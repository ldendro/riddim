import { useEffect, useRef, useState } from 'react';
import WaveSurfer from 'wavesurfer.js';
import './AudioPlayer.css';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// ── Shared AudioContext (one per page) ──
let sharedAudioCtx = null;
function getAudioContext() {
  if (!sharedAudioCtx) {
    sharedAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return sharedAudioCtx;
}


function AudioPlayer({ src, title, artist, genre, bpm, albumArt, popularity, year, onEnded, trackId }) {
  const waveformRef = useRef(null);
  const wavesurferRef = useRef(null);
  const analyserRef = useRef(null);
  const animFrameRef = useRef(null);
  const audioCtxConnectedRef = useRef(false);
  const dropTimestampsRef = useRef([]);
  const firedDropsRef = useRef(new Set());
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isReady, setIsReady] = useState(false);

  // ── Fetch precomputed drop timestamps from backend ──
  useEffect(() => {
    if (!trackId) return;
    fetch(`${API_BASE}/api/tracks/${trackId}/drops`)
      .then(r => r.ok ? r.json() : { drops: [] })
      .then(data => {
        dropTimestampsRef.current = data.drops || [];
        firedDropsRef.current = new Set();
        if (data.drops?.length > 0) {
          console.debug(`🎯 Loaded ${data.drops.length} drop timestamps for ${title}:`,
            data.drops.map(t => `${t.toFixed(1)}s`).join(', '));
        }
      })
      .catch(() => { dropTimestampsRef.current = []; });
  }, [trackId, title]);

  useEffect(() => {
    if (!waveformRef.current || !src) return;

    const ws = WaveSurfer.create({
      container: waveformRef.current,
      waveColor: 'rgba(0, 212, 255, 0.3)',
      progressColor: '#00d4ff',
      cursorColor: 'rgba(0, 212, 255, 0.6)',
      cursorWidth: 2,
      height: 64,
      normalize: true,
    });

    ws.load(src);

    ws.on('ready', () => {
      setDuration(ws.getDuration());
      setIsReady(true);
    });

    ws.on('audioprocess', () => {
      const time = ws.getCurrentTime();
      setCurrentTime(time);

      // ── Precomputed drop detection ──
      // Check if current time is within 0.3s of a known drop timestamp
      const drops = dropTimestampsRef.current;
      const fired = firedDropsRef.current;
      for (let i = 0; i < drops.length; i++) {
        const dropTime = drops[i];
        if (!fired.has(i) && Math.abs(time - dropTime) < 0.3) {
          fired.add(i);
          console.debug(`💥 DROP at ${dropTime.toFixed(1)}s`);
          window.dispatchEvent(new CustomEvent('riddim-drop', {
            detail: { intensity: 1.2, timestamp: dropTime }
          }));
        }
      }

      // ── BPM-based rhythmic pulse (subtle grid wobble) ──
      if (bpm) {
        const bps = bpm / 60;
        const beatPhase = (time * bps) % 1;
        const pulse = Math.pow(1 - beatPhase, 4);
        window.dispatchEvent(new CustomEvent('riddim-beat', { detail: { pulse, isPlaying: true } }));
      }
    });

    ws.on('seeking', () => {
      setCurrentTime(ws.getCurrentTime());
      // Reset fired drops when user seeks
      firedDropsRef.current = new Set();
    });

    ws.on('finish', () => {
      setIsPlaying(false);
      stopAnalysisLoop();
      if (onEnded) onEnded();
    });

    ws.on('play', () => {
      setIsPlaying(true);
      connectAudioAnalysis(ws);
      startAnalysisLoop();
    });

    ws.on('pause', () => {
      setIsPlaying(false);
      window.dispatchEvent(new CustomEvent('riddim-beat', { detail: { pulse: 0, isPlaying: false } }));
      stopAnalysisLoop();
    });

    wavesurferRef.current = ws;

    /**
     * Connect Web Audio API for continuous energy visualization.
     * This provides the subtle ambient grid reactivity (not drop detection).
     */
    function connectAudioAnalysis(wsInstance) {
      if (audioCtxConnectedRef.current) return;

      try {
        const mediaEl = wsInstance.getMediaElement();
        if (!mediaEl) return;

        const ctx = getAudioContext();
        if (ctx.state === 'suspended') ctx.resume();

        const analyser = ctx.createAnalyser();
        analyser.fftSize = 1024;
        analyser.smoothingTimeConstant = 0.5;

        const source = ctx.createMediaElementSource(mediaEl);
        source.connect(analyser);
        analyser.connect(ctx.destination);

        analyserRef.current = analyser;
        audioCtxConnectedRef.current = true;
      } catch (err) {
        console.debug('Audio analysis setup skipped:', err.message);
      }
    }

    function startAnalysisLoop() {
      stopAnalysisLoop();
      const freqData = new Uint8Array(512);

      const loop = () => {
        if (analyserRef.current) {
          analyserRef.current.getByteFrequencyData(freqData);

          // Compute bass-weighted energy for ambient grid glow
          const bassEnd = Math.floor(freqData.length * 0.25);
          let bassEnergy = 0;
          for (let i = 0; i < bassEnd; i++) bassEnergy += freqData[i];
          bassEnergy /= bassEnd * 255;

          const midEnd = Math.floor(freqData.length * 0.6);
          let midEnergy = 0;
          for (let i = bassEnd; i < midEnd; i++) midEnergy += freqData[i];
          midEnergy /= (midEnd - bassEnd) * 255;

          const energy = bassEnergy * 0.7 + midEnergy * 0.3;

          window.dispatchEvent(new CustomEvent('riddim-energy', {
            detail: { energy, bassEnergy }
          }));
        }
        animFrameRef.current = requestAnimationFrame(loop);
      };
      animFrameRef.current = requestAnimationFrame(loop);
    }

    function stopAnalysisLoop() {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
    }

    return () => {
      stopAnalysisLoop();
      audioCtxConnectedRef.current = false;
      try { ws.pause(); } catch (e) { /* ignore */ }
      try { ws.destroy(); } catch (e) { /* ignore */ }
    };
  }, [src, bpm, onEnded]);

  const togglePlay = () => {
    if (wavesurferRef.current) {
      wavesurferRef.current.playPause();
    }
  };

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const formatViews = (views) => {
    if (!views) return null;
    if (views >= 1000000) return (views / 1000000).toFixed(1) + 'M views';
    if (views >= 1000) return (views / 1000).toFixed(1) + 'K views';
    return views + ' views';
  };

  return (
    <div className={`audio-player glass-card ${isPlaying ? 'playing' : ''}`}>
      <div className="player-header">
        <div className="player-main">
          {albumArt && (
            <div className="album-art">
              <img src={albumArt} alt="Album Art" />
            </div>
          )}
          <div className="player-info">
            <h4 className="player-title">{title || 'Unknown Track'}</h4>
            <p className="player-artist">{artist || 'Unknown Artist'}</p>
            <div className="player-meta-badges">
              {genre && <span className="badge genre-badge">{genre}</span>}
              {bpm && <span className="badge stats-badge">{Math.round(bpm)} BPM</span>}
              {year && <span className="badge tag-badge">{year}</span>}
              {popularity > 0 && <span className="badge views-badge">{formatViews(popularity)}</span>}
            </div>
          </div>
        </div>

        <button
          className="btn btn-icon play-btn"
          onClick={togglePlay}
          disabled={!isReady}
          id="audio-play-toggle"
        >
          {isPlaying ? '⏸' : '▶'}
        </button>
      </div>

      <div className="player-waveform" ref={waveformRef} />

      <div className="player-timeline">
        <span className="time-current">{formatTime(currentTime)}</span>
        <span className="time-duration">{formatTime(duration)}</span>
      </div>
    </div>
  );
}

export default AudioPlayer;
