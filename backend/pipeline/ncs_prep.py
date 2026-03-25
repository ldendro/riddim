"""
Riddim — NCS Data Preparation Pipeline

Searches and downloads high-quality, royalty-free EDM tracks from
NoCopyrightSounds (NCS) via YouTube using yt-dlp.
Converts to MP3 for playback and WAV for feature extraction.
"""

import json
import os
import subprocess
from pathlib import Path

import yt_dlp
from tqdm import tqdm

from backend.config import DATA_DIR, NCS_SEARCH_QUERIES, SAMPLE_RATE
from backend.db.database import execute, get_db, init_db

NCS_DIR = DATA_DIR / "ncs"
AUDIO_DIR = NCS_DIR / "audio"       # Original MP3 (for playback)
WAV_DIR = NCS_DIR / "wav"           # 16kHz mono WAV (for feature extraction)


def convert_to_wav(mp3_path: Path, wav_dir: Path) -> Path | None:
    """Convert MP3 to 16kHz mono WAV for feature extraction."""
    wav_path = wav_dir / f"{mp3_path.stem}.wav"
    if wav_path.exists():
        return wav_path

    try:
        result = subprocess.run(
            [
                "ffmpeg", "-y", "-i", str(mp3_path),
                "-ar", str(SAMPLE_RATE),
                "-ac", "1",
                "-loglevel", "error",
                str(wav_path),
            ],
            capture_output=True, text=True, timeout=60,
        )
        if result.returncode == 0:
            return wav_path
    except Exception as e:
        print(f"  ⚠ WAV conversion failed for {mp3_path.name}: {e}")
    return None


def insert_track(track: dict, wav_path: Path) -> bool:
    """Insert an NCS track into the database."""
    metadata = json.dumps({
        "title": track["title"],
        "artist": track["artist"],
        "youtube_id": track["id"],
        "popularity": track.get("popularity", 0),
        "album_art": track.get("album_art", ""),
        "year": track.get("year", ""),
    })

    try:
        execute(
            """
            INSERT OR IGNORE INTO items (id, source, file_path, genre, metadata)
            VALUES (?, 'ncs', ?, ?, ?)
            """,
            (
                f"ncs_{track['id']}",
                str(track["mp3_path"]),  # Serve the MP3 for playback
                track.get("genre", "Electronic"),
                metadata,
            ),
        )
        return True
    except Exception as e:
        print(f"  ⚠ DB insert failed for {track['title']}: {e}")
        return False


def deduplicate_tracks(tracks: list[dict]) -> list[dict]:
    """Remove duplicate tracks by YouTube ID."""
    seen = set()
    unique = []
    for t in tracks:
        if t["id"] not in seen:
            seen.add(t["id"])
            unique.append(t)
    return unique


def run_pipeline():
    """
    Full NCS data preparation pipeline:
    1. Bulk download top NCS EDM tracks via yt-dlp search queries
    2. Convert to 16kHz WAV for librosa
    3. Insert metadata into SQLite
    """
    print("=" * 60)
    print("🎵 Riddim — NCS Data Preparation Pipeline")
    print("=" * 60)

    AUDIO_DIR.mkdir(parents=True, exist_ok=True)
    WAV_DIR.mkdir(parents=True, exist_ok=True)
    init_db()

    print(f"\n[1/3] Searching and downloading top NCS tracks ({len(NCS_SEARCH_QUERIES)} queries)...")
    downloaded_tracks = []
    
    ydl_opts = {
        'format': 'bestaudio/best',
        'postprocessors': [{
            'key': 'FFmpegExtractAudio',
            'preferredcodec': 'mp3',
            'preferredquality': '192',
        }],
        'outtmpl': str(AUDIO_DIR / '%(id)s.%(ext)s'),
        'quiet': True,
        'no_warnings': True,
        'extract_flat': False,
        'ignoreerrors': True, # Gracefully skip private/deleted videos
        'match_filter': yt_dlp.utils.match_filter_func("duration <= 600"), # Ignore mixes > 10 mins
    }

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            for query in tqdm(NCS_SEARCH_QUERIES, desc="  Downloading"):
                try:
                    info = ydl.extract_info(query, download=True)
                    if not info or 'entries' not in info:
                        continue
                        
                    for entry in info['entries']:
                        if not entry:
                            continue
                        
                        mp3_path = AUDIO_DIR / f"{entry['id']}.mp3"
                        if mp3_path.exists():
                            # Parse Artist and Title
                            raw_title = entry.get("title", "Unknown Title")
                            artist = entry.get("uploader", "NCS").replace("NoCopyrightSounds", "").strip() or "NCS"
                            title = raw_title
                            
                            if " - " in raw_title:
                                parts = raw_title.split(" - ", 1)
                                artist = parts[0].strip()
                                title = parts[1].split("[NCS")[0].split("(NCS")[0].split("|")[0].strip()
                            else:
                                title = raw_title.split("[NCS")[0].split("(NCS")[0].strip()

                            # Extract Genre from tags/description
                            tags = [t.lower() for t in entry.get("tags", [])]
                            genre = "Electronic"
                            edm_genres = ["house", "dubstep", "trap", "drum and bass", "dnb", "future bass", "hardstyle", "electro", "trance", "bass", "riddim"]
                            for g in edm_genres:
                                if g in tags or any(g in t for t in tags):
                                    genre = "Drum & Bass" if g == "dnb" else g.title()
                                    break

                            downloaded_tracks.append({
                                "id": entry["id"],
                                "title": title,
                                "artist": artist,
                                "genre": genre,
                                "mp3_path": mp3_path,
                                "duration": entry.get("duration", 0),
                                "popularity": entry.get("view_count", 0),
                                "album_art": entry.get("thumbnail", ""),
                                "year": entry.get("upload_date", "")[:4] if entry.get("upload_date") else "",
                            })
                except Exception as e:
                    print(f"  ⚠ Search failed for {query}: {e}")
    except Exception as e:
        print(f"  ⚠ yt-dlp initialization failed: {e}")

    downloaded_tracks = deduplicate_tracks(downloaded_tracks)
    print(f"  ✓ Downloaded {len(downloaded_tracks)} unique full-length EDM tracks")

    if not downloaded_tracks:
        print("\n  ⚠ No tracks downloaded. Exiting.")
        return

    print("\n[2/3] Converting to WAV for feature extraction...")
    converted = 0
    for track in tqdm(downloaded_tracks, desc="  Converting"):
        wav_path = convert_to_wav(track["mp3_path"], WAV_DIR)
        if wav_path:
            track["wav_path"] = wav_path
            converted += 1
            
    print(f"  ✓ Converted {converted} tracks to WAV")

    print("\n[3/3] Inserting into database...")
    inserted = 0
    for track in downloaded_tracks:
        if "wav_path" in track:
            if insert_track(track, track["wav_path"]):
                inserted += 1

    print(f"  ✓ Inserted {inserted} tracks into database")

    print("\n" + "=" * 60)
    print(f"✅ Pipeline complete! {inserted} high-quality EDM tracks ready.")
    print("=" * 60)


if __name__ == "__main__":
    run_pipeline()
