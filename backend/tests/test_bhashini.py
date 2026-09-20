"""Test suite for Digital India Bhashini integration and TTS/Translation endpoints."""

import os
from fastapi.testclient import TestClient
from backend.main import app
from backend.rag.bhashini_service import is_bhashini_configured, translate_bhashini, synthesize_speech_bhashini
from backend.rag.translation import translate_text, detect_language


def test_bhashini_configuration():
    assert is_bhashini_configured() is True, "Bhashini credentials should be loaded and valid"


def test_bhashini_status_endpoint():
    client = TestClient(app)
    response = client.get("/api/bhashini/status")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "active"
    assert data["configured"] is True
    assert "translation" in data["services"]
    assert "tts" in data["services"]


def test_bhashini_translate_endpoint():
    client = TestClient(app)
    payload = {
        "text": "पेटेंट कैसे दर्ज करें?",
        "source_language": "hi",
        "target_language": "en"
    }
    response = client.post("/api/bhashini/translate", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "patent" in data["translated_text"].lower()


def test_translation_utility_with_bhashini():
    # Marathi to English
    mr_text = "मला पेटेंट अर्ज करायचा आहे"
    en_res = translate_text(mr_text, target_lang="en", source_lang="mr")
    assert "patent" in en_res.lower()

    # English to Hindi
    en_text = "Patent infringement in India"
    hi_res = translate_text(en_text, target_lang="hi", source_lang="en")
    assert len(hi_res) > 0


def test_bhashini_tts_endpoint():
    client = TestClient(app)
    payload = {
        "text": "आईपी शक्ति सहायक में आपका स्वागत है।",
        "language": "hi",
        "gender": "female"
    }
    response = client.post("/api/bhashini/tts", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "audio_base64" in data
    assert len(data["audio_base64"]) > 1000
    assert data["mime_type"] == "audio/wav"


if __name__ == "__main__":
    print("Running Bhashini tests...")
    test_bhashini_configuration()
    print("✓ Configuration check passed")
    test_bhashini_status_endpoint()
    print("✓ Status endpoint passed")
    test_bhashini_translate_endpoint()
    print("✓ Translate endpoint passed")
    test_translation_utility_with_bhashini()
    print("✓ Translation utility passed")
    test_bhashini_tts_endpoint()
    print("✓ TTS speech synthesis passed")
    print("ALL BHASHINI INTEGRATION TESTS PASSED SUCCESSFULLY!")
