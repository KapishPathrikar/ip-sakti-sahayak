"""Session and multi-turn conversation history management."""

from __future__ import annotations

import time
import uuid
from dataclasses import dataclass, field
from typing import Any


@dataclass
class ChatMessage:
    role: str  # "user" or "assistant"
    content: str
    timestamp: float = field(default_factory=time.time)

    def to_dict(self) -> dict[str, Any]:
        return {
            "role": self.role,
            "content": self.content,
            "timestamp": self.timestamp,
        }


class SessionManager:
    """In-memory session manager with sliding window message history."""

    def __init__(self, max_history_turns: int = 5) -> None:
        self.max_history_turns = max_history_turns
        self._sessions: dict[str, list[ChatMessage]] = {}

    def get_or_create_session(self, session_id: str | None = None) -> str:
        """Return valid session ID or generate a new UUID."""
        if not session_id or not session_id.strip():
            session_id = str(uuid.uuid4())
        if session_id not in self._sessions:
            self._sessions[session_id] = []
        return session_id

    def add_message(self, session_id: str, role: str, content: str) -> None:
        """Add a message to the session history, trimming to max history turns."""
        session_id = self.get_or_create_session(session_id)
        self._sessions[session_id].append(ChatMessage(role=role, content=content))
        # Keep only the last 2 * max_history_turns messages (user + assistant pairs)
        max_messages = self.max_history_turns * 2
        if len(self._sessions[session_id]) > max_messages:
            self._sessions[session_id] = self._sessions[session_id][-max_messages:]

    def get_history(self, session_id: str) -> list[dict[str, Any]]:
        """Retrieve recent conversation history for a given session."""
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
            return True
        return False

    def list_sessions(self) -> list[str]:
        """Return all active session IDs."""
        return list(self._sessions.keys())


# Global singleton session manager instance
session_manager = SessionManager()
