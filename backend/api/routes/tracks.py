"""
Riddim — Track Routes

Endpoints for listing tracks and streaming audio.
"""

from pathlib import Path

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import FileResponse

from backend.db.database import query_all, query_one

router = APIRouter(prefix="/api/tracks", tags=["tracks"])


@router.get("")
<<<<<<< HEAD
def list_tracks(
=======
async def list_tracks(
>>>>>>> b49329b382f888c35451f2b08cf9db6dd7d44c73
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


@router.get("/{track_id}")
<<<<<<< HEAD
def get_track(track_id: str):
=======
async def get_track(track_id: str):
>>>>>>> b49329b382f888c35451f2b08cf9db6dd7d44c73
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
<<<<<<< HEAD
def stream_audio(track_id: str):
=======
async def stream_audio(track_id: str):
>>>>>>> b49329b382f888c35451f2b08cf9db6dd7d44c73
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
