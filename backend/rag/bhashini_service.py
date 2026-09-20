"""Digital India Bhashini (National Language Translation Mission) AI Services Integration.

Provides high-quality neural machine translation (NMT) and text-to-speech (TTS)
for Indian languages via Government of India Bhashini / Dhruva API.
"""

from __future__ import annotations

import os
import time
import base64
from typing import Any, Optional
import httpx
from dotenv import load_dotenv
from pathlib import Path

# Ensure environment variables are loaded
load_dotenv()
for path in [
    Path(__file__).resolve().parent.parent / ".env",
    Path(__file__).resolve().parent.parent.parent / ".env",
    Path(__file__).resolve().parent.parent.parent / "frontend" / ".env.local",
]:
    if path.exists():
        load_dotenv(path)

BHASHINI_USER_ID = os.getenv("BHASHINI_USER_ID", "")
BHASHINI_API_KEY = os.getenv("BHASHINI_API_KEY", "")
BHASHINI_INFERENCE_KEY = os.getenv("BHASHINI_INFERENCE_KEY", "")
BHASHINI_PIPELINE_ID = os.getenv("BHASHINI_PIPELINE_ID", "64392f96daac500b55c543cd")

CONFIG_ENDPOINT = "https://meity-auth.ulcacontrib.org/ulca/apis/v0/model/getModelsPipeline"
DEFAULT_INFERENCE_ENDPOINT = "https://dhruva-api.bhashini.gov.in/services/inference/pipeline"

# In-memory pipeline cache: (task_type, source_lang, target_lang) -> (service_id, endpoint, auth_key)
_PIPELINE_CACHE: dict[str, dict[str, Any]] = {}
_LAST_CONFIG_FETCH = 0
CONFIG_CACHE_TTL = 3600  # 1 hour


def is_bhashini_configured() -> bool:
    """Check whether Bhashini credentials are present."""
    return bool(BHASHINI_USER_ID and (BHASHINI_API_KEY or BHASHINI_INFERENCE_KEY))


def get_pipeline_config(task_type: str, source_lang: str = "hi", target_lang: Optional[str] = None) -> Optional[dict[str, Any]]:
    """Retrieve service ID and inference endpoint for a task, with local in-memory caching."""
    global _PIPELINE_CACHE, _LAST_CONFIG_FETCH

    cache_key = f"{task_type}:{source_lang}:{target_lang or ''}"
    now = time.time()
    if cache_key in _PIPELINE_CACHE and (now - _LAST_CONFIG_FETCH) < CONFIG_CACHE_TTL:
        return _PIPELINE_CACHE[cache_key]

    if not BHASHINI_USER_ID or not BHASHINI_API_KEY:
        # If config credentials are not present, return static default config
        return {
            "service_id": "ai4bharat/indictrans-v2-all-gpu--t4" if task_type == "translation" else "ai4bharat/indic-tts-coqui-indo_aryan-gpu--t4",
            "endpoint": DEFAULT_INFERENCE_ENDPOINT,
            "auth_key": BHASHINI_INFERENCE_KEY,
        }

    headers = {
        "userID": BHASHINI_USER_ID,
        "ulcaApiKey": BHASHINI_API_KEY,
        "Content-Type": "application/json",
    }

    task_config: dict[str, Any] = {"taskType": task_type}
    lang_config: dict[str, str] = {"sourceLanguage": source_lang}
    if target_lang:
        lang_config["targetLanguage"] = target_lang
    task_config["config"] = {"language": lang_config}

    payload = {
        "pipelineTasks": [task_config],
        "pipelineRequestConfig": {"pipelineId": BHASHINI_PIPELINE_ID},
    }

    try:
        with httpx.Client(timeout=10.0) as client:
            resp = client.post(CONFIG_ENDPOINT, headers=headers, json=payload)
            if resp.status_code == 200:
                data = resp.json()
                inference_endpoint = (
                    data.get("pipelineInferenceAPIEndPoint", {}).get("callbackUrl")
                    or DEFAULT_INFERENCE_ENDPOINT
                )
                auth_key = (
                    data.get("pipelineInferenceAPIEndPoint", {})
                    .get("inferenceApiKey", {})
                    .get("value")
                    or BHASHINI_INFERENCE_KEY
                )

                configs = data.get("pipelineResponseConfig", [])
                for c in configs:
                    if c.get("taskType") == task_type:
                        for item in c.get("config", []):
                            service_id = item.get("serviceId")
                            res = {
                                "service_id": service_id,
                                "endpoint": inference_endpoint,
                                "auth_key": auth_key,
                            }
                            _PIPELINE_CACHE[cache_key] = res
                            _LAST_CONFIG_FETCH = now
                            return res

    except Exception as exc:
        print(f"[Bhashini] Config discovery warning: {exc}. Using fallback defaults.")

    # Fallback to sensible defaults
    fallback = {
        "service_id": "ai4bharat/indictrans-v2-all-gpu--t4" if task_type == "translation" else "ai4bharat/indic-tts-coqui-indo_aryan-gpu--t4",
        "endpoint": DEFAULT_INFERENCE_ENDPOINT,
        "auth_key": BHASHINI_INFERENCE_KEY,
    }
    _PIPELINE_CACHE[cache_key] = fallback
    return fallback


