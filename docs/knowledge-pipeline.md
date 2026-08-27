# Knowledge pipeline

Phase 1 turns source files in `corpus/` into a local Chroma collection. Keep source materials organised by topic or jurisdiction, for example:

```text
corpus/
  national/
    patents-act.pdf
    trademarks-faq.md
  international/
    wipo-overview.pdf
  ayurveda/
    traditional-knowledge-note.txt
```

Supported formats are UTF-8 `.txt` and `.md` files plus text-based `.pdf` files. Scanned PDFs without an OCR text layer are reported as errors rather than silently indexed. Do not add files until their authority, licence, publication date, and jurisdiction have been checked.

Run a non-destructive validation first:

```powershell
py backend/rag/ingest.py --dry-run
```

Then build the local index:

```powershell
py backend/rag/ingest.py
```

The first full run may download the configured `all-MiniLM-L6-v2` embedding model. The collection and `ingestion_manifest.json` are written under `chroma_db/` and excluded from Git. The manifest records source checksums, categories, character counts, chunk counts, and validation errors.

Each chunk stores its exact source path, source checksum, category, type, character span, and chunk order. Phase 2 must return this metadata as citations; it must not answer from retrieved text without showing the source.
