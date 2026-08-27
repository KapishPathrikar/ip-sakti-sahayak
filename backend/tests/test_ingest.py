"""Tests for the provenance-preserving knowledge ingestion pipeline."""

from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from rag.ingest import create_chunks, discover_sources


class IngestionTests(unittest.TestCase):
    """Validate local source discovery and deterministic chunk metadata."""

    def test_discovers_text_source_with_category_and_checksum(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            corpus_directory = Path(temporary_directory)
            source_path = corpus_directory / "national" / "guide.txt"
            source_path.parent.mkdir()
            source_path.write_text("  Patent\n\n filing guidance. ", encoding="utf-8")

            sources, errors = discover_sources(corpus_directory)

        self.assertEqual(errors, [])
        self.assertEqual(len(sources), 1)
        self.assertEqual(sources[0].source_path, "national/guide.txt")
        self.assertEqual(sources[0].category, "national")
        self.assertEqual(sources[0].text, "Patent\n\nfiling guidance.")
        self.assertEqual(len(sources[0].checksum), 64)

    def test_chunks_keep_citation_metadata_and_stable_ids(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            corpus_directory = Path(temporary_directory)
            source_path = corpus_directory / "international" / "overview.txt"
            source_path.parent.mkdir()
            source_path.write_text("word " * 100, encoding="utf-8")
            sources, errors = discover_sources(corpus_directory)

        self.assertEqual(errors, [])
        chunks = create_chunks(sources[0], chunk_size=100, overlap=20)

        self.assertGreater(len(chunks), 1)
        self.assertTrue(chunks[0].id.endswith("-0000"))
        self.assertEqual(chunks[0].metadata["source_path"], "international/overview.txt")
        self.assertEqual(chunks[0].metadata["total_chunks"], len(chunks))
        self.assertEqual(chunks[-1].metadata["chunk_index"], len(chunks) - 1)


if __name__ == "__main__":
    unittest.main()
