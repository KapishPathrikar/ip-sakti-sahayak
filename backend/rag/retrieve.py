"""Retrieve source-backed context from the local Chroma knowledge base."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any


import os
import httpx

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

HF_ROUTER_URL = "https://router.huggingface.co/hf-inference/models/sentence-transformers/all-mpnet-base-v2"


def get_remote_query_embedding(text: str) -> list[float] | None:
	"""Fetch 768-dim query embedding via Hugging Face Serverless API.
	Runs in ~150ms and avoids loading 420MB PyTorch into memory, preventing Render 512MB OOM crashes.
	"""
	token = os.getenv("HF_TOKEN", "").strip()
	if not token:
		return None
	try:
		res = httpx.post(
			HF_ROUTER_URL,
			headers={
				"Authorization": f"Bearer {token}",
				"Content-Type": "application/json",
			},
			json={"inputs": text},
			timeout=15.0,
		)
		if res.status_code == 200:
			data = res.json()
			if isinstance(data, list) and len(data) > 0:
				if isinstance(data[0], list):
					return [float(x) for x in data[0]]
				return [float(x) for x in data]
		else:
			print(f"[Embedding Warning] HF API returned {res.status_code}: {res.text[:200]}")
	except Exception as err:
		print(f"[Embedding Error] Failed remote embedding call: {err}")
	return None


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

		token = os.getenv("HF_TOKEN", "").strip()
		if token:
			# Remote embedding active: connect to collection without loading PyTorch in RAM
			try:
				_COLLECTION_CACHE[key] = client.get_collection(COLLECTION_NAME)
			except Exception:
				_COLLECTION_CACHE[key] = client.get_or_create_collection(COLLECTION_NAME)
		else:
			_COLLECTION_CACHE[key] = client.get_or_create_collection(
				COLLECTION_NAME,
				embedding_function=_get_embedding_function(),
			)
	return _COLLECTION_CACHE[key]


def _is_india_source(source: str) -> bool:
	s = source.replace("\\", "/").lower()
	return "national" in s or "ayurveda" in s


def _is_international_source(source: str) -> bool:
	s = source.replace("\\", "/").lower()
	return "international" in s


def retrieve(
	query: str,
	persist_dir: str | Path = DEFAULT_CHROMA_DB,
	limit: int = 5,
	max_distance: float = DEFAULT_MAX_DISTANCE,
	jurisdiction: str = "india",
) -> list[RetrievedChunk]:
	"""Return nearest chunks, preserving source and page provenance (using cached vector client)
	with jurisdiction-specific statutory filtering and comparative split support."""
	if not query.strip() or limit < 1 or max_distance < 0:
		return []

	# Candidate pool size to allow jurisdiction filtering
	candidate_limit = max(limit * 3, 18)

	collection = _get_collection(persist_dir)
	remote_vec = get_remote_query_embedding(query)

	def _query_collection(col: Any) -> dict[str, Any]:
		if remote_vec is not None:
			return col.query(query_embeddings=[remote_vec], n_results=candidate_limit)
		return col.query(query_texts=[query], n_results=candidate_limit)

	try:
		result = _query_collection(collection)
	except Exception as err:
		print(f"[Retrieve Warning] Query failed with cached collection: {err}. Refreshing connection...")
		_COLLECTION_CACHE.pop(str(persist_dir), None)
		_CLIENT_CACHE.pop(str(persist_dir), None)
		collection = _get_collection(persist_dir)
		result = _query_collection(collection)

	documents = result.get("documents", [[]])[0]
	metadatas = result.get("metadatas", [[]])[0]
	distances = result.get("distances", [[]])[0]
	all_chunks: list[RetrievedChunk] = []
	seen: set[tuple[str, int, str]] = set()
	for document, metadata, distance in zip(documents, metadatas, distances):
		source = metadata.get("source", "unknown")
		page = int(metadata.get("page", 0))
		key = (source, page, document)
		if float(distance) > max_distance or key in seen:
			continue
		seen.add(key)
		all_chunks.append(RetrievedChunk(text=document, source=source, page=page, distance=float(distance)))

	jur = (jurisdiction or "india").strip().lower()

	if jur == "comparative":
		# Balanced dual-regime retrieval
		india_chunks = [c for c in all_chunks if _is_india_source(c.source)]
		intl_chunks = [c for c in all_chunks if _is_international_source(c.source)]
		
		target_each = max(1, limit // 2)
		selected_india = india_chunks[:target_each]
		selected_intl = intl_chunks[:target_each]

		# Interleave: [India, Intl, India, Intl]
		interleaved: list[RetrievedChunk] = []
		for i in range(max(len(selected_india), len(selected_intl))):
			if i < len(selected_india):
				interleaved.append(selected_india[i])
			if i < len(selected_intl):
				interleaved.append(selected_intl[i])

		# Fallback if one pool had too few chunks
		remaining_capacity = limit - len(interleaved)
		if remaining_capacity > 0:
			used_set = set((c.source, c.page, c.text) for c in interleaved)
			for c in all_chunks:
				if (c.source, c.page, c.text) not in used_set:
					interleaved.append(c)
					if len(interleaved) >= limit:
						break

		return interleaved[:limit]

	elif jur == "international":
		intl_chunks = [c for c in all_chunks if _is_international_source(c.source)]
		if len(intl_chunks) >= limit:
			return intl_chunks[:limit]
		# Fallback: add remaining chunks
		other_chunks = [c for c in all_chunks if not _is_international_source(c.source)]
		return (intl_chunks + other_chunks)[:limit]

	elif jur == "india":
		india_chunks = [c for c in all_chunks if _is_india_source(c.source)]
		if len(india_chunks) >= limit:
			return india_chunks[:limit]
		# Fallback: add remaining chunks
		other_chunks = [c for c in all_chunks if not _is_india_source(c.source)]
		return (india_chunks + other_chunks)[:limit]

	return all_chunks[:limit]


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

