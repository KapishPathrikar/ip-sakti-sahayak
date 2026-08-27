"""Retrieve source-backed context from the local Chroma knowledge base."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from .ingest import COLLECTION_NAME

DEFAULT_MAX_DISTANCE = 0.5


@dataclass(frozen=True)
class RetrievedChunk:
	text: str
	source: str
	page: int
	distance: float


def retrieve(
	query: str,
	persist_dir: str | Path = "chroma_db",
	limit: int = 5,
	max_distance: float = DEFAULT_MAX_DISTANCE,
) -> list[RetrievedChunk]:
	"""Return nearest chunks, preserving source and page provenance."""
	if not query.strip() or limit < 1 or max_distance < 0:
		return []
	import chromadb
	from chromadb.utils.embedding_functions import SentenceTransformerEmbeddingFunction

	client = chromadb.PersistentClient(path=str(persist_dir))
	collection = client.get_collection(
		COLLECTION_NAME,
		embedding_function=SentenceTransformerEmbeddingFunction(model_name="all-MiniLM-L6-v2"),
	)
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
