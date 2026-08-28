"""Modified generate.py that works with either Ollama or Cloud LLM for immediate testing."""

from __future__ import annotations

from pathlib import Path
from typing import Any

try:
    from .retrieve import retrieve
except (ImportError, ValueError):
    import sys
    from pathlib import Path
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    from retrieve import retrieve

try:
    from .translation import translate_text, detect_language
except (ImportError, ValueError):
    from translation import translate_text, detect_language

try:
    from .safety import is_safe_query, get_safety_response
except (ImportError, ValueError):
    from safety import is_safe_query, get_safety_response

try:
    from .session import session_manager
except (ImportError, ValueError):
    from session import session_manager

try:
    from .faq_matcher import match_faq
except (ImportError, ValueError):
    from faq_matcher import match_faq

try:
    from .web_search import needs_web_search, search_web, format_web_context_for_prompt
except (ImportError, ValueError):
    from web_search import needs_web_search, search_web, format_web_context_for_prompt


import json
import os
import urllib.error
import urllib.request
import time

NO_ANSWER = "I could not find sufficient information in the available IP sources to answer your question."
DEFAULT_OLLAMA_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
DEFAULT_OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "gpt-oss:20b")

# Configuration: Use Ollama or Cloud LLM
USE_CLOUD_LLM = os.getenv("USE_CLOUD_LLM", "true").lower() == "true"


def _call_ollama(prompt: str, model: str = DEFAULT_OLLAMA_MODEL, base_url: str = DEFAULT_OLLAMA_URL) -> str | None:
    """Send prompt to local Ollama instance, with retries to handle model loading/boot-up times."""
    if USE_CLOUD_LLM:
        # Use cloud LLM instead
        try:
            from .cloud_llm import _call_cloud_llm
            return _call_cloud_llm(prompt, model)
        except ImportError:
            pass

    # Original Ollama code
    url = f"{base_url.rstrip('/')}/api/generate"
    payload = {
        "model": model,
        "prompt": prompt,
        "stream": False,
        "keep_alive": "1h",  # Keep model in GPU memory for 1 hour to prevent reload delays
    }

    max_retries = 3
    timeout = 180  # Generous timeout to allow large 20B models to load

    for attempt in range(1, max_retries + 1):
        try:
            req = urllib.request.Request(
                url,
                data=json.dumps(payload).encode("utf-8"),
                headers={"Content-Type": "application/json"},
            )
            with urllib.request.urlopen(req, timeout=timeout) as response:
                data = json.loads(response.read().decode("utf-8"))
                return data.get("response", "").strip()

        except urllib.error.HTTPError as http_err:
            error_detail = ""
            try:
                error_detail = http_err.read().decode("utf-8")
            except Exception:
                pass

            # If it's a 500 error, the model is likely loading or crashed
            print(f"[Warning] Ollama HTTP {http_err.code} on attempt {attempt}/{max_retries}: {error_detail or http_err.reason}")
            if attempt < max_retries:
                wait_time = attempt * 8  # Wait 8s, then 16s...
                print(f"Waiting {wait_time}s for model '{model}' to load/boot up...")
                time.sleep(wait_time)

        except Exception as err:
            print(f"[Warning] Failed to query Ollama on attempt {attempt}/{max_retries}: {err}")
            if attempt < max_retries:
                time.sleep(5)

    # If Ollama fails, try cloud LLM as fallback
    try:
        from .cloud_llm import _call_cloud_llm
        print("[Fallback] Using Cloud LLM as Ollama failed")
        return _call_cloud_llm(prompt, model)
    except ImportError:
        return "[ERROR] Neither Ollama nor Cloud LLM is available. Please install Ollama or configure cloud API keys."


def _stream_ollama(prompt: str, model: str = DEFAULT_OLLAMA_MODEL, base_url: str = DEFAULT_OLLAMA_URL):
    """Stream response from Ollama or Cloud LLM."""
    if USE_CLOUD_LLM:
        # Use cloud LLM streaming
        try:
            from .cloud_llm import _stream_cloud_llm
            yield from _stream_cloud_llm(prompt, model)
            return
        except ImportError:
            pass

    # Original Ollama streaming code
    url = f"{base_url.rstrip('/')}/api/generate"
    payload = {
        "model": model,
        "prompt": prompt,
        "stream": True,
        "keep_alive": "1h",
    }

    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
    )

    try:
        with urllib.request.urlopen(req, timeout=180) as response:
            for line in response:
                line_text = line.decode("utf-8").strip()
                if line_text:
                    try:
                        data = json.loads(line_text)
                        if "response" in data:
                            yield f"data: {json.dumps({'response': data['response']})}\n\n"
                    except json.JSONDecodeError:
                        continue
            yield "data: [DONE]\n\n"
    except Exception as err:
        print(f"[Stream Error] {err}")
        # Fallback to cloud LLM
        try:
            from .cloud_llm import _stream_cloud_llm
            yield from _stream_cloud_llm(prompt, model)
        except ImportError:
            yield f"data: {json.dumps({'response': 'Streaming unavailable. Please install Ollama.'})}\n\n"
            yield "data: [DONE]\n\n"


