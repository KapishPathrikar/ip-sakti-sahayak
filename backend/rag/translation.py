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


def detect_language(text: str) -> str:
    """Detect if the query is English ('en'), Hindi ('hi'), Marathi ('mr'), Hinglish ('hinglish'), or Marathish ('marathish')."""
    lower_text = text.lower()
    words = set(re.findall(r"\b\w+\b", lower_text))

    # 1. Devnagari Script Check (Hindi vs Marathi)
    if any("\u0900" <= char <= "\u097f" for char in text):
        # Check for characteristic Marathi words
        if any(marker in text for marker in MARATHI_DEVNAGARI_MARKERS):
            return "mr"
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



def translate_text(text: str, target_lang: str = "en", source_lang: str = "auto") -> str:
    """Translate text between languages using deep-translator with error string sanitization."""
    if not text or not text.strip() or target_lang == source_lang:
        return text
    try:
        if source_lang == "en" and target_lang == "en":
            return text
        translator = GoogleTranslator(source=source_lang, target=target_lang)
        result = translator.translate(text)
        if not result or "Error 500" in result or "That's an error" in result or "That’s an error" in result or "Server Error" in result:
            return text
        return result
    except Exception as err:
        print(f"[Warning] Translation error ({source_lang} -> {target_lang}): {err}")
        return text
