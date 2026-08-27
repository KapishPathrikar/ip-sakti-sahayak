"""FastAPI entry point for IP Shakti Sahayak."""

from __future__ import annotations

from typing import Any
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

try:
    from config import APP_NAME, APP_VERSION, CORS_ORIGINS
except ImportError:
    from backend.config import APP_NAME, APP_VERSION, CORS_ORIGINS

try:
    from rag.generate import answer_question, answer_question_stream, DEFAULT_OLLAMA_MODEL
    from rag.retrieve import retrieve
    from rag.session import session_manager
    from rag.faq_matcher import load_faqs
except (ImportError, ValueError):
    from backend.rag.generate import answer_question, answer_question_stream, DEFAULT_OLLAMA_MODEL
    from backend.rag.retrieve import retrieve
    from backend.rag.session import session_manager
    from backend.rag.faq_matcher import load_faqs




class HealthResponse(BaseModel):
    """Stable response contract used by the web client and deployment checks."""

    status: str
    service: str
    version: str


class Citation(BaseModel):
    source: str
    page: int
    confidence: str | None = None


class AskRequest(BaseModel):
    query: str = Field(..., min_length=2, description="Question about Indian IP laws or procedures")
    limit: int = Field(default=4, ge=1, le=10, description="Max source chunks to retrieve")
    model: str | None = Field(default=None, description="Optional Ollama model override")


class AskResponse(BaseModel):
    answer: str
    citations: list[Citation]
    grounded: bool
    disclaimer: str = "This service provides informational guidance on Indian IP law and does not constitute formal legal advice."


class ChatRequest(BaseModel):
    query: str = Field(..., min_length=2, description="Question for multi-turn chat")
    session_id: str | None = Field(default=None, description="Optional session ID for memory context")
    limit: int = Field(default=4, ge=1, le=10, description="Max source chunks to retrieve")
    model: str | None = Field(default=None, description="Optional Ollama model override")


class ChatResponse(BaseModel):
    answer: str
    citations: list[Citation]
    grounded: bool
    session_id: str
    disclaimer: str = "This service provides informational guidance on Indian IP law and does not constitute formal legal advice."


class SearchChunk(BaseModel):
    text: str
    source: str
    page: int
    distance: float


class SearchResponse(BaseModel):
    query: str
    chunks: list[SearchChunk]


app = FastAPI(title=APP_NAME, version=APP_VERSION)
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)


@app.get("/", tags=["system"])
def root():
    """Root endpoint welcoming the user and pointing to docs."""
    return {
        "message": f"Welcome to {APP_NAME}",
        "version": APP_VERSION,
        "docs": "/docs",
        "health": "/health",
    }


@app.get("/health", response_model=HealthResponse, tags=["system"])
def health_check() -> HealthResponse:
    """Report whether the API process is available."""
    return HealthResponse(status="ok", service="ip-shakti-sahayak", version=APP_VERSION)


@app.post("/api/ask", response_model=AskResponse, tags=["rag"])
def ask_question_endpoint(payload: AskRequest) -> AskResponse:
    """Ask a standalone question about Indian IP laws and receive a grounded answer with citations."""
    try:
        model_name = payload.model or DEFAULT_OLLAMA_MODEL
        result = answer_question(
            query=payload.query,
            limit=payload.limit,
            model=model_name,
        )
        return AskResponse(
            answer=result["answer"],
            citations=[Citation(**c) for c in result.get("citations", [])],
            grounded=result.get("grounded", False),
        )
    except Exception as err:
        raise HTTPException(status_code=500, detail=f"Failed to generate answer: {str(err)}")


@app.post("/api/chat", response_model=ChatResponse, tags=["chat"])
def chat_endpoint(payload: ChatRequest) -> ChatResponse:
    """Multi-turn conversational chat with session memory and context continuity."""
    try:
        model_name = payload.model or DEFAULT_OLLAMA_MODEL
        result = answer_question(
            query=payload.query,
            limit=payload.limit,
            model=model_name,
            session_id=payload.session_id,
        )
        return ChatResponse(
            answer=result["answer"],
            citations=[Citation(**c) for c in result.get("citations", [])],
            grounded=result.get("grounded", False),
            session_id=result.get("session_id") or "default",
        )
    except Exception as err:
        raise HTTPException(status_code=500, detail=f"Chat generation failed: {str(err)}")


@app.post("/api/chat/stream", tags=["chat"])
def chat_stream_endpoint(payload: ChatRequest):
    """Stream token-by-token answer via Server-Sent Events (SSE) for low-latency UI rendering."""
    try:
        model_name = payload.model or DEFAULT_OLLAMA_MODEL
        generator = answer_question_stream(
            query=payload.query,
            limit=payload.limit,
            model=model_name,
            session_id=payload.session_id,
        )
        return StreamingResponse(generator, media_type="text/event-stream")
    except Exception as err:
        raise HTTPException(status_code=500, detail=f"Streaming failed: {str(err)}")



@app.get("/api/chat/history/{session_id}", tags=["chat"])
def get_chat_history_endpoint(session_id: str) -> dict[str, Any]:
    """Retrieve full conversation history for a given session."""
    return {
        "session_id": session_id,
        "history": session_manager.get_history(session_id),
    }


@app.delete("/api/chat/history/{session_id}", tags=["chat"])
def clear_chat_history_endpoint(session_id: str) -> dict[str, Any]:
    """Clear conversation history for a given session."""
    cleared = session_manager.clear_session(session_id)
    return {
        "session_id": session_id,
        "cleared": cleared,
    }


@app.get("/api/chat/sessions", tags=["chat"])
def list_sessions_endpoint() -> dict[str, Any]:
    """List all currently active conversation session IDs."""
    return {
        "sessions": session_manager.list_sessions(),
    }


@app.post("/api/retrieve", response_model=SearchResponse, tags=["rag"])
def retrieve_endpoint(payload: AskRequest) -> SearchResponse:
    """Perform direct semantic search across the ChromaDB vector database."""
    try:
        chunks = retrieve(query=payload.query, limit=payload.limit)
        return SearchResponse(
            query=payload.query,
            chunks=[
                SearchChunk(
                    text=chunk.text,
                    source=chunk.source,
                    page=chunk.page,
                    distance=chunk.distance,
                )
                for chunk in chunks
            ],
        )
    except Exception as err:
        raise HTTPException(status_code=500, detail=f"Failed to retrieve chunks: {str(err)}")


@app.get("/api/faqs", tags=["faq"])
def list_faqs_endpoint(category: str | None = None) -> dict[str, Any]:
    """Retrieve all pre-verified authoritative legal FAQs, optionally filtered by category."""
    faqs = load_faqs()
    if category:
        faqs = [f for f in faqs if f.get("category", "").lower() == category.lower()]
    return {
        "count": len(faqs),
        "faqs": faqs,
    }


@app.get("/api/faqs/{faq_id}", tags=["faq"])
def get_faq_endpoint(faq_id: str) -> dict[str, Any]:
    """Retrieve a single authoritative FAQ by its ID (e.g. FAQ-003)."""
    faqs = load_faqs()
    for faq in faqs:
        if faq.get("id", "").lower() == faq_id.lower():
            return faq
    raise HTTPException(status_code=404, detail=f"FAQ with ID '{faq_id}' not found.")



