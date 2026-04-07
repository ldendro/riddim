import { useEffect, useRef, useState } from 'react';
import WaveSurfer from 'wavesurfer.js';
import './AudioPlayer.css';

function AudioPlayer({ src, title, artist, genre, bpm, albumArt, popularity, year, onEnded }) {
  const waveformRef = useRef(null);
  const wavesurferRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (!waveformRef.current || !src) return;

    const ws = WaveSurfer.create({
      container: waveformRef.current,
      waveColor: 'rgba(0, 212, 255, 0.3)',
      progressColor: '#00d4ff',
      cursorColor: 'rgba(0, 212, 255, 0.6)',
      cursorWidth: 2,
      barWidth: 2,
      barGap: 1,
      barRadius: 2,
      height: 64,
      normalize: true,
      backend: 'WebAudio',
    });

    ws.load(src);

    ws.on('ready', () => {
      setDuration(ws.getDuration());
      setIsReady(true);
    });

    ws.on('audioprocess', () => {
      const time = ws.getCurrentTime();
      setCurrentTime(time);
      if (bpm) {
        const bps = bpm / 60;
        const beatPhase = (time * bps) % 1;
        const pulse = Math.pow(1 - beatPhase, 4); 
        window.dispatchEvent(new CustomEvent('riddim-beat', { detail: { pulse, isPlaying: true }}));
      }
    });

    ws.on('seeking', () => {
      setCurrentTime(ws.getCurrentTime());
    });

    ws.on('finish', () => {
      setIsPlaying(false);
      if (onEnded) onEnded();
    });

    ws.on('play', () => {
      setIsPlaying(true);
    });
    ws.on('pause', () => {
      setIsPlaying(false);
      window.dispatchEvent(new CustomEvent('riddim-beat', { detail: { pulse: 0, isPlaying: false }}));
    });

    wavesurferRef.current = ws;

    return () => {
      ws.destroy();
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
              {popularity > 0 && <span className="badge views-badge">🔥 {formatViews(popularity)}</span>}
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
