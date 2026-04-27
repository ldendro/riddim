"""
Riddim — Taste Engine

Hybrid scoring model for personalized track recommendations.
Combines onboarding priors with learned feature centroids (RLHF-style reward).

Signals:
  1. Onboarding Prior  — genre/BPM/energy preferences from onboarding
  2. Learned Centroids  — weighted average feature vectors of liked vs disliked tracks
  3. Diversity Bonus    — small boost for underexplored genres
"""

import json
import math
from typing import Optional

import numpy as np

from backend.db.database import query_all, query_one, get_db


# ── Feature vector keys (order matters — must match centroid storage) ──
FEATURE_KEYS = ["bpm", "energy_rms", "bass_energy", "spectral_centroid", "onset_density"]

# ── Normalization ranges (from actual data analysis) ──
FEATURE_RANGES = {
    "bpm":               (56.0, 175.0),
    "energy_rms":        (0.07, 0.42),
    "bass_energy":       (0.07, 0.38),
    "spectral_centroid": (800.0, 4000.0),
    "onset_density":     (1.0, 8.0),
}

# ── Reaction weights for centroid computation ──
REACTION_WEIGHTS = {
    "love":    1.0,
    "like":    0.6,
    "reject":  -1.0,
    "neutral": -0.3,
}

# ── Genre normalization map ──
GENRE_ALIASES = {
    "drum_and_bass": "drum and bass",
    "drum & bass":   "drum and bass",
    "dnb":           "drum and bass",
    "future_bass":   "future bass",
    "edm":           "electronic",
}


def _normalize_genre(genre: str) -> str:
    """Normalize a genre string for comparison."""
    g = genre.strip().lower().replace("_", " ")
    return GENRE_ALIASES.get(g, g)


def _normalize_feature(value: float, key: str) -> float:
    """Normalize a feature value to [0, 1] using known ranges."""
    lo, hi = FEATURE_RANGES.get(key, (0.0, 1.0))
    if hi == lo:
        return 0.5
    return max(0.0, min(1.0, (value - lo) / (hi - lo)))


def _track_to_vector(track: dict) -> np.ndarray:
    """Convert a track's features to a normalized numpy vector."""
    return np.array([
        _normalize_feature(float(track.get(k, 0) or 0), k)
        for k in FEATURE_KEYS
    ], dtype=np.float64)


def _cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    """Cosine similarity between two vectors."""
    norm_a = np.linalg.norm(a)
    norm_b = np.linalg.norm(b)
    if norm_a < 1e-9 or norm_b < 1e-9:
        return 0.0
    return float(np.dot(a, b) / (norm_a * norm_b))


def _gaussian_proximity(value: float, target: float, sigma: float = 0.25) -> float:
    """Gaussian decay: 1.0 when value == target, <1.0 as they diverge."""
    diff = value - target
    return math.exp(-0.5 * (diff / sigma) ** 2)


