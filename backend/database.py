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
ROOT_DIR = Path(__file__).resolve().parent.parent
default_db_path = ROOT_DIR / "ip_shakti.db"
# Use absolute path for sqlite so it works regardless of cwd
DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{default_db_path}")

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
	"""Initialize database tables and ensure schema migrations."""
	try:
		from . import models  # noqa: F401
	except (ImportError, ValueError):
		try:
			from backend import models  # noqa: F401
		except ImportError:
			import models  # noqa: F401
	Base.metadata.create_all(bind=engine)

	# Lightweight SQLite schema migration
	if DATABASE_URL.startswith("sqlite"):
		try:
			from sqlalchemy import text
			with engine.connect() as conn:
				result = conn.execute(text("PRAGMA table_info(chat_messages)")).fetchall()
				cols = [r[1] for r in result]
				if cols and "is_low_confidence" not in cols:
					conn.execute(text("ALTER TABLE chat_messages ADD COLUMN is_low_confidence BOOLEAN DEFAULT 0"))
					conn.commit()
		except Exception as err:
			print(f"[DB Migration Notice] {err}")


