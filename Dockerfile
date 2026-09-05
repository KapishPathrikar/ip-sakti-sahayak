# Multi-platform production Dockerfile for IP Shakti Sahayak Backend
# Compatible with Hugging Face Spaces (Port 7860), Render, and Local Docker.

FROM python:3.10-slim

# Prevent Python from writing .pyc files and enable unbuffered logging
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=7860 \
    HOME=/home/user

# Install essential system build packages
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    git \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user (UID 1000 is required for Hugging Face Spaces)
RUN useradd -m -u 1000 user
USER user
ENV PATH="/home/user/.local/bin:$PATH"
WORKDIR /home/user/app

# Pre-install CPU-only PyTorch (drastically reduces image size & prevents GPU driver bloat)
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu

# Install backend Python dependencies
COPY --chown=user:user requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend code, static legal corpus, and the pre-computed ChromaDB vector index
COPY --chown=user:user backend/ ./backend/
COPY --chown=user:user corpus/ ./corpus/
COPY --chown=user:user chroma_db/ ./chroma_db/

EXPOSE 7860

# Dynamically bind to PORT (Hugging Face Spaces default 7860, Render $PORT fallback)
CMD ["sh", "-c", "uvicorn backend.main:app --host 0.0.0.0 --port ${PORT:-7860}"]
