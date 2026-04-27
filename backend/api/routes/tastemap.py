"""
Riddim — Taste Map API

Generates a lightweight 2D space for the track catalog
and projects the user's learned taste centroids onto it.
Operates in either 'intensity' (BPM/Energy matrix) or 'genre' (Genre constellations).
"""

from fastapi import APIRouter, Depends, Query
import numpy as np

from backend.db.database import query_all, query_one
from backend.api.deps import get_current_user
from backend.models.taste_engine import _track_to_vector, _normalize_genre

router = APIRouter(prefix="/api/tastemap", tags=["tastemap"])


# ── GENRE CONSTELLATION POINTS (X, Y) ──
# Fixed centers for the Genre taxonomy map.
GENRE_CENTERS = {
    "drum and bass": (80, 80),
    "house": (20, 70),
    "techno": (50, 50),
    "trance": (75, 30),
    "dubstep": (45, 85),
    "electronic": (25, 25),
    "ambient": (20, 10),
    "hardstyle": (85, 90),
}


@router.get("/points")
async def get_tastemap_points(
    map_type: str = Query("intensity", description="Either 'intensity' or 'genre'"),
    current_user: dict = Depends(get_current_user)
):
    """
    Returns 2D projected points of all NCS tracks and the user's centroids.
    map_type='intensity': BPM (X) vs Energy (Y)
    map_type='genre': Spatial clustering by taxonomy
    """
    user_id = current_user["user_id"]

    # 1. Fetch all tracks & features
    tracks = query_all(
        """
        SELECT i.id, i.genre, i.metadata,
               f.bpm, f.energy_rms, f.bass_energy, f.spectral_centroid, f.onset_density
        FROM items i
        JOIN features f ON i.id = f.item_id
        WHERE i.source = 'ncs'
        """
    )

    if not tracks:
        return {"points": []}

    # 2. Fetch user's reactions
    reactions = query_all(
        "SELECT item_id, reaction FROM reactions WHERE user_id = ?",
        (user_id,)
    )
    reaction_map = {r["item_id"]: r["reaction"] for r in reactions}

    # 3. Fetch user's centroids from taste_profiles
    profile = query_one(
        "SELECT real_liked_centroid, real_disliked_centroid FROM taste_profiles WHERE user_id = ?",
        (user_id,)
    )

    # 4. Map Tracks
    points = []
    
    # Store for centroid projection logic later
    genre_counts_liked = {}
    genre_counts_disliked = {}

    for t in tracks:
        # Metadata parsing
        meta = t.get("metadata") or "{}"
        if isinstance(meta, str):
            import json
            try:
                meta = json.loads(meta)
            except:
                meta = {}
                
        title = meta.get("title", t["id"])
        norm_genre = _normalize_genre(t.get("genre") or "Unknown")
        reaction = reaction_map.get(t["id"], "none")

        if reaction in ['love', 'like']:
            genre_counts_liked[norm_genre] = genre_counts_liked.get(norm_genre, 0) + 1
        elif reaction in ['reject', 'skip']:
            genre_counts_disliked[norm_genre] = genre_counts_disliked.get(norm_genre, 0) + 1

        x, y = 0.0, 0.0

        if map_type == "intensity":
            # X = BPM (typically 60 to 180 -> normalized 0 to 100)
            bpm = float(t.get("bpm") or 120.0)
            x = max(0, min(100, ((bpm - 60) / 120) * 100))
            
            # Y = Energy (typically 0.0 to 0.5 -> normalized 0 to 100)
            erg = float(t.get("energy_rms") or 0.2)
            y = max(0, min(100, ((erg - 0.05) / 0.35) * 100))

        elif map_type == "texture":
            # X = Bass Energy (Depth)
            bass = float(t.get("bass_energy") or 0.2)
            x = max(0, min(100, ((bass - 0.05) / 0.3) * 100))
            
            # Y = Spectral Centroid (Brightness)
            spec = float(t.get("spectral_centroid") or 2000.0)
            y = max(0, min(100, ((spec - 500) / 3500) * 100))

        else: # genre
            # X, Y = predefined cluster point + random jitter
            center = GENRE_CENTERS.get(norm_genre, (50, 50))
            # deterministic jitter based on track ID so re-renders are stable
            seed = sum(ord(c) for c in t["id"]) % 10000
            np.random.seed(seed)
            x = center[0] + np.random.normal(0, 3)
            y = center[1] + np.random.normal(0, 3)

        points.append({
            "id": t["id"],
            "type": "track",
            "title": title,
            "genre": norm_genre.title(),
            "x": round(float(x), 2),
            "y": round(float(y), 2),
            "reaction": reaction
        })

    # 5. Map Centroids
    # Vector indices: [bpm, energy_rms, bass_energy, spectral_centroid, onset_density]
    def project_intensity_centroid(c_vec):
        # We know c_vec[0] is normalized BPM, c_vec[1] is normalized Energy. Both are [0,1].
        # In our vectorization logic (taste_engine.py), they were mapped using:
        # BPM: (56, 175) -> [0, 1]
        # Energy: (0.07, 0.42) -> [0, 1]
        # So we inverse the normalization to get raw BPM/Energy, then apply our graph scale.
        raw_bpm = (c_vec[0] * (175 - 56)) + 56
        raw_energy = (c_vec[1] * (0.42 - 0.07)) + 0.07
        
        cx = float(max(0, min(100, ((raw_bpm - 60) / 120) * 100)))
        cy = float(max(0, min(100, ((raw_energy - 0.05) / 0.35) * 100)))
        return cx, cy

    def project_texture_centroid(c_vec):
        # Bass Energy is index 2, Spectral Centroid is index 3
        # Bass: (0.07, 0.38) -> [0, 1]
        # Spectral: (800.0, 4000.0) -> [0, 1]
        raw_bass = (c_vec[2] * (0.38 - 0.07)) + 0.07
        raw_spec = (c_vec[3] * (4000.0 - 800.0)) + 800.0

        cx = float(max(0, min(100, ((raw_bass - 0.05) / 0.3) * 100)))
        cy = float(max(0, min(100, ((raw_spec - 500) / 3500) * 100)))
        return cx, cy

    def project_genre_centroid(counts: dict):
        if not counts:
            return 50.0, 50.0
        total = sum(counts.values())
        cx = 0.0
        cy = 0.0
        for g, count in counts.items():
            g_center = GENRE_CENTERS.get(g, (50, 50))
            weight = count / total
            cx += g_center[0] * weight
            cy += g_center[1] * weight
        return cx, cy

    liked_centroid = None
    disliked_centroid = None
    if profile:
        if profile.get("real_liked_centroid"):
            liked_centroid = np.frombuffer(profile["real_liked_centroid"], dtype=np.float64)
        if profile.get("real_disliked_centroid"):
            disliked_centroid = np.frombuffer(profile["real_disliked_centroid"], dtype=np.float64)

    # Centroid visualization has been disabled per user request
    # if liked_centroid is not None:
    #    ...

    return {"points": points}
