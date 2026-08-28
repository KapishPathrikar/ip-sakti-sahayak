"""Live web search augmentation module with dead-link filtering and canonical validation."""

from __future__ import annotations

import re
import urllib.request
import urllib.error
from typing import Any

LIVE_KEYWORDS_PATTERN = re.compile(
	r"\b(?:latest|recent|update|updates|link|links|url|website|portal|online|apply|form|fee hike|2024|2025|2026|today|news|notification|gazette|who is|current)\b",
	re.IGNORECASE,
)

CANONICAL_PORTALS = {
	"ipindia.gov.in": "https://ipindia.gov.in",
	"ipindiaservices.gov.in": "https://ipindiaservices.gov.in/publicsearch",
	"tkdl.res.in": "https://www.tkdl.res.in",
	"ayush.gov.in": "https://ayush.gov.in",
	"wipo.int": "https://www.wipo.int",
	"cdsco.gov.in": "https://cdsco.gov.in",
	"copyright.gov.in": "https://copyright.gov.in",
}


def is_url_alive(url: str, timeout: float = 1.5) -> bool:
	"""Fast check to verify if a URL is active and does not return 404 or connection error."""
	if not url or not url.startswith("http"):
		return False

	req = urllib.request.Request(
		url,
		headers={
			"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
		},
	)
	try:
		# Use head request or light get
		with urllib.request.urlopen(req, timeout=timeout) as response:
			return response.status in {200, 301, 302, 307, 308}
	except urllib.error.HTTPError as e:
		# 404 or 410 means dead link
		if e.code in {404, 410}:
			return False
		# Some government portals block automated HEAD requests with 403, but the main domain is alive
		return e.code in {403, 401}
	except Exception:
		return False


def sanitize_and_validate_url(raw_url: str) -> str | None:
	"""
	Sanitize DuckDuckGo search result URL.
	If dead or 404, fallback to canonical domain root or discard.
	"""
	if not raw_url:
		return None

	url = raw_url.strip()
	if not url.startswith("http://") and not url.startswith("https://"):
		url = "https://" + url

	# Check against canonical domains
	for domain, canonical_root in CANONICAL_PORTALS.items():
		if domain in url.lower():
			# If deep link is alive, keep it; otherwise fallback to canonical root
			if is_url_alive(url):
				return url
			return canonical_root

	# For external links, only return if alive
	if is_url_alive(url):
		return url

	return None


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
	Filters out 404s, stale cache links, and validates all URLs.
	"""
	search_query = query
	if "india" not in query.lower() and "patent" in query.lower():
		search_query = f"{query} India official"

	try:
		try:
			from ddgs import DDGS
		except ImportError:
			from duckduckgo_search import DDGS

		results: list[dict[str, str]] = []
		ddgs_gen = DDGS().text(search_query, max_results=max_results + 3)

		for item in ddgs_gen:
			title = item.get("title", "Official Source")
			raw_url = item.get("href") or item.get("url", "")
			body = item.get("body") or item.get("snippet", "")

			if not raw_url or not body:
				continue

			valid_url = sanitize_and_validate_url(raw_url)
			if valid_url:
				results.append({
					"title": title,
					"url": valid_url,
					"snippet": body,
				})

			if len(results) >= max_results:
				break

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
