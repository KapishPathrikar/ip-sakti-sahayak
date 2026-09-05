"""Live web search augmentation module with dead-link filtering and canonical validation."""

from __future__ import annotations

import re
import urllib.request
import urllib.error
from typing import Any

LINK_REQUEST_PATTERN = re.compile(
	r"\b(?:link|links|url|urls|website|web link|portal link|official link|portal url|where can i (?:find|access|apply|file|register|check)|give me the link|share the link|provide the link|direct link)\b",
	re.IGNORECASE,
)

CANONICAL_PORTALS = {
	"ipindia.gov.in": "https://ipindia.gov.in",
	"ipindiaservices.gov.in": "https://ipindiaservices.gov.in/publicsearch",
	"openhousehelpdesk": "https://iprsearch.ipindia.gov.in/openhousehelpdesk/Login/login",
	"trademarkefiling": "https://ipindiaonline.gov.in/trademarkefiling/user/frmloginnew.aspx",
	"epatentfiling": "https://ipronline.ipindia.gov.in/epatentfiling/goForLogin/doLogin",
	"designapplicationstatus": "https://search.ipindia.gov.in/DesignApplicationStatus",
	"tkdl.res.in": "https://www.tkdl.res.in",
	"ayush.gov.in": "https://ayush.gov.in",
	"wipo.int": "https://www.wipo.int",
	"cdsco.gov.in": "https://cdsco.gov.in",
	"copyright.gov.in": "https://copyright.gov.in",
	"pgportal.gov.in": "https://pgportal.gov.in",
}

OFFICIAL_DOMAINS = (
	"gov.in",
	"nic.in",
	"res.in",
	"wipo.int",
	"who.int",
	"europa.eu",
	"fda.gov",
)


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
		with urllib.request.urlopen(req, timeout=timeout) as response:
			return response.status in {200, 301, 302, 307, 308}
	except urllib.error.HTTPError as e:
		if e.code in {404, 410}:
			return False
		return e.code in {403, 401}
	except Exception:
		return False


def sanitize_and_validate_url(raw_url: str) -> str | None:
	"""
	Sanitize search result URL to ensure it is strictly an official government or institutional portal.
	Commercial blogs (e.g. Lexology, LexOrbis) are filtered out to prevent hallucinations.
	"""
	if not raw_url:
		return None

	url = raw_url.strip()
	if not url.startswith("http://") and not url.startswith("https://"):
		url = "https://" + url

	# Match against canonical portals first
	for key, canonical_url in CANONICAL_PORTALS.items():
		if key in url.lower():
			return canonical_url

	# Only accept official domains
	domain = urllib.request.urlparse(url).netloc.lower()
	if not any(domain.endswith(off) or f".{off}." in domain for off in OFFICIAL_DOMAINS):
		return None

	if is_url_alive(url):
		return url

	return None


def needs_web_search(query: str, local_chunks_found: int = 5, best_distance: float = 0.3) -> bool:
	"""
	Determine if a query explicitly requests an official link or website URL.
	All rules, statutes, procedures, and legal questions MUST be answered strictly
	from the local RAG corpus to prevent hallucinations.
	Web search is ONLY triggered when the user explicitly asks for a link/URL.
	"""
	return bool(LINK_REQUEST_PATTERN.search(query))


def search_web(query: str, max_results: int = 3) -> list[dict[str, str]]:
	"""
	Search strictly for official portal links when explicitly requested.
	Returns ONLY validated official URLs without third-party web content.
	"""
	# Check for direct canonical portal matches first
	lower_q = query.lower()
	matched_canonical = []
	if "open house" in lower_q or "grievance" in lower_q:
		matched_canonical.append({
			"title": "IPO Open House Helpdesk Portal",
			"url": CANONICAL_PORTALS["openhousehelpdesk"],
		})
	if "trademark" in lower_q and ("filing" in lower_q or "apply" in lower_q or "e-filing" in lower_q):
		matched_canonical.append({
			"title": "Trade Marks E-Filing Portal (IP India)",
			"url": CANONICAL_PORTALS["trademarkefiling"],
		})
	if "patent" in lower_q and ("filing" in lower_q or "apply" in lower_q or "e-filing" in lower_q):
		matched_canonical.append({
			"title": "Comprehensive E-Patent Filing Portal (IP India)",
			"url": CANONICAL_PORTALS["epatentfiling"],
		})
	if "search" in lower_q and "patent" in lower_q:
		matched_canonical.append({
			"title": "Indian Patent Advanced Search System (InPASS)",
			"url": CANONICAL_PORTALS["ipindiaservices.gov.in"],
		})

	if matched_canonical:
		return matched_canonical[:max_results]

	search_query = f"{query} site:gov.in OR site:nic.in OR site:wipo.int"

	try:
		try:
			from ddgs import DDGS
		except ImportError:
			from duckduckgo_search import DDGS

		results: list[dict[str, str]] = []
		ddgs_gen = DDGS().text(search_query, max_results=max_results + 3)

		for item in ddgs_gen:
			title = item.get("title", "Official Portal")
			raw_url = item.get("href") or item.get("url", "")

			if not raw_url:
				continue

			valid_url = sanitize_and_validate_url(raw_url)
			if valid_url:
				results.append({
					"title": title,
					"url": valid_url,
				})

			if len(results) >= max_results:
				break

		return results
	except Exception as err:
		print(f"[Web Search Warning] Link search failed: {err}")
		return []


def format_web_context_for_prompt(web_results: list[dict[str, str]]) -> str:
	"""
	Format verified official links ONLY (no web snippets/text).
	Prevents hallucination by ensuring no third-party web text enters the prompt context.
	"""
	if not web_results:
		return ""

	parts = []
	for i, item in enumerate(web_results, 1):
		parts.append(f"[Official Link {i}: {item['title']}]\nVerified URL: {item['url']}")
	return "\n\n".join(parts)
