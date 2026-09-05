"""Retrieve source-backed context from the local Chroma knowledge base."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any


try:
	from .ingest import COLLECTION_NAME, EMBEDDING_MODEL_NAME
except (ImportError, ValueError):
	import sys
	from pathlib import Path
	sys.path.insert(0, str(Path(__file__).resolve().parent))
	from ingest import COLLECTION_NAME, EMBEDDING_MODEL_NAME

HIGH_SIMILARITY_MAX_DISTANCE = 0.32
HIGH_SIMILARITY_MIN_CONFIDENCE = 80
DEFAULT_MAX_DISTANCE = 0.65
DEFAULT_CHROMA_DB = str(Path(__file__).resolve().parent.parent.parent / "chroma_db")

@dataclass(frozen=True)
class RetrievedChunk:
	text: str
	source: str
	page: int
	distance: float

def is_within_corpus_boundary(chunks: list[RetrievedChunk], threshold: float = HIGH_SIMILARITY_MAX_DISTANCE) -> bool:
	"""Check if at least one retrieved chunk satisfies the high-similarity corpus boundary."""
	if not chunks:
		return False
	return min(c.distance for c in chunks) <= threshold

def calculate_chunk_confidence(distance: float) -> int:
	"""Calculate calibrated percentage confidence from distance (0-99%)."""
	raw_sim = max(0.0, 1.0 - distance)
	return max(0, min(99, round((raw_sim ** 0.6) * 100)))



_CLIENT_CACHE: dict[str, Any] = {}
_COLLECTION_CACHE: dict[str, Any] = {}
_EMBEDDING_FUNCTION: Any = None


def _get_embedding_function() -> Any:
	global _EMBEDDING_FUNCTION
	if _EMBEDDING_FUNCTION is None:
		print("DEBUG: Initializing SentenceTransformer embedding function (this may take a moment)...")
		from chromadb.utils.embedding_functions import SentenceTransformerEmbeddingFunction
		_EMBEDDING_FUNCTION = SentenceTransformerEmbeddingFunction(model_name=EMBEDDING_MODEL_NAME)
		print("DEBUG: Embedding function loaded successfully.")
	return _EMBEDDING_FUNCTION



def _get_collection(persist_dir: str | Path = DEFAULT_CHROMA_DB) -> Any:
	key = str(persist_dir)
	print(f"DEBUG: Connecting to ChromaDB at {key}")
	if key not in _COLLECTION_CACHE:
		import chromadb
		client = chromadb.PersistentClient(path=key)
		_CLIENT_CACHE[key] = client
		_COLLECTION_CACHE[key] = client.get_or_create_collection(
			COLLECTION_NAME,
			embedding_function=_get_embedding_function(),
		)
	return _COLLECTION_CACHE[key]


def retrieve(
	query: str,
	persist_dir: str | Path = DEFAULT_CHROMA_DB,
	limit: int = 5,
	max_distance: float = DEFAULT_MAX_DISTANCE,
) -> list[RetrievedChunk]:
	"""Return nearest chunks, preserving source and page provenance (using cached vector client)."""
	if not query.strip() or limit < 1 or max_distance < 0:
		return []

	collection = _get_collection(persist_dir)
	try:
		result = collection.query(query_texts=[query], n_results=limit)
	except Exception as err:
		print(f"[Retrieve Warning] Query failed with cached collection: {err}. Refreshing connection...")
		_COLLECTION_CACHE.pop(str(persist_dir), None)
		_CLIENT_CACHE.pop(str(persist_dir), None)
		collection = _get_collection(persist_dir)
		result = collection.query(query_texts=[query], n_results=limit)

	documents = result.get("documents", [[]])[0]
	metadatas = result.get("metadatas", [[]])[0]
	distances = result.get("distances", [[]])[0]
	chunks: list[RetrievedChunk] = []
	seen: set[tuple[str, int, str]] = set()
	for document, metadata, distance in zip(documents, metadatas, distances):
		source = metadata.get("source", "unknown")
		page = int(metadata.get("page", 0))
		key = (source, page, document)
		if float(distance) > max_distance or key in seen:
			continue
		seen.add(key)
		chunks.append(RetrievedChunk(text=document, source=source, page=page, distance=float(distance)))
	return chunks


def main() -> None:
	import argparse
	import json

	parser = argparse.ArgumentParser(description=__doc__)
	parser.add_argument("query", type=str, help="Search query")
	parser.add_argument("--persist-dir", type=Path, default=Path("chroma_db"))
	parser.add_argument("--limit", type=int, default=3)
	parser.add_argument("--max-distance", type=float, default=1.5)
	args = parser.parse_args()

	results = retrieve(args.query, persist_dir=args.persist_dir, limit=args.limit, max_distance=args.max_distance)
	if not results:
		print("No relevant chunks found.")
		return

	print(f"\nFound {len(results)} relevant chunks:\n" + "=" * 50)
	for i, chunk in enumerate(results, 1):
		print(f"\n[{i}] Source: {chunk.source} (Page {chunk.page}) | Distance: {chunk.distance:.4f}")
		print(f"{chunk.text}\n" + "-" * 50)


if __name__ == "__main__":
	main()

