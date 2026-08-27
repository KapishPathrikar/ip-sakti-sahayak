"""Build the local Chroma knowledge base from PDF and text sources."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
from pathlib import Path
from typing import Any

COLLECTION_NAME = "ip-shakti-sahayak"
DEFAULT_CHUNK_SIZE = 900
DEFAULT_CHUNK_OVERLAP = 150
UPSERT_BATCH_SIZE = 2000
SECTION_PATTERN = re.compile(
	r"(?im)^(?P<heading>(?:chapter|part|section|rule|article|annexure|appendix|schedule)\s+[\w./()-]+.*|\d+(?:\.\d+)*[.)]?\s+[A-Z][^\n]{2,120})$"
)
NOISE_PATTERN = re.compile(r"^(?:page\s+)?\d+(?:\s+of\s+\d+)?$|^[|_\-]{3,}$", re.IGNORECASE)


def _clean_lines(text: str, repeated_lines: set[str] | None = None) -> list[str]:
	"""Remove common PDF extraction noise while retaining meaningful headings."""
	lines = [re.sub(r"\s+", " ", line).strip() for line in text.splitlines()]
	return [
		line
		for line in lines
		if line and not NOISE_PATTERN.fullmatch(line) and line.casefold() not in (repeated_lines or set())
	]


def _repeated_page_lines(pages: list[dict[str, Any]]) -> set[str]:
	"""Find lines repeated on at least three pages, usually headers or footers."""
	counts: dict[str, int] = {}
	for page in pages:
		seen = {line.casefold() for line in page["text"].splitlines() if line.strip()}
		for line in seen:
			counts[line] = counts.get(line, 0) + 1
	return {line for line, count in counts.items() if count >= 3 and len(line) > 3}


def _chunk_text(
	text: str,
	chunk_size: int = DEFAULT_CHUNK_SIZE,
	overlap: int = DEFAULT_CHUNK_OVERLAP,
) -> list[dict[str, str]]:
	"""Split cleaned text around headings, then bound each section by size."""
	if overlap >= chunk_size:
		raise ValueError("overlap must be smaller than chunk_size")
	lines = _clean_lines(text)
	sections: list[tuple[str, list[str]]] = []
	current_heading = "General"
	current_lines: list[str] = []
	for line in lines:
		match = SECTION_PATTERN.match(line)
		if match and current_lines:
			sections.append((current_heading, current_lines))
			current_lines = []
		if match:
			current_heading = match.group("heading")
		current_lines.append(line)
	if current_lines:
		sections.append((current_heading, current_lines))

	chunks: list[dict[str, str]] = []
	step = chunk_size - overlap
	for heading, section_lines in sections:
		section = " ".join(section_lines)
		for start in range(0, len(section), step):
			chunk = section[start : start + chunk_size]
			if chunk:
				chunks.append({"text": chunk, "section": heading})
	return chunks


def _read_source(path: Path) -> list[dict[str, Any]]:
	if path.suffix.lower() == ".pdf":
		from pypdf import PdfReader

		return [
			{"text": page.extract_text() or "", "page": page_number}
			for page_number, page in enumerate(PdfReader(str(path)).pages, start=1)
		]
	if path.suffix.lower() in {".txt", ".md"}:
		return [{"text": path.read_text(encoding="utf-8"), "page": None}]
	return []


def ingest_sources(
	source_dir: str | Path,
	persist_dir: str | Path = "chroma_db",
	chunk_size: int = DEFAULT_CHUNK_SIZE,
	overlap: int = DEFAULT_CHUNK_OVERLAP,
) -> dict[str, int]:
	"""Extract, chunk, embed, and persist supported sources with provenance."""
	import chromadb
	from chromadb.utils.embedding_functions import SentenceTransformerEmbeddingFunction

	source_root = Path(source_dir)
	client = chromadb.PersistentClient(path=str(persist_dir))
	embedding_function = SentenceTransformerEmbeddingFunction(model_name="all-MiniLM-L6-v2")
	collection = client.get_or_create_collection(COLLECTION_NAME, embedding_function=embedding_function)

	documents: list[str] = []
	ids: list[str] = []
	metadatas: list[dict[str, Any]] = []
	source_count = 0
	for path in sorted(source_root.rglob("*")):
		if not path.is_file() or path.suffix.lower() not in {".pdf", ".txt", ".md"}:
			continue
		source_count += 1
		pages = _read_source(path)
		repeated_lines = _repeated_page_lines(pages) if path.suffix.lower() == ".pdf" else set()
		for item in pages:
			cleaned_chunks = _chunk_text(
				"\n".join(_clean_lines(item["text"], repeated_lines)), chunk_size, overlap
			)
			for chunk_number, chunk in enumerate(cleaned_chunks):
				source_id = hashlib.sha256(f"{path}:{item['page']}:{chunk_number}".encode()).hexdigest()[:24]
				ids.append(source_id)
				documents.append(chunk["text"])
				metadatas.append(
					{
						"source": str(path.relative_to(source_root)),
						"page": item["page"] or 0,
						"chunk": chunk_number,
						"section": chunk["section"],
					}
				)
	if documents:
		for start in range(0, len(documents), UPSERT_BATCH_SIZE):
			end = min(start + UPSERT_BATCH_SIZE, len(documents))
			collection.upsert(
				ids=ids[start:end],
				documents=documents[start:end],
				metadatas=metadatas[start:end],
			)
	return {"sources": source_count, "chunks": len(documents)}


def main() -> None:
	parser = argparse.ArgumentParser(description=__doc__)
	parser.add_argument("source_dir", type=Path)
	parser.add_argument("--persist-dir", type=Path, default=Path("chroma_db"))
	args = parser.parse_args()
	print(json.dumps(ingest_sources(args.source_dir, args.persist_dir), indent=2))


if __name__ == "__main__":
	main()
