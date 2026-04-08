import { useState, useEffect } from 'react';
import AudioPlayer from '../components/AudioPlayer';
import './GeneratePage.css';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

function GeneratePage() {
  const [clips, setClips] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchPair();
  }, []);

  const fetchPair = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`${API_BASE}/api/generate/pair`);
      if (!res.ok) throw new Error('Failed to fetch A/B pair');
      const data = await res.json();
      setClips(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const generateReplicate = async () => {
    try {
      setGenerating(true);
      setError(null);
      const res = await fetch(`${API_BASE}/api/generate/replicate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: 'default_user' })
      });
      if (!res.ok) throw new Error('Replicate generation failed');
      const data = await res.json();
      setClips(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setGenerating(false);
    }
  };

  const submitPreference = async (preferred) => {
    if (!clips) return;
    
    try {
      await fetch(`${API_BASE}/api/feedback/ab`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          item_a_id: clips.clipA.id,
          item_b_id: clips.clipB.id,
          preferred: preferred
        })
      });
      fetchPair(); // Next drops dynamically
    } catch (err) {
      console.error("Failed to submit A/B feedback:", err);
    }
  };

  if (loading && !clips) {
    return (
      <div className="generate-page animate-fade-in">
        <div className="page-header">
          <h1><span className="text-gradient">Generate</span></h1>
          <p>A/B compare AI-generated EDM drops</p>
        </div>
        <div className="discover-loading">
          <div className="loading-pulse" />
        </div>
      </div>
    );
  }

  if (error || !clips) {
    return (
      <div className="generate-page animate-fade-in">
        <div className="page-header">
          <h1><span className="text-gradient">Generate</span></h1>
          <p>A/B compare AI-generated EDM drops</p>
        </div>
        <div className="on-demand-controls" style={{ textAlign: 'center', marginBottom: '20px' }}>
          <button className="btn btn-green" onClick={generateReplicate} disabled={generating}>
            {generating ? 'Generating...' : 'Generate Custom Track'}
          </button>
        </div>
        <div className="empty-state glass-card">
          <div className="icon">🎛️</div>
          <h3>No AI Candidates Found</h3>
          <p>You can generate new tracks on-demand using Replicate MusicGen-Large, or fetch random pre-generated clips.</p>
          <div style={{ display: 'flex', gap: '15px', justifyContent: 'center', marginTop: '20px' }}>
            <button className="btn btn-primary" onClick={generateReplicate} disabled={generating}>
              {generating ? 'Generating...' : 'Generate New'}
            </button>
            <button className="btn btn-secondary" onClick={fetchPair} disabled={generating}>
              Random Pair
            </button>
          </div>
        </div>
      </div>
    );
  }

  const { clipA, clipB } = clips;

  const parseMeta = (track) => {
    if (track && track.metadata) {
      try { return typeof track.metadata === 'string' ? JSON.parse(track.metadata) : track.metadata; } catch {}
    }
    return {};
  };

  const metaA = parseMeta(clipA);
  const metaB = parseMeta(clipB);

  return (
    <div className="generate-page animate-fade-in">
      <div className="page-header">
        <h1><span className="text-gradient">Generate</span></h1>
        <p>A/B compare AI-generated tracks (Replicate MusicGen)</p>
      </div>

      <div className="on-demand-controls" style={{ textAlign: 'center', marginBottom: '20px' }}>
        <button className="btn btn-green" onClick={generateReplicate} disabled={generating}>
          {generating ? 'Generating...' : 'Generate Custom Track'}
        </button>
      </div>

      <div className="dual-player-container">
        {/* PLAYER A */}
        <div className="ab-column glass-card">
          <div className="ab-badge">Clip A</div>
          <AudioPlayer
            key={clipA.id}
            src={`${API_BASE}/api/tracks/${clipA.id}/audio`}
            title={metaA.title || clipA.id}
            artist={metaA.artist}
            bpm={clipA.bpm}
          />
          <button className="btn btn-primary btn-select" onClick={() => submitPreference('A')}>
            A is better
          </button>
        </div>
        
        {/* VS Divider */}
        <div className="vs-divider">
          <span>VS</span>
        </div>

        {/* PLAYER B */}
        <div className="ab-column glass-card" style={{ borderColor: 'rgba(255, 51, 136, 0.1)' }}>
          <div className="ab-badge pink">Clip B</div>
          <AudioPlayer
            key={clipB.id}
            src={`${API_BASE}/api/tracks/${clipB.id}/audio`}
            title={metaB.title || clipB.id}
            artist={metaB.artist}
            bpm={clipB.bpm}
          />
          <button className="btn btn-primary btn-select pink" onClick={() => submitPreference('B')}>
            B is better
          </button>
        </div>
      </div>

    </div>
  );
}

export default GeneratePage;
