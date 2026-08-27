"""Live web search augmentation module for real-time links, updates, and portal references."""

from __future__ import annotations

import re
from typing import Any

LIVE_KEYWORDS_PATTERN = re.compile(
	r"\b(?:latest|recent|update|updates|link|links|url|website|portal|online|apply|form|fee hike|2024|2025|2026|today|news|notification|gazette|who is|current)\b",
	re.IGNORECASE,
)


def needs_web_search(query: str, local_chunks_found: int = 5, best_distance: float = 0.3) -> bool:
	"""Determine if a query requires live web verification or link discovery."""
	# 1. Explicit keyword trigger
	if LIVE_KEYWORDS_PATTERN.search(query):
		return True

	# 2. Local knowledge gap trigger (if no chunks found or low similarity)
	if local_chunks_found == 0 or best_distance > 0.55:
		return True

	return False


def search_web(query: str, max_results: int = 3) -> list[dict[str, str]]:
	"""
	Search the live web for official government, AYUSH, or Indian patent resources.
	Returns list of dicts with keys: 'title', 'url', 'snippet'.
	"""
	# Enhance query for Indian IP & Ayush context if needed
	search_query = query
	if "india" not in query.lower() and "patent" in query.lower():
		search_query = f"{query} India ipindia"

	try:
		try:
			from ddgs import DDGS
		except ImportError:
			from duckduckgo_search import DDGS

		results: list[dict[str, str]] = []
		ddgs_gen = DDGS().text(search_query, max_results=max_results)
		for item in ddgs_gen:
			title = item.get("title", "Official Source")
			url = item.get("href") or item.get("url", "")
			body = item.get("body") or item.get("snippet", "")
			if url and body:
				results.append({
					"title": title,
					"url": url,
					"snippet": body,
				})
		return results
	except Exception as err:
		print(f"[Web Search Warning] Search failed or offline: {err}")
		return []


def format_web_context_for_prompt(web_results: list[dict[str, str]]) -> str:
	"""Format live web search results for injection into the LLM system prompt."""
	if not web_results:
		return ""

	parts = []
	for i, item in enumerate(web_results, 1):
		parts.append(f"[Web Source {i}: {item['title']}]\nURL: {item['url']}\nSnippet: {item['snippet']}")
	return "\n\n".join(parts)
