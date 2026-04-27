import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useDJ } from '../context/DJContext';
import AudioPlayer from '../components/AudioPlayer';
import './DiscoverPage.css';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const Icons = {
  Love: () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>,
  Like: () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>,
  Neutral: () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  Skip: () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 19 22 12 13 5 13 19"/><polygon points="2 19 11 12 2 5 2 19"/></svg>,
  Previous: () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 19 2 12 11 5 11 19"/><polygon points="22 19 13 12 22 5 22 19"/></svg>,
  Reject: () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
};

function DiscoverPage() {
  const { token } = useAuth();
  const { triggerDJComment } = useDJ();
  const [tracks, setTracks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userReactions, setUserReactions] = useState({});
  const [mode, setMode] = useState('explore');

  useEffect(() => {
    fetchMyReactions();
  }, []);

  useEffect(() => {
    fetchTracks();
  }, [mode]);

  const fetchTracks = async () => {
    try {
      setLoading(true);
      setCurrentIndex(0);
      const res = await fetch(
        `${API_BASE}/api/tracks/discover?mode=${mode}&limit=50`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) throw new Error('Failed to fetch tracks');
      const data = await res.json();
      setTracks(data.tracks || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchMyReactions = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/feedback/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setUserReactions(data.reactions || {});
      }
    } catch (err) {
      console.error('Failed to fetch prior reactions:', err);
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

  const handleReaction = async (reaction) => {
    // Optimistically update local active state
    setUserReactions(prev => ({
      ...prev,
      [currentTrack.id]: reaction
    }));
    
    try {
      await fetch(`${API_BASE}/api/feedback/reaction`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          item_id: currentTrack.id,
          reaction: reaction,
          reason_tags: []
        }),
      });

      // Trigger DJ Byte commentary
      const meta = parseMetadata(currentTrack);
      triggerDJComment({
        event_type: 'reaction',
        reaction: reaction,
        track_id: currentTrack.id,
        track_title: `${meta.artist || 'Unknown'} - ${meta.title || currentTrack.id}`,
        track_features: {
          bpm: currentTrack.bpm,
          energy_rms: currentTrack.energy_rms,
          bass_energy: currentTrack.bass_energy,
          genre: meta.genre || currentTrack.genre || 'EDM',
        },
      });

      // Move to next track
      if (currentIndex < tracks.length - 1) {
        setCurrentIndex(currentIndex + 1);
      }
    } catch (err) {
      console.error("Failed to submit reaction", err);
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
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
        <p>{mode === 'tailored' ? 'Tracks picked for your taste' : 'Browse real EDM tracks and tell us what you think'}</p>
      </div>

      {/* Mode Toggle */}
      <div className="discover-mode-toggle">
        <button
          className={`mode-tab ${mode === 'explore' ? 'active' : ''}`}
          onClick={() => setMode('explore')}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" /></svg>
          Explore
        </button>
        <button
          className={`mode-tab ${mode === 'tailored' ? 'active' : ''}`}
          onClick={() => setMode('tailored')}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
          Tailored
        </button>
        {mode === 'explore' && (
          <button className="shuffle-btn" onClick={fetchTracks} title="Shuffle">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 3 21 3 21 8" /><line x1="4" y1="20" x2="21" y2="3" /><polyline points="21 16 21 21 16 21" /><line x1="15" y1="15" x2="21" y2="21" /><line x1="4" y1="4" x2="9" y2="9" /></svg>
          </button>
        )}
      </div>

      <div className="discover-content">
        <div className="track-counter">
          <span className="counter-current">{currentIndex + 1}</span>
          <span className="counter-sep">/</span>
          <span className="counter-total">{tracks.length}</span>
        </div>

        <AudioPlayer
          key={currentTrack.id}
          trackId={currentTrack.id}
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

        <div className="discover-feedback-bar glass-card">
          <button 
            className="btn-reaction previous" 
            onClick={handlePrevious} 
            disabled={currentIndex === 0}
            data-tooltip="Previous Track"
            style={{ opacity: currentIndex === 0 ? 0.3 : 1, cursor: currentIndex === 0 ? 'not-allowed' : 'pointer' }}
          >
            <Icons.Previous />
          </button>
          
          <button className={`btn-reaction love ${userReactions[currentTrack.id] === 'love' ? 'active' : ''}`} onClick={() => handleReaction('love')} data-tooltip="Love / Banger">
            <Icons.Love />
          </button>
          <button className={`btn-reaction like ${userReactions[currentTrack.id] === 'like' ? 'active' : ''}`} onClick={() => handleReaction('like')} data-tooltip="Like">
            <Icons.Like />
          </button>
          <button className={`btn-reaction neutral ${userReactions[currentTrack.id] === 'neutral' ? 'active' : ''}`} onClick={() => handleReaction('neutral')} data-tooltip="Neutral">
            <Icons.Neutral />
          </button>
          <button className={`btn-reaction reject ${userReactions[currentTrack.id] === 'reject' ? 'active' : ''}`} onClick={() => handleReaction('reject')} data-tooltip="Not My Sound">
            <Icons.Reject />
          </button>
          <button className={`btn-reaction skip ${userReactions[currentTrack.id] === 'skip' ? 'active' : ''}`} onClick={() => handleReaction('skip')} data-tooltip="Skip">
            <Icons.Skip />
          </button>
        </div>
      </div>
    </div>
  );
}

export default DiscoverPage;
