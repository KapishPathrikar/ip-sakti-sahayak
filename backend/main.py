"""FastAPI entry point for IP Shakti Sahayak."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from config import APP_NAME, APP_VERSION, CORS_ORIGINS


class HealthResponse(BaseModel):
    """Stable response contract used by the web client and deployment checks."""

    status: str
    service: str
    version: str


app = FastAPI(title=APP_NAME, version=APP_VERSION)
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=False,
    allow_methods=["GET"],
    allow_headers=[],
)


@app.get("/health", response_model=HealthResponse, tags=["system"])
def health_check() -> HealthResponse:
    """Report whether the API process is available."""
    return HealthResponse(status="ok", service="ip-shakti-sahayak", version=APP_VERSION)
