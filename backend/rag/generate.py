"""Compose a grounded answer from retrieved context."""

from __future__ import annotations

from pathlib import Path
from typing import Any

try:
	from .retrieve import retrieve, DEFAULT_CHROMA_DB
except (ImportError, ValueError):
	import sys
	from pathlib import Path
	sys.path.insert(0, str(Path(__file__).resolve().parent))
	from retrieve import retrieve, DEFAULT_CHROMA_DB

try:
	from .translation import translate_text, detect_language
except (ImportError, ValueError):
	from translation import translate_text, detect_language

try:
	from .safety import is_safe_query, is_injection_query, get_safety_response, is_greeting_query
except (ImportError, ValueError):
	from safety import is_safe_query, is_injection_query, get_safety_response, is_greeting_query


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

try:
	from .cloud_llm import _call_cloud_llm, _stream_cloud_llm
except (ImportError, ValueError):
	from cloud_llm import _call_cloud_llm, _stream_cloud_llm



import json
import os
import urllib.error
import urllib.request
import time



NO_ANSWER = "I could not find sufficient information in the available IP sources to answer your question."
DEFAULT_OLLAMA_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
DEFAULT_OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "gpt-oss:20b")

MOCK_TKDL_KEYWORDS = ["turmeric", "neem", "triphala", "amla", "ashwagandha", "tulsi", "haldi", "brahmi", "shatavari", "haritaki", "bibhitaki"]
def answer_question(
	query: str,
	persist_dir: str | Path = DEFAULT_CHROMA_DB,
	limit: int = 5,
	model: str = DEFAULT_OLLAMA_MODEL,
	session_id: str | None = None,
	user_id: int | None = None,
	jurisdiction: str = "india",
) -> dict[str, Any]:
	"""Retrieve context and generate an accurate, grounded answer with session history support."""
	# Ensure session exists if requested
	active_session_id = session_manager.get_or_create_session(session_id, user_id=user_id) if session_id is not None else None

	# Detect language of the incoming query
	detected_lang = detect_language(query)
	
	# Translate query to English for semantic search and prompt if it's Hindi, Marathi, Hinglish, or Marathish
	english_query = query
	if detected_lang != "en":
		translation_source = "auto" if detected_lang in {"hinglish", "marathish"} else detected_lang
		english_query = translate_text(query, target_lang="en", source_lang=translation_source)
		print(f"[Translation] Detected '{detected_lang}' query. Translated to English: '{english_query}'")

	# 1. Prompt injection defense
	if is_injection_query(english_query):
		safety_response = get_safety_response("prompt_injection", lang=detected_lang)
		if active_session_id:
			session_manager.add_message(active_session_id, "user", query, user_id=user_id)
			session_manager.add_message(active_session_id, "assistant", safety_response, user_id=user_id)
		return {"answer": safety_response, "citations": [], "grounded": False, "session_id": active_session_id}

	# 2. Check FAQ Direct Answering Cache Layer
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
			session_manager.add_message(active_session_id, "user", query, user_id=user_id)
			session_manager.add_message(active_session_id, "assistant", ans_text, citations=citations, confidence=f"{round(faq_score * 100)}%", is_from_faq=True, user_id=user_id)
		return {
			"answer": ans_text,
			"citations": citations,
			"grounded": True,
			"session_id": active_session_id,
			"from_faq": True,
		}

	# 3. Off-topic relevance validation (check both translated and original text)
	is_safe, reason = is_safe_query(english_query)
	if not is_safe:
		is_safe, reason = is_safe_query(query)
	if not is_safe:
		safety_response = get_safety_response(reason, lang=detected_lang)
		if active_session_id:
			session_manager.add_message(active_session_id, "user", query, user_id=user_id)
			session_manager.add_message(active_session_id, "assistant", safety_response, user_id=user_id)
		return {"answer": safety_response, "citations": [], "grounded": False, "session_id": active_session_id}


	chunks = retrieve(english_query, persist_dir, limit)
	if not chunks and not is_greeting_query(english_query):
		translated_no_answer = translate_text(NO_ANSWER, target_lang=detected_lang if detected_lang in {"hi", "mr"} else "en", source_lang="en")
		if active_session_id:
			session_manager.add_message(active_session_id, "user", query, user_id=user_id)
			session_manager.add_message(active_session_id, "assistant", translated_no_answer, user_id=user_id)
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
				"snippet": " ".join(chunk.text.split()[:8])
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

	# Check if live web search is needed for real-time links/updates
	best_dist = min([c.distance for c in chunks]) if chunks else 1.0
	web_section = ""
	if needs_web_search(english_query, local_chunks_found=len(chunks), best_distance=best_dist) and not is_greeting_query(english_query):
		print(f"[Web Search] Live web search triggered for: '{english_query}'")
		web_results = search_web(english_query, max_results=2)
		if web_results:
			web_context_text = format_web_context_for_prompt(web_results)
			web_section = f"\n=== LIVE OFFICIAL WEB SOURCES & LINKS ===\n{web_context_text}\n"
			for item in web_results:
				citations.append({
					"source": f"Live Web: {item['title']} ({item['url']})",
					"page": 1,
					"confidence": "Live Web",
				})

	# Adjust instructions based on Jurisdiction
	system_prompt = f"""You are IP Shakti Sahayak, an expert Intellectual Property and Patent law assistant.
Answer the user's question accurately, concisely, and strictly based on the provided legal reference context and live web sources.
If the context does not provide sufficient information, clarify what is known and note the limitations.{history_section}
=== REFERENCE CONTEXT ===
{context_text}
{web_section}
=== USER QUESTION ===
{english_query}

=== INSTRUCTIONS ===
- Provide a clear, well-structured, and helpful explanation."""

	if jurisdiction == "international":
		system_prompt += """
- Focus on International treaties, WIPO, Nagoya Protocol, PCT, and Madrid systems.
- If referencing official portals, use:
  * WIPO: https://www.wipo.int
  * European Medicines Agency: https://www.ema.europa.eu
  * FDA: https://www.fda.gov
- Ensure the advice reflects cross-border export realities."""
	else:
		system_prompt += """
- Focus strictly on Indian domestic law (Patents Act 1970, Biological Diversity Act 2002, D&C Act).
- If referencing official portals, use:
  * Official IP India Portal: https://ipindia.gov.in
  * InPASS Patent Search: https://ipindiaservices.gov.in/publicsearch
  * Traditional Knowledge Digital Library (TKDL): https://www.tkdl.res.in
  * Ministry of AYUSH: https://ayush.gov.in
  * CDSCO: https://cdsco.gov.in"""

	system_prompt += "\n- Never generate relative, incomplete, or speculative URLs.\n- Answer directly and professionally."


	if detected_lang == "hi":
		system_prompt += """
- CRITICAL: You must write your entire response in clear, fluent, and professional Hindi (हिन्दी) using standard Devanagari script."""
	elif detected_lang == "mr":
		system_prompt += """
- CRITICAL: You must write your entire response in clear, fluent, and professional Marathi (मराठी) using standard Devanagari script."""
	elif detected_lang == "hinglish":
		system_prompt += """
- CRITICAL: You must write the entire response in Hinglish (Hindi language written using English/Latin alphabet characters. E.g., 'Aapka patent file karne ke liye form submit karna hoga'). Do not use Devnagari characters."""
	elif detected_lang == "marathish":
		system_prompt += """
- CRITICAL: You must write the entire response in Marathish / Romanized Marathi (Marathi language written using English/Latin alphabet characters. E.g., 'Aaplyala patent file karnyasaathi form submit karava lagel'). Do not use Devnagari characters."""

	system_prompt += "\n\nHelpful Answer:"

	llm_answer = _call_cloud_llm(system_prompt)

	if not llm_answer:
		# Fallback if cloud is unreachable
		llm_answer = "Relevant information from the available sources:\n\n" + "\n\n".join(
			f"[{i}] {c.text}" for i, c in enumerate(chunks, start=1)
		)

	if active_session_id:
		session_manager.add_message(active_session_id, "user", query, user_id=user_id)
		session_manager.add_message(active_session_id, "assistant", llm_answer, citations=citations, user_id=user_id)

	return {
		"answer": llm_answer,
		"citations": citations,
		"grounded": True,
		"session_id": active_session_id,
	}




