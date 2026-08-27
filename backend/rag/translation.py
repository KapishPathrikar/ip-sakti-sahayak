"""Language translation utilities for multilingual RAG support."""

from __future__ import annotations
from deep_translator import GoogleTranslator


def detect_language(text: str) -> str:
    """Detect if the query is English, Hindi (Devnagari), or Hinglish."""
    # First check: If it has Devnagari characters, it's Devnagari Hindi
    if any("\u0900" <= char <= "\u097f" for char in text):
        return "hi"

    # Second check: Translate to English and see if the text changes
    try:
        translated = GoogleTranslator(source="auto", target="en").translate(text)
        # If the text changes significantly and has no Devnagari, it's Hinglish
        if translated.lower().strip() != text.lower().strip():
            return "hinglish"
    except Exception:
        pass

    return "en"


def translate_text(text: str, target_lang: str = "en", source_lang: str = "auto") -> str:
    """Translate text between languages using deep-translator."""
    if not text or not text.strip() or target_lang == source_lang:
        return text
    try:
        if source_lang == "en" and target_lang == "en":
            return text
        translator = GoogleTranslator(source=source_lang, target=target_lang)
        return translator.translate(text)
    except Exception as err:
        print(f"[Warning] Translation error ({source_lang} -> {target_lang}): {err}")
        return text
