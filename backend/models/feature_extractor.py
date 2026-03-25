"""
Riddim — Audio Feature Extraction

Extracts audio features using librosa:
- BPM (tempo)
- Energy (RMS)
- Bass energy (20-250Hz band)
- Spectral centroid
- Onset density
"""

from dataclasses import dataclass, asdict
from pathlib import Path

import librosa
import numpy as np
import scipy.signal

from backend.config import BASS_FREQ_RANGE, SAMPLE_RATE


@dataclass
class AudioFeatures:
    """Extracted audio features for a single track."""
    track_id: str
    bpm: float
    energy_rms: float
    bass_energy: float
    spectral_centroid: float
    onset_density: float
    duration_sec: float


def extract_features(audio_path: str | Path, track_id: str) -> AudioFeatures | None:
    """
    Extract audio features from a WAV file.

    Args:
        audio_path: Path to the audio file.
        track_id: Unique identifier for the track.

    Returns:
        AudioFeatures dataclass, or None if extraction fails.
    """
    try:
        # Load audio
        y, sr = librosa.load(str(audio_path), sr=SAMPLE_RATE, mono=True)
        duration = librosa.get_duration(y=y, sr=sr)

        if duration < 1.0:
            return None

        # BPM
        tempo, _ = librosa.beat.beat_track(y=y, sr=sr)
        bpm = float(np.atleast_1d(tempo)[0])

        # Energy (RMS)
        rms = librosa.feature.rms(y=y)[0]
        energy_rms = float(np.mean(rms))

        # Bass energy (20-250 Hz bandpass → RMS)
        bass_energy = _compute_bass_energy(y, sr)

        # Spectral centroid
        centroid = librosa.feature.spectral_centroid(y=y, sr=sr)[0]
        spectral_centroid = float(np.mean(centroid))

        # Onset density (onsets per second)
        onsets = librosa.onset.onset_detect(y=y, sr=sr)
        onset_density = float(len(onsets) / duration) if duration > 0 else 0.0

        return AudioFeatures(
            track_id=track_id,
            bpm=bpm,
            energy_rms=energy_rms,
            bass_energy=bass_energy,
            spectral_centroid=spectral_centroid,
            onset_density=onset_density,
            duration_sec=duration,
        )

    except Exception as e:
        print(f"  ⚠ Feature extraction failed for {track_id}: {e}")
        return None


def _compute_bass_energy(y: np.ndarray, sr: int) -> float:
    """Compute RMS energy in the bass frequency range (20-250 Hz)."""
    lo, hi = BASS_FREQ_RANGE
    nyquist = sr / 2

    # Ensure valid frequency range for the given sample rate
    if hi >= nyquist:
        hi = nyquist - 1

    # Design bandpass filter
    sos = scipy.signal.butter(
        4,
        [lo / nyquist, hi / nyquist],
        btype="bandpass",
        output="sos",
    )

    # Apply filter
    y_bass = scipy.signal.sosfilt(sos, y)

    # Compute RMS
    return float(np.sqrt(np.mean(y_bass ** 2)))


def features_to_dict(features: AudioFeatures) -> dict:
    """Convert AudioFeatures to a dict (excluding track_id)."""
    d = asdict(features)
    d.pop("track_id", None)
    return d
