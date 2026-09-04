"""SQLAlchemy ORM models for Users, Chat Sessions, Messages, and Feedback."""

from __future__ import annotations

import datetime
from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship

try:
	from .database import Base
except (ImportError, ValueError):
	from database import Base


def get_utc_now() -> datetime.datetime:
	return datetime.datetime.now(datetime.timezone.utc)


class User(Base):
	__tablename__ = "users"

	id = Column(Integer, primary_key=True, index=True)
	email = Column(String(255), unique=True, index=True, nullable=False)
	hashed_password = Column(String(255), nullable=False)
	full_name = Column(String(255), nullable=True)
	role = Column(String(50), default="user", nullable=False)  # "user", "admin", "lawyer"
	is_active = Column(Boolean, default=True, nullable=False)
	daily_query_limit = Column(Integer, default=50, nullable=False)  # 50 for registered users
	created_at = Column(DateTime, default=get_utc_now, nullable=False)

	# Relationships
	sessions = relationship("ChatSession", back_populates="user", cascade="all, delete-orphan")


class ChatSession(Base):
	__tablename__ = "chat_sessions"

	id = Column(Integer, primary_key=True, index=True)
	session_id = Column(String(100), unique=True, index=True, nullable=False)
	user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
	title = Column(String(255), default="New Legal Consultation", nullable=False)
	created_at = Column(DateTime, default=get_utc_now, nullable=False)
	updated_at = Column(DateTime, default=get_utc_now, onupdate=get_utc_now, nullable=False)


	# Relationships
	user = relationship("User", back_populates="sessions")
	messages = relationship("ChatMessage", back_populates="session", cascade="all, delete-orphan", order_by="ChatMessage.id")


class ChatMessage(Base):
	__tablename__ = "chat_messages"

	id = Column(Integer, primary_key=True, index=True)
	session_id = Column(String(100), ForeignKey("chat_sessions.session_id", ondelete="CASCADE"), nullable=False, index=True)
	role = Column(String(50), nullable=False)  # "user", "assistant", "system"
	content = Column(Text, nullable=False)
	citations_json = Column(Text, nullable=True)  # Serialized list of citations
	confidence = Column(String(50), nullable=True)
	is_from_faq = Column(Boolean, default=False, nullable=False)
	is_low_confidence = Column(Boolean, default=False, nullable=True)
	created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)

	# Relationships
	session = relationship("ChatSession", back_populates="messages")
	feedbacks = relationship("MessageFeedback", back_populates="message", cascade="all, delete-orphan")


class MessageFeedback(Base):
	__tablename__ = "message_feedbacks"

	id = Column(Integer, primary_key=True, index=True)
	message_id = Column(Integer, ForeignKey("chat_messages.id", ondelete="CASCADE"), nullable=False, index=True)
	user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
	rating = Column(Integer, nullable=False)  # +1 for helpful, -1 for unhelpful
	comment = Column(Text, nullable=True)
	created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)

	# Relationships
	message = relationship("ChatMessage", back_populates="feedbacks")
