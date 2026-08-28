"""Database connection and session management supporting SQLite and PostgreSQL."""

from __future__ import annotations

import os
from pathlib import Path
from typing import Generator
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker, Session

# Environment variable for database connection
# In production on Render/Railway/Supabase: postgresql://user:pass@host:5432/dbname
# In local development: sqlite:///./ip_shakti.db
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./ip_shakti.db")

# Fix for Render / Heroku postgres:// prefix
if DATABASE_URL.startswith("postgres://"):
	DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

connect_args = {}
if DATABASE_URL.startswith("sqlite"):
	connect_args = {"check_same_thread": False}

engine = create_engine(
	DATABASE_URL,
	connect_args=connect_args,
	pool_pre_ping=True,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db() -> Generator[Session, None, None]:
	"""FastAPI dependency yielding a database session per request."""
	db = SessionLocal()
	try:
		yield db
	finally:
		db.close()


def init_db() -> None:
	"""Initialize database tables."""
	try:
		from . import models  # noqa: F401
	except (ImportError, ValueError):
		try:
			from backend import models  # noqa: F401
		except ImportError:
			import models  # noqa: F401
	Base.metadata.create_all(bind=engine)