class TasteEngine:
    """Hybrid recommendation engine for personalized track scoring."""

    def score_tracks(self, user_id: str, limit: int = 50) -> list[dict]:
        """
        Score all unrated tracks for a user and return them sorted by score.

        Returns list of track dicts with an added 'score' field.
        """
        # 1. Get user's onboarding preferences
        user = query_one(
            "SELECT onboarding FROM users WHERE id = ?", (user_id,)
        )
        prefs = {}
        if user and user.get("onboarding"):
            raw = user["onboarding"]
            prefs = json.loads(raw) if isinstance(raw, str) else raw

        # 2. Get user's reaction history
        reactions = query_all(
            "SELECT item_id, reaction FROM reactions WHERE user_id = ?",
            (user_id,),
        )
        rated_ids = {r["item_id"] for r in reactions}
        reaction_count = len(rated_ids)

        # 3. Compute liked/disliked centroids from reactions
        liked_centroid, disliked_centroid, seen_genres = self._compute_centroids(
            reactions
        )

        # 4. Compute adaptive weights
        # Onboarding prior decays, learned signal grows
        if reaction_count == 0:
            w_prior, w_learned, w_div = 1.0, 0.0, 0.05
        else:
            # Sigmoid-like transition: by 15 reactions, learned dominates
            t = min(reaction_count / 15.0, 1.0)
            w_prior = 1.0 - 0.7 * t    # 1.0 → 0.3
            w_learned = 0.7 * t         # 0.0 → 0.7
            w_div = 0.05

        # 5. Get all tracks with features (excluding already-rated ones)
        all_tracks = query_all(
            """
            SELECT i.id, i.source, i.file_path, i.genre, i.metadata,
                   f.bpm, f.energy_rms, f.bass_energy, f.spectral_centroid,
                   f.onset_density, f.duration_sec
            FROM items i
            JOIN features f ON i.id = f.item_id
            WHERE i.source = 'ncs'
            """,
        )

        # 6. Score each unrated track
        scored = []
        for track in all_tracks:
            if track["id"] in rated_ids:
                continue

            track_vec = _track_to_vector(track)
            track_genre = _normalize_genre(track.get("genre") or "")

            # Signal 1: Onboarding prior
            onboarding_score = self._onboarding_score(track, track_vec, prefs)

            # Signal 2: Learned centroid reward
            learned_score = self._learned_score(
                track_vec, liked_centroid, disliked_centroid
            )

            # Signal 3: Diversity bonus
            diversity = self._diversity_bonus(track_genre, seen_genres)

            # Composite score
            score = (
                w_prior * onboarding_score
                + w_learned * learned_score
                + w_div * diversity
            )

            track_dict = dict(track)
            track_dict["score"] = round(score, 4)
            scored.append(track_dict)

        # Sort by score descending
        scored.sort(key=lambda t: t["score"], reverse=True)

        return scored[:limit]

    def update_profile(self, user_id: str):
        """
        Recompute and store the user's taste centroids in taste_profiles.
        Called after every reaction to keep the profile fresh.
        """
        reactions = query_all(
            "SELECT item_id, reaction FROM reactions WHERE user_id = ?",
            (user_id,),
        )

        liked_centroid, disliked_centroid, _ = self._compute_centroids(reactions)

        # Serialize centroids as bytes
        liked_bytes = liked_centroid.tobytes() if liked_centroid is not None else None
        disliked_bytes = (
            disliked_centroid.tobytes() if disliked_centroid is not None else None
        )

        confidence = min(len(reactions) / 20.0, 1.0)

        with get_db() as conn:
            conn.execute(
                """
                INSERT INTO taste_profiles (user_id, real_liked_centroid, real_disliked_centroid, confidence, updated_at)
                VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT(user_id) DO UPDATE SET
                    real_liked_centroid = excluded.real_liked_centroid,
                    real_disliked_centroid = excluded.real_disliked_centroid,
                    confidence = excluded.confidence,
                    updated_at = CURRENT_TIMESTAMP
                """,
                (user_id, liked_bytes, disliked_bytes, confidence),
            )

    def _compute_centroids(
        self, reactions: list[dict]
    ) -> tuple[Optional[np.ndarray], Optional[np.ndarray], set[str]]:
        """
        Compute weighted feature centroids from reaction history.

        Returns (liked_centroid, disliked_centroid, seen_genres).
        """
        liked_vecs = []
        liked_weights = []
        disliked_vecs = []
        disliked_weights = []
        seen_genres = set()

        if not reactions:
            return None, None, seen_genres

        # Fetch features for all reacted tracks in one query
        item_ids = [r["item_id"] for r in reactions]
        placeholders = ",".join("?" * len(item_ids))
        tracks = query_all(
            f"""
            SELECT i.id, i.genre, f.bpm, f.energy_rms, f.bass_energy,
                   f.spectral_centroid, f.onset_density
            FROM items i
            JOIN features f ON i.id = f.item_id
            WHERE i.id IN ({placeholders})
            """,
            tuple(item_ids),
        )
        track_map = {t["id"]: t for t in tracks}

        for r in reactions:
            track = track_map.get(r["item_id"])
            if not track:
                continue

            vec = _track_to_vector(track)
            genre = _normalize_genre(track.get("genre") or "")
            if genre:
                seen_genres.add(genre)

            weight = REACTION_WEIGHTS.get(r["reaction"], 0)
            if weight > 0:
                liked_vecs.append(vec)
                liked_weights.append(weight)
            elif weight < 0:
                disliked_vecs.append(vec)
                disliked_weights.append(abs(weight))

        liked_centroid = None
        if liked_vecs:
            w = np.array(liked_weights)
            liked_centroid = np.average(liked_vecs, axis=0, weights=w)

        disliked_centroid = None
        if disliked_vecs:
            w = np.array(disliked_weights)
            disliked_centroid = np.average(disliked_vecs, axis=0, weights=w)

        return liked_centroid, disliked_centroid, seen_genres

    def _onboarding_score(
        self, track: dict, track_vec: np.ndarray, prefs: dict
    ) -> float:
        """
        Score a track against onboarding preferences (cold-start signal).

        Components:
          - Genre match (0 or 0.4 boost)
          - BPM proximity (Gaussian)
          - Energy proximity (Gaussian)
        """
        if not prefs:
            return 0.5  # No prefs → neutral score

        score = 0.0
        components = 0

        # Genre match
        fav_genres = prefs.get("favorite_genres", [])
        if fav_genres:
            track_genre = _normalize_genre(track.get("genre") or "")
            normalized_favs = {_normalize_genre(g) for g in fav_genres}
            genre_match = 1.0 if track_genre in normalized_favs else 0.0
            score += 0.4 * genre_match
            components += 0.4

        # BPM proximity
        bpm_pref = prefs.get("bpm_preference")
        if bpm_pref is not None:
            track_bpm_norm = _normalize_feature(
                float(track.get("bpm") or 120), "bpm"
            )
            pref_bpm_norm = _normalize_feature(float(bpm_pref), "bpm")
            bpm_score = _gaussian_proximity(track_bpm_norm, pref_bpm_norm, sigma=0.3)
            score += 0.3 * bpm_score
            components += 0.3

        # Energy proximity
        energy_pref = prefs.get("energy_preference")
        if energy_pref is not None:
            track_energy_norm = _normalize_feature(
                float(track.get("energy_rms") or 0.2), "energy_rms"
            )
            energy_score = _gaussian_proximity(
                track_energy_norm, float(energy_pref), sigma=0.3
            )
            score += 0.3 * energy_score
            components += 0.3

        # Normalize to [0, 1]
        if components > 0:
            score = score / components
        else:
            score = 0.5

        return score

    def _learned_score(
        self,
        track_vec: np.ndarray,
        liked_centroid: Optional[np.ndarray],
        disliked_centroid: Optional[np.ndarray],
    ) -> float:
        """
        RLHF-style reward: similarity to liked - penalty for similarity to disliked.

        Returns a value roughly in [-0.5, 1.0].
        """
        if liked_centroid is None:
            return 0.0

        sim_liked = _cosine_similarity(track_vec, liked_centroid)

        if disliked_centroid is not None:
            sim_disliked = _cosine_similarity(track_vec, disliked_centroid)
            return sim_liked - 0.5 * sim_disliked
        else:
            return sim_liked

    def _diversity_bonus(self, track_genre: str, seen_genres: set[str]) -> float:
        """
        Small bonus for tracks from genres the user hasn't explored yet.
        """
        if not track_genre or not seen_genres:
            return 0.5  # Neutral when no data
        return 1.0 if track_genre not in seen_genres else 0.0


# Singleton
taste_engine = TasteEngine()
