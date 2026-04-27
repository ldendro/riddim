import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import AudioPlayer from '../components/AudioPlayer';
import {
  IconLove, IconLike, IconSkip, IconReject,
  IconHouse, IconDrumBass, IconDubstep, IconTrance,
  IconTechno, IconHardstyle, IconAmbient, IconTrap,
  IconHeadphones, IconCpu, IconSliders, IconMusic,
  IconCheck, IconWarning, IconBattery, IconZap,
} from '../components/Icons';
import './OnboardingPage.css';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const GENRE_OPTIONS = [
  { id: 'house', label: 'House', Icon: IconHouse, vibe: 'Groovy four-on-the-floor beats' },
  { id: 'drum_and_bass', label: 'Drum & Bass', Icon: IconDrumBass, vibe: 'Fast breaks, heavy bass' },
  { id: 'dubstep', label: 'Dubstep', Icon: IconDubstep, vibe: 'Filthy wobbles & drops' },
  { id: 'trance', label: 'Trance', Icon: IconTrance, vibe: 'Euphoric builds & melodies' },
  { id: 'techno', label: 'Techno', Icon: IconTechno, vibe: 'Dark, hypnotic, relentless' },
  { id: 'hardstyle', label: 'Hardstyle', Icon: IconHardstyle, vibe: 'Hard kicks, raw energy' },
  { id: 'ambient', label: 'Ambient / Chill', Icon: IconAmbient, vibe: 'Atmospheric soundscapes' },
  { id: 'trap', label: 'Trap / Future Bass', Icon: IconTrap, vibe: 'Heavy 808s, melodic drops' },
];

const QUIZ_REACTIONS = [
  { id: 'love', label: 'Love it', Icon: IconLove, className: 'love' },
  { id: 'like', label: 'Vibe', Icon: IconLike, className: 'like' },
  { id: 'skip', label: 'Skip', Icon: IconSkip, className: 'skip' },
  { id: 'reject', label: 'Not me', Icon: IconReject, className: 'reject' },
];

