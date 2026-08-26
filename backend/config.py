"""Runtime configuration for the IP Shakti Sahayak API."""

from __future__ import annotations

import os


def _origins_from_environment() -> list[str]:
    """Return the browser origins permitted to call the development API."""
    raw_origins = os.getenv("CORS_ORIGINS", "http://localhost:3000")
    return [origin.strip() for origin in raw_origins.split(",") if origin.strip()]


APP_NAME = "IP Shakti Sahayak API"
APP_VERSION = "0.1.0"
CORS_ORIGINS = _origins_from_environment()
