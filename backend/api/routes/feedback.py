"""
Riddim — Feedback Routes

Endpoints for handling user feedback on tracks.
"""
import json
from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional, List, Literal

from backend.db.database import get_db

router = APIRouter(prefix="/api/feedback", tags=["feedback"])

class ReactionRequest(BaseModel):
    item_id: str
    reaction: str
    reason_tags: Optional[List[str]] = []

@router.post("/reaction")
async def submit_reaction(req: ReactionRequest):
    user_id = "local_user"
    
    with get_db() as conn:
        conn.execute("INSERT OR IGNORE INTO users (id) VALUES (?)", (user_id,))
        conn.execute(
            """
            INSERT INTO reactions (user_id, item_id, reaction, reason_tags)
            VALUES (?, ?, ?, ?)
            """,
            (user_id, req.item_id, req.reaction, json.dumps(req.reason_tags))
        )
        
    return {"status": "ok", "message": f"Reaction '{req.reaction}' recorded"}

class ABFeedbackRequest(BaseModel):
    item_a_id: str
    item_b_id: str
    preferred: Literal["A", "B"]

@router.post("/ab")
async def submit_ab_feedback(req: ABFeedbackRequest):
    user_id = "local_user"
    
    with get_db() as conn:
        conn.execute("INSERT OR IGNORE INTO users (id) VALUES (?)", (user_id,))
        conn.execute(
            """
            INSERT INTO preference_pairs (user_id, item_a_id, item_b_id, preferred)
            VALUES (?, ?, ?, ?)
            """,
            (user_id, req.item_a_id, req.item_b_id, req.preferred)
        )
        
    return {"status": "ok", "message": f"A/B preference '{req.preferred}' recorded"}
