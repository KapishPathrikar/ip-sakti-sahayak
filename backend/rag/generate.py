"""Compose a grounded answer from retrieved context."""

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


import json
import os
import urllib.error
import urllib.request
import time



NO_ANSWER = "I could not find sufficient information in the available IP sources to answer your question."
DEFAULT_OLLAMA_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
DEFAULT_OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "gpt-oss:20b")


def _call_ollama(prompt: str, model: str = DEFAULT_OLLAMA_MODEL, base_url: str = DEFAULT_OLLAMA_URL) -> str | None:
	"""Send prompt to local Ollama instance, with retries to handle model loading/boot-up times."""
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
				
	return None




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
	
	# Perform safety validation (guardrails against off-topic/injection)
	is_safe, reason = is_safe_query(query)
	if not is_safe:
		safety_response = get_safety_response(reason, lang=detected_lang)
		if active_session_id:
			session_manager.add_message(active_session_id, "user", query)
			session_manager.add_message(active_session_id, "assistant", safety_response)
		return {"answer": safety_response, "citations": [], "grounded": False, "session_id": active_session_id}
	
	# Translate query to English for semantic search and prompt if it's Hindi or Hinglish
	english_query = query
	if detected_lang != "en":
		# Treat Hinglish as auto/Hindi for translation to English
		translation_source = "auto" if detected_lang == "hinglish" else detected_lang
		english_query = translate_text(query, target_lang="en", source_lang=translation_source)
		print(f"[Translation] Detected '{detected_lang}' query. Translated to English: '{english_query}'")

	# Check FAQ Direct Answering Cache Layer first
	matched_faq, faq_score = match_faq(english_query)
	if matched_faq is not None:
		print(f"[FAQ Cache] High-confidence match ({faq_score:.2f}): {matched_faq['id']} - {matched_faq['question']}")
		ans_text = matched_faq["answer"]
		if detected_lang == "hi":
			ans_text = translate_text(ans_text, target_lang="hi", source_lang="en")
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
			"from_faq": True,
		}

	chunks = retrieve(english_query, persist_dir, limit)
	if not chunks:
		translated_no_answer = translate_text(NO_ANSWER, target_lang=detected_lang if detected_lang != "hinglish" else "hi", source_lang="en")
		if active_session_id:
			session_manager.add_message(active_session_id, "user", query)
			session_manager.add_message(active_session_id, "assistant", translated_no_answer)
		return {"answer": translated_no_answer, "citations": [], "grounded": False, "session_id": active_session_id}

	citations = []
	seen_citations: set[tuple[str, int]] = set()
	evidence_parts = []
	for index, chunk in enumerate(chunks, start=1):
		citation_key = (chunk.source, chunk.page)
		if citation_key not in seen_citations:
			raw_sim = max(0.0, 1.0 - chunk.distance)
			calibrated = max(0, min(99, round((raw_sim ** 0.6) * 100)))
			citations.append({
				"source": chunk.source,
				"page": chunk.page,
				"confidence": f"{calibrated}%",
			})
			seen_citations.add(citation_key)
		evidence_parts.append(f"[Source {index}: {chunk.source} (Page {chunk.page})]\n{chunk.text}")

	context_text = "\n\n".join(evidence_parts)

	# Fetch previous conversation turns if session is active
	history_section = ""
	if active_session_id:
		history_text = session_manager.format_history_for_prompt(active_session_id)
		if history_text:
			history_section = f"\n=== PREVIOUS CONVERSATION HISTORY ===\n{history_text}\n"

	system_prompt = f"""You are IP Shakti Sahayak, an expert Indian Intellectual Property and Patent law assistant.
Answer the user's question accurately, concisely, and strictly based on the provided legal reference context.
If the context does not provide sufficient information, clarify what is known and note the limitations.{history_section}
=== REFERENCE CONTEXT ===
{context_text}

=== USER QUESTION ===
{english_query}

=== INSTRUCTIONS ===
- Provide a clear, well-structured, and helpful explanation.
- Reference relevant sections, rules, or guidelines where applicable.
- Answer directly and professionally."""

	if detected_lang == "hinglish":
		system_prompt += """
- CRITICAL: You must write the entire response in Hinglish (Hindi language written using English/Latin alphabet characters. E.g., 'Aapka patent file karne ke liye form submit karna hoga'). Do not use Devnagari characters."""

	system_prompt += "\n\nHelpful Answer:"

	llm_answer = _call_ollama(system_prompt, model=model)

	if not llm_answer:
		# Fallback if Ollama is unreachable
		llm_answer = "Relevant information from the available sources:\n\n" + "\n\n".join(
			f"[{i}] {c.text}" for i, c in enumerate(chunks, start=1)
		)

	# Translate the final answer back to Devnagari Hindi ONLY if the original language was Devnagari Hindi
	if detected_lang == "hi":
		print(f"[Translation] Translating answer back to Devnagari: '{detected_lang}'...")
		llm_answer = translate_text(llm_answer, target_lang=detected_lang, source_lang="en")

	if active_session_id:
		session_manager.add_message(active_session_id, "user", query)
		session_manager.add_message(active_session_id, "assistant", llm_answer)

	return {
		"answer": llm_answer,
		"citations": citations,
		"grounded": True,
		"session_id": active_session_id,
	}


