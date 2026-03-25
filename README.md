# 🎵 Riddim

A human-in-the-loop AI system that learns your EDM music taste through interaction and improves both real music recommendations and AI-generated drop selection.

> **Riddim does not improve the music — it improves how well the music matches you.**

## Quick Start

### Backend

```bash
# Create virtual environment
python -m venv .venv
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Initialize database
python -c "from backend.db.database import init_db; init_db()"

# Start API server
uvicorn backend.api.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

### Data Pipeline

```bash
# Full setup (download NCS + extract features)
python scripts/setup_data.py

# Or run steps individually:
python -m backend.pipeline.ncs_prep       # Download & process NCS tracks
python scripts/extract_features.py        # Extract audio features
```

## Architecture

See [docs/system_design.md](docs/system_design.md) for the full system design document.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Vite + React |
| Backend | FastAPI (Python) |
| Audio Features | librosa |
| Audio Embeddings | CLAP |
| Music Generation | MusicGen |
| Database | SQLite |

## Project Structure

```
riddim/
├── docs/           # Design documents
├── frontend/       # Vite + React app
├── backend/
│   ├── api/        # FastAPI routes
│   ├── models/     # ML models & feature extraction
│   ├── pipeline/   # Data preparation pipelines
│   ├── db/         # Database schema & helpers
│   └── config.py   # Configuration
├── scripts/        # CLI utilities
└── data/           # Audio, embeddings, DB (gitignored)
```
