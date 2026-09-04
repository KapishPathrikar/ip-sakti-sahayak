import unittest
from fastapi.testclient import TestClient
from backend.main import app


class TestBackendAPI(unittest.TestCase):
    def setUp(self):
        from backend.database import init_db
        init_db()
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
        import uuid
        test_session_id = f"test-session-{uuid.uuid4().hex[:6]}"

        # 1. Start a chat session (off-topic query to respond immediately without heavy inference)
        response = self.client.post("/api/chat", json={"query": "Tell me a cake recipe", "session_id": test_session_id})
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["session_id"], test_session_id)
        self.assertFalse(data["grounded"])

        # 2. Get history
        hist_resp = self.client.get(f"/api/chat/history/{test_session_id}")
        self.assertEqual(hist_resp.status_code, 200)
        hist_data = hist_resp.json()
        self.assertEqual(len(hist_data["history"]), 2)  # 1 user + 1 assistant message
        self.assertEqual(hist_data["history"][0]["role"], "user")
        self.assertEqual(hist_data["history"][1]["role"], "assistant")

        # 3. List sessions
        sessions_resp = self.client.get("/api/chat/sessions")
        self.assertEqual(sessions_resp.status_code, 200)
        self.assertIn(test_session_id, sessions_resp.json()["sessions"])

        # 4. Clear history
        del_resp = self.client.delete(f"/api/chat/history/{test_session_id}")
        self.assertEqual(del_resp.status_code, 200)
        self.assertTrue(del_resp.json()["cleared"])

        # Verify it's empty
        empty_hist = self.client.get(f"/api/chat/history/{test_session_id}").json()
        self.assertEqual(len(empty_hist["history"]), 0)

    def test_chat_stream_endpoint(self):
        import uuid
        test_stream_id = f"stream-session-{uuid.uuid4().hex[:6]}"
        response = self.client.post("/api/chat/stream", json={"query": "Tell me a cake recipe", "session_id": test_stream_id})
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

    def test_rate_limiting_and_faq_exemption(self):
        from backend.rag.rate_limiter import rate_limiter
        rate_limiter.reset_client("testclient")

        # 1. Fire 5 non-FAQ requests (allowed up to burst limit)
        for i in range(5):
            resp = self.client.post("/api/chat", json={"query": "Tell me a cake recipe", "session_id": f"burst-{i}"})
            self.assertEqual(resp.status_code, 200)

        # 2. 6th request should hit 429 Too Many Requests (burst limit)
        resp_blocked = self.client.post("/api/chat", json={"query": "Tell me a cake recipe", "session_id": "burst-6"})
        self.assertEqual(resp_blocked.status_code, 429)
        self.assertIn("Burst limit exceeded", resp_blocked.json()["detail"]["message"])

        # 3. An authoritative FAQ query should be EXEMPT and succeed even when burst limit is hit!
        faq_resp = self.client.post("/api/chat", json={"query": "Can an Ayurvedic formulation be patented?", "session_id": "faq-exempt-test"})
        self.assertEqual(faq_resp.status_code, 200)
        self.assertTrue(faq_resp.json()["grounded"])

        # Clean up
        rate_limiter.reset_client("testclient")

    def test_unsigned_and_signed_daily_rate_limits(self):
        import time
        import uuid
        from backend.rag.rate_limiter import rate_limiter

        # 1. Unsigned / Anonymous user: strictly 25 queries per day
        anon_ip = f"198.51.100.{uuid.uuid4().int % 250 + 1}"
        rate_limiter.reset_client(anon_ip)
        now = time.time()
        # Seed 25 prior queries spaced out today
        rate_limiter._requests[anon_ip] = [now - 3600 + i * 10 for i in range(25)]

        # 26th request for unsigned user must fail with daily quota exceeded
        resp_anon = self.client.post(
            "/api/chat",
            json={"query": "Tell me a cake recipe", "session_id": "anon-daily-test"},
            headers={"X-Forwarded-For": anon_ip},
        )
        self.assertEqual(resp_anon.status_code, 429)
        self.assertIn("Daily limit reached (25 queries / day)", resp_anon.json()["detail"]["message"])

        # 2. Signed-in user: strictly 50 queries per day
        test_email = f"rate_limit_{uuid.uuid4().hex[:6]}@shakti.law"
        reg_resp = self.client.post("/api/auth/register", json={
            "email": test_email,
            "password": "SecurePassword123!",
            "full_name": "Quota Tester"
        })
        self.assertEqual(reg_resp.status_code, 201)
        token = reg_resp.json()["access_token"]
        user_id = reg_resp.json()["user"]["id"]
        client_id = f"user_{user_id}"

        # Seed 49 prior queries spaced out today
        rate_limiter.reset_client(client_id)
        rate_limiter._requests[client_id] = [now - 3600 + i * 10 for i in range(49)]

        # 50th request should succeed
        resp_50 = self.client.post(
            "/api/chat",
            json={"query": "Tell me a cake recipe", "session_id": "user-daily-50"},
            headers={"Authorization": f"Bearer {token}"},
        )
        self.assertEqual(resp_50.status_code, 200)

        # 51st request must hit the 50 queries / day limit
        resp_51 = self.client.post(
            "/api/chat",
            json={"query": "Tell me a cake recipe", "session_id": "user-daily-51"},
            headers={"Authorization": f"Bearer {token}"},
        )
        self.assertEqual(resp_51.status_code, 429)
        self.assertIn("Daily limit reached (50 queries / day)", resp_51.json()["detail"]["message"])

        # Clean up
        rate_limiter.reset_client(anon_ip)
        rate_limiter.reset_client(client_id)


    def test_auth_registration_and_login(self):
        import uuid
        test_email = f"testuser_{uuid.uuid4().hex[:6]}@shakti.law"
        test_pass = "SecurePass123!"

        # 1. Register new user
        reg_resp = self.client.post("/api/auth/register", json={
            "email": test_email,
            "password": test_pass,
            "full_name": "Ayurveda Practitioner"
        })
        self.assertEqual(reg_resp.status_code, 201)
        reg_data = reg_resp.json()
        self.assertIn("access_token", reg_data)
        self.assertEqual(reg_data["user"]["email"], test_email)
        self.assertEqual(reg_data["user"]["daily_query_limit"], 50)
        token = reg_data["access_token"]

        # 2. Test /api/auth/me with Bearer token
        me_resp = self.client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
        self.assertEqual(me_resp.status_code, 200)
        self.assertEqual(me_resp.json()["email"], test_email)

        # 3. Login with credentials
        login_resp = self.client.post("/api/auth/login", json={
            "email": test_email,
            "password": test_pass
        })
        self.assertEqual(login_resp.status_code, 200)
        self.assertIn("access_token", login_resp.json())

    def test_user_sessions_and_feedback(self):
        import uuid
        test_email = f"doctor_{uuid.uuid4().hex[:6]}@ayush.org"
        reg_resp = self.client.post("/api/auth/register", json={
            "email": test_email,
            "password": "Password789!",
            "full_name": "Dr. Sharma"
        })
        token = reg_resp.json()["access_token"]
        session_id = f"doc-session-{uuid.uuid4().hex[:6]}"

        # 1. Send chat message authenticated
        chat_resp = self.client.post(
            "/api/chat",
            json={"query": "Tell me a cake recipe", "session_id": session_id},
            headers={"Authorization": f"Bearer {token}"}
        )
        self.assertEqual(chat_resp.status_code, 200)

        # 2. Get my saved sessions
        my_sess_resp = self.client.get("/api/chat/my-sessions", headers={"Authorization": f"Bearer {token}"})
        self.assertEqual(my_sess_resp.status_code, 200)
        sessions_list = my_sess_resp.json()
        self.assertGreaterEqual(len(sessions_list), 1)

        # 3. Submit feedback
        fb_resp = self.client.post(
            "/api/feedback",
            json={"message_id": 1, "rating": 1, "comment": "Very helpful legal clarification"},
            headers={"Authorization": f"Bearer {token}"}
        )
        self.assertEqual(fb_resp.status_code, 200)
        self.assertEqual(fb_resp.json()["status"], "success")

    def test_fee_calculator_endpoint(self):
        # 1. Patent fee calculation for Individual (Online e-filing)
        payload = {
            "ip_type": "patent",
            "applicant_type": "natural_person",
            "filing_mode": "online",
            "pages_count": 35,  # 5 extra pages
            "claims_count": 12,  # 2 extra claims
            "include_early_publication": True,
            "request_examination": "standard"
        }
        resp = self.client.post("/api/tools/fee-calculator", json=payload)
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["ip_type"], "Patent")
        self.assertIn("80% Statutory Subsidy", data["rebate_applied"])
        self.assertGreater(data["total_fee_inr"], 5000)
        self.assertGreaterEqual(len(data["applicable_forms"]), 3)

        # 2. Trademark fee calculation
        tm_payload = {
            "ip_type": "trademark",
            "applicant_type": "startup",
            "trademark_classes_count": 2
        }
        tm_resp = self.client.post("/api/tools/fee-calculator", json=tm_payload)
        self.assertEqual(tm_resp.status_code, 200)
        self.assertEqual(tm_resp.json()["total_fee_inr"], 9000.0)  # 2 classes @ 4500

        # 3. Design fee calculation (Startup 80% subsidy vs Large Entity)
        design_payload = {
            "ip_type": "design",
            "applicant_type": "startup"
        }
        d_resp = self.client.post("/api/tools/fee-calculator", json=design_payload)
        self.assertEqual(d_resp.status_code, 200)
        self.assertEqual(d_resp.json()["total_fee_inr"], 1000.0)
        self.assertEqual(d_resp.json()["applicable_forms"][0], "Form 1 (Application for Registration of Design)")

        design_corp_payload = {
            "ip_type": "design",
            "applicant_type": "large_entity"
        }
        d_corp_resp = self.client.post("/api/tools/fee-calculator", json=design_corp_payload)
        self.assertEqual(d_corp_resp.status_code, 200)
        self.assertEqual(d_corp_resp.json()["total_fee_inr"], 4000.0)

    def test_patentability_wizard_endpoint(self):
        # High risk: Ayurvedic combination without synergistic data
        payload = {
            "title": "Herbal Antidiabetic Formulation",
            "description": "Combination of Ashwagandha, Neem, and Turmeric extracts for lowering blood sugar.",
            "is_ayurvedic_or_herbal": True,
            "is_combination_of_known_herbs_or_drugs": True,
            "has_synergistic_efficacy_data": False,
            "uses_indian_biological_resources": True
        }
        resp = self.client.post("/api/tools/patentability-check", json=payload)
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertLess(data["patentability_score"], 70)
        self.assertIn("Section 3(p)", data["statutory_hurdles"][0]["section"])
        self.assertIn("National Biodiversity Authority", data["required_clearances"][0])

    def test_pdf_export_endpoint(self):
        import uuid
        test_session_id = f"export-sess-{uuid.uuid4().hex[:6]}"

        # Start a chat to populate history
        self.client.post("/api/chat", json={
            "query": "Can an Ayurvedic formulation be patented?",
            "session_id": test_session_id
        })

        # Export to PDF
        export_resp = self.client.get(f"/api/chat/export/{test_session_id}")
        self.assertEqual(export_resp.status_code, 200)
        self.assertEqual(export_resp.headers.get("content-type"), "application/pdf")
        self.assertTrue(export_resp.content.startswith(b"%PDF-"))







