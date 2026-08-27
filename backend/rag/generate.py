"""Compose a grounded answer from retrieved context."""

from __future__ import annotations

from pathlib import Path
from typing import Any

from .retrieve import retrieve

NO_ANSWER = "I could not find this information in the available IP sources."


def answer_question(query: str, persist_dir: str | Path = "chroma_db", limit: int = 5) -> dict[str, Any]:
	"""Return retrieved evidence and a conservative answer without inventing facts."""
	chunks = retrieve(query, persist_dir, limit)
	if not chunks:
		return {"answer": NO_ANSWER, "citations": [], "grounded": False}
	citations = []
	seen_citations: set[tuple[str, int]] = set()
	evidence_parts = []
	for index, chunk in enumerate(chunks, start=1):
		citation_key = (chunk.source, chunk.page)
		if citation_key not in seen_citations:
			citations.append({"source": chunk.source, "page": chunk.page})
			seen_citations.add(citation_key)
		evidence_parts.append(f"[{index}] {chunk.text}")
	return {
		"answer": "Relevant information from the available sources:\n\n" + "\n\n".join(evidence_parts),
		"citations": citations,
		"grounded": True,
	}
