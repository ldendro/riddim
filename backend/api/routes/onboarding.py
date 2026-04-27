"""
Riddim — Onboarding Routes

Endpoints for the onboarding flow: quiz track selection and preference submission.
"""

import json
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional

from backend.db.database import get_db, query_all, query_one
from backend.api.deps import get_current_user

router = APIRouter(prefix="/api/onboarding", tags=["onboarding"])

# Genre buckets for diverse quiz track selection
QUIZ_GENRE_BUCKETS = [
    {"label": "House", "keywords": ["house", "deep house", "future house"]},
    {"label": "Drum and Bass", "keywords": ["drum and bass", "dnb", "d&b", "liquid"]},
    {"label": "Dubstep", "keywords": ["dubstep", "riddim", "brostep"]},
    {"label": "Trance", "keywords": ["trance", "psytrance", "uplifting"]},
    {"label": "Techno", "keywords": ["techno", "minimal", "industrial"]},
    {"label": "Hardstyle", "keywords": ["hardstyle", "hardcore", "hard dance"]},
    {"label": "Chill", "keywords": ["ambient", "chill", "downtempo", "lofi"]},
    {"label": "Trap", "keywords": ["trap", "future bass", "bass music"]},
]


class OnboardingPayload(BaseModel):
    display_name: Optional[str] = None
    favorite_genres: list[str]
    energy_preference: float  # 0.0 (chill) to 1.0 (explosive)
    bpm_preference: float     # raw BPM value (80–180)
    quiz_reactions: dict[str, str]  # {track_id: reaction}


@router.get("/quiz-tracks")
async def get_quiz_tracks(current_user: dict = Depends(get_current_user)):
    """
    Return 8 diverse NCS tracks for the onboarding listening quiz.
    Selects one track per genre bucket so the user hears a wide range.
    """
    quiz_tracks = []

    for bucket in QUIZ_GENRE_BUCKETS:
        # Build a LIKE clause matching any keyword in the bucket
        like_clauses = []
        params = []
        for kw in bucket["keywords"]:
            like_clauses.append("(LOWER(i.genre) LIKE ? OR LOWER(i.metadata) LIKE ?)")
            params.extend([f"%{kw.lower()}%", f"%{kw.lower()}%"])

        where_clause = " OR ".join(like_clauses)

        sql = f"""
            SELECT i.id, i.source, i.file_path, i.genre, i.metadata,
                   f.bpm, f.energy_rms, f.bass_energy, f.spectral_centroid,
                   f.onset_density, f.duration_sec
            FROM items i
            LEFT JOIN features f ON i.id = f.item_id
            WHERE i.source = 'ncs' AND ({where_clause})
            ORDER BY RANDOM()
            LIMIT 1
        """

        track = query_all(sql, tuple(params))
        if track:
            result = dict(track[0])
            result["quiz_genre_label"] = bucket["label"]
            quiz_tracks.append(result)

    # If we didn't get 8 tracks from genre matching, fill with random NCS tracks
    existing_ids = {t["id"] for t in quiz_tracks}
    if len(quiz_tracks) < 8:
        fill_sql = """
            SELECT i.id, i.source, i.file_path, i.genre, i.metadata,
                   f.bpm, f.energy_rms, f.bass_energy, f.spectral_centroid,
                   f.onset_density, f.duration_sec
            FROM items i
            LEFT JOIN features f ON i.id = f.item_id
            WHERE i.source = 'ncs'
            ORDER BY RANDOM()
            LIMIT ?
        """
        fill = query_all(fill_sql, (8 - len(quiz_tracks) + 5,))
        for t in fill:
            if t["id"] not in existing_ids and len(quiz_tracks) < 8:
                result = dict(t)
                result["quiz_genre_label"] = "Mixed"
                quiz_tracks.append(result)
                existing_ids.add(t["id"])

    return {"tracks": quiz_tracks, "total": len(quiz_tracks)}


@router.post("/complete")
async def complete_onboarding(
    payload: OnboardingPayload,
    current_user: dict = Depends(get_current_user),
):
    """
    Process the completed onboarding and seed the initial taste profile.
    """
    user_id = current_user["user_id"]

    # Verify user hasn't already completed onboarding
    user = query_one("SELECT onboarding_complete FROM users WHERE id = ?", (user_id,))
    if user and user["onboarding_complete"]:
        raise HTTPException(status_code=400, detail="Onboarding already completed")

    with get_db() as conn:
        # Store onboarding preferences
        onboarding_data = {
            "favorite_genres": payload.favorite_genres,
            "energy_preference": payload.energy_preference,
            "bpm_preference": payload.bpm_preference,
        }
        conn.execute(
            """
            UPDATE users SET
                onboarding_complete = 1,
                onboarding = ?,
                display_name = COALESCE(?, display_name)
            WHERE id = ?
            """,
            (json.dumps(onboarding_data), payload.display_name, user_id),
        )

        # Record quiz reactions as initial feedback
        for track_id, reaction in payload.quiz_reactions.items():
            conn.execute(
                """
                INSERT INTO reactions (user_id, item_id, reaction, reason_tags)
                VALUES (?, ?, ?, ?)
                """,
                (user_id, track_id, reaction, json.dumps(["onboarding"])),
            )

        # Seed an initial interpretable taste profile
        genre_weights = {}
        for genre in payload.favorite_genres:
            genre_weights[genre.lower()] = 0.8

        initial_taste = {
            "genre_weights": genre_weights,
            "preferred_bpm": payload.bpm_preference,
            "preferred_energy": payload.energy_preference,
            "preferred_bass": 0.5,
            "melodicness": 0.0,
            "brightness": 0.0,
            "confidence": 0.1,
        }

        conn.execute(
            """
            INSERT OR REPLACE INTO taste_profiles (user_id, interpretable, confidence)
            VALUES (?, ?, ?)
            """,
            (user_id, json.dumps(initial_taste), 0.1),
        )

    return {
        "status": "ok",
        "message": "Onboarding complete! Your taste profile has been seeded.",
    }
