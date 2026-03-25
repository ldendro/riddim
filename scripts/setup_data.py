"""
Riddim — One-Shot Data Setup

Orchestrates the full data preparation pipeline:
1. NCS EDM track fetch + MP3 download via yt-dlp
2. Feature extraction
"""

import sys
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from backend.pipeline.ncs_prep import run_pipeline as run_ncs_pipeline
from scripts.extract_features import run as run_feature_extraction


def main():
    print("🎵 Riddim — Full Data Setup\n")

    # Step 1: NCS data preparation
    run_ncs_pipeline()

    print()

    # Step 2: Feature extraction (uses WAV files)
    run_feature_extraction()

    print("\n🎉 All data setup complete!")


if __name__ == "__main__":
    main()
