"""
Riddim — DJ Byte API Routes

Endpoints for DJ commentary generation, prompt saving, and health checks.
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional, List

from backend.models.dj_engine import dj_engine
from backend.db.database import query_all, query_one, get_db
from backend.api.deps import get_current_user

router = APIRouter(prefix="/api/dj", tags=["dj"])


class DJCommentRequest(BaseModel):
    event_type: str = "reaction"
    reaction: str = "skip"
    track_title: str = "Unknown Track"
    track_features: dict = {}


class DJCommentResponse(BaseModel):
    comment: str
    mood: str
    suno_prompt: str | None = None


class SaveSummaryRequest(BaseModel):
    summary: str


@router.post("/save-summary")
async def save_summary(
    req: SaveSummaryRequest,
    current_user: dict = Depends(get_current_user),
):
    """Saves the generated DJ Byte taste summary directly to the user's profile."""
    user_id = current_user["user_id"]
    from backend.db.database import get_db
    with get_db() as conn:
        conn.execute(
            "UPDATE taste_profiles SET dj_summary = ? WHERE user_id = ?",
            (req.summary, user_id)
        )
    return {"status": "ok"}


class SavePromptRequest(BaseModel):
    item_id: str
    prompt_text: str


class RegeneratePromptRequest(BaseModel):
    track_title: str = "Unknown Track"
    track_features: dict = {}


MAX_PROMPTS_PER_TRACK = 3


@router.post("/comment", response_model=DJCommentResponse)
async def generate_comment(request: DJCommentRequest):
    """Generate a DJ Byte commentary response based on user feedback context."""
    result = await dj_engine.generate_comment(request.model_dump())
    return DJCommentResponse(**result)


@router.post("/taste-analysis")
async def analyze_taste(
    request: dict,
    current_user: dict = Depends(get_current_user),
):
    """
    Analyzes the user's taste data based on the requested map 'focus'.
    focus can be: 'combo', 'intensity', 'genre'
    """
    focus = request.get("focus", "combo")
    user_id = current_user["user_id"]

    # Gather data
    reactions = query_all(
        "SELECT item_id, reaction FROM reactions WHERE user_id = ?", (user_id,)
    )
    if not reactions:
        return {"commentary": "I can't analyze what I can't see! Get out there and rate some tracks on the Discover page so I can build your Taste Map."}

    # Fetch stats
    liked = [r for r in reactions if r["reaction"] in ["love", "like"]]

    if len(liked) < 3:
        return {"commentary": "I need a bit more data before I can lock onto your signal. Keep hunting for tracks you vibe with!"}

    item_ids = [r["item_id"] for r in liked]
    placeholders = ",".join("?" * len(item_ids))
    tracks = query_all(
        f"SELECT i.genre, f.bpm, f.energy_rms FROM items i JOIN features f ON i.id = f.item_id WHERE i.id IN ({placeholders})",
        tuple(item_ids)
    )

    avg_bpm = sum((float(t.get("bpm") or 120) for t in tracks)) / len(tracks)
    avg_energy = sum((float(t.get("energy_rms") or 0.2) for t in tracks)) / len(tracks)

    genres = {}
    for t in tracks:
        g = t.get("genre", "electronic").lower()
        genres[g] = genres.get(g, 0) + 1
    
    top_genres = sorted(genres.items(), key=lambda x: x[1], reverse=True)[:3]
    top_genre_names = [g[0] for g in top_genres]

    # Dynamic prompts based on visualizer focus
    if focus == "intensity":
        prompt = (
            f"You are DJ Byte, an AI robotic DJ interacting with a human. "
            f"The user is looking at their 'Intensity Matrix' (BPM vs Energy). "
            f"Their average liked track is {round(avg_bpm)} BPM with {round(avg_energy*100)}% audio energy. "
            f"Explain to them what this means about their music taste in 2 short, punchy, conversational sentences. Start by acknowledging the Tempo and Energy."
        )
    elif focus == "genre":
        prompt = (
            f"You are DJ Byte, an AI robotic DJ interacting with a human. "
            f"The user is looking at their 'Taxonomy Constellations' genre map. "
            f"Their most liked genres are {', '.join(top_genre_names)}. "
            f"Explain to them what this scene tells you about their vibe in exactly 2 short, punchy, conversational sentences."
        )
    else: # intro / combo
        prompt = (
            f"You are DJ Byte, a cool AI robotic DJ interacting with a human. "
            f"The user just opened their Taste Laboratory map. "
            f"Write a 3-4 sentence comprehensive, in-depth analysis summarizing exactly what you have learned about their music taste so far. "
            f"Use their real data: They predominantly like {', '.join(top_genre_names)}, averaging {round(avg_bpm)} BPM, with an energy intensity of {round(avg_energy*100)}%. "
            f"Connect these data points to explain their overall vibe based on the feedback they've given the system."
        )

    try:
        commentary = await dj_engine.generate_taste_analysis(prompt)
        return {"commentary": commentary}
    except Exception as e:
        return {"commentary": "My audio processors are glitching, check back in a second."}


@router.post("/save-prompt")
async def save_prompt(
    request: SavePromptRequest,
    current_user: dict = Depends(get_current_user),
):
    """Save a generation prompt for a track. Max 3 per track per user."""
    user_id = current_user["user_id"]

    # Check count
    existing = query_one(
        "SELECT COUNT(*) as cnt FROM saved_prompts WHERE user_id = ? AND item_id = ?",
        (user_id, request.item_id),
    )
    if existing and existing["cnt"] >= MAX_PROMPTS_PER_TRACK:
        raise HTTPException(
            status_code=400,
            detail=f"Maximum {MAX_PROMPTS_PER_TRACK} prompts per track reached.",
        )

    with get_db() as conn:
        conn.execute(
            "INSERT INTO saved_prompts (user_id, item_id, prompt_text) VALUES (?, ?, ?)",
            (user_id, request.item_id, request.prompt_text),
        )

    return {"status": "saved"}


@router.get("/prompts/{item_id}")
async def get_prompts(
    item_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Get all saved prompts for a track."""
    user_id = current_user["user_id"]
    prompts = query_all(
        "SELECT id, prompt_text, created_at FROM saved_prompts WHERE user_id = ? AND item_id = ? ORDER BY created_at DESC",
        (user_id, item_id),
    )
    return {"prompts": prompts, "max": MAX_PROMPTS_PER_TRACK}


@router.delete("/prompts/{prompt_id}")
async def delete_prompt(
    prompt_id: int,
    current_user: dict = Depends(get_current_user),
):
    """Delete a saved prompt."""
    user_id = current_user["user_id"]
    with get_db() as conn:
        conn.execute(
            "DELETE FROM saved_prompts WHERE id = ? AND user_id = ?",
            (prompt_id, user_id),
        )
    return {"status": "deleted"}


@router.post("/regenerate-prompt")
async def regenerate_prompt(
    request: RegeneratePromptRequest,
    current_user: dict = Depends(get_current_user),
):
    """Regenerate a generation prompt for a track via LLM."""
    context = {
        "reaction": "love",
        "track_title": request.track_title,
        "track_features": request.track_features,
    }

    available = await dj_engine.check_health()
    if not available:
        raise HTTPException(status_code=503, detail="LLM engine unavailable")

    result = await dj_engine.generate_comment(context)
    return {"prompt": result.get("suno_prompt", "")}


@router.get("/health")
async def dj_health():
    """Check if the DJ Byte LLM backend (Ollama + phi4-mini) is available."""
    available = await dj_engine.check_health()
    return {
        "available": available,
        "engine": "ollama/phi4-mini" if available else "templates",
    }
