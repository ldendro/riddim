# Riddim: Phase 1 State

## Overview
Phase 1 (Foundation) establishes the core infrastructure, data pipeline, and UI for the Riddim human-in-the-loop recommendation system. This completely sets the stage for Phase 2, where we will implement the Interpretable Taste System to collect user feedback and map their sonic profile.

## Major Changes & Additions

### 1. The Data Pipeline Pivot
Originally designed around the Free Music Archive (FMA) dataset, the core data source was deprecated due to lack of recent tracks. We successfully pivoted the data ingestion engine to **NoCopyrightSounds (NCS)** via YouTube.

- **`backend/pipeline/ncs_prep.py`:** A completely custom `yt-dlp` scraping pipeline that bulk-downloads curated EDM tracks. It dynamically parses artist details, tags, genres, popularity metrics, and fetches high-resolution album art.
- **`scripts/setup_data.py`:** The generalized orchestrator that runs the pipeline, safely extracts audio, converts into both MP3 (for browser playback) and 16kHz WAV (for librosa feature extraction), and seeds the SQLite database.

### 2. Rich Metadata Schema
The database (`schema.sql`) was upgraded to accept `ncs` as a native source. We extended the metadata storage format to retain:
- Track Year
- Genre Tags
- View/Popularity Counts
- Album Artwork

### 3. Core Engine (Backend API)
- **FastAPI Core:** Set up basic API routers (`/api/tracks`) feeding from the SQLite DB.
- **Librosa Extraction:** `extract_features.py` computes robust acoustic properties (`bpm`, `energy`, `bass`, etc.) for all downloaded items.

### 4. High-Fidelity Animated UI
- **Design System:** Shifted to a hyper-premium "Dark Mode Club" aesthetic in Vite+React.
- **AudioPlayer Enhancements:** Rebuilt the `AudioPlayer` component to feature glowing neon badges projecting the track's BPM, Release Year, Genre, and Popularity metadata.
- **Interactive Background:** The application background is fully powered by **ReactBits' `RippleGrid` (ogl WebGL)**. We translated the default circular mask out of the fragment shader, creating a full-screen, infinitely extending, mouse-reactive 3D neon grid. 
- **Theming:** Deep violets, magentas, and neon cyan (`#00d4ff`) dominate the color palette to mirror authentic EDM environments.

## Transition to Phase 2 (Taste Matrix)
The backend successfully hands rich, structured EDM tracks to a highly polished frontend. The immediate next step is capturing interaction.
In Phase 2 we will:
1. Implement the interactive component overlay (Love/Like/Skip buttons) on the `DiscoverPage`.
2. Push those interactions back to the API.
3. Train the taste-learning algorithm (`TasteProfile`) to parse the librosa vectors and predict recommendations based on those interactions.
