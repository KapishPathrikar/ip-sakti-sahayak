"""High-confidence FAQ semantic matching and instant answer retrieval layer."""

from __future__ import annotations

import json
import math
from pathlib import Path
from typing import Any

try:
	from .retrieve import _get_embedding_function
except (ImportError, ValueError):
	import sys
	sys.path.insert(0, str(Path(__file__).resolve().parent))
	from retrieve import _get_embedding_function

FAQ_FILE_PATH = Path(__file__).resolve().parent.parent / "data" / "faqs.json"
DEFAULT_FAQ_SIMILARITY_THRESHOLD = 0.80

_FAQS_CACHE: list[dict[str, Any]] | None = None
_FAQ_QUESTION_EMBEDDINGS: list[tuple[dict[str, Any], str, list[float]]] | None = None


def load_faqs() -> list[dict[str, Any]]:
	"""Load and cache pre-verified FAQs from storage."""
	global _FAQS_CACHE
	if _FAQS_CACHE is None:
		if not FAQ_FILE_PATH.exists():
			return []
		with open(FAQ_FILE_PATH, "r", encoding="utf-8") as f:
			_FAQS_CACHE = json.load(f)
	return _FAQS_CACHE


def _cosine_similarity(vec1: list[float], vec2: list[float]) -> float:
	"""Compute cosine similarity between two normalized or raw float vectors."""
	dot = sum(a * b for a, b in zip(vec1, vec2))
	norm1 = math.sqrt(sum(a * a for a, b in zip(vec1, vec2)))
	norm2 = math.sqrt(sum(b * b for a, b in zip(vec1, vec2)))
	if norm1 == 0.0 or norm2 == 0.0:
		return 0.0
	return dot / (norm1 * norm2)


def _init_faq_embeddings() -> list[tuple[dict[str, Any], str, list[float]]]:
	"""Compute embeddings for each primary and alternative question."""
	global _FAQ_QUESTION_EMBEDDINGS
	if _FAQ_QUESTION_EMBEDDINGS is not None:
		return _FAQ_QUESTION_EMBEDDINGS

	faqs = load_faqs()
	if not faqs:
		_FAQ_QUESTION_EMBEDDINGS = []
		return _FAQ_QUESTION_EMBEDDINGS

	embed_fn = _get_embedding_function()
	
	all_questions: list[tuple[dict[str, Any], str]] = []
	text_list: list[str] = []
	
	for faq in faqs:
		# Add primary question
		all_questions.append((faq, faq["question"]))
		text_list.append(faq["question"])
		
		# Add alternative questions
		for alt in faq.get("alternative_questions", []):
			all_questions.append((faq, alt))
			text_list.append(alt)

	# Batch embed all questions
	raw_embeddings = embed_fn(text_list)
	
	_FAQ_QUESTION_EMBEDDINGS = [
		(faq, q_text, embedding)
		for (faq, q_text), embedding in zip(all_questions, raw_embeddings)
	]
	return _FAQ_QUESTION_EMBEDDINGS


def match_faq(query: str, threshold: float = DEFAULT_FAQ_SIMILARITY_THRESHOLD) -> tuple[dict[str, Any] | None, float]:
	"""
	Match incoming user query against verified FAQs.
	Returns (FAQ_dict, similarity_score) if match exceeds threshold, else (None, best_score).
	"""
	query = query.strip()
	if not query:
		return None, 0.0

	faq_entries = _init_faq_embeddings()
	if not faq_entries:
		return None, 0.0

	embed_fn = _get_embedding_function()
	query_embedding = embed_fn([query])[0]

	best_faq: dict[str, Any] | None = None
	best_score = 0.0

	for faq, _, q_embedding in faq_entries:
		sim = _cosine_similarity(query_embedding, q_embedding)
		if sim > best_score:
			best_score = sim
			best_faq = faq

	if best_score >= threshold:
		return best_faq, best_score
	return None, best_score