def answer_question(
    query: str,
    persist_dir: str | Path = "chroma_db",
    limit: int = 5,
    model: str = DEFAULT_OLLAMA_MODEL,
    session_id: str | None = None,
) -> dict[str, Any]:
    """Retrieve context and generate an accurate, grounded answer with session history support."""
    # Ensure session exists if requested
    active_session_id = session_manager.get_or_create_session(session_id) if session_id is not None else None

    # Detect language of the incoming query
    detected_lang = detect_language(query)

    # Translate query to English for semantic search and prompt if it's Hindi, Marathi, Hinglish, or Marathish
    english_query = query
    if detected_lang != "en":
        translation_source = "auto" if detected_lang in {"hinglish", "marathish"} else detected_lang
        english_query = translate_text(query, target_lang="en", source_lang=translation_source)
        print(f"[Translation] Detected '{detected_lang}' query. Translated to English: '{english_query}'")

    # Perform safety validation (guardrails against off-topic/injection)
    is_safe, reason = is_safe_query(english_query)
    if not is_safe:
        safety_response = get_safety_response(reason, lang=detected_lang)
        if active_session_id:
            session_manager.add_message(active_session_id, "user", query)
            session_manager.add_message(active_session_id, "assistant", safety_response)
        return {"answer": safety_response, "citations": [], "grounded": False, "session_id": active_session_id}


    # Check FAQ Direct Answering Cache Layer first
    matched_faq, faq_score = match_faq(english_query)
    if matched_faq is not None:
        print(f"[FAQ Cache] High-confidence match ({faq_score:.2f}): {matched_faq['id']} - {matched_faq['question']}")
        ans_text = matched_faq["answer"]
        if detected_lang in {"hi", "mr"}:
            ans_text = translate_text(ans_text, target_lang=detected_lang, source_lang="en")
        citations = [{
            "source": matched_faq["source"],
            "page": 1,
            "confidence": f"{round(faq_score * 100)}%",
        }]
        if active_session_id:
            session_manager.add_message(active_session_id, "user", query)
            session_manager.add_message(active_session_id, "assistant", ans_text)
        return {
            "answer": ans_text,
            "citations": citations,
            "grounded": True,
            "session_id": active_session_id,
        }


    # Retrieve relevant chunks from the vector database
    retrieved = retrieve(query=english_query, persist_dir=persist_dir, limit=limit)
    if not retrieved:
        print("[RAG] No relevant context found in vector database.")
        if active_session_id:
            session_manager.add_message(active_session_id, "user", query)
            session_manager.add_message(active_session_id, "assistant", NO_ANSWER)
        return {
            "answer": NO_ANSWER,
            "citations": [],
            "grounded": False,
            "session_id": active_session_id,
        }

    # Format retrieved context
    context_texts = []
    citations = []
    for i, chunk in enumerate(retrieved, 1):
        context_texts.append(f"[{i}] {chunk.text}")
        citations.append({
            "source": chunk.source,
            "page": chunk.page,
            "confidence": f"{100 - int(chunk.distance * 100)}%",
        })

    # Optionally augment with live web search for current official government info
    web_context = ""
    if needs_web_search(english_query):
        print("[Web Search] Query flagged for live government link augmentation.")
        try:
            web_results = search_web(english_query, max_results=3)
            web_context = format_web_context_for_prompt(web_results)
            if web_context:
                print("[Web Search] Retrieved live government/legal links.")
        except Exception as web_err:
            print(f"[Web Search Error] {web_err}")

    # Build the final LLM prompt with session history if available
    session_history = ""
    if active_session_id:
        session_history = session_manager.format_history_for_prompt(active_session_id)
        if session_history:
            session_history = "\n\n--- Prior Conversation (for context) ---\n" + session_history

    # Compose the system prompt
    system_prompt = f"""You are an expert legal assistant specializing in Indian Intellectual Property (IP) law.

CONTEXT FROM OFFICIAL IP DOCUMENTS:
{chr(10).join(context_texts)}

{web_context}
{session_history}

USER QUESTION: {english_query}

INSTRUCTIONS:
1. Answer STRICTLY based on the provided context. If the context doesn't contain enough information, say "{NO_ANSWER}"
2. Include specific citations like [1], [2] referring to the context numbers above
3. Provide accurate, practical guidance for Indian IP law
4. Keep the answer concise and focused
5. If the user asked in Hindi/Marathi, answer in the same language
6. Mention if any additional government approvals are needed (NBA, AYUSH, etc.)

ANSWER:"""

    print(f"[RAG] Retrieved {len(retrieved)} context chunks. Generating answer...")

    # Generate answer using LLM (Ollama or Cloud)
    llm_answer = _call_ollama(system_prompt, model=model) or ""

    # Translate answer back if needed
    final_answer = llm_answer.strip()
    if detected_lang in {"hi", "mr"}:
        final_answer = translate_text(llm_answer, target_lang=detected_lang, source_lang="en")
        print(f"[Translation] Translated answer to '{detected_lang}'")

    # Store in session
    if active_session_id:
        session_manager.add_message(active_session_id, "user", query)
        session_manager.add_message(active_session_id, "assistant", final_answer)

    return {
        "answer": final_answer,
        "citations": citations,
        "grounded": bool(retrieved),
        "session_id": active_session_id,
    }


