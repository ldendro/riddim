import { useState, useEffect } from 'react';
import AudioPlayer from '../components/AudioPlayer';
import './DiscoverPage.css';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

function DiscoverPage() {
  const [tracks, setTracks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    fetchTracks();
  }, []);

  const fetchTracks = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/api/tracks?source=ncs&limit=50`);
      if (!res.ok) throw new Error('Failed to fetch tracks');
      const data = await res.json();
      setTracks(data.tracks || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const currentTrack = tracks[currentIndex];

  const parseMetadata = (track) => {
    let meta = {};
    if (track?.metadata) {
      try {
        meta = typeof track.metadata === 'string' ? JSON.parse(track.metadata) : track.metadata;
      } catch { }
    }
    return meta;
  };

  if (loading) {
    return (
      <div className="discover-page animate-fade-in">
        <div className="page-header">
          <h1><span className="text-gradient">Discover</span></h1>
          <p>Finding tracks for you...</p>
        </div>
        <div className="discover-loading">
          <div className="loading-pulse" />
        </div>
      </div>
    );
  }

  if (error || tracks.length === 0) {
    return (
      <div className="discover-page animate-fade-in">
        <div className="page-header">
          <h1><span className="text-gradient">Discover</span></h1>
          <p>Browse real EDM tracks and tell us what you think</p>
        </div>
        <div className="empty-state glass-card">
          <div className="icon">🎧</div>
          <h3>No Tracks Yet</h3>
          <p>
            {error
              ? `Could not connect to the backend. Make sure the server is running on port 8000.`
              : 'Run the data pipeline to load NCS tracks into the database.'
            }
          </p>
          <code className="setup-hint">python scripts/setup_data.py</code>
        </div>
      </div>
    );
  }

  const meta = parseMetadata(currentTrack);

  return (
    <div className="discover-page animate-fade-in">
      <div className="page-header">
        <h1><span className="text-gradient">Discover</span></h1>
        <p>Browse real EDM tracks and tell us what you think</p>
      </div>

      <div className="discover-content">
        <div className="track-counter">
          <span className="counter-current">{currentIndex + 1}</span>
          <span className="counter-sep">/</span>
          <span className="counter-total">{tracks.length}</span>
        </div>

        <AudioPlayer
          src={`${API_BASE}/api/tracks/${currentTrack.id}/audio`}
          title={meta.title || currentTrack.id}
          artist={meta.artist}
          genre={meta.genre || currentTrack.genre}
          bpm={currentTrack.bpm}
          albumArt={meta.album_art}
          popularity={meta.popularity}
          year={meta.year}
          onEnded={() => {
            if (currentIndex < tracks.length - 1) {
              setCurrentIndex(currentIndex + 1);
            }
          }}
        />

        {/* Feedback buttons will be added in Phase 2 */}
        <div className="discover-feedback-placeholder glass-card">
          <p className="placeholder-text">
            ❤️ 👍 😐 ⏭️ 🚫 — Feedback buttons coming in Phase 2
          </p>
        </div>

        <div className="discover-nav">
          <button
            className="btn btn-primary"
            onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
            disabled={currentIndex === 0}
          >
            ← Previous
          </button>
          <button
            className="btn btn-primary"
            onClick={() => setCurrentIndex(Math.min(tracks.length - 1, currentIndex + 1))}
            disabled={currentIndex === tracks.length - 1}
          >
            Next →
          </button>
        </div>
      </div>
    </div>
  );
}

export default DiscoverPage;
