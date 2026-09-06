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
DEFAULT_CLOUD_MODEL = os.getenv("GEMINI_MODEL", "gemini-1.5-flash")

def _normalize_model_name(model: str) -> str:
    """Ensure a valid, recognized Gemini model ID is used."""
    if not model or model in ("gemini-3.5-flash-lite", "gemini-2.5-flash"):
        return os.getenv("GEMINI_MODEL", "gemini-1.5-flash")
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
    p_lower = prompt.lower()
    
    is_comparative = (
        "comparative" in p_lower 
        or "compare" in p_lower 
        or "vs" in p_lower 
        or "versus" in p_lower 
        or "dual" in p_lower
        or ("india" in p_lower and ("pct" in p_lower or "fda" in p_lower or "wipo" in p_lower or "international" in p_lower or "us" in p_lower or "abroad" in p_lower))
        or "### 🇮🇳" in prompt
    )
    
    if is_comparative:
        return (
            "### 🇮🇳 Indian Domestic Regime (Patents Act & TKDL)\n"
            "Under Indian patent jurisprudence, patent protection is strictly governed by the Indian Patents Act, 1970:\n\n"
            "1. **Statutory Term & Prior Art:** 20-year term from the filing date. InPASS database and Traditional Knowledge Digital Library (TKDL) are scrutinized during examination.\n"
            "2. **Section 3(p) Traditional Knowledge Bar:** Formulations that are traditional knowledge or aggregations of known properties of Ayurvedic, Siddha, or Unani herbs cannot be patented.\n"
            "3. **Section 3(e) Synergistic Efficacy:** To overcome Section 3(e) prior art exclusions, the applicant must demonstrate statistically validated synergistic therapeutic enhancement beyond mere additive effects.\n"
            "4. **National Biodiversity Authority (NBA) Mandate:** Under Section 6 of the Biological Diversity Act, 2002, prior Form III approval from the NBA is mandatory before patent grant if Indian biological resources are utilized.\n\n"
            "### 🌐 International Regime & Export Guidelines (PCT, WIPO & Regulators)\n"
            "For cross-border commercialization and international patent rights across export markets:\n\n"
            "1. **Patent Cooperation Treaty (PCT):** Indian inventors file a PCT international application through WIPO or the Indian Patent Office (RO/IN) within 12 months of domestic priority. This secures a 30 to 31-month timeline before entering National Phase filings in 157+ member countries.\n"
            "2. **US FDA Regulatory Pathways:** The FDA regulates market entry, not patentability. Ayurvedic formulations entering the US typically qualify as **Dietary Supplements** under DSHEA 1994 (no pre-market drug trial approval needed for structure/function claims), or as **Botanical Drugs** requiring Phase I–III IND clinical trials for disease treatment claims.\n"
            "3. **European Medicines Agency (EMA):** Governed by the Traditional Herbal Medicinal Products Directive (Directive 2004/24/EC). Simplified registration requires bibliographic proof of at least 30 years of traditional medicinal use (with at least 15 years within the EU).\n\n"
            "### ⚖️ Strategic Synthesis & Action Plan\n"
            "1. **Filing Sequence:** Always file Form 1 & Form 2 in India first, obtain Section 39 foreign filing permission (or wait 6 weeks), and subsequently initiate PCT International Phase.\n"
            "2. **Claims Architecture:** Structure product-by-process or synergistic dosage extraction claims to satisfy both Indian Section 3(d)/(e) thresholds and US utility standards.\n"
            "3. **Dual Regulatory Pathway:** For exports to the US/EU, launch under dietary supplement/THMPD frameworks while parallel patent claims mature via the PCT National Phase."
        )

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