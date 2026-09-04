"""Tests for the provenance-preserving knowledge ingestion pipeline."""

from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

try:
    from rag.ingest import _chunk_text, _read_source, _clean_lines
except ModuleNotFoundError:
    from backend.rag.ingest import _chunk_text, _read_source, _clean_lines


class IngestionTests(unittest.TestCase):
    """Validate text reading, cleaning, and heading-aware chunking."""

    def test_clean_lines_and_read_source(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            corpus_directory = Path(temporary_directory)
            source_path = corpus_directory / "guide.txt"
            source_path.write_text("  Patent\n\n filing guidance. \npage 1 of 5\n", encoding="utf-8")

            pages = _read_source(source_path)
            self.assertEqual(len(pages), 1)
            cleaned = _clean_lines(pages[0]["text"])
            self.assertIn("Patent", cleaned)
            self.assertNotIn("page 1 of 5", cleaned)

    def test_chunk_text_heading_and_bounds(self) -> None:
        raw_text = "Section 3(d) of the Patents Act\n" + ("Inventions that are not patentable. " * 30)
        chunks = _chunk_text(raw_text, chunk_size=200, overlap=50)

        self.assertGreater(len(chunks), 1)
        self.assertTrue(chunks[0]["section"].startswith("Section 3(d)"))
        for chunk in chunks:
            self.assertLessEqual(len(chunk["text"]), 200)


if __name__ == "__main__":
    unittest.main()

