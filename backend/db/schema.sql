-- Riddim — SQLite Schema
-- See docs/system_design.md §16 for details

-- Users
CREATE TABLE IF NOT EXISTS users (
    id          TEXT PRIMARY KEY,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    onboarding  JSON  -- serialized onboarding preferences
);

-- Taste profiles (one per user, updated in place)
CREATE TABLE IF NOT EXISTS taste_profiles (
    user_id                TEXT PRIMARY KEY REFERENCES users(id),
    interpretable          JSON,       -- InterpretableTaste serialized
    real_liked_centroid    BLOB,       -- numpy array bytes
    real_disliked_centroid BLOB,
    gen_liked_centroid     BLOB,
    confidence             REAL DEFAULT 0.0,
    updated_at             TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Items (both FMA tracks and generated clips)
CREATE TABLE IF NOT EXISTS items (
    id          TEXT PRIMARY KEY,
    source      TEXT NOT NULL CHECK(source IN ('generated', 'ncs')),
    file_path   TEXT NOT NULL,
    genre       TEXT,
    metadata    JSON,       -- title, artist, prompt, etc.
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Extracted audio features
CREATE TABLE IF NOT EXISTS features (
    item_id             TEXT PRIMARY KEY REFERENCES items(id),
    bpm                 REAL,
    energy_rms          REAL,
    bass_energy         REAL,
    spectral_centroid   REAL,
    onset_density       REAL,
    duration_sec        REAL
);

-- CLAP embeddings (stored as blobs for fast load)
CREATE TABLE IF NOT EXISTS embeddings (
    item_id     TEXT PRIMARY KEY REFERENCES items(id),
    vector      BLOB NOT NULL,      -- 512-d float32 numpy array
    model       TEXT DEFAULT 'clap'
);

-- User feedback on individual tracks
CREATE TABLE IF NOT EXISTS reactions (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     TEXT REFERENCES users(id),
    item_id     TEXT REFERENCES items(id),
    reaction    TEXT NOT NULL,       -- love/like/neutral/skip/reject/save
    reason_tags JSON,               -- ["too_slow", "weak_bass"]
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- A/B preference pairs
CREATE TABLE IF NOT EXISTS preference_pairs (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     TEXT REFERENCES users(id),
    item_a_id   TEXT REFERENCES items(id),
    item_b_id   TEXT REFERENCES items(id),
    preferred   TEXT NOT NULL CHECK(preferred IN ('A', 'B')),
    match_quality REAL,             -- 0.0 to 1.0
    directions  JSON,               -- ["more_bass", "darker"]
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Candidate pool membership
CREATE TABLE IF NOT EXISTS candidate_pool (
    user_id     TEXT REFERENCES users(id),
    item_id     TEXT REFERENCES items(id),
    score       REAL DEFAULT 0.5,
    added_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, item_id)
);

-- Saved collection
CREATE TABLE IF NOT EXISTS saved_tracks (
    user_id     TEXT REFERENCES users(id),
    item_id     TEXT REFERENCES items(id),
    saved_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, item_id)
);
