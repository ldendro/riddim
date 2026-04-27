"""
Riddim — Authentication Routes

Registration, login, user info, and profile reset endpoints.
"""

import json
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from jose import jwt
from passlib.context import CryptContext
from pydantic import BaseModel, EmailStr

from backend.config import JWT_SECRET_KEY, JWT_ALGORITHM, JWT_EXPIRE_MINUTES
from backend.db.database import get_db, query_one
from backend.api.deps import get_current_user

router = APIRouter(prefix="/api/auth", tags=["auth"])

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


# ── Request / Response Models ──

class RegisterRequest(BaseModel):
    email: str
    password: str
    display_name: str


class LoginRequest(BaseModel):
    email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict


class UserResponse(BaseModel):
    id: str
    email: str
    display_name: str
    onboarding_complete: bool
    created_at: str


# ── Helpers ──

def _create_token(user_id: str, email: str, display_name: str) -> str:
    """Create a JWT access token."""
    expire = datetime.now(timezone.utc) + timedelta(minutes=JWT_EXPIRE_MINUTES)
    payload = {
        "sub": user_id,
        "email": email,
        "display_name": display_name,
        "exp": expire,
    }
    return jwt.encode(payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)


def _user_to_dict(row: dict) -> dict:
    """Convert a DB user row to a safe response dict."""
    return {
        "id": row["id"],
        "email": row["email"],
        "display_name": row["display_name"],
        "onboarding_complete": bool(row["onboarding_complete"]),
        "created_at": str(row["created_at"]),
    }


# ── Endpoints ──

@router.post("/register", response_model=TokenResponse)
async def register(req: RegisterRequest):
    """Create a new user account."""
    # Validate
    if len(req.password) < 4:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 4 characters",
        )
    if not req.display_name.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Display name is required",
        )

    # Check if email already exists
    existing = query_one("SELECT id FROM users WHERE email = ?", (req.email.lower(),))
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists",
        )

    # Create user
    user_id = str(uuid.uuid4())
    password_hash = pwd_context.hash(req.password)

    with get_db() as conn:
        conn.execute(
            """
            INSERT INTO users (id, email, password_hash, display_name)
            VALUES (?, ?, ?, ?)
            """,
            (user_id, req.email.lower(), password_hash, req.display_name.strip()),
        )

    token = _create_token(user_id, req.email.lower(), req.display_name.strip())

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user_id,
            "email": req.email.lower(),
            "display_name": req.display_name.strip(),
            "onboarding_complete": False,
            "created_at": datetime.now(timezone.utc).isoformat(),
        },
    }


@router.post("/login", response_model=TokenResponse)
async def login(req: LoginRequest):
    """Authenticate and return a JWT token."""
    user = query_one(
        "SELECT * FROM users WHERE email = ?",
        (req.email.lower(),),
    )

    if not user or not pwd_context.verify(req.password, user["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    token = _create_token(user["id"], user["email"], user["display_name"])

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": _user_to_dict(user),
    }


@router.get("/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    """Return the current authenticated user's profile."""
    user = query_one(
        "SELECT u.*, t.dj_summary FROM users u LEFT JOIN taste_profiles t ON u.id = t.user_id WHERE u.id = ?", 
        (current_user["user_id"],)
    )
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    user_dict = _user_to_dict(user)
    user_dict["dj_summary"] = user.get("dj_summary")
    return user_dict


@router.post("/reset-profile")
async def reset_profile(current_user: dict = Depends(get_current_user)):
    """
    Reset the user's taste profile and re-trigger onboarding.
    Preserves the account but clears all taste data.
    """
    user_id = current_user["user_id"]

    with get_db() as conn:
        # Reset onboarding flag and clear onboarding preferences
        conn.execute(
            "UPDATE users SET onboarding_complete = 0, onboarding = NULL WHERE id = ?",
            (user_id,),
        )
        # Clear taste profile
        conn.execute("DELETE FROM taste_profiles WHERE user_id = ?", (user_id,))
        # Clear all reactions
        conn.execute("DELETE FROM reactions WHERE user_id = ?", (user_id,))
        # Clear A/B preferences
        conn.execute("DELETE FROM preference_pairs WHERE user_id = ?", (user_id,))
        # Clear candidate pool
        conn.execute("DELETE FROM candidate_pool WHERE user_id = ?", (user_id,))
        # Clear saved tracks
        conn.execute("DELETE FROM saved_tracks WHERE user_id = ?", (user_id,))

    return {"status": "ok", "message": "Profile reset. Onboarding required."}
