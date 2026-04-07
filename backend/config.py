"""
Riddim — Centralized Configuration

All constants from the system design doc live here.
"""

import os
from pathlib import Path

# ──────────────────────────────────────────────
# Paths
# ──────────────────────────────────────────────
PROJECT_ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = PROJECT_ROOT / "data"
NCS_DIR = DATA_DIR / "ncs"
GENERATED_DIR = DATA_DIR / "generated"
EMBEDDINGS_DIR = DATA_DIR / "embeddings"
DB_DIR = DATA_DIR / "db"
DB_PATH = DB_DIR / "riddim.db"

# Ensure data directories exist
for d in [NCS_DIR, GENERATED_DIR, EMBEDDINGS_DIR, DB_DIR]:
    d.mkdir(parents=True, exist_ok=True)

# ──────────────────────────────────────────────
# Audio Processing
# ──────────────────────────────────────────────
SAMPLE_RATE = 16000
MONO = True
CLIP_DURATION_SEC = 8

# Feature extraction
BASS_FREQ_RANGE = (20, 250)  # Hz

# ──────────────────────────────────────────────
# Audio Metadata & Genres
# ──────────────────────────────────────────────
EDM_GENRES = [
    "Electronic", "Techno", "House", "Trance", "Drum and Bass",
    "Dubstep", "Ambient", "IDM", "Glitch", "Downtempo",
    "Breakbeat", "Electro", "Garage", "Hardstyle", "Jungle",
]

# ──────────────────────────────────────────────
# NCS Data Source (NoCopyrightSounds)
# ──────────────────────────────────────────────
NCS_SEARCH_QUERIES = [
    "ytsearch40:NoCopyrightSounds House",
    "ytsearch40:NoCopyrightSounds Dubstep",
    "ytsearch40:NoCopyrightSounds Drum and Bass",
    "ytsearch40:NoCopyrightSounds Trap",
    "ytsearch40:NoCopyrightSounds Electronic",
    "ytsearch40:NoCopyrightSounds Future Bass",
    "ytsearch40:NoCopyrightSounds Hardstyle",
    "ytsearch40:NoCopyrightSounds Dance",
]

# ──────────────────────────────────────────────
# MusicGen Prompt Strategy
# ──────────────────────────────────────────────
PROMPT_TEMPLATES = [
    "A {energy} {genre} drop at {bpm} BPM with {character}",
    "An EDM {genre} buildup and drop, {energy} energy, {bpm} BPM",
    "{genre} festival drop, {character}, {energy} intensity",
]

MUSICGEN_GENRES = ["house", "dubstep", "drum and bass", "trance", "techno", "hardstyle"]

BPM_RANGES = {
    "house":         (124, 128),
    "dubstep":       (138, 142),
    "drum and bass": (170, 178),
    "trance":        (136, 142),
    "techno":        (128, 135),
    "hardstyle":     (150, 160),
}

ENERGY_LEVELS = ["low", "medium", "high", "explosive"]

CHARACTERS = [
    "heavy bass", "melodic synths", "dark atmosphere",
    "euphoric chords", "distorted wobble", "crisp percussion",
    "ethereal pads", "aggressive leads", "minimal groove",
]

# ──────────────────────────────────────────────
# Taste Model
# ──────────────────────────────────────────────
CENTROID_ALPHA = 0.1          # EMA smoothing factor
FEATURE_ALPHA = 0.1
GENRE_WEIGHT_ALPHA = 0.05
CONFIDENCE_DECAY = 0.95

# ──────────────────────────────────────────────
# Reward Model
# ──────────────────────────────────────────────
MIN_PAIRS_FOR_XGBOOST = 50
REWARD_WEIGHT = 0.6
TASTE_WEIGHT = 0.4

# ──────────────────────────────────────────────
# Candidate Pool
# ──────────────────────────────────────────────
INITIAL_POOL_SIZE = 100
MIN_POOL_SIZE = 40
REFRESH_BATCH_SIZE = 20
PRUNE_SCORE_THRESHOLD = 0.2

# ──────────────────────────────────────────────
# CLAP Embeddings
# ──────────────────────────────────────────────
CLAP_EMBEDDING_DIM = 512

# ──────────────────────────────────────────────
# Feedback Signal Values
# ──────────────────────────────────────────────
REACTION_VALUES = {
    "love": 1.0,
    "like": 0.5,
    "neutral": 0.0,
    "skip": -0.5,
    "reject": -1.0,
    "save": 1.5,
}

REASON_TAGS = [
    "too_slow", "too_fast", "too_dark", "too_bright",
    "weak_bass", "too_heavy", "wrong_vibe", "too_repetitive",
    "not_enough_melody", "too_simple", "too_complex",
]

# ──────────────────────────────────────────────
# Server
# ──────────────────────────────────────────────
API_HOST = os.getenv("RIDDIM_HOST", "0.0.0.0")
API_PORT = int(os.getenv("RIDDIM_PORT", "8000"))
FRONTEND_URL = os.getenv("RIDDIM_FRONTEND_URL", "http://localhost:5173")