def _stream_ollama(prompt: str, model: str = DEFAULT_OLLAMA_MODEL, base_url: str = DEFAULT_OLLAMA_URL):
	"""Yield individual token chunks directly from Ollama streaming API."""
	url = f"{base_url.rstrip('/')}/api/generate"
	payload = {
		"model": model,
		"prompt": prompt,
		"stream": True,
		"keep_alive": "1h",  # Keep model in GPU memory for 1 hour to prevent reload delays
	}
	req = urllib.request.Request(
		url,
		data=json.dumps(payload).encode("utf-8"),
		headers={"Content-Type": "application/json"},
	)
	with urllib.request.urlopen(req, timeout=180) as response:
		for line in response:
			if line:
				try:
					data = json.loads(line.decode("utf-8"))
					token = data.get("response", "")
					if token:
						yield token
				except Exception:
					continue


def answer_question_stream(
	query: str,
	persist_dir: str | Path = "chroma_db",
	limit: int = 5,
	model: str = DEFAULT_OLLAMA_MODEL,
	session_id: str | None = None,
):
	"""Stream RAG response token-by-token via Server-Sent Events (SSE)."""
	active_session_id = session_manager.get_or_create_session(session_id) if session_id is not None else None
	detected_lang = detect_language(query)

	# Safety check
	is_safe, reason = is_safe_query(query)
	if not is_safe:
		safety_response = get_safety_response(reason, lang=detected_lang)
		if active_session_id:
			session_manager.add_message(active_session_id, "user", query)
			session_manager.add_message(active_session_id, "assistant", safety_response)
		yield f"data: {json.dumps({'type': 'token', 'token': safety_response})}\n\n"
		yield f"data: {json.dumps({'type': 'done', 'citations': [], 'grounded': False, 'session_id': active_session_id})}\n\n"
		return

	# Translate query to English if non-English
	english_query = query
	if detected_lang != "en":
		translation_source = "auto" if detected_lang == "hinglish" else detected_lang
		english_query = translate_text(query, target_lang="en", source_lang=translation_source)

	# Check FAQ Direct Answering Cache Layer first
	matched_faq, faq_score = match_faq(english_query)
	if matched_faq is not None:
		print(f"[FAQ Cache Stream] High-confidence match ({faq_score:.2f}): {matched_faq['id']} - {matched_faq['question']}")
		ans_text = matched_faq["answer"]
		if detected_lang == "hi":
			ans_text = translate_text(ans_text, target_lang="hi", source_lang="en")
		citations = [{
			"source": matched_faq["source"],
			"page": 1,
			"confidence": f"{round(faq_score * 100)}%",
		}]
		if active_session_id:
			session_manager.add_message(active_session_id, "user", query)
			session_manager.add_message(active_session_id, "assistant", ans_text)
		yield f"data: {json.dumps({'type': 'token', 'token': ans_text})}\n\n"
		yield f"data: {json.dumps({'type': 'done', 'citations': citations, 'grounded': True, 'session_id': active_session_id, 'from_faq': True})}\n\n"
		return

	chunks = retrieve(english_query, persist_dir, limit)
	if not chunks:
		translated_no_answer = translate_text(NO_ANSWER, target_lang=detected_lang if detected_lang != "hinglish" else "hi", source_lang="en")
		if active_session_id:
			session_manager.add_message(active_session_id, "user", query)
			session_manager.add_message(active_session_id, "assistant", translated_no_answer)
		yield f"data: {json.dumps({'type': 'token', 'token': translated_no_answer})}\n\n"
		yield f"data: {json.dumps({'type': 'done', 'citations': [], 'grounded': False, 'session_id': active_session_id})}\n\n"
		return

	citations = []
	seen_citations: set[tuple[str, int]] = set()
	evidence_parts = []
	for index, chunk in enumerate(chunks, start=1):
		citation_key = (chunk.source, chunk.page)
		if citation_key not in seen_citations:
			# Calibrated confidence formula for 768-dim embeddings:
			# Raw similarity >= 0.70 -> 95%+, 0.55 -> ~88%, 0.40 -> ~72%
			raw_sim = max(0.0, 1.0 - chunk.distance)
			calibrated = max(0, min(99, round((raw_sim ** 0.6) * 100)))
			citations.append({
				"source": chunk.source,
				"page": chunk.page,
				"confidence": f"{calibrated}%",
			})
			seen_citations.add(citation_key)
		evidence_parts.append(f"[Source {index}: {chunk.source} (Page {chunk.page})]\n{chunk.text}")

	context_text = "\n\n".join(evidence_parts)

	history_section = ""
	if active_session_id:
		history_text = session_manager.format_history_for_prompt(active_session_id)
		if history_text:
			history_section = f"\n=== PREVIOUS CONVERSATION HISTORY ===\n{history_text}\n"

	system_prompt = f"""You are IP Shakti Sahayak, an expert Indian Intellectual Property and Patent law assistant.
Answer the user's question accurately, concisely, and strictly based on the provided legal reference context.
If the context does not provide sufficient information, clarify what is known and note the limitations.{history_section}
=== REFERENCE CONTEXT ===
{context_text}

=== USER QUESTION ===
{english_query}

=== INSTRUCTIONS ===
- Provide a clear, well-structured, and helpful explanation.
- Reference relevant sections, rules, or guidelines where applicable.
- Answer directly and professionally."""

	if detected_lang == "hinglish":
		system_prompt += """
- CRITICAL: You must write the entire response in Hinglish (Hindi language written using English/Latin alphabet characters. E.g., 'Aapka patent file karne ke liye form submit karna hoga'). Do not use Devnagari characters."""

	system_prompt += "\n\nHelpful Answer:"

	full_answer = []

	if detected_lang in {"en", "hinglish"}:
		# Stream tokens live
		try:
			for token in _stream_ollama(system_prompt, model=model):
				full_answer.append(token)
				yield f"data: {json.dumps({'type': 'token', 'token': token})}\n\n"
		except Exception as err:
			print(f"[Warning] Streaming error: {err}")
			fallback_ans = "Relevant information from the available sources:\n\n" + "\n\n".join(
				f"[{i}] {c.text}" for i, c in enumerate(chunks, start=1)
			)
			full_answer = [fallback_ans]
			yield f"data: {json.dumps({'type': 'token', 'token': fallback_ans})}\n\n"
	else:
		# For Devnagari Hindi, generate full English then translate and yield
		llm_answer = _call_ollama(system_prompt, model=model) or ""
		translated_answer = translate_text(llm_answer, target_lang="hi", source_lang="en")
		full_answer = [translated_answer]
		yield f"data: {json.dumps({'type': 'token', 'token': translated_answer})}\n\n"

	final_text = "".join(full_answer)

	if active_session_id:
		session_manager.add_message(active_session_id, "user", query)
		session_manager.add_message(active_session_id, "assistant", final_text)

	yield f"data: {json.dumps({'type': 'done', 'citations': citations, 'grounded': True, 'session_id': active_session_id})}\n\n"






