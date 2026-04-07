"""
Riddim — Batch Feature Extraction Script

Iterates all items in the database that don't have features yet,
extracts audio features using librosa, and stores them.
"""

import sys
from pathlib import Path

from tqdm import tqdm

# Add project root to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from backend.config import DATA_DIR
from backend.db.database import execute, get_db, query_all
from backend.models.feature_extractor import extract_features


def _resolve_wav_path(item: dict) -> Path | None:
    """
    Resolve the WAV file path for feature extraction.

    For NCS tracks: file_path is the MP3 (for playback),
    so we look for the corresponding WAV in data/ncs/wav/.

    For generated tracks: file_path is already a WAV.
    """
    file_path = Path(item["file_path"])

    # If it's already a WAV, use it directly
    if file_path.suffix == ".wav" and file_path.exists():
        return file_path

    # For MP3s (NCS), look for the WAV counterpart
    if file_path.suffix == ".mp3":
        # Try NCS WAV directory
        wav_path = DATA_DIR / "ncs" / "wav" / f"{file_path.stem}.wav"
        if wav_path.exists():
            return wav_path

    return None


def run():
    """Extract features for all items missing them."""
    print("=" * 60)
    print("🎛️  Riddim — Batch Feature Extraction")
    print("=" * 60)

    # Find items without features
    items = query_all(
        """
        SELECT i.id, i.file_path
        FROM items i
        LEFT JOIN features f ON i.id = f.item_id
        WHERE f.item_id IS NULL
        """
    )

    if not items:
        print("  ✓ All items already have features extracted.")
        return

    print(f"  Found {len(items)} items without features.\n")

    success = 0
    failed = 0

    for item in tqdm(items, desc="  Extracting features"):
        wav_path = _resolve_wav_path(item)
        if wav_path is None:
            print(f"  ⚠ No WAV file found for: {item['id']}")
            failed += 1
            continue

        features = extract_features(wav_path, item["id"])
        if features is None:
            failed += 1
            continue

        try:
            execute(
                """
                INSERT OR REPLACE INTO features
                    (item_id, bpm, energy_rms, bass_energy, spectral_centroid, onset_density, duration_sec)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    features.track_id,
                    features.bpm,
                    features.energy_rms,
                    features.bass_energy,
                    features.spectral_centroid,
                    features.onset_density,
                    features.duration_sec,
                ),
            )
            success += 1
        except Exception as e:
            print(f"  ⚠ DB insert failed for {item['id']}: {e}")
            failed += 1

    print(f"\n  ✅ Extracted: {success} | ⚠ Failed: {failed}")


if __name__ == "__main__":
    run()
