# IP Shakti Sahayak 🇮🇳

**IP Shakti Sahayak** is an India-first, retrieval-augmented intelligence assistant designed for accessible intellectual-property law guidance, patent procedures, and traditional Ayurvedic knowledge protection. It delivers source-backed guidance with exact citations, multilingual comprehension (English, Hindi, and conversational Hinglish), safety guardrails, real-time token streaming, an instant 25-FAQ legal cache, and live web search augmentation for official government links.

> **Disclaimer:** *IP Shakti Sahayak is an informational product and does not constitute formal legal advice.*

---

## 🏛️ System Architecture

- **`frontend/`**: Next.js 16 App Router interface.
- **`backend/`**: FastAPI REST & Server-Sent Events (SSE) streaming server.
  - `backend/database.py`: SQLAlchemy engine (SQLite locally, PostgreSQL in production).
  - `backend/models.py`: Database tables (`users`, `chat_sessions`, `chat_messages`, `message_feedbacks`).
  - `backend/auth.py`: JWT token generation, bcrypt password hashing, and user dependencies.
  - `backend/schemas.py`: Pydantic validation schemas for Auth, Sessions, and Feedback.
  - `backend/rag/ingest.py`: PDF/text extractor & 768-dimensional vector chunker (`all-mpnet-base-v2`).
  - `backend/rag/retrieve.py`: In-memory singleton vector retriever with cosine similarity ranking (<90ms).
  - `backend/rag/generate.py`: Multi-tier LLM router (Ollama -> Cloud LiteLLM fallback -> Grounded context).
  - `backend/rag/translation.py`: Multi-dialect engine supporting English, pure Hindi (Devnagari), pure Marathi (Devnagari), Hinglish, and Marathish.
  - `backend/rag/safety.py`: Prompt-injection defense and off-topic guardrails with multilingual safety disclaimers (EN, HI, MR).
  - `backend/rag/rate_limiter.py`: Sliding-window limiter (5 req/min burst, 25/day guest, 50/day registered, FAQ exemption).
  - `backend/rag/session.py`: Persistent multi-turn conversational session history manager (`session_id`).
  - `backend/rag/fee_calculator.py`: Official Indian IP Statutory Fee Calculator (First Schedule of Patent Rules 2024).
  - `backend/rag/patentability_wizard.py`: "Am I Patentable?" Statutory risk assessment wizard (Section 3 & NBA analysis).
  - `backend/rag/pdf_exporter.py`: Official Legal Consultation Advisory Report generator in formatted PDF.
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
| **3 — Conversational & Multilingual** | Multi-turn & vernacular support | Multi-turn session memory (`POST /api/chat`), history endpoints, English / Hindi / Marathi / Hinglish translation layer. | ✅ **Complete** |
| **4 — Safety & Guardrails** | Trustworthy legal delivery | Prompt-injection prevention, off-topic question blocking, statutory disclaimers, sliding-window rate limiting (25 queries/24h, 5 req/min burst, FAQ exemption), automated unit test suite. | ✅ **Complete** |
| **5 — Streaming & Semantic Cache** | Low-latency real-time response | SSE token streaming (`POST /api/chat/stream`), 25 pre-verified legal FAQs with instant (<0.01s) deterministic answering (`GET /api/faqs`), and Live Web Search for clickable government links. | ✅ **Complete** |
| **6 — Persistence & Authentication** | Production database & user accounts | SQLite/PostgreSQL persistence (`users`, `chat_sessions`, `chat_messages`), JWT authentication (`POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`), user chat history (`GET /api/chat/my-sessions`), feedback rating (`POST /api/feedback`), and 50 queries/day registered user quota. | ✅ **Complete** |
| **7 — Legal Calculators & PDF Export** | Interactive tools & formal reports | Official IP Fee Calculator (`POST /api/tools/fee-calculator`), "Am I Patentable?" Wizard (`POST /api/tools/patentability-check`), and PDF Consultation Advisory Export (`GET /api/chat/export/{session_id}`). | ✅ **Complete** |




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

### 🧪 Comprehensive Backend Testing
A complete test suite is available for validating the backend:

```bash
# Run comprehensive test suite
python test_backend.py

# Test includes:
# - Health checks
# - FAQ system validation
# - RAG pipeline testing
# - Streaming endpoint verification
# - Postman collection generation
```

### 📱 Postman API Testing
Import the generated `postman_collection.json` into Postman for easy API testing:
- Health checks
- FAQ queries
- RAG question answering
- Streaming chat endpoints

### 🌐 API Testing with curl
```bash
# Health check
curl http://localhost:8000/health

# List all FAQs
curl http://localhost:8000/api/faqs

# Ask FAQ question (works without Ollama)
curl -X POST "http://localhost:8000/api/ask" \
  -H "Content-Type: application/json" \
  -d '{"query": "What is Intellectual Property?", "limit": 4}'

# Test streaming (needs Ollama)
curl -X POST "http://localhost:8000/api/chat/stream" \
  -H "Content-Type: application/json" \
  -d '{"query": "Explain patent law in India"}' \
  -N
```

---

### 🔬 Run Automated Unit Test Suite
```powershell
python -m unittest backend/tests/test_api.py
```

## 🚀 Alternative Deployment Options

### Option A: Cloud LLM (No Ollama Installation)
The system supports cloud-based LLMs through free APIs:
1. Get API key from [Together.ai](https://www.together.ai), [OpenRouter](https://openrouter.ai), or [Groq](https://console.groq.com)
2. Add to `backend/.env`:
   ```
   TOGETHER_API_KEY=your_key_here
   USE_CLOUD_LLM=true
   ```
3. Restart backend server

### Option B: FAQ-Only Mode (Immediate Testing)
The FAQ system with 25 pre-verified legal questions works immediately without any LLM setup, perfect for frontend development.

### Option C: Full Ollama (Recommended)
For best performance, install Ollama and use local models.

---

## 🔧 Recent Enhancements (August 28, 2026)

### Backend Improvements
- **Cloud LLM Integration**: Added support for Together.ai, OpenRouter, and Groq APIs
- **Enhanced Testing**: Comprehensive test suite with Postman collection generation
- **Error Handling**: Graceful fallbacks and mock responses for testing
- **Documentation**: Complete development report and updated guides
- **Environment Configuration**: Simplified `.env` setup with multiple deployment options

### System Features
- **Multiple LLM Options**: Local Ollama, Cloud APIs, or FAQ-only mode
- **Comprehensive Testing**: Health checks, FAQ validation, RAG testing
- **Easy Integration**: Ready for frontend development with fully documented API
- **Flexible Deployment**: Works on Windows, macOS, and Linux systems

For detailed development report, see [DEVELOPMENT_REPORT_2026_08_28.md](DEVELOPMENT_REPORT_2026_08_28.md)