def answer_question_stream(
    query: str,
    persist_dir: str | Path = "chroma_db",
    limit: int = 5,
    model: str = DEFAULT_OLLAMA_MODEL,
    session_id: str | None = None,
):
    """Stream token-by-token answer via Server-Sent Events (SSE)."""
    # Ensure session exists if requested
    active_session_id = session_manager.get_or_create_session(session_id) if session_id is not None else None

    # Detect language
    detected_lang = detect_language(query)

    # Translate query to English for semantic search
    english_query = query
    if detected_lang != "en":
        translation_source = "auto" if detected_lang in {"hinglish", "marathish"} else detected_lang
        english_query = translate_text(query, target_lang="en", source_lang=translation_source)

    # Safety check
    is_safe, reason = is_safe_query(english_query)
    if not is_safe:
        safety_response = get_safety_response(reason, lang=detected_lang)
        if active_session_id:
            session_manager.add_message(active_session_id, "user", query)
            session_manager.add_message(active_session_id, "assistant", safety_response)
        yield f"data: {json.dumps({'response': safety_response})}\n\n"
        yield "data: [DONE]\n\n"
        return

    # FAQ check
    matched_faq, faq_score = match_faq(english_query)
    if matched_faq is not None:
        ans_text = matched_faq["answer"]
        if detected_lang in {"hi", "mr"}:
            ans_text = translate_text(ans_text, target_lang=detected_lang, source_lang="en")
        if active_session_id:
            session_manager.add_message(active_session_id, "user", query)
            session_manager.add_message(active_session_id, "assistant", ans_text)
        for word in ans_text.split():
            yield f"data: {json.dumps({'response': word + ' '})}\n\n"
        yield "data: [DONE]\n\n"
        return

    # Retrieve context
    retrieved = retrieve(query=english_query, persist_dir=persist_dir, limit=limit)
    if not retrieved:
        if active_session_id:
            session_manager.add_message(active_session_id, "user", query)
            session_manager.add_message(active_session_id, "assistant", NO_ANSWER)
        for word in NO_ANSWER.split():
            yield f"data: {json.dumps({'response': word + ' '})}\n\n"
        yield "data: [DONE]\n\n"
        return

    # Format context
    context_texts = []
    for i, chunk in enumerate(retrieved, 1):
        context_texts.append(f"[{i}] {chunk.text}")

    # Web search if needed
    web_context = ""
    if needs_web_search(english_query):
        try:
            web_results = search_web(english_query, max_results=3)
            web_context = format_web_context_for_prompt(web_results)
        except Exception:
            pass

    # Session history
    session_history = ""
    if active_session_id:
        session_history = session_manager.format_history_for_prompt(active_session_id)
        if session_history:
            session_history = "\n\n--- Prior Conversation ---\n" + session_history

    # Build prompt
    system_prompt = f"""You are an expert legal assistant for Indian IP law.

CONTEXT FROM OFFICIAL IP DOCUMENTS:
{chr(10).join(context_texts)}

{web_context}
{session_history}

USER QUESTION: {english_query}

INSTRUCTIONS:
1. Answer based on the provided context
2. Include citations like [1], [2]
3. Provide practical Indian IP guidance
4. Keep concise

ANSWER:"""

    print(f"[RAG Stream] Retrieved {len(retrieved)} chunks. Streaming answer...")

    # Store question in session
    if active_session_id:
        session_manager.add_message(active_session_id, "user", query)

    # Stream the answer
    full_answer = ""
    for token in _stream_ollama(system_prompt, model=model):
        if token.strip():
            full_answer += token
        yield token

    # Store full answer in session
    if active_session_id:
        # Need to extract the actual response from tokens
        answer_text = full_answer
        session_manager.add_message(active_session_id, "assistant", answer_text[:500])  # Store first 500 chars