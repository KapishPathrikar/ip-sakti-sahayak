"""Language translation utilities for multilingual RAG support."""

from __future__ import annotations
import re
from deep_translator import GoogleTranslator



MARATHI_DEVNAGARI_MARKERS = {
    "आहे", "नाही", "कसे", "करावे", "मिळेल", "मिळवायचे", "माहिती", "नियम",
    "औषध", "नोंदणी", "हक्क", "करणे", "झाले", "होते", "असेल", "प्रक्रिया",
    "अर्ज", "काय", "कोणते", "कधी", "कुठे", "यांचे", "साठी", "मध्ये", "झाला"
}

MARATHISH_LATIN_MARKERS = {
    "kase", "kasa", "kahi", "aushadh", "milto", "milnar", "aahe", "nahi",
    "kiti", "kadhi", "kay", "ahe", "karayche", "mahiti", "sathi", "madhye", "karave"
}

SANSKRIT_MARKERS = {
    "अस्ति", "भवति", "इति", "कथम्", "किम्", "कुत्र", "तत्र", "यत्र", "च", "तत्", "तथा", "यथा"
}

def detect_language(text: str) -> str:
    """Detect if the query is English ('en'), Hindi ('hi'), Marathi ('mr'), Tamil ('ta'), Telugu ('te'), Sanskrit ('sa'), Hinglish ('hinglish'), or Marathish ('marathish')."""
    lower_text = text.lower()
    words = set(re.findall(r"\b\w+\b", lower_text))

    # Tamil Script Check
    if any("\u0B80" <= char <= "\u0BFF" for char in text):
        return "ta"
        
    # Telugu Script Check
    if any("\u0C00" <= char <= "\u0C7F" for char in text):
        return "te"

    # Devnagari Script Check (Hindi vs Marathi vs Sanskrit)
    if any("\u0900" <= char <= "\u097f" for char in text):
        # Check for characteristic Marathi words
        if any(marker in text for marker in MARATHI_DEVNAGARI_MARKERS):
            return "mr"
        # Check for characteristic Sanskrit words
        if any(marker in text for marker in SANSKRIT_MARKERS):
            return "sa"
        return "hi"

    # 2. Latin script Marathi (Marathish) check
    if any(marker in words for marker in MARATHISH_LATIN_MARKERS):
        return "marathish"

    # 3. Hinglish / Translation Check
    try:
        translated = GoogleTranslator(source="auto", target="en").translate(text)
        if translated.lower().strip() != text.lower().strip():
            return "hinglish"
    except Exception:
        pass

    return "en"



try:
    from .bhashini_service import translate_bhashini, is_bhashini_configured, synthesize_speech_bhashini
except ImportError:
    from bhashini_service import translate_bhashini, is_bhashini_configured, synthesize_speech_bhashini

INDIC_LANG_CODES = {"hi", "mr", "ta", "te", "bn", "gu", "kn", "ml", "or", "pa", "ur", "sa", "as"}


def translate_text(text: str, target_lang: str = "en", source_lang: str = "auto") -> str:
    """Translate text between languages using Bhashini IndicTrans-v2 with deep-translator fallback."""
    if not text or not text.strip() or target_lang == source_lang:
        return text

    # Resolve 'auto' source language if needed
    resolved_source = source_lang
    if resolved_source == "auto":
        detected = detect_language(text)
        if detected in INDIC_LANG_CODES or detected == "en":
            resolved_source = detected

    # 1. Attempt Bhashini NMT if one side is an Indic language and the other is English or Indic
    if (resolved_source in INDIC_LANG_CODES or target_lang in INDIC_LANG_CODES) and resolved_source != target_lang:
        try:
            bhashini_res = translate_bhashini(text, source_lang=resolved_source, target_lang=target_lang)
            if bhashini_res and bhashini_res.strip():
                return bhashini_res
        except Exception as bhashini_err:
            print(f"[Bhashini NMT Fallback] {bhashini_err}")

    # 2. Fallback to deep-translator
    try:
        if resolved_source == "en" and target_lang == "en":
            return text
        translator = GoogleTranslator(source=resolved_source if resolved_source != "auto" else "auto", target=target_lang)
        result = translator.translate(text)
        if not result or "Error 500" in result or "That's an error" in result or "That’s an error" in result or "Server Error" in result:
            return text
        return result
    except Exception as err:
        print(f"[Warning] Translation error ({source_lang} -> {target_lang}): {err}")
        return text

