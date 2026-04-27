"""
Riddim — Feedback Routes

Endpoints for handling user feedback on tracks.
"""
import json
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import Optional, List, Literal

from backend.db.database import get_db, query_one, query_all
from backend.api.deps import get_current_user
from backend.models.taste_engine import taste_engine

router = APIRouter(prefix="/api/feedback", tags=["feedback"])

class ReactionRequest(BaseModel):
    item_id: str
    reaction: str
    reason_tags: Optional[List[str]] = []

@router.post("/reaction")
async def submit_reaction(
    req: ReactionRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    Submit or update a reaction for a track.
    Uses UPSERT: if user already reacted to this track, update in place.
    love/like automatically set in_library = 1.
    neutral/reject/skip set in_library = 0.
    """
    user_id = current_user["user_id"]
    in_library = 1 if req.reaction in ("love", "like") else 0

    with get_db() as conn:
        conn.execute(
            """
            INSERT INTO reactions (user_id, item_id, reaction, reason_tags, in_library, created_at)
            VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(user_id, item_id) DO UPDATE SET
                reaction = excluded.reaction,
                reason_tags = excluded.reason_tags,
                in_library = excluded.in_library,
                created_at = CURRENT_TIMESTAMP
            """,
            (user_id, req.item_id, req.reaction, json.dumps(req.reason_tags), in_library)
        )

    # Update taste profile centroids in real-time
    try:
        taste_engine.update_profile(user_id)
    except Exception as e:
        print(f"  ⚠ Taste profile update failed: {e}")

    # Return the track's features so the frontend can use them for DJ commentary
    track = query_one(
        """
        SELECT i.id, i.genre, i.metadata,
               f.bpm, f.energy_rms, f.bass_energy, f.spectral_centroid
        FROM items i
        LEFT JOIN features f ON i.id = f.item_id
        WHERE i.id = ?
        """,
        (req.item_id,),
    )
        
    return {
        "status": "ok",
        "message": f"Reaction '{req.reaction}' recorded",
        "track_features": track if track else None,
    }


@router.get("/me")
async def get_my_reactions(
    current_user: dict = Depends(get_current_user),
):
    """
    Get all of the current user's reactions as a dict of item_id -> reaction.
    Used by the Discover page to restore previous feedback state.
    """
    user_id = current_user["user_id"]
    rows = query_all(
        "SELECT item_id, reaction FROM reactions WHERE user_id = ?",
        (user_id,),
    )
    reactions = {row["item_id"]: row["reaction"] for row in rows}
    return {"reactions": reactions}


class ABFeedbackRequest(BaseModel):
    item_a_id: str
    item_b_id: str
    preferred: Literal["A", "B"]

@router.post("/ab")
async def submit_ab_feedback(
    req: ABFeedbackRequest,
    current_user: dict = Depends(get_current_user),
):
    user_id = current_user["user_id"]
    
    with get_db() as conn:
        conn.execute(
            """
            INSERT INTO preference_pairs (user_id, item_a_id, item_b_id, preferred)
            VALUES (?, ?, ?, ?)
            """,
            (user_id, req.item_a_id, req.item_b_id, req.preferred)
        )

    return {"status": "ok", "message": "AB preference recorded"}