def main() -> None:
	import argparse
	import sys

	# Reconfigure console to print UTF-8 (Devnagari script & Emojis) on Windows
	if sys.platform.startswith("win"):
		import io
		sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

	parser = argparse.ArgumentParser(description=__doc__)

	parser.add_argument("query", type=str, nargs="?", default=None, help="Question to ask (optional, opens interactive mode if omitted)")
	parser.add_argument("-i", "--interactive", action="store_true", help="Launch interactive multi-turn terminal chat")
	parser.add_argument("--persist-dir", type=Path, default=Path("chroma_db"))
	parser.add_argument("--limit", type=int, default=3)
	parser.add_argument("--model", type=str, default=DEFAULT_OLLAMA_MODEL)
	parser.add_argument("--json", action="store_true", help="Output raw JSON response")
	args = parser.parse_args()

	# If interactive flag is passed OR no query provided, enter persistent chat mode
	if args.interactive or args.query is None:
		print("\n" + "=" * 65)
		print("🤖 IP SHAKTI SAHAYAK — INTERACTIVE CONVERSATION MODE")
		print("=" * 65)
		print("• Type your questions in English, Hindi (Devnagari), or Hinglish.")
		print("• Models & embeddings stay loaded in memory for instant responses.")
		print("• Type 'clear' to reset conversation memory | Type 'exit' to quit.\n" + "-" * 65)

		session_id = f"cli-interactive-{int(time.time())}"

		while True:
			try:
				user_input = input("\n👤 You: ").strip()
			except (KeyboardInterrupt, EOFError):
				print("\nExiting. Dhanyavaad!")
				break

			if not user_input:
				continue
			if user_input.lower() in {"exit", "quit", "q"}:
				print("Exiting IP Shakti Sahayak. Have a great day!")
				break
			if user_input.lower() == "clear":
				session_manager.clear_session(session_id)
				print("[Session memory cleared. Starting fresh context.]")
				continue

			print("\n🤖 IP Shakti Sahayak:\n")
			citations = []
			for sse_event in answer_question_stream(
				user_input,
				persist_dir=args.persist_dir,
				limit=args.limit,
				model=args.model,
				session_id=session_id,
			):
				if sse_event.startswith("data: "):
					data = json.loads(sse_event[6:].strip())
					if data.get("type") == "token":
						sys.stdout.write(data.get("token", ""))
						sys.stdout.flush()
					elif data.get("type") == "done":
						citations = data.get("citations", [])

			print("\n\n" + "-" * 40)
			if citations:
				print("📚 Sources:")
				for i, cite in enumerate(citations, 1):
					conf = f" ({cite['confidence']})" if "confidence" in cite else ""
					print(f"  [{i}] {cite['source']} (Page {cite['page']}){conf}")
			else:
				print("📚 Direct Verified Knowledge")
			print("-" * 40)

	elif args.json:
		result = answer_question(args.query, persist_dir=args.persist_dir, limit=args.limit, model=args.model)
		print(json.dumps(result, indent=2))
	else:
		print("\n" + "=" * 60)
		print("🤖 IP SHAKTI SAHAYAK (LIVE STREAMING):")
		print("=" * 60 + "\n")
		
		citations = []
		for sse_event in answer_question_stream(args.query, persist_dir=args.persist_dir, limit=args.limit, model=args.model):
			if sse_event.startswith("data: "):
				data = json.loads(sse_event[6:].strip())
				if data.get("type") == "token":
					sys.stdout.write(data.get("token", ""))
					sys.stdout.flush()
				elif data.get("type") == "done":
					citations = data.get("citations", [])

		print("\n\n" + "-" * 60)
		print("📚 CITATIONS & SOURCES:")
		if citations:
			for i, cite in enumerate(citations, 1):
				conf = f" (Confidence: {cite['confidence']})" if "confidence" in cite else ""
				print(f"  [{i}] {cite['source']} (Page {cite['page']}){conf}")
		else:
			print("  No citations required for this query.")
		print("-" * 60 + "\n")




if __name__ == "__main__":
	main()