def translate_bhashini(text: str, source_lang: str = "hi", target_lang: str = "en", timeout: float = 12.0) -> Optional[str]:
    """Translate text between Indic languages and English using Bhashini IndicTrans-v2.
    
    Returns the translated string, or None if Bhashini call fails.
    """
    if not text or not text.strip() or source_lang == target_lang:
        return text

    if not is_bhashini_configured():
        return None

    config = get_pipeline_config("translation", source_lang=source_lang, target_lang=target_lang)
    if not config:
        return None

    service_id = config["service_id"] or "ai4bharat/indictrans-v2-all-gpu--t4"
    endpoint = config["endpoint"] or DEFAULT_INFERENCE_ENDPOINT
    auth_key = config["auth_key"] or BHASHINI_INFERENCE_KEY

    headers = {
        "Authorization": auth_key,
        "Content-Type": "application/json",
    }

    payload = {
        "pipelineTasks": [
            {
                "taskType": "translation",
                "config": {
                    "language": {
                        "sourceLanguage": source_lang,
                        "targetLanguage": target_lang,
                    },
                    "serviceId": service_id,
                },
            }
        ],
        "inputData": {
            "input": [{"source": text}]
        },
    }

    try:
        with httpx.Client(timeout=timeout) as client:
            resp = client.post(endpoint, headers=headers, json=payload)
            if resp.status_code == 200:
                data = resp.json()
                pipeline_resp = data.get("pipelineResponse", [])
                if pipeline_resp:
                    output = pipeline_resp[0].get("output", [])
                    if output and "target" in output[0]:
                        return output[0]["target"]
            else:
                print(f"[Bhashini] NMT failed with status {resp.status_code}: {resp.text[:200]}")
    except Exception as exc:
        print(f"[Bhashini] NMT request error ({source_lang}->{target_lang}): {exc}")

    return None


def synthesize_speech_bhashini(text: str, language: str = "hi", gender: str = "female", timeout: float = 20.0) -> Optional[str]:
    """Generate audio speech (base64 WAV string) from text using Bhashini Indic-TTS.
    
    Returns the base64 audio content string, or None if synthesis fails.
    """
    if not text or not text.strip():
        return None

    if not is_bhashini_configured():
        return None

    config = get_pipeline_config("tts", source_lang=language)
    if not config:
        return None

    service_id = config["service_id"] or "ai4bharat/indic-tts-coqui-indo_aryan-gpu--t4"
    endpoint = config["endpoint"] or DEFAULT_INFERENCE_ENDPOINT
    auth_key = config["auth_key"] or BHASHINI_INFERENCE_KEY

    # Clean text to keep synthesis natural and avoid markdown noise
    clean_text = text.replace("#", "").replace("*", "").replace("`", "").strip()
    if len(clean_text) > 400:
        # Truncate long legal texts to first 400 chars for responsive audio playback
        clean_text = clean_text[:400] + "..."

    headers = {
        "Authorization": auth_key,
        "Content-Type": "application/json",
    }

    payload = {
        "pipelineTasks": [
            {
                "taskType": "tts",
                "config": {
                    "language": {
                        "sourceLanguage": language,
                    },
                    "serviceId": service_id,
                    "gender": gender,
                },
            }
        ],
        "inputData": {
            "input": [{"source": clean_text}]
        },
    }

    try:
        with httpx.Client(timeout=timeout) as client:
            resp = client.post(endpoint, headers=headers, json=payload)
            if resp.status_code == 200:
                data = resp.json()
                pipeline_resp = data.get("pipelineResponse", [])
                if pipeline_resp:
                    audio_list = pipeline_resp[0].get("audio", [])
                    if audio_list and "audioContent" in audio_list[0]:
                        return audio_list[0]["audioContent"]
            else:
                print(f"[Bhashini] TTS failed with status {resp.status_code}: {resp.text[:200]}")
    except Exception as exc:
        print(f"[Bhashini] TTS request error ({language}): {exc}")

    return None
