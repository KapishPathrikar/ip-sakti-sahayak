# RAG Change Report

## Overview
This project now includes a working local retrieval pipeline for the IP Shakti Sahayak corpus. The work focused on organizing the legal and policy PDFs, extracting clean text, chunking it into retrievable segments, embedding those chunks into ChromaDB, and validating retrieval quality against real domain queries.

## Files changed

### 1) Corpus organization
The source PDF set was organized into a structured corpus under the project root:

- [corpus/national](corpus/national)
- [corpus/ayurveda](corpus/ayurveda)
- [corpus/international](corpus/international)

This ensured the ingestion pipeline could process a curated and category-based knowledge base.

### 2) Ingestion pipeline
Updated [backend/rag/ingest.py](backend/rag/ingest.py) to:

- discover supported PDF/text files recursively
- extract page-level content using `pypdf`
- remove repeated headers, footers, page numbers, and noisy separators
- detect section-like headings and preserve them in metadata
- split text into overlapping chunks using a configurable chunk size and overlap
- assign source, page, section, and chunk provenance metadata
- upsert chunks to Chroma in safe batches to avoid Chroma batch-size errors
- support persistent local embedding storage through `chroma_db`

Important implementation details:
- default chunk size: 900 characters
- default overlap: 150 characters
- persistent collection name: `ip-shakti-sahayak`
- batched `collection.upsert(...)` calls to keep writes under Chroma limits

### 3) Retrieval layer
Updated [backend/rag/retrieve.py](backend/rag/retrieve.py) to:

- connect to the persistent Chroma collection
- generate embeddings using `all-mpnet-base-v2`
- query the vector database for the top matching chunks
- filter out results above the configured threshold
- return structured results with source, page, distance, and text

### 4) Response generation layer
Updated [backend/rag/generate.py](backend/rag/generate.py) to:

- retrieve evidence from the vector store
- reject empty or irrelevant retrieval results conservatively
- build grounded responses with citations
- return a no-answer message when the evidence is insufficient

### 5) Repository configuration
Updated [.gitignore](.gitignore) to:

- ignore generated ChromaDB files
- ignore local environment artifacts
- ignore the local implementation plan PDF

## Embedding run results
The final verified collection state is:

- total chunks embedded: 18,506
- unique source PDFs embedded: 10

Verified source list:

- Botanical-Drug-Development--Guidance-for-Industry.pdf
- Drugs Rules 1945_2024 09.pdf
- Drugs and Cosmetics Act, 1940.pdf
- EU_EMA_Quality_Herbal_Guideline_Rev3_2022.PDF
- Food Safety and Standards (Ayurveda Aahara) Regulations, 2022.pdf
- Guidelines for Examinations of Ayush Related Inventions.pdf
- Manual of Patent Office Practice and Procedure - 2019.PDF
- The Ayurvedic Formulary of India - Part I - Second Revised English Edition.pdf
- The Biological Diversity (Amendment) Act, 2023.pdf
- The Biological Diversity Act, 2002 and the Biological Diversity (Amendment) Act, 2023.pdf

## Retrieval validation
A real evaluation was performed using 23 queries against the populated Chroma index.

Results:

- passed: 21
- total: 23
- accuracy: 91.3%

The test set covered:

- legal and policy queries
- Ayurveda and AYUSH topics
- herbal quality guideline queries
- unrelated/no-answer queries

Observed performance:

- strong results for domain-specific legal and regulatory questions
- good citation and source provenance
- occasional false positives when the query is off-domain or loosely related
- the retrieval layer is usable, but the no-answer filtering could be stricter

## Key issues addressed

### Batch-size failure
An initial full-corpus ingestion attempt failed with:

> `Batch size of 18506 is greater than max batch size of 5461`

This was resolved by batching Chroma upserts into smaller groups before writing.

### Invalid PDF-header issue
Some runs encountered:

> `invalid pdf header: b' %PDF'`

This was traced to files being included in the ingest directory that were not valid PDF files or were malformed. The corpus was checked and the valid PDFs were confirmed; the successful final ingestion run completed with all 10 source files embedded.

## Final status
The project now has a working, persistent local RAG pipeline backed by ChromaDB with all ten corpus PDFs ingested and retrievable.

This represents the main functional milestones achieved:

- corpus organized and prepared
- ingestion pipeline stabilized
- embeddings generated successfully
- retrieval pipeline validated with real queries
- citations and grounded answers implemented

## Recommendations
1. Keep the corpus in a controlled storage location if redistributing PDFs is restricted by licensing.
2. Add stricter relevance filtering to reduce false positives on unrelated questions.
3. Optionally add a small automated test suite under the project to keep retrieval quality from regressing.
