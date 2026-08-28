"""Authentication and JWT utilities for IP Shakti Sahayak."""

from __future__ import annotations

import datetime
import os
import bcrypt
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

try:
	from .database import get_db
	from .models import User
except (ImportError, ValueError):
	from database import get_db
	from models import User

SECRET_KEY = os.getenv("JWT_SECRET_KEY", "ip-shakti-sahayak-super-secret-jwt-key-2026-ayurveda")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_DAYS = 7

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)


def hash_password(password: str) -> str:
	"""Hash a plaintext password with salt."""
	salt = bcrypt.gensalt()
	return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
	"""Verify a plaintext password against the stored bcrypt hash."""
	try:
		return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))
	except Exception:
		return False


def create_access_token(data: dict, expires_delta: datetime.timedelta | None = None) -> str:
	"""Generate a signed JWT bearer token."""
	to_encode = data.copy()
	if expires_delta:
		expire = datetime.datetime.utcnow() + expires_delta
	else:
		expire = datetime.datetime.utcnow() + datetime.timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS)
	to_encode.update({"exp": expire})
	return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def get_current_user(token: str | None = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
	"""Dependency to retrieve the authenticated user from a JWT token."""
	credentials_exception = HTTPException(
		status_code=status.HTTP_401_UNAUTHORIZED,
		detail="Could not validate credentials or token expired.",
		headers={"WWW-Authenticate": "Bearer"},
	)
	if not token:
		raise credentials_exception
	try:
		payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
		email: str = payload.get("sub")
		if email is None:
			raise credentials_exception
	except Exception:
		raise credentials_exception

	user = db.query(User).filter(User.email == email).first()
	if user is None or not user.is_active:
		raise credentials_exception
	return user


def get_optional_current_user(token: str | None = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User | None:
	"""Dependency to retrieve user if token is present, else None for guest requests."""
	if not token:
		return None
	try:
		payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
		email: str = payload.get("sub")
		if not email:
			return None
		return db.query(User).filter(User.email == email, User.is_active == True).first()
	except Exception:
		return None
