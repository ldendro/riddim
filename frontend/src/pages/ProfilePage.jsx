import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import AudioPlayer from '../components/AudioPlayer';
import {
  IconHeadphones, IconSettings, IconLove, IconLike,
  IconRefresh, IconLogout, IconDisc, IconWarning,
} from '../components/Icons';
import './ProfilePage.css';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

function ProfilePage() {
  const { user, token, resetProfile, logout } = useAuth();
  const [activeSection, setActiveSection] = useState('library');
  const [likedTracks, setLikedTracks] = useState([]);
  const [loadingTracks, setLoadingTracks] = useState(false);
  const [stats, setStats] = useState({ reactions: 0, pairs: 0 });
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [expandedTrack, setExpandedTrack] = useState(null);
  const [trackPrompts, setTrackPrompts] = useState({});
  const [regenerating, setRegenerating] = useState(null);

  useEffect(() => {
    fetchLibrary();
    fetchStats();
  }, []);

  const fetchLibrary = async () => {
    setLoadingTracks(true);
    try {
      const res = await fetch(`${API_BASE}/api/tracks/library`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setLikedTracks(data.tracks || []);
      }
    } catch (err) {
      console.error('Failed to fetch library:', err);
    } finally {
      setLoadingTracks(false);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/tracks/stats`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    }
  };

  const handleReset = async () => {
    setResetting(true);
    const ok = await resetProfile();
    if (ok) {
      setConfirmReset(false);
    }
    setResetting(false);
  };

  const parseMetadata = (track) => {
    if (!track?.metadata) return {};
    try {
      return typeof track.metadata === 'string' ? JSON.parse(track.metadata) : track.metadata;
    } catch { return {}; }
  };

  const toggleTrackPlayer = (trackId) => {
    const next = expandedTrack === trackId ? null : trackId;
    setExpandedTrack(next);
    if (next && !trackPrompts[next]) {
      fetchPrompts(next);
    }
  };

  const fetchPrompts = async (itemId) => {
    try {
      const res = await fetch(`${API_BASE}/api/dj/prompts/${itemId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setTrackPrompts(prev => ({ ...prev, [itemId]: data.prompts || [] }));
      }
    } catch (err) {
      console.error('Failed to fetch prompts:', err);
    }
  };

  const handleDeletePrompt = async (promptId, itemId) => {
    try {
      await fetch(`${API_BASE}/api/dj/prompts/${promptId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchPrompts(itemId);
    } catch (err) {
      console.error('Failed to delete prompt:', err);
    }
  };

  const handleRegenerate = async (track) => {
    const meta = parseMetadata(track);
    setRegenerating(track.id);
    try {
      const res = await fetch(`${API_BASE}/api/dj/regenerate-prompt`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          track_title: `${meta.artist || 'Unknown'} - ${meta.title || track.id}`,
          track_features: {
            bpm: track.bpm,
            energy_rms: track.energy_rms,
            bass_energy: track.bass_energy,
            genre: meta.genre || track.genre || 'EDM',
          },
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.prompt) {
          // Save it
          await fetch(`${API_BASE}/api/dj/save-prompt`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ item_id: track.id, prompt_text: data.prompt }),
          });
          fetchPrompts(track.id);
        }
      }
    } catch (err) {
      console.error('Failed to regenerate prompt:', err);
    } finally {
      setRegenerating(null);
    }
  };

  const handleCopyPrompt = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
  };

  const handleRemoveFromLibrary = async (trackId) => {
    try {
      await fetch(`${API_BASE}/api/tracks/library/${trackId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      setLikedTracks(prev => prev.filter(t => t.id !== trackId));
      setExpandedTrack(null);
    } catch (err) {
      console.error('Failed to remove from library:', err);
    }
  };

  return (
    <div className="profile-page animate-fade-in">
      <div className="page-header">
        <h1><span className="text-gradient">Profile</span></h1>
        <p className="page-subtitle">Your taste identity and curated collection</p>
      </div>

      {/* User Info Card */}
      <div className="profile-card glass-card">
        <div className="profile-avatar">
          <span>{user?.display_name?.[0]?.toUpperCase() || '?'}</span>
        </div>
        <div className="profile-info">
          <h3 className="profile-name">{user?.display_name || 'Unknown'}</h3>
          <p className="profile-email">{user?.email}</p>
        </div>
        <div className="profile-stats">
          <div className="stat-item">
            <span className="stat-value">{stats.reactions}</span>
            <span className="stat-label">Tracks Rated</span>
          </div>
          <div className="stat-item">
            <span className="stat-value">{stats.pairs}</span>
            <span className="stat-label">A/B Compared</span>
          </div>
        </div>
      </div>

      {/* Your Taste Summary Block */}
      {user?.dj_summary && (
        <div className="profile-taste-summary glass-card animate-fade-in" style={{ marginTop: '20px', padding: '24px', borderLeft: '4px solid var(--neon-cyan)' }}>
          <h3 style={{ margin: '0 0 12px 0', fontSize: '1.2rem', color: 'var(--neon-cyan)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2a10 10 0 1 0 10 10H12z"/>
              <path d="M12 12 2.1 7.1"/>
              <path d="M12 12l9.9 4.9"/>
            </svg>
            Music Identity
          </h3>
          <p style={{ margin: 0, lineHeight: '1.6', color: 'rgba(255, 255, 255, 0.9)', fontStyle: 'italic' }}>
            "{user.dj_summary}"
          </p>
          <div style={{ marginTop: '12px', fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'right' }}>
            — Analyzed by DJ Byte
          </div>
        </div>
      )}

      {/* Section Navigation */}
      <div className="profile-sections">
        <button
          className={`section-tab ${activeSection === 'library' ? 'active' : ''}`}
          onClick={() => setActiveSection('library')}
        >
          <IconHeadphones size={16} /> Library
        </button>
        <button
          className={`section-tab ${activeSection === 'settings' ? 'active' : ''}`}
          onClick={() => setActiveSection('settings')}
        >
          <IconSettings size={16} /> Settings
        </button>
      </div>

      <div className="profile-content">
        {activeSection === 'library' ? (
          <div className="profile-section animate-fade-in">
            {loadingTracks ? (
              <div className="section-loading">
                <div className="loading-pulse" />
              </div>
            ) : likedTracks.length === 0 ? (
              <div className="empty-state glass-card">
                <div className="icon"><IconDisc size={32} /></div>
                <h3>No Liked Tracks Yet</h3>
                <p>Tracks you love or like will appear here. Start discovering!</p>
              </div>
            ) : (
              <div className="library-grid">
                {likedTracks.map((track) => {
                  const meta = parseMetadata(track);
                  const isExpanded = expandedTrack === track.id;
                  return (
                    <div key={track.id} className={`library-item glass-card ${isExpanded ? 'expanded' : ''}`}>
                      <div className="library-item-row" onClick={() => toggleTrackPlayer(track.id)}>
                        <div className="library-item-info">
                          <span className={`library-reaction-badge ${track.reaction}`}>
                            {track.reaction === 'love' ? <IconLove size={18} /> : <IconLike size={18} />}
                          </span>
                          <div>
                            <h4 className="library-track-title">{meta.title || track.id}</h4>
                            <p className="library-track-artist">{meta.artist || 'Unknown'}</p>
                          </div>
                        </div>
                        <div className="library-item-right">
                          {track.genre && (
                            <span className="badge genre-badge library-genre">{track.genre}</span>
                          )}
                          <span className={`library-expand-icon ${isExpanded ? 'open' : ''}`}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <polyline points="6 9 12 15 18 9" />
                            </svg>
                          </span>
                        </div>
                      </div>
                      {isExpanded && (
                        <div className="library-player-wrapper">
                          <AudioPlayer
                            key={`lib-${track.id}`}
                            trackId={track.id}
                            src={`${API_BASE}/api/tracks/${track.id}/audio`}
                            title={meta.title || track.id}
                            artist={meta.artist}
                            genre={meta.genre || track.genre}
                            bpm={track.bpm}
                            albumArt={meta.album_art}
                          />

                          {/* Saved Generation Prompts */}
                          <div className="library-prompts-section">
                            <div className="library-prompts-header">
                              <span className="library-prompts-title">Generation Prompts</span>
                              {(trackPrompts[track.id]?.length || 0) < 3 && (
                                <button
                                  className="library-regen-btn"
                                  onClick={() => handleRegenerate(track)}
                                  disabled={regenerating === track.id}
                                >
                                  {regenerating === track.id ? 'Generating...' : '+ Generate'}
                                </button>
                              )}
                            </div>
                            {trackPrompts[track.id]?.length > 0 ? (
                              <div className="library-prompts-list">
                                {trackPrompts[track.id].map((p) => (
                                  <div key={p.id} className="library-prompt-item">
                                    <p className="library-prompt-text">{p.prompt_text}</p>
                                    <div className="library-prompt-actions">
                                      <button
                                        className="library-prompt-action-btn"
                                        onClick={() => handleCopyPrompt(p.prompt_text)}
                                        title="Copy"
                                      >Copy</button>
                                      <button
                                        className="library-prompt-action-btn delete"
                                        onClick={() => handleDeletePrompt(p.id, track.id)}
                                        title="Delete"
                                      >Delete</button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="library-prompts-empty">
                                No prompts saved yet. Like a track on Discover to get one, or click Generate above.
                              </p>
                            )}
                          </div>

                          {/* Remove from Library */}
                          <button
                            className="library-remove-btn"
                            onClick={() => handleRemoveFromLibrary(track.id)}
                          >
                            Remove from Library
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <div className="profile-section animate-fade-in">
            <div className="settings-group glass-card">
              <h3 className="settings-title">Account</h3>
              <div className="settings-item">
                <div>
                  <p className="settings-item-label">Display Name</p>
                  <p className="settings-item-value">{user?.display_name}</p>
                </div>
              </div>
              <div className="settings-item">
                <div>
                  <p className="settings-item-label">Email</p>
                  <p className="settings-item-value">{user?.email}</p>
                </div>
              </div>
            </div>



          <div className="settings-group glass-card danger-zone">
            <h3 className="settings-title">Danger Zone</h3>

            {!confirmReset ? (
              <button
                className="btn btn-ghost danger-btn"
                onClick={() => setConfirmReset(true)}
              >
                <IconRefresh size={16} /> Reset My Taste
              </button>
            ) : (
              <div className="confirm-reset">
                <p className="reset-warning">
                  This will erase all your ratings, preferences, and taste profile.
                  You'll go through onboarding again.
                </p>
                <div className="reset-actions">
                  <button
                    className="btn btn-ghost"
                    onClick={() => setConfirmReset(false)}
                  >
                    Cancel
                  </button>
                  <button
                    className="btn btn-primary danger-confirm"
                    onClick={handleReset}
                    disabled={resetting}
                  >
                    {resetting ? 'Resetting...' : 'Confirm Reset'}
                  </button>
                </div>
              </div>
            )}

            <button className="btn btn-ghost danger-btn logout-btn" onClick={logout}>
              <IconLogout size={16} /> Sign Out
            </button>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}

export default ProfilePage;
