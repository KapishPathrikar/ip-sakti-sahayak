# IP Shakti Sahayak

IP Shakti Sahayak is an India-first, retrieval-augmented assistant for accessible intellectual-property information. It will provide source-backed guidance about patents, trademarks, copyright, and industrial designs. It is an information product, not a substitute for legal advice.

> Note: `Project.MD` supplied with this task describes a separate Flask college-event allocation system. The repository implements a Next.js and FastAPI IP-assistant foundation, so this repository plan follows the codebase rather than that reference document.

## Current architecture

- `frontend/`: Next.js 16 App Router interface.
- `backend/`: FastAPI API. `GET /health` is the Phase 0 integration contract.
- `corpus/`: source material organised as `national`, `international`, and `ayurveda`.
- `chroma_db/`: local, generated vector-store data; it is intentionally not committed.

## Phase-wise implementation plan

| Phase | Outcome | Key deliverables |
| --- | --- | --- |
| 0 — Foundation | An executable, safe development baseline | Documented scope and architecture; environment examples; CORS configuration; stable health contract; branded frontend shell and API status check. |
| 1 — Knowledge pipeline | Repeatable, traceable ingestion | Source inventory and metadata schema; PDF/text extraction; chunking; embeddings and Chroma persistence; ingest CLI and validation report. |
| 2 — Retrieval and answer API | Grounded answers with citations | Query/retrieval service; answer endpoint; source citations and confidence/no-answer policy; automated retrieval tests. |
| 3 — Conversational experience | Useful public-facing guided Q&amp;A | Chat UI; loading/error/empty states; citation viewer; topic suggestions; Hindi/regional-language input strategy. |
| 4 — Safety and quality | Trustworthy IP information delivery | Legal-information disclaimer; prompt-injection and citation checks; evaluation set; feedback capture; observability and rate limiting. |
| 5 — Production readiness | Deployable, maintainable service | Authentication only if required; admin source-management workflow; CI; container/deployment configuration; backups and monitoring. |

## Phase 0 status

Complete. The frontend now identifies the product and checks API availability at runtime. The API exposes a versioned health response and limits browser access to configured origins. No RAG model, source corpus, or legal-answer behavior has been introduced yet.

## Run locally

Use separate terminals from the repository root.

```powershell
py -m venv .venv
.\.venv\Scripts\Activate.ps1
py -m pip install -r requirements.txt
uvicorn main:app --app-dir backend --reload
```

```powershell
Copy-Item frontend\.env.example frontend\.env.local
Set-Location frontend
npm install
npm run dev
```

Open `http://localhost:3000`; API docs are available at `http://localhost:8000/docs`.