function OnboardingPage() {
  const { token, completeOnboarding } = useAuth();
  const [step, setStep] = useState(0);
  const [selectedGenres, setSelectedGenres] = useState([]);
  const [energy, setEnergy] = useState(0.5);
  const [bpm, setBpm] = useState(128);
  const [quizTracks, setQuizTracks] = useState([]);
  const [quizIndex, setQuizIndex] = useState(0);
  const [quizReactions, setQuizReactions] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [quizLoading, setQuizLoading] = useState(false);
  const [error, setError] = useState('');

  // Fetch quiz tracks when reaching step 3
  useEffect(() => {
    if (step === 3 && quizTracks.length === 0) {
      fetchQuizTracks();
    }
  }, [step]);

  const fetchQuizTracks = async () => {
    setQuizLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/onboarding/quiz-tracks`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to load quiz tracks');
      const data = await res.json();
      setQuizTracks(data.tracks || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setQuizLoading(false);
    }
  };

  const toggleGenre = (id) => {
    setSelectedGenres(prev => {
      if (prev.includes(id)) return prev.filter(g => g !== id);
      if (prev.length >= 5) return prev;
      return [...prev, id];
    });
  };

  const handleQuizReaction = (reaction) => {
    const track = quizTracks[quizIndex];
    if (!track) return;
    setQuizReactions(prev => ({ ...prev, [track.id]: reaction }));

    // Move to next track after short delay
    setTimeout(() => {
      if (quizIndex < quizTracks.length - 1) {
        setQuizIndex(quizIndex + 1);
      } else {
        // All tracks rated — move to completion
        setStep(4);
      }
    }, 400);
  };

  const handleComplete = async () => {
    setIsSubmitting(true);
    setError('');

    try {
      const res = await fetch(`${API_BASE}/api/onboarding/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          favorite_genres: selectedGenres,
          energy_preference: energy,
          bpm_preference: bpm,
          quiz_reactions: quizReactions,
        }),
      });

      if (!res.ok) throw new Error('Failed to complete onboarding');
      completeOnboarding();
    } catch (err) {
      setError(err.message);
      setIsSubmitting(false);
    }
  };

  const canProceed = () => {
    switch (step) {
      case 0: return true;
      case 1: return selectedGenres.length >= 1;
      case 2: return true;
      case 3: return Object.keys(quizReactions).length === quizTracks.length;
      default: return true;
    }
  };

  const parseMetadata = (track) => {
    if (!track?.metadata) return {};
    try {
      return typeof track.metadata === 'string' ? JSON.parse(track.metadata) : track.metadata;
    } catch { return {}; }
  };

  const getEnergyLabel = () => {
    if (energy < 0.25) return 'Chill';
    if (energy < 0.5) return 'Moderate';
    if (energy < 0.75) return 'High';
    return 'Explosive';
  };

  const currentQuizTrack = quizTracks[quizIndex];
  const currentQuizMeta = currentQuizTrack ? parseMetadata(currentQuizTrack) : {};

  return (
    <div className="onboarding-page">
      <div className="onboarding-ambient" />

      {/* Progress Bar */}
      <div className="onboarding-progress">
        <div className="progress-track">
          <div
            className="progress-fill"
            style={{ width: `${((step + 1) / 5) * 100}%` }}
          />
        </div>
        <div className="progress-steps">
          {['Welcome', 'Genres', 'Vibe', 'Listen', 'Ready'].map((label, i) => (
            <span
              key={label}
              className={`progress-step ${i <= step ? 'active' : ''} ${i === step ? 'current' : ''}`}
            >
              {label}
            </span>
          ))}
        </div>
      </div>

      {/* Step Content */}
      <div className="onboarding-content">
        {/* ── Step 0: Welcome ── */}
        {step === 0 && (
          <div className="step step-welcome animate-fade-in">
            <div className="welcome-logo">
              <span className="welcome-icon"><IconMusic size={48} /></span>
              <h1>
                <span className="text-gradient">Welcome to Riddim</span>
              </h1>
            </div>
            <p className="welcome-subtitle">
              Your AI-powered EDM taste engine.
              <br />
              Let's learn your sound in under 2 minutes.
            </p>
            <div className="welcome-features">
              <div className="welcome-feature">
                <span className="feature-icon"><IconHeadphones size={22} /></span>
                <span>Discover tracks that match your vibe</span>
              </div>
              <div className="welcome-feature">
                <span className="feature-icon"><IconCpu size={22} /></span>
                <span>AI that learns what you love</span>
              </div>
              <div className="welcome-feature">
                <span className="feature-icon"><IconSliders size={22} /></span>
                <span>Generate custom drops, tuned to you</span>
              </div>
            </div>
            <button className="btn btn-primary onboarding-next" onClick={() => setStep(1)}>
              Let's Go
            </button>
          </div>
        )}

        {/* ── Step 1: Genre Selector ── */}
        {step === 1 && (
          <div className="step step-genres animate-fade-in">
            <div className="step-header">
              <h2><span className="text-gradient">Pick Your Genres</span></h2>
              <p>Select 1–5 genres that define your sound</p>
            </div>
            <div className="genre-grid">
              {GENRE_OPTIONS.map((genre) => (
                <button
                  key={genre.id}
                  className={`genre-card glass-card ${selectedGenres.includes(genre.id) ? 'selected' : ''}`}
                  onClick={() => toggleGenre(genre.id)}
                >
                  <span className="genre-icon"><genre.Icon size={32} /></span>
                  <span className="genre-label">{genre.label}</span>
                  <span className="genre-vibe">{genre.vibe}</span>
                  {selectedGenres.includes(genre.id) && (
                    <span className="genre-check"><IconCheck size={12} /></span>
                  )}
                </button>
              ))}
            </div>
            <div className="step-actions">
              <button className="btn btn-ghost" onClick={() => setStep(0)}>Back</button>
              <button
                className="btn btn-primary onboarding-next"
                onClick={() => setStep(2)}
                disabled={!canProceed()}
              >
                Next
              </button>
            </div>
          </div>
        )}

        {/* ── Step 2: Energy & BPM Sliders ── */}
        {step === 2 && (
          <div className="step step-sliders animate-fade-in">
            <div className="step-header">
              <h2><span className="text-gradient">Set Your Vibe</span></h2>
              <p>Dial in your energy and tempo preferences</p>
            </div>

            <div className="slider-group">
              <div className="slider-label-row">
                <label>Energy</label>
                <span className="slider-value">{getEnergyLabel()}</span>
              </div>
              <div className="slider-range-labels">
                <span><IconBattery size={14} /> Chill</span>
                <span><IconZap size={14} /> Explosive</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={energy}
                onChange={(e) => setEnergy(parseFloat(e.target.value))}
                className="neon-slider"
                style={{ '--slider-pct': `${energy * 100}%` }}
              />
            </div>

            <div className="slider-group">
              <div className="slider-label-row">
                <label>Tempo</label>
                <span className="slider-value">{Math.round(bpm)} BPM</span>
              </div>
              <div className="slider-range-labels">
                <span>80 BPM</span>
                <span>180 BPM</span>
              </div>
              <input
                type="range"
                min="80"
                max="180"
                step="1"
                value={bpm}
                onChange={(e) => setBpm(parseFloat(e.target.value))}
                className="neon-slider"
                style={{ '--slider-pct': `${((bpm - 80) / 100) * 100}%` }}
              />
            </div>

            <div className="step-actions">
              <button className="btn btn-ghost" onClick={() => setStep(1)}>Back</button>
              <button className="btn btn-primary onboarding-next" onClick={() => setStep(3)}>
                Next
              </button>
            </div>
          </div>
        )}

        {/* ── Step 3: Listening Quiz ── */}
        {step === 3 && (
          <div className="step step-quiz animate-fade-in">
            <div className="step-header">
              <h2><span className="text-gradient">Listen & React</span></h2>
              <p>Quick-rate these tracks to seed your taste profile</p>
            </div>

            {quizLoading ? (
              <div className="quiz-loading">
                <div className="loading-pulse" />
                <p>Loading tracks...</p>
              </div>
            ) : error ? (
              <div className="login-error">
                <span className="error-icon"><IconWarning size={16} /></span>
                {error}
              </div>
            ) : currentQuizTrack ? (
              <div className="quiz-content">
                <div className="quiz-counter">
                  <span className="counter-current">{quizIndex + 1}</span>
                  <span className="counter-sep">/</span>
                  <span className="counter-total">{quizTracks.length}</span>
                </div>

                {currentQuizTrack.quiz_genre_label && (
                  <div className="quiz-genre-badge">{currentQuizTrack.quiz_genre_label}</div>
                )}

                <AudioPlayer
                  key={currentQuizTrack.id}
                  trackId={currentQuizTrack.id}
                  src={`${API_BASE}/api/tracks/${currentQuizTrack.id}/audio`}
                  title={currentQuizMeta.title || currentQuizTrack.id}
                  artist={currentQuizMeta.artist}
                  genre={currentQuizMeta.genre || currentQuizTrack.genre}
                  bpm={currentQuizTrack.bpm}
                  albumArt={currentQuizMeta.album_art}
                />

                <div className="quiz-reactions">
                  {QUIZ_REACTIONS.map((r) => (
                    <button
                      key={r.id}
                      className={`quiz-reaction-btn ${r.className} ${quizReactions[currentQuizTrack.id] === r.id ? 'active' : ''}`}
                      onClick={() => handleQuizReaction(r.id)}
                    >
                      <span className="reaction-icon"><r.Icon size={22} /></span>
                      <span className="reaction-label">{r.label}</span>
                    </button>
                  ))}
                </div>

                {/* Quiz progress dots */}
                <div className="quiz-dots">
                  {quizTracks.map((t, i) => (
                    <span
                      key={t.id}
                      className={`quiz-dot ${i === quizIndex ? 'current' : ''} ${quizReactions[t.id] ? 'done' : ''}`}
                    />
                  ))}
                </div>
              </div>
            ) : (
              <div className="empty-state glass-card">
                <div className="icon"><IconHeadphones size={32} /></div>
                <h3>No Tracks Available</h3>
                <p>Run the data pipeline to load NCS tracks first.</p>
              </div>
            )}

            <div className="step-actions">
              <button className="btn btn-ghost" onClick={() => setStep(2)}>Back</button>
            </div>
          </div>
        )}

        {/* ── Step 4: Ready / Complete ── */}
        {step === 4 && (
          <div className="step step-complete animate-fade-in">
            <div className="complete-visual">
              <div className="complete-rings">
                <div className="ring ring-1" />
                <div className="ring ring-2" />
                <div className="ring ring-3" />
                <span className="complete-icon"><IconMusic size={40} /></span>
              </div>
            </div>
            <h2><span className="text-gradient">You're All Set</span></h2>
            <p className="complete-summary">
              {selectedGenres.length} genres · {getEnergyLabel()} energy · {Math.round(bpm)} BPM
              · {Object.keys(quizReactions).length} tracks rated
            </p>

            {error && (
              <div className="login-error">
                <span className="error-icon"><IconWarning size={16} /></span>
                {error}
              </div>
            )}

            <button
              className="btn btn-primary onboarding-next glow-btn"
              onClick={handleComplete}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Setting up...' : "Let's Ride"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default OnboardingPage;
