"""FastAPI entry point for IP Shakti Sahayak."""

from __future__ import annotations

from typing import Any
from fastapi import FastAPI, HTTPException, Request, Response, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

try:
    from config import APP_NAME, APP_VERSION, CORS_ORIGINS
except ImportError:
    from backend.config import APP_NAME, APP_VERSION, CORS_ORIGINS

try:
    from database import get_db, init_db
    from models import User, ChatSession, ChatMessage as DBChatMessage, MessageFeedback
    from auth import (
        hash_password,
        verify_password,
        create_access_token,
        get_current_user,
        get_optional_current_user,
    )
    from schemas import (
        UserRegister,
        UserLogin,
        UserOut,
        Token,
        SessionOut,
        FeedbackIn,
        FeeCalculationRequest,
        PatentabilityCheckRequest,
    )
except (ImportError, ValueError):
    from backend.database import get_db, init_db
    from backend.models import User, ChatSession, ChatMessage as DBChatMessage, MessageFeedback
    from backend.auth import (
        hash_password,
        verify_password,
        create_access_token,
        get_current_user,
        get_optional_current_user,
    )
    from backend.schemas import (
        UserRegister,
        UserLogin,
        UserOut,
        Token,
        SessionOut,
        FeedbackIn,
        FeeCalculationRequest,
        PatentabilityCheckRequest,
    )

try:
    from rag.generate import answer_question, answer_question_stream, DEFAULT_OLLAMA_MODEL
    from rag.retrieve import retrieve
    from rag.session import session_manager
    from rag.faq_matcher import load_faqs, match_faq
    from rag.rate_limiter import rate_limiter
    from rag.fee_calculator import calculate_ip_fee
    from rag.patentability_wizard import assess_patentability
    from rag.pdf_exporter import generate_consultation_pdf
except (ImportError, ValueError):
    from backend.rag.generate import answer_question, answer_question_stream, DEFAULT_OLLAMA_MODEL
    from backend.rag.retrieve import retrieve
    from backend.rag.session import session_manager
    from backend.rag.faq_matcher import load_faqs, match_faq
    from backend.rag.rate_limiter import rate_limiter
    from backend.rag.fee_calculator import calculate_ip_fee
    from backend.rag.patentability_wizard import assess_patentability
    from backend.rag.pdf_exporter import generate_consultation_pdf




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


@app.on_event("startup")
def on_startup():
    """Create database tables on server startup."""
    init_db()


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


# ==========================================
# AUTHENTICATION ENDPOINTS
# ==========================================

