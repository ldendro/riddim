"""
Riddim — FastAPI Application

Main entry point for the backend API server.
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.config import FRONTEND_URL
from backend.db.database import init_db
from backend.api.routes.tracks import router as tracks_router
from backend.api.routes.feedback import router as feedback_router
from backend.api.routes.generate import router as generate_router
from backend.api.routes.auth import router as auth_router
from backend.api.routes.onboarding import router as onboarding_router
from backend.api.routes.dj import router as dj_router
from backend.api.routes.tastemap import router as tastemap_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize database on startup."""
    init_db()
    yield


app = FastAPI(
    title="Riddim",
    description="A human-in-the-loop AI system that learns your EDM taste",
    version="0.2.0",
    lifespan=lifespan,
)

# CORS — allow frontend dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_URL, "http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routes
app.include_router(auth_router)
app.include_router(onboarding_router)
app.include_router(tracks_router)
app.include_router(feedback_router)
app.include_router(generate_router)
app.include_router(dj_router)
app.include_router(tastemap_router)


@app.get("/api/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "ok", "service": "riddim"}
