"""
Riddim — Track Routes

Endpoints for listing tracks, streaming audio, library, and stats.
"""

from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse

from backend.db.database import query_all, query_one, get_db
from backend.api.deps import get_current_user
from backend.models.taste_engine import taste_engine

router = APIRouter(prefix="/api/tracks", tags=["tracks"])


@router.get("/discover")
async def discover_tracks(
    mode: str = Query("explore", description="Discovery mode: 'explore' or 'tailored'"),
    limit: int = Query(50, ge=1, le=100),
    current_user: dict = Depends(get_current_user),
):
    """
    Get tracks for the Discover page.

    - explore:  Random unrated tracks for unbiased discovery.
    - tailored: Scored by the TasteEngine, ranked by relevance.
    """
    user_id = current_user["user_id"]

    if mode == "tailored":
        scored = taste_engine.score_tracks(user_id, limit=limit)
        return {
            "tracks": scored,
            "total": len(scored),
            "mode": "tailored",
        }
    else:
        # Explore: random order, exclude already-rated
        tracks = query_all(
            """
            SELECT i.id, i.source, i.file_path, i.genre, i.metadata,
                   f.bpm, f.energy_rms, f.bass_energy, f.spectral_centroid,
                   f.onset_density, f.duration_sec
            FROM items i
            JOIN features f ON i.id = f.item_id
            WHERE i.source = 'ncs'
              AND i.id NOT IN (
                  SELECT item_id FROM reactions WHERE user_id = ?
              )
            ORDER BY RANDOM()
            LIMIT ?
            """,
            (user_id, limit),
        )
        return {
            "tracks": tracks,
            "total": len(tracks),
            "mode": "explore",
        }


@router.get("")
async def list_tracks(
    source: str | None = Query(None, description="Filter by source: 'ncs' or 'generated'"),
    genre: str | None = Query(None, description="Filter by genre"),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
):
    """List available tracks with optional filtering."""
    conditions = []
    params = []

    if source:
        conditions.append("i.source = ?")
        params.append(source)
    if genre:
        conditions.append("i.genre = ?")
        params.append(genre)

    where_clause = f"WHERE {' AND '.join(conditions)}" if conditions else ""

    sql = f"""
        SELECT i.id, i.source, i.file_path, i.genre, i.metadata,
               f.bpm, f.energy_rms, f.bass_energy, f.spectral_centroid,
               f.onset_density, f.duration_sec
        FROM items i
        LEFT JOIN features f ON i.id = f.item_id
        {where_clause}
        ORDER BY i.created_at DESC
        LIMIT ? OFFSET ?
    """
    params.extend([limit, offset])

    tracks = query_all(sql, tuple(params))

    # Get total count
    count_sql = f"SELECT COUNT(*) as total FROM items i {where_clause}"
    count_result = query_one(count_sql, tuple(params[:-2]))
    total = count_result["total"] if count_result else 0

    return {
        "tracks": tracks,
        "total": total,
        "limit": limit,
        "offset": offset,
    }


@router.get("/library")
async def get_library(current_user: dict = Depends(get_current_user)):
    """Get all tracks the user has added to their library (in_library = 1)."""
    user_id = current_user["user_id"]

    sql = """
        SELECT i.id, i.source, i.file_path, i.genre, i.metadata,
               f.bpm, f.energy_rms, f.bass_energy, f.spectral_centroid,
               f.onset_density, f.duration_sec,
               r.reaction
        FROM reactions r
        JOIN items i ON r.item_id = i.id
        LEFT JOIN features f ON i.id = f.item_id
        WHERE r.user_id = ? AND r.in_library = 1
        ORDER BY r.created_at DESC
    """
    tracks = query_all(sql, (user_id,))
    return {"tracks": tracks}


@router.delete("/library/{item_id}")
async def remove_from_library(
    item_id: str,
    current_user: dict = Depends(get_current_user),
):
    """
    Remove a track from the user's library without deleting the reaction.
    The feedback data is preserved for taste analysis.
    """
    user_id = current_user["user_id"]
    with get_db() as conn:
        conn.execute(
            "UPDATE reactions SET in_library = 0 WHERE user_id = ? AND item_id = ?",
            (user_id, item_id),
        )
    return {"status": "removed"}


@router.get("/stats")
async def get_stats(current_user: dict = Depends(get_current_user)):
    """Get user's feedback statistics."""
    user_id = current_user["user_id"]

    reactions = query_one(
        "SELECT COUNT(*) as total FROM reactions WHERE user_id = ?",
        (user_id,),
    )
    pairs = query_one(
        "SELECT COUNT(*) as total FROM preference_pairs WHERE user_id = ?",
        (user_id,),
    )

    return {
        "reactions": reactions["total"] if reactions else 0,
        "pairs": pairs["total"] if pairs else 0,
    }


@router.get("/{track_id}")
async def get_track(track_id: str):
    """Get a single track by ID."""
    track = query_one(
        """
        SELECT i.id, i.source, i.file_path, i.genre, i.metadata,
               f.bpm, f.energy_rms, f.bass_energy, f.spectral_centroid,
               f.onset_density, f.duration_sec
        FROM items i
        LEFT JOIN features f ON i.id = f.item_id
        WHERE i.id = ?
        """,
        (track_id,),
    )
    if not track:
        raise HTTPException(status_code=404, detail="Track not found")
    return track


@router.get("/{track_id}/audio")
async def stream_audio(track_id: str):
    """Stream audio file for a track."""
    track = query_one("SELECT file_path FROM items WHERE id = ?", (track_id,))
    if not track:
        raise HTTPException(status_code=404, detail="Track not found")

    file_path = Path(track["file_path"])
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Audio file not found on disk")

    # Determine media type
    suffix = file_path.suffix.lower()
    media_types = {
        ".wav": "audio/wav",
        ".mp3": "audio/mpeg",
        ".ogg": "audio/ogg",
        ".flac": "audio/flac",
    }
    media_type = media_types.get(suffix, "audio/wav")

    return FileResponse(
        path=str(file_path),
        media_type=media_type,
        filename=file_path.name,
    )


@router.get("/{track_id}/drops")
async def get_drop_timestamps(track_id: str):
    """Get precomputed drop timestamps for a track."""
    import json as _json

    row = query_one(
        "SELECT drop_timestamps FROM features WHERE item_id = ?",
        (track_id,),
    )
    if not row or not row.get("drop_timestamps"):
        return {"drops": []}

    raw = row["drop_timestamps"]
    try:
        drops = _json.loads(raw) if isinstance(raw, str) else raw
    except Exception:
        drops = []
    return {"drops": drops}