def answer_question_stream(
	query: str,
	persist_dir: str | Path = DEFAULT_CHROMA_DB,
	limit: int = 5,
	model: str = DEFAULT_OLLAMA_MODEL,
	session_id: str | None = None,
	user_id: int | None = None,
	allow_cloud: bool = False,
	jurisdiction: str = "india",
):
	"""Stream RAG response token-by-token via Server-Sent Events (SSE)."""
	active_session_id = session_manager.get_or_create_session(session_id, user_id=user_id) if session_id is not None else None
	detected_lang = detect_language(query)

	# Emit initial thinking state
	yield f"data: {json.dumps({'type': 'thinking', 'message': '🧠 Analyzing Indian IP statutes & legal corpus...'})}\n\n"
	# Pad to blow out proxy buffers (Next.js rewrites)
	yield f": {' ' * 2048}\n\n"


	# Translate query to English if non-English
	english_query = query
	if detected_lang != "en":
		translation_source = "auto" if detected_lang in {"hinglish", "marathish"} else detected_lang
		english_query = translate_text(query, target_lang="en", source_lang=translation_source)

	# 1. Prompt injection defense
	if is_injection_query(english_query):
		safety_response = get_safety_response("prompt_injection", lang=detected_lang)
		if active_session_id:
			session_manager.add_message(active_session_id, "user", query, user_id=user_id)
			session_manager.add_message(active_session_id, "assistant", safety_response, user_id=user_id)
		yield f"data: {json.dumps({'type': 'token', 'token': safety_response})}\n\n"
		yield f"data: {json.dumps({'type': 'done', 'citations': [], 'grounded': False, 'session_id': active_session_id})}\n\n"
		return

	# 2. Check FAQ Direct Answering Cache Layer
	matched_faq, faq_score = match_faq(english_query)
	if matched_faq is not None:
		print(f"[FAQ Cache Stream] High-confidence match ({faq_score:.2f}): {matched_faq['id']} - {matched_faq['question']}")
		ans_text = matched_faq["answer"]
		if detected_lang in {"hi", "mr"}:
			ans_text = translate_text(ans_text, target_lang=detected_lang, source_lang="en")
		citations = [{
			"source": matched_faq["source"],
			"page": 1,
			"confidence": f"{round(faq_score * 100)}%",
		}]
		if active_session_id:
			session_manager.add_message(active_session_id, "user", query, user_id=user_id)
			session_manager.add_message(active_session_id, "assistant", ans_text, citations=citations, confidence=f"{round(faq_score * 100)}%", is_from_faq=True, user_id=user_id)
		for word in ans_text.split(" "):
			yield f"data: {json.dumps({'type': 'token', 'token': word + ' '})}\n\n"
			import time
			time.sleep(0.03) # Small delay to simulate live streaming
		yield f"data: {json.dumps({'type': 'done', 'citations': citations, 'grounded': True, 'session_id': active_session_id, 'from_faq': True})}\n\n"
		return



	# 3. Off-topic relevance validation (check both translated and original text)
	is_safe, reason = is_safe_query(english_query)
	if not is_safe:
		is_safe, reason = is_safe_query(query)
	if not is_safe:
		safety_response = get_safety_response(reason, lang=detected_lang)
		if active_session_id:
			session_manager.add_message(active_session_id, "user", query, user_id=user_id)
			session_manager.add_message(active_session_id, "assistant", safety_response, user_id=user_id)
		yield f"data: {json.dumps({'type': 'token', 'token': safety_response})}\n\n"
		yield f"data: {json.dumps({'type': 'done', 'citations': [], 'grounded': False, 'session_id': active_session_id})}\n\n"
		return



	chunks = retrieve(english_query, persist_dir, limit)
	if not chunks and not is_greeting_query(english_query):
		translated_no_answer = translate_text(NO_ANSWER, target_lang=detected_lang if detected_lang in {"hi", "mr"} else "en", source_lang="en")
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
			raw_sim = max(0.0, 1.0 - chunk.distance)
			calibrated = max(0, min(99, round((raw_sim ** 0.6) * 100)))
			citations.append({
				"source": chunk.source,
				"page": chunk.page,
				"confidence": f"{calibrated}%",
				"snippet": " ".join(chunk.text.split()[:8])
			})
			seen_citations.add(citation_key)
		evidence_parts.append(f"[Source {index}: {chunk.source} (Page {chunk.page})]\n{chunk.text}")

	context_text = "\n\n".join(evidence_parts)

	history_section = ""
	if active_session_id:
		history_text = session_manager.format_history_for_prompt(active_session_id)
		if history_text:
			history_section = f"\n=== PREVIOUS CONVERSATION HISTORY ===\n{history_text}\n"

	# Check if live web search is needed for real-time links/updates
	best_dist = min([c.distance for c in chunks]) if chunks else 1.0
	web_section = ""
	if needs_web_search(english_query, local_chunks_found=len(chunks), best_distance=best_dist) and not is_greeting_query(english_query):
		yield f"data: {json.dumps({'type': 'thinking', 'message': '🌐 Searching official live government portals (ipindia.gov.in / ayush.gov.in)...'})}\n\n"
		print(f"[Web Search Stream] Live web search triggered for: '{english_query}'")
		web_results = search_web(english_query, max_results=2)
		if web_results:
			web_context_text = format_web_context_for_prompt(web_results)
			web_section = f"\n=== LIVE OFFICIAL WEB SOURCES & LINKS ===\n{web_context_text}\n"
			for item in web_results:
				citations.append({
					"source": f"Live Web: {item['title']} ({item['url']})",
					"page": 1,
					"confidence": "Live Web",
				})

	# Adjust instructions based on Jurisdiction
	system_prompt = f"""You are IP Shakti Sahayak, an expert Intellectual Property and Patent law assistant.
Answer the user's question accurately, concisely, and strictly based on the provided legal reference context and live web sources.
If the context does not provide sufficient information, clarify what is known and note the limitations.{history_section}
=== REFERENCE CONTEXT ===
{context_text}
{web_section}
=== USER QUESTION ===
{english_query}

=== INSTRUCTIONS ===
- Provide a clear, well-structured, and helpful explanation."""

	if jurisdiction == "international":
		system_prompt += """
- Focus on International treaties, WIPO, Nagoya Protocol, PCT, and Madrid systems.
- If referencing official portals, use:
  * WIPO: https://www.wipo.int
  * European Medicines Agency: https://www.ema.europa.eu
  * FDA: https://www.fda.gov
- Ensure the advice reflects cross-border export realities."""
	else:
		system_prompt += """
- Focus strictly on Indian domestic law (Patents Act 1970, Biological Diversity Act 2002, D&C Act).
- If referencing official portals, use:
  * Official IP India Portal: https://ipindia.gov.in
  * InPASS Patent Search: https://ipindiaservices.gov.in/publicsearch
  * Traditional Knowledge Digital Library (TKDL): https://www.tkdl.res.in
  * Ministry of AYUSH: https://ayush.gov.in
  * CDSCO: https://cdsco.gov.in"""

	system_prompt += "\n- Never generate relative, incomplete, or speculative URLs.\n- Answer directly and professionally. NEVER introduce yourself or say 'Hello' or 'I am IP Shakti Sahayak'. Start answering the question immediately without any pleasantries."


	if detected_lang == "hi":
		system_prompt += """
- CRITICAL: You must write your entire response in clear, fluent, and professional Hindi (हिन्दी) using standard Devanagari script."""
	elif detected_lang == "mr":
		system_prompt += """
- CRITICAL: You must write your entire response in clear, fluent, and professional Marathi (मराठी) using standard Devanagari script."""
	elif detected_lang == "hinglish":
		system_prompt += """
- CRITICAL: You must write the entire response in Hinglish (Hindi language written using English/Latin alphabet characters. E.g., 'Aapka patent file karne ke liye form submit karna hoga'). Do not use Devnagari characters."""
	elif detected_lang == "marathish":
		system_prompt += """
- CRITICAL: You must write the entire response in Marathish / Romanized Marathi (Marathi language written using English/Latin alphabet characters. E.g., 'Aaplyala patent file karnyasaathi form submit karava lagel'). Do not use Devnagari characters."""

	system_prompt += "\n\nHelpful Answer:"

	full_answer = []

	# Stream tokens live across all languages
	try:
		for token in _stream_cloud_llm(system_prompt):
			if token.startswith("data: "):
				yield token
				return
			
			full_answer.append(token)
			yield f"data: {json.dumps({'type': 'token', 'token': token})}\n\n"

	except Exception as err:
		print(f"[Warning] Streaming error: {err}")
		fallback_ans = "Relevant information from the available sources:\n\n" + "\n\n".join(
			f"[{i}] {c.text}" for i, c in enumerate(chunks, start=1)
		)
		full_answer = [fallback_ans]
		yield f"data: {json.dumps({'type': 'token', 'token': fallback_ans})}\n\n"

	# 2.5 Mock TKDL Interception Logic
	tkdl_hits = [k for k in MOCK_TKDL_KEYWORDS if k in english_query.lower()]
	if tkdl_hits and not is_greeting_query(english_query):
		warning_msg = f"\n\n> 🚨 **TKDL PRIOR ART WARNING**: The ingredients mentioned ({', '.join(tkdl_hits)}) are documented as Traditional Knowledge. Under Section 3(p) of the Patents Act, this formulation may face strict patentability bars unless significant synergistic efficacy is proven. Please consult the TKDL database.\n\n"
		if detected_lang in {"hi", "mr"}:
			warning_msg = translate_text(warning_msg, target_lang=detected_lang, source_lang="en")
		
		# Stream the warning at the end
		for word in warning_msg.split(" "):
			yield f"data: {json.dumps({'type': 'token', 'token': word + ' '})}\n\n"
			full_answer.append(word + ' ')
			import time
			time.sleep(0.02)

	final_text = "".join(full_answer)

	if active_session_id:
		session_manager.add_message(active_session_id, "user", query, user_id=user_id)
		session_manager.add_message(active_session_id, "assistant", final_text, citations=citations, user_id=user_id)

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
		print("• Languages supported: English, Hindi, Marathi, Hinglish & Marathish.")
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
					if data.get("type") == "thinking":
						print(f"\n{data.get('message')}\n")
					elif data.get("type") == "token":
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
				if data.get("type") == "thinking":
					print(f"{data.get('message')}\n")
				elif data.get("type") == "token":
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



