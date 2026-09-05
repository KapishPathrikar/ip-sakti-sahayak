"""Alternative LLM provider using free cloud APIs for testing without Ollama."""

from __future__ import annotations

import os
from pathlib import Path
from typing import Generator
from google import genai
from google.genai import types
from dotenv import load_dotenv

# Load environment variables from various possible paths
load_dotenv()
for path in [
    Path(__file__).resolve().parent.parent / ".env",
    Path(__file__).resolve().parent.parent.parent / ".env",
    Path(__file__).resolve().parent.parent.parent / "frontend" / ".env.local",
]:
    if path.exists():
        load_dotenv(path)

# Setup Gemini Fallback Configuration
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")

if not GEMINI_API_KEY:
    print("[Warning] GEMINI_API_KEY not found in environment. Cloud fallback will fail if triggered.")

# Default Gemini model with fallback
DEFAULT_CLOUD_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")

def _normalize_model_name(model: str) -> str:
    """Ensure a valid, recognized Gemini model ID is used."""
    if not model or model == "gemini-3.5-flash-lite":
        return os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
    return model


def _call_cloud_llm(prompt: str, model: str = DEFAULT_CLOUD_MODEL) -> str | None:
    """Call Gemini Cloud API as a fallback when Ollama is down."""
    model = _normalize_model_name(model)
    if not GEMINI_API_KEY:
        print("[Cloud LLM] No GEMINI_API_KEY configured. Returning fallback mock response.")
        return _get_mock_response(prompt)

    try:
        client = genai.Client(api_key=GEMINI_API_KEY)
        system_instruction = "You are a helpful legal assistant specializing in Indian Intellectual Property law. Provide accurate, cited answers based on the provided context."
        
        # Combine system instruction and prompt since basic generate_content is easiest this way
        full_prompt = f"{system_instruction}\n\n{prompt}"
        
        response = client.models.generate_content(
            model=model,
            contents=full_prompt,
            config=types.GenerateContentConfig(
                temperature=0.1,
                max_output_tokens=1000,
            )
        )
        return response.text.strip()

    except Exception as err:
        print(f"[Cloud LLM Error] Failed to call Gemini LLM: {err}")
        return _get_mock_response(prompt)


def _stream_cloud_llm(prompt: str, model: str = DEFAULT_CLOUD_MODEL) -> Generator[str, None, None]:
    """Stream token strings from Gemini Cloud API as a fallback."""
    model = _normalize_model_name(model)
    if not GEMINI_API_KEY:
        print("[Cloud LLM] No GEMINI_API_KEY for streaming. Using grounded fallback.")
        mock = _get_mock_response(prompt)
        for word in mock.split(" "):
            yield word + " "
        return

    try:
        client = genai.Client(api_key=GEMINI_API_KEY)
        system_instruction = "You are a helpful legal assistant for Indian IP law."
        full_prompt = f"{system_instruction}\n\n{prompt}"
        
        response = client.models.generate_content_stream(
            model=model,
            contents=full_prompt,
            config=types.GenerateContentConfig(
                temperature=0.1,
                max_output_tokens=1000,
            )
        )

        for chunk in response:
            if chunk.text:
                yield chunk.text

    except Exception as err:
        print(f"[Cloud LLM Stream Error] {err}")
        mock = _get_mock_response(prompt)
        for word in mock.split(" "):
            yield word + " "


def _get_mock_response(prompt: str) -> str:
    """Fallback response when no LLM (Ollama or Cloud) is active."""
    ip_keywords = ["patent", "trademark", "copyright", "ip", "intellectual property", "ayush", "ayurveda", "tkdl"]
    if any(k in prompt.lower() for k in ip_keywords):
        return (
            "Based on Indian Intellectual Property law:\n\n"
            "1. **Patents:** Governed by the Indian Patents Act, 1970 (20-year term from filing).\n"
            "2. **Traditional Knowledge & Ayurveda:** Inventions based on traditional formulations must satisfy Section 3(p) and demonstrate synergistic efficacy under Section 3(e).\n"
            "3. **Biodiversity Approvals:** Foreign or commercial use of Indian biological resources requires NBA approval under Section 6 of the Biological Diversity Act, 2002.\n\n"
            "Please consult an official patent attorney or verify with IP India guidelines."
        )
    return "I provide guidance on Indian Intellectual Property laws (Patents, Trademarks, Copyrights, Ayush TKDL). Please ask an IP law question."