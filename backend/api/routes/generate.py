"""
Riddim — Generate Routes

Endpoints for fetching A/B candidate pairs.
"""
import json
import uuid
from pathlib import Path
from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel
from backend.db.database import query_all, get_db
from backend.pipeline.replicate_client import replicate_client
from backend.models.feature_extractor import extract_features
from backend.config import DATA_DIR
import logging
import asyncio

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/generate", tags=["generate"])

class GenerateRequest(BaseModel):
    user_id: str
    custom_prompt: str | None = None

@router.get("/pair")
async def get_generate_pair():
    """Get a random pair of tracks to simulate A/B candidate drops."""
    # Temporarily pick 2 random items (acting as generator drops)
    sql = """
        SELECT i.id, i.source, i.file_path, i.genre, i.metadata,
               f.bpm, f.energy_rms, f.bass_energy, f.spectral_centroid,
               f.onset_density, f.duration_sec
        FROM items i
        LEFT JOIN features f ON i.id = f.item_id
        WHERE i.source = 'generated'
        ORDER BY RANDOM()
        LIMIT 2
    """
    pair = query_all(sql)
    if len(pair) < 2:
        raise HTTPException(status_code=404, detail="Not enough tracks to form a pair")
    
    return {
        "clipA": pair[0],
        "clipB": pair[1]
    }

@router.post("/replicate")
async def generate_replicate_music(req: GenerateRequest):
    """Generates two tracks using Replicate MusicGen-Large and returns them as an A/B pair."""
    # 1. Construct prompt
    prompt = req.custom_prompt or "Electronic EDM banger drop, heavy bass, energetic"
    
    # 2. Call Replicate in Parallel (this handles Mock fallback)
    logger.info(f"Triggering Replicate with prompt: {prompt}")
    
    # We trigger two generations in parallel to cut wait time in half
    try:
        # Note: we use asyncio.to_thread because the replicate client is blocking
        task1 = asyncio.to_thread(replicate_client.generate_music_single, prompt=prompt, duration=15)
        task2 = asyncio.to_thread(replicate_client.generate_music_single, prompt=prompt, duration=15)
        clips = await asyncio.gather(task1, task2)
    except Exception as e:
        logger.error(f"Generation failed: {e}")
        raise HTTPException(status_code=500, detail=f"Generation failed: {str(e)}")
    
    if not clips or any(c is None for c in clips):
        raise HTTPException(status_code=500, detail="Replicate generation failed to return clips.")

    # 3. Download and Extract Features
    out_dir = Path("data/generated/wav")
    out_dir.mkdir(parents=True, exist_ok=True)
    
    saved_clips = []
    
    # Batch items into one DB transaction for efficiency
    with get_db() as conn:
        for i, clip in enumerate(clips):
            track_id = f"gen_{clip['id'][:8]}"
            file_path = out_dir / f"{track_id}.wav"
            
            # Download
            replicate_client.download_audio(clip.get("audio_url", ""), file_path)
            
            metadata = {
                "prompt": prompt,
                "title": clip.get("title", f"Variation {i+1}"),
                "model": "musicgen-large",
                "tags": clip.get("metadata", {}).get("tags", "EDM")
            }
            
            # Insert item
            conn.execute(
                "INSERT OR REPLACE INTO items (id, source, file_path, genre, metadata) VALUES (?, ?, ?, ?, ?)",
                (track_id, "generated", str(file_path), "EDM", json.dumps(metadata))
            )
            
            # Extract and Insert features
            features = extract_features(file_path, track_id)
            if features:
                conn.execute(
                    "INSERT OR REPLACE INTO features (item_id, bpm, energy_rms, bass_energy, spectral_centroid, onset_density, duration_sec) VALUES (?, ?, ?, ?, ?, ?, ?)",
                    (track_id, features.bpm, features.energy_rms, features.bass_energy, features.spectral_centroid, features.onset_density, features.duration_sec),
                )
        
        # We don't need conn.commit() here because get_db() context manager handles it on exit
        
    # Query back outside the loop
    for clip in clips:
        track_id = f"gen_{clip['id'][:8]}"
        rec = query_all("SELECT i.*, f.bpm, f.energy_rms, f.bass_energy, f.spectral_centroid, f.onset_density, f.duration_sec FROM items i LEFT JOIN features f ON i.id = f.item_id WHERE i.id = ?", (track_id,))
        if rec:
            saved_clips.append(rec[0])

    if len(saved_clips) < 2:
        raise HTTPException(status_code=500, detail="Failed to retrieve generated clips from database.")
        
    return {
        "clipA": saved_clips[0],
        "clipB": saved_clips[1]
    }