@app.post("/api/auth/register", response_model=Token, status_code=status.HTTP_201_CREATED, tags=["auth"])
def register_user_endpoint(payload: UserRegister, db: Session = Depends(get_db)):
    """Register a new user account with hashed password and return access token."""
    existing = db.query(User).filter(User.email == payload.email.lower().strip()).first()
    if existing:
        raise HTTPException(status_code=400, detail="An account with this email already exists.")

    new_user = User(
        email=payload.email.lower().strip(),
        hashed_password=hash_password(payload.password),
        full_name=payload.full_name,
        role="user",
        daily_query_limit=50,  # Elevated 50 queries/day for registered accounts
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    token = create_access_token(data={"sub": new_user.email})
    return Token(access_token=token, user=UserOut.model_validate(new_user))


@app.post("/api/auth/login", response_model=Token, tags=["auth"])
async def login_user_endpoint(request: Request, db: Session = Depends(get_db)):
    """Authenticate user with email/password and return JWT token. Supports both JSON and Swagger OAuth2 form data."""
    email = ""
    password = ""

    content_type = request.headers.get("content-type", "")
    if "application/json" in content_type:
        try:
            body = await request.json()
            email = body.get("email") or body.get("username") or ""
            password = body.get("password") or ""
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid JSON body.")
    else:
        # OAuth2 form-data from Swagger UI Authorize modal
        try:
            form = await request.form()
            email = form.get("username") or form.get("email") or ""
            password = form.get("password") or ""
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid form data.")

    email = email.lower().strip()
    if not email or not password:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Email/username and password are required.",
        )

    user = db.query(User).filter(User.email == email).first()
    if not user or not verify_password(password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.is_active:
        raise HTTPException(status_code=400, detail="Account is deactivated.")

    token = create_access_token(data={"sub": user.email})
    return Token(access_token=token, user=UserOut.model_validate(user))



@app.get("/api/auth/me", response_model=UserOut, tags=["auth"])
def get_current_user_profile(current_user: User = Depends(get_current_user)):
    """Return the profile of the currently authenticated user."""
    return UserOut.model_validate(current_user)



# ==========================================
# RATE LIMITING & RAG ENDPOINTS
# ==========================================

def _get_client_identifier(request: Request, current_user: User | None = None) -> str:
    """Extract client identifier: User ID if authenticated, else IP address."""
    if current_user:
        return f"user_{current_user.id}"
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "127.0.0.1"


def _check_rate_limit(request: Request, query: str, current_user: User | None = None) -> None:
    """Validate rate limit with exemption for pre-verified FAQ matches."""
    client_id = _get_client_identifier(request, current_user)
    
    # Check if this query matches an authoritative FAQ with high confidence (exempt from quota)
    matched_faq, faq_score = match_faq(query)
    is_faq = matched_faq is not None and faq_score >= 0.80

    # If registered user, allocate higher daily limit
    if current_user:
        rate_limiter.max_daily = current_user.daily_query_limit

    status_limit = rate_limiter.check_and_record(client_id, is_faq_query=is_faq)
    if not status_limit.allowed:
        raise HTTPException(
            status_code=429,
            detail={
                "error": "Rate limit exceeded",
                "message": status_limit.reason,
                "retry_after_seconds": status_limit.retry_after_seconds,
                "daily_remaining": status_limit.daily_remaining,
                "burst_remaining": status_limit.burst_remaining,
            },
            headers={"Retry-After": str(status_limit.retry_after_seconds)},
        )


@app.post("/api/ask", response_model=AskResponse, tags=["rag"])
def ask_question_endpoint(
    payload: AskRequest,
    request: Request,
    current_user: User | None = Depends(get_optional_current_user),
) -> AskResponse:
    """Ask a standalone question about Indian IP laws and receive a grounded answer with citations."""
    _check_rate_limit(request, payload.query, current_user)
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
    except HTTPException:
        raise
    except Exception as err:
        raise HTTPException(status_code=500, detail=f"Failed to generate answer: {str(err)}")


@app.post("/api/chat", response_model=ChatResponse, tags=["chat"])
def chat_endpoint(
    payload: ChatRequest,
    request: Request,
    current_user: User | None = Depends(get_optional_current_user),
) -> ChatResponse:
    """Multi-turn conversational chat with session memory and database persistence."""
    _check_rate_limit(request, payload.query, current_user)
    try:
        model_name = payload.model or DEFAULT_OLLAMA_MODEL
        user_id = current_user.id if current_user else None
        result = answer_question(
            query=payload.query,
            limit=payload.limit,
            model=model_name,
            session_id=payload.session_id,
            user_id=user_id,
        )
        return ChatResponse(
            answer=result["answer"],
            citations=[Citation(**c) for c in result.get("citations", [])],
            grounded=result.get("grounded", False),
            session_id=result.get("session_id") or "default",
        )
    except HTTPException:
        raise
    except Exception as err:
        raise HTTPException(status_code=500, detail=f"Chat generation failed: {str(err)}")


@app.post("/api/chat/stream", tags=["chat"])
def chat_stream_endpoint(
    payload: ChatRequest,
    request: Request,
    current_user: User | None = Depends(get_optional_current_user),
):
    """Stream token-by-token answer via Server-Sent Events (SSE) for low-latency UI rendering."""
    _check_rate_limit(request, payload.query, current_user)
    try:
        model_name = payload.model or DEFAULT_OLLAMA_MODEL
        generator = answer_question_stream(
            query=payload.query,
            limit=payload.limit,
            model=model_name,
            session_id=payload.session_id,
            user_id=current_user.id if current_user else None,
        )
        return StreamingResponse(generator, media_type="text/event-stream")
    except HTTPException:
        raise
    except Exception as err:
        raise HTTPException(status_code=500, detail=f"Streaming failed: {str(err)}")


@app.get("/api/chat/history/{session_id}", tags=["chat"])
def get_chat_history_endpoint(session_id: str) -> dict[str, Any]:
    """Retrieve full conversation history for a given session."""
    return {
        "session_id": session_id,
        "history": session_manager.get_history(session_id),
    }


@app.get("/api/chat/my-sessions", response_model=list[SessionOut], tags=["chat"])
def get_my_sessions_endpoint(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retrieve all saved conversation sessions for the authenticated user."""
    sessions = (
        db.query(ChatSession)
        .filter(ChatSession.user_id == current_user.id)
        .order_by(ChatSession.updated_at.desc())
        .all()
    )
    return [SessionOut.model_validate(s) for s in sessions]



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


@app.post("/api/feedback", tags=["feedback"])
def submit_feedback_endpoint(
    payload: FeedbackIn,
    current_user: User | None = Depends(get_optional_current_user),
    db: Session = Depends(get_db),
):
    """Submit rating (+1 or -1) and optional comment for a generated assistant message."""
    fb = MessageFeedback(
        message_id=payload.message_id,
        user_id=current_user.id if current_user else None,
        rating=payload.rating,
        comment=payload.comment,
    )
    db.add(fb)
    db.commit()
    return {"status": "success", "message": "Feedback recorded successfully."}


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


# ==========================================
# INTERACTIVE LEGAL TOOLS & WIZARDS
# ==========================================

@app.post("/api/tools/fee-calculator", tags=["tools"])
def calculate_fee_endpoint(payload: FeeCalculationRequest) -> dict[str, Any]:
    """Calculate official Indian IP filing fees based on The First Schedule of Patent and Trademark Rules."""
    return calculate_ip_fee(
        ip_type=payload.ip_type,
        applicant_type=payload.applicant_type,
        filing_mode=payload.filing_mode,
        is_provisional=payload.is_provisional,
        pages_count=payload.pages_count,
        claims_count=payload.claims_count,
        include_early_publication=payload.include_early_publication,
        request_examination=payload.request_examination,
        trademark_classes_count=payload.trademark_classes_count,
    )


@app.post("/api/tools/patentability-check", tags=["tools"])
def patentability_check_endpoint(payload: PatentabilityCheckRequest) -> dict[str, Any]:
    """Assess invention patentability and identify statutory bars under Section 3 and Biological Diversity Act."""
    return assess_patentability(
        title=payload.title,
        description=payload.description,
        is_ayurvedic_or_herbal=payload.is_ayurvedic_or_herbal,
        is_combination_of_known_herbs_or_drugs=payload.is_combination_of_known_herbs_or_drugs,
        has_synergistic_efficacy_data=payload.has_synergistic_efficacy_data,
        uses_indian_biological_resources=payload.uses_indian_biological_resources,
        is_method_of_treatment=payload.is_method_of_treatment,
        publicly_disclosed_before_filing=payload.publicly_disclosed_before_filing,
    )


@app.get("/api/chat/export/{session_id}", tags=["chat"])
def export_chat_session_pdf(
    session_id: str,
    current_user: User | None = Depends(get_optional_current_user),
):
    """Export consultation session transcript as a formatted, downloadable PDF advisory report."""
    history = session_manager.get_history(session_id)
    if not history:
        raise HTTPException(status_code=404, detail=f"No conversation history found for session '{session_id}'.")

    pdf_buffer = generate_consultation_pdf(
        session_id=session_id,
        history=history,
        user_email=current_user.email if current_user else None,
        user_name=current_user.full_name if current_user else None,
    )

    filename = f"IP_Shakti_Consultation_{session_id[:8]}.pdf"
    return StreamingResponse(
        pdf_buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )





