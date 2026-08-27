import unittest
from fastapi.testclient import TestClient
from backend.main import app


class TestBackendAPI(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)

    def test_health_check(self):
        response = self.client.get("/health")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["status"], "ok")
        self.assertEqual(data["service"], "ip-shakti-sahayak")

    def test_retrieve_endpoint(self):
        response = self.client.post("/api/retrieve", json={"query": "Patent filing", "limit": 2})
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("chunks", data)
        self.assertLessEqual(len(data["chunks"]), 2)

    def test_chat_session_history_management(self):
        # 1. Start a chat session (off-topic query to respond immediately without heavy inference)
        response = self.client.post("/api/chat", json={"query": "Tell me a cake recipe", "session_id": "test-session-123"})
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["session_id"], "test-session-123")
        self.assertFalse(data["grounded"])

        # 2. Get history
        hist_resp = self.client.get("/api/chat/history/test-session-123")
        self.assertEqual(hist_resp.status_code, 200)
        hist_data = hist_resp.json()
        self.assertEqual(len(hist_data["history"]), 2)  # 1 user + 1 assistant message
        self.assertEqual(hist_data["history"][0]["role"], "user")
        self.assertEqual(hist_data["history"][1]["role"], "assistant")

        # 3. List sessions
        sessions_resp = self.client.get("/api/chat/sessions")
        self.assertEqual(sessions_resp.status_code, 200)
        self.assertIn("test-session-123", sessions_resp.json()["sessions"])

        # 4. Clear history
        del_resp = self.client.delete("/api/chat/history/test-session-123")
        self.assertEqual(del_resp.status_code, 200)
        self.assertTrue(del_resp.json()["cleared"])

        # Verify it's empty
        empty_hist = self.client.get("/api/chat/history/test-session-123").json()
        self.assertEqual(len(empty_hist["history"]), 0)

    def test_chat_stream_endpoint(self):
        response = self.client.post("/api/chat/stream", json={"query": "Tell me a cake recipe", "session_id": "stream-session-1"})
        self.assertEqual(response.status_code, 200)
        self.assertIn("text/event-stream", response.headers.get("content-type", ""))
        content = response.text
        self.assertIn("data:", content)

    def test_faqs_endpoints(self):
        # 1. List all FAQs
        response = self.client.get("/api/faqs")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["count"], 25)
        self.assertEqual(len(data["faqs"]), 25)

        # 2. Get specific FAQ
        faq3_resp = self.client.get("/api/faqs/FAQ-003")
        self.assertEqual(faq3_resp.status_code, 200)
        faq3_data = faq3_resp.json()
        self.assertEqual(faq3_data["id"], "FAQ-003")
        self.assertEqual(faq3_data["category"], "Patents")
        self.assertFalse(faq3_data["requires_rag"])

        # 3. Test direct FAQ cache hit via /api/chat
        chat_resp = self.client.post("/api/chat", json={"query": "Can an Ayurvedic formulation be patented?", "session_id": "faq-chat-test"})
        self.assertEqual(chat_resp.status_code, 200)
        chat_data = chat_resp.json()
        self.assertTrue(chat_data["grounded"])
        self.assertIn("Synergism", chat_data["answer"])




