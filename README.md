# IP Shakti Sahayak 🇮🇳

**IP Shakti Sahayak** is an India-first, retrieval-augmented intelligence assistant designed for accessible intellectual-property law guidance, patent procedures, and traditional Ayurvedic knowledge protection. It delivers source-backed guidance with exact citations, multilingual comprehension (English, Hindi, and conversational Hinglish), safety guardrails, real-time token streaming, an instant 25-FAQ legal cache, and live web search augmentation for official government links.

> **Disclaimer:** *IP Shakti Sahayak is an informational product and does not constitute formal legal advice.*

---

## 🏛️ System Architecture

- **`frontend/`**: Next.js 16 App Router interface.
- **`backend/`**: FastAPI REST & Server-Sent Events (SSE) streaming server.
  - `backend/rag/ingest.py`: PDF/text extractor & 768-dimensional vector chunker (`all-mpnet-base-v2`).
  - `backend/rag/retrieve.py`: In-memory singleton vector retriever with cosine similarity ranking (<90ms).
  - `backend/rag/generate.py`: Ollama LLM generator with prompt crafting, keep-alive, and real-time SSE streaming.
  - `backend/rag/translation.py`: Multi-dialect engine supporting English, pure Hindi (Devnagari), and conversational Hinglish.
  - `backend/rag/safety.py`: Prompt-injection defense and off-topic guardrails with multilingual safety disclaimers.
  - `backend/rag/session.py`: Multi-turn conversational session history manager (`session_id`).
  - `backend/rag/faq_matcher.py`: In-memory semantic matcher for instant (<0.01s) deterministic legal answers.
  - `backend/data/faqs.json`: 25 curated, statutory-backed legal FAQs with exact section citations.
  - `backend/rag/web_search.py`: Live web search augmentation for real-time government updates and clickable links.
- **`corpus/`**: Official legal source manuals organized as `national`, `international`, and `ayurveda`.
- **`chroma_db/`**: Local 768-dimension vector database (generated on-demand, git-ignored).

---

## 📋 Phase-Wise Implementation Status

| Phase | Outcome | Key Deliverables | Status |
|---|---|---|---|
| **0 — Foundation** | Development baseline | Scope & architecture, CORS configuration, stable health contract (`GET /health`), clean project structure. | ✅ **Complete** |
| **1 — Knowledge Pipeline** | Traceable ingestion | PDF extraction, provenance tracking, chunking, and 768-dim `all-mpnet-base-v2` persistence (18,518 chunks). | ✅ **Complete** |
| **2 — Retrieval & Answer API** | Grounded answers with citations | Chroma vector search, answer endpoint (`POST /api/ask`), exact source citations, calibrated confidence scoring. | ✅ **Complete** |
| **3 — Conversational & Multilingual** | Multi-turn & vernacular support | Multi-turn session memory (`POST /api/chat`), history endpoints, English / Hindi / Hinglish translation layer. | ✅ **Complete** |
| **4 — Safety & Guardrails** | Trustworthy legal delivery | Prompt-injection prevention, off-topic question blocking, statutory disclaimers, automated unit test suite. | ✅ **Complete** |
| **5 — Streaming & Semantic Cache** | Low-latency real-time response | SSE token streaming (`POST /api/chat/stream`), 25 pre-verified legal FAQs with instant (<0.01s) deterministic answering (`GET /api/faqs`), and Live Web Search for clickable government links. | ✅ **Complete** |

---

## 🚀 Quickstart: Run Locally

### 1. Prerequisites
- **Python 3.10+**
- **Node.js 18+**
- **[Ollama](https://ollama.com)** with model pulled:
  ```powershell
  ollama pull gpt-oss:20b
  ```
  *(Alternative lighter models: `ollama pull qwen3:14b` or `ollama pull llama3.2:3b`)*

---

### 2. Backend Setup & Ingestion

From the repository root in PowerShell:

```powershell
# Create and activate virtual environment
python -m venv .venv
.\.venv\Scripts\Activate.ps1

# Install dependencies
pip install -r requirements.txt

# One-time ingestion: Build the 768-dim Chroma vector database (18,518 chunks)
python backend/rag/ingest.py corpus

# Start FastAPI backend server
uvicorn backend.main:app --reload --port 8000
```
- **API Root:** `http://localhost:8000`
- **Interactive Swagger Docs:** `http://localhost:8000/docs`

---

### 3. Frontend Setup

In a separate terminal:

```powershell
# Navigate to frontend folder
cd frontend

# Set up local environment variables
Copy-Item .env.example .env.local

# Install Node dependencies and start dev server
npm install
npm run dev
```
- **Web App Interface:** `http://localhost:3000`

---

## 🧪 Interactive Chat & Testing Tools

### 💬 Interactive Continuous Terminal Chat (Instant Responses, Zero Reload Delay)
Run persistent chat mode where models load into memory once and stay hot for continuous conversations:

```powershell
python backend/rag/generate.py
```
* Supports multi-turn memory context.
* Supports English, Hindi (Devnagari), and conversational Hinglish.
* Type `clear` to reset conversation context | Type `exit` to quit.

---

### ⚡ Single-Query Streaming CLI
```powershell
# Standard legal question
python backend/rag/generate.py "What are the rules for patent filing in India?"

# Hinglish query
python backend/rag/generate.py "Ayurvedic medicine ka patent kaise le?"

# Direct FAQ cache hit (Instant <0.01s)
python backend/rag/generate.py "Can an Ayurvedic formulation be patented?"

# Live Web link query
python backend/rag/generate.py "Give me the official website link to apply for an Indian patent online"
```

---

### 🔬 Run Automated Unit Test Suite
```powershell
python -m unittest backend/tests/test_api.py
```
