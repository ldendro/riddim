"""
Riddim — Compute Drop Timestamps for Existing Tracks

Runs librosa-based drop detection on all NCS tracks that don't yet
have drop_timestamps computed, and stores the results in the DB.
"""

import json
import sys
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from tqdm import tqdm

from backend.config import DATA_DIR
from backend.db.database import execute, get_db, init_db, query_all
from backend.models.feature_extractor import detect_drops

SAMPLE_RATE = 16000
WAV_DIR = DATA_DIR / "ncs" / "wav"


def compute_drops():
    """Compute drop timestamps for all tracks missing them."""
    import librosa

    init_db()

    # Find tracks that need drop detection
    rows = query_all("""
        SELECT f.item_id, i.file_path
        FROM features f
        JOIN items i ON f.item_id = i.id
        WHERE f.drop_timestamps IS NULL
    """)

    if not rows:
        print("✅ All tracks already have drop timestamps computed.")
        return

    print(f"🎵 Computing drop timestamps for {len(rows)} tracks...")

    updated = 0
    for row in tqdm(rows, desc="  Detecting drops"):
        item_id = row["item_id"]

        # Try WAV file first (higher quality for analysis)
        mp3_path = Path(row["file_path"])
        wav_path = WAV_DIR / f"{mp3_path.stem}.wav"

        audio_path = wav_path if wav_path.exists() else mp3_path
        if not audio_path.exists():
            print(f"  ⚠ Audio not found for {item_id}")
            continue

        try:
            y, sr = librosa.load(str(audio_path), sr=SAMPLE_RATE, mono=True)
            drops = detect_drops(y, sr)

            execute(
                "UPDATE features SET drop_timestamps = ? WHERE item_id = ?",
                (json.dumps(drops), item_id),
            )
            updated += 1

            if drops:
                times_str = ", ".join(f"{t:.1f}s" for t in drops)
                print(f"  ✓ {item_id}: {len(drops)} drops at [{times_str}]")
            else:
                print(f"  · {item_id}: no drops detected")

        except Exception as e:
            print(f"  ⚠ Failed for {item_id}: {e}")

    print(f"\n✅ Updated {updated}/{len(rows)} tracks with drop timestamps.")


if __name__ == "__main__":
    compute_drops()
