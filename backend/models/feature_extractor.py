"""
Riddim — Audio Feature Extraction

Extracts audio features using librosa:
- BPM (tempo)
- Energy (RMS)
- Bass energy (20-250Hz band)
- Spectral centroid
- Onset density
- Drop timestamps (EDM drop detection)
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
    drop_timestamps: list[float] | None = None  # seconds where drops occur


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

        # Drop detection
        drops = detect_drops(y, sr)

        return AudioFeatures(
            track_id=track_id,
            bpm=bpm,
            energy_rms=energy_rms,
            bass_energy=bass_energy,
            spectral_centroid=spectral_centroid,
            onset_density=onset_density,
            duration_sec=duration,
            drop_timestamps=drops,
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


def detect_drops(
    y: np.ndarray,
    sr: int,
    min_drop_spacing_sec: float = 8.0,
    hop_length: int = 512,
    anticipation_offset: float = 0.7,
) -> list[float]:
    """
    Detect EDM drop timestamps using RMS energy contour analysis.

    A "drop" is where energy rises sharply after a relatively quiet section
    (the buildup → drop transition). We look at the RMS envelope over time,
    smooth it, compute the first derivative, and find large positive spikes
    that follow a dip.

    The resulting timestamps are shifted earlier by `anticipation_offset`
    seconds to compensate for the RMS envelope lagging behind the actual
    percussive onset of the drop.

    Args:
        y: Audio time series.
        sr: Sample rate.
        min_drop_spacing_sec: Minimum seconds between detected drops.
        hop_length: Hop length for RMS calculation.
        anticipation_offset: Seconds to shift timestamps earlier.

    Returns:
        List of drop timestamps in seconds.
    """
    # Compute RMS envelope
    rms = librosa.feature.rms(y=y, hop_length=hop_length)[0]
    n_frames = len(rms)
    if n_frames < 20:
        return []

    # Convert frames to time
    times = librosa.frames_to_time(np.arange(n_frames), sr=sr, hop_length=hop_length)

    # Smooth the RMS envelope (window ~0.5s)
    smooth_len = max(int(0.5 * sr / hop_length), 3)
    if smooth_len % 2 == 0:
        smooth_len += 1
    rms_smooth = np.convolve(rms, np.ones(smooth_len) / smooth_len, mode='same')

    # Compute first derivative (energy rate of change)
    rms_diff = np.diff(rms_smooth)

    # Also compute a longer-term rolling minimum (~3 seconds) to identify quiet sections
    min_window = max(int(3.0 * sr / hop_length), 10)
    rolling_min = np.array([
        np.min(rms_smooth[max(0, i - min_window):i + 1])
        for i in range(n_frames)
    ])

    # The "contrast" at each frame: how much louder is this frame than the recent minimum?
    contrast = rms_smooth - rolling_min

    # Threshold: a drop must have significant contrast AND positive derivative
    # Use adaptive threshold based on the track's overall dynamic range
    rms_range = np.percentile(rms_smooth, 95) - np.percentile(rms_smooth, 5)
    contrast_threshold = max(rms_range * 0.4, 0.005)
    diff_threshold = max(np.percentile(np.abs(rms_diff), 90) * 0.8, 0.001)

    # Find candidate drop frames
    candidates = []
    min_spacing_frames = int(min_drop_spacing_sec * sr / hop_length)

    for i in range(1, n_frames - 1):
        if i >= len(rms_diff):
            break
        # Must be a positive spike in energy derivative
        if rms_diff[i - 1] < diff_threshold:
            continue
        # Must have significant contrast from recent minimum  
        if contrast[i] < contrast_threshold:
            continue
        # Must be above median energy (not a quiet-to-slightly-less-quiet transition)
        if rms_smooth[i] < np.median(rms_smooth) * 0.9:
            continue
        candidates.append((i, contrast[i]))

    # Non-maximum suppression: pick the strongest candidates with minimum spacing
    candidates.sort(key=lambda x: x[1], reverse=True)
    drops = []
    used_frames = set()

    for frame_idx, strength in candidates:
        # Check spacing from all accepted drops
        too_close = False
        for accepted in used_frames:
            if abs(frame_idx - accepted) < min_spacing_frames:
                too_close = True
                break
        if too_close:
            continue

        drops.append(float(times[frame_idx]))
        used_frames.add(frame_idx)

    drops.sort()

    # Shift timestamps earlier to compensate for RMS lag
    drops = [max(0.0, t - anticipation_offset) for t in drops]

    return drops


def features_to_dict(features: AudioFeatures) -> dict:
    """Convert AudioFeatures to a dict (excluding track_id)."""
    d = asdict(features)
    d.pop("track_id", None)
    return d
