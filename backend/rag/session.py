"""Session and multi-turn conversation history management with database persistence."""

from __future__ import annotations

import json
import time
import uuid
from dataclasses import dataclass, field
from typing import Any

# Import DB persistence helpers safely
try:
	from ..database import SessionLocal
	from ..models import ChatSession as DBChatSession, ChatMessage as DBChatMessage
except (ImportError, ValueError):
	try:
		from database import SessionLocal
		from models import ChatSession as DBChatSession, ChatMessage as DBChatMessage
	except Exception:
		SessionLocal = None
		DBChatSession = None
		DBChatMessage = None


@dataclass
class ChatMessage:
	role: str  # "user" or "assistant"
	content: str
	citations: list[dict[str, Any]] | None = None
	confidence: str | None = None
	is_from_faq: bool = False
	is_low_confidence: bool = False
	timestamp: float = field(default_factory=time.time)

	def to_dict(self) -> dict[str, Any]:
		data = {
			"role": self.role,
			"content": self.content,
			"timestamp": self.timestamp,
		}
		if self.citations:
			data["citations"] = self.citations
		if self.confidence:
			data["confidence"] = self.confidence
		if self.is_from_faq:
			data["is_from_faq"] = self.is_from_faq
		if self.is_low_confidence:
			data["is_low_confidence"] = self.is_low_confidence
		return data


class SessionManager:
	"""Hybrid session manager: in-memory sliding window cache + persistent SQL storage."""

	def __init__(self, max_history_turns: int = 6) -> None:
		self.max_history_turns = max_history_turns
		self._sessions: dict[str, list[ChatMessage]] = {}

	def get_or_create_session(self, session_id: str | None = None, user_id: int | None = None) -> str:
		"""Return valid session ID or generate a new UUID and persist session record."""
		if not session_id or not session_id.strip():
			session_id = str(uuid.uuid4())

		if session_id not in self._sessions:
			self._sessions[session_id] = []
			# Populate from database if existing session
			if SessionLocal and DBChatSession:
				try:
					with SessionLocal() as db:
						db_session = db.query(DBChatSession).filter(DBChatSession.session_id == session_id).first()
						if not db_session:
							db_session = DBChatSession(session_id=session_id, user_id=user_id, title="New Legal Consultation")
							db.add(db_session)
							db.commit()
						else:
							# Load recent messages into in-memory cache
							for db_msg in db_session.messages[-self.max_history_turns * 2:]:
								cites = json.loads(db_msg.citations_json) if db_msg.citations_json else None
								self._sessions[session_id].append(
									ChatMessage(
										role=db_msg.role,
										content=db_msg.content,
										citations=cites,
										confidence=db_msg.confidence,
										is_from_faq=db_msg.is_from_faq,
										is_low_confidence=getattr(db_msg, "is_low_confidence", False) or False,
									)
								)
				except Exception as err:
					print(f"[Session DB Notice] {err}")

		return session_id

	def add_message(
		self,
		session_id: str,
		role: str,
		content: str,
		citations: list[dict[str, Any]] | None = None,
		confidence: str | None = None,
		is_from_faq: bool = False,
		is_low_confidence: bool = False,
		user_id: int | None = None,
	) -> None:
		"""Add a message to the in-memory cache and write permanently to the database."""
		session_id = self.get_or_create_session(session_id, user_id=user_id)
		msg = ChatMessage(
			role=role,
			content=content,
			citations=citations,
			confidence=confidence,
			is_from_faq=is_from_faq,
			is_low_confidence=is_low_confidence,
		)
		self._sessions[session_id].append(msg)

		# Trim in-memory sliding window
		max_messages = self.max_history_turns * 2
		if len(self._sessions[session_id]) > max_messages:
			self._sessions[session_id] = self._sessions[session_id][-max_messages:]

		# Persist to database
		if SessionLocal and DBChatMessage and DBChatSession:
			try:
				with SessionLocal() as db:
					db_session = db.query(DBChatSession).filter(DBChatSession.session_id == session_id).first()
					if db_session:
						# Update title on first user message
						if role == "user" and len(self._sessions[session_id]) <= 2:
							if db_session.title == "New Legal Consultation":
								db_session.title = content[:60] + ("..." if len(content) > 60 else "")
						# Always update session updated_at timestamp
						import datetime
						db_session.updated_at = datetime.datetime.now(datetime.timezone.utc)

					cites_str = json.dumps(citations) if citations else None
					db_msg = DBChatMessage(
						session_id=session_id,
						role=role,
						content=content,
						citations_json=cites_str,
						confidence=confidence,
						is_from_faq=is_from_faq,
						is_low_confidence=is_low_confidence,
					)
					db.add(db_msg)
					db.commit()
			except Exception as err:
				print(f"[Session DB Write Notice] {err}")


	def get_history(self, session_id: str) -> list[dict[str, Any]]:
		"""Retrieve recent conversation history for a given session."""
		self.get_or_create_session(session_id)
		messages = self._sessions.get(session_id, [])
		return [msg.to_dict() for msg in messages]

	def format_history_for_prompt(self, session_id: str) -> str:
		"""Format prior conversation turns as text for the LLM prompt context."""
		messages = self._sessions.get(session_id, [])
		if not messages:
			return ""
		formatted = []
		for msg in messages:
			prefix = "User" if msg.role == "user" else "Assistant"
			formatted.append(f"{prefix}: {msg.content}")
		return "\n".join(formatted)

	def clear_session(self, session_id: str) -> bool:
		"""Clear history for a specific session."""
		if session_id in self._sessions:
			del self._sessions[session_id]
		if SessionLocal and DBChatSession:
			try:
				with SessionLocal() as db:
					db.query(DBChatSession).filter(DBChatSession.session_id == session_id).delete()
					db.commit()
			except Exception:
				pass
		return True

	def list_sessions(self) -> list[str]:
		"""Return all active session IDs."""
		return list(self._sessions.keys())


# Global singleton session manager instance
session_manager = SessionManager()
