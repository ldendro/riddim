import { useEffect, useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useDJ } from '../context/DJContext';
import './DJByte.css';

function DJByte({ activeTab }) {
  const { token, refreshProfile } = useAuth();
  const {
    lastComment, lastPrompt, currentTrackId, currentTrackContext, mood,
    isSpeaking, isGenerating, isLLMResponse, dismissBubble, savePrompt,
    isTasteSummary,
    onRegenerate,
    saveTasteSummary
  } = useDJ();
  const [displayedText, setDisplayedText] = useState('');
  const [showPrompt, setShowPrompt] = useState(false);
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [summarySaved, setSummarySaved] = useState(false);
  const [summarySaveError, setSummarySaveError] = useState('');
  const [showTasteActions, setShowTasteActions] = useState(false);
  const typewriterRef = useRef(null);
  const prevCommentRef = useRef('');

  // Dismiss bubble when navigating away
  useEffect(() => {
    dismissBubble();
  }, [activeTab, dismissBubble]);

  // Typewriter effect
  useEffect(() => {
    if (!isSpeaking || !lastComment) {
      setDisplayedText('');
      setShowPrompt(false);
      setCopied(false);
      setSaved(false);
      setSaveError('');
      prevCommentRef.current = '';
      if (typewriterRef.current) clearInterval(typewriterRef.current);
      return;
    }

    // Only re-type if comment changed
    if (lastComment === prevCommentRef.current) return;
    prevCommentRef.current = lastComment;

    if (typewriterRef.current) clearInterval(typewriterRef.current);
    setDisplayedText('');
    setCopied(false);
    setSaved(false);
    setSaveError('');
    setShowTasteActions(false);

    const text = lastComment;
    let i = 0;

    typewriterRef.current = setInterval(() => {
      i++;
      if (i <= text.length) {
        setDisplayedText(text.slice(0, i));
      } else {
        clearInterval(typewriterRef.current);
        typewriterRef.current = null;
        if (lastPrompt) {
          setTimeout(() => setShowPrompt(true), 300);
        }
        if (isTasteSummary) {
          setTimeout(() => setShowTasteActions(true), 300);
        }
      }
    }, 20);

    return () => {
      if (typewriterRef.current) {
        clearInterval(typewriterRef.current);
        typewriterRef.current = null;
      }
    };
  }, [isSpeaking, lastComment, lastPrompt]);

  const handleCopyPrompt = async () => {
    if (!lastPrompt) return;
    try {
      await navigator.clipboard.writeText(lastPrompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = lastPrompt;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleSavePrompt = async () => {
    if (!lastPrompt || !currentTrackId || !token) return;
    setSaveError('');
    const result = await savePrompt(currentTrackId, lastPrompt, token);
    if (result.success) {
      setSaved(true);
    } else {
      setSaveError(result.error);
      setTimeout(() => setSaveError(''), 3000);
    }
  };

  const handleSaveTasteSummary = async () => {
    if (!lastComment || !token) return;
    setSummarySaveError('');
    const result = await saveTasteSummary(lastComment, token);
    if (result.success) {
      setSummarySaved(true);
      refreshProfile(); // Trigger profile update
      setTimeout(() => setSummarySaved(false), 3000);
    } else {
      setSummarySaveError(result.error);
      setTimeout(() => setSummarySaveError(''), 3000);
    }
  };

  return (
    <div className={`dj-byte ${mood} ${isSpeaking ? 'speaking' : ''} ${activeTab === 'generate' ? 'in-studio' : ''}`} id="dj-byte-container">
      {/* Speech Bubble */}
      {isSpeaking && displayedText && (
        <div className="dj-bubble">
          <button className="dj-bubble-close" onClick={dismissBubble} title="Dismiss">×</button>

          <div className="dj-bubble-header">
            <span className="dj-brand-name">DJ Byte</span>
            {isLLMResponse && currentTrackContext?.track_title && (
              <span className="dj-brand-track" title={currentTrackContext.track_title}>
                {currentTrackContext.track_title}
              </span>
            )}
          </div>

          <div className="dj-bubble-text">{displayedText}</div>

          {/* Generating indicator */}
          {isGenerating && (
            <div className="dj-generating">
              <span className="dj-generating-dots">
                <span>.</span><span>.</span><span>.</span>
              </span>
              <span className="dj-generating-label">cooking up something special</span>
            </div>
          )}

          {/* Generation Prompt */}
          {showPrompt && lastPrompt && !isGenerating && (
            <div className="dj-gen-prompt">
              <div className="dj-gen-label">Generation Prompt</div>
              <div className="dj-gen-text">{lastPrompt}</div>
              <div className="dj-prompt-actions">
                <button
                  className="dj-copy-btn"
                  onClick={handleCopyPrompt}
                >
                  {copied ? '✓ Copied!' : 'Copy'}
                </button>
                <button
                  className="dj-save-btn"
                  onClick={handleSavePrompt}
                  disabled={saved}
                >
                  {saved ? '✓ Saved to Library' : 'Save to Library'}
                </button>
              </div>
              {saveError && <div className="dj-save-error">{saveError}</div>}
            </div>
          )}

          {/* Taste Summary Actions — Mirror fixed Positioning of Prompts */}
          {isTasteSummary && showTasteActions && !isGenerating && (
            <div className="dj-gen-prompt">
              <div className="dj-gen-label">Taste Analysis</div>
              <div className="dj-prompt-actions">
                <button
                  className="dj-save-btn"
                  onClick={handleSaveTasteSummary}
                  disabled={summarySaved}
                >
                  {summarySaved ? '✓ Saved' : 'Save'}
                </button>
                {onRegenerate && (
                  <button
                    className="dj-copy-btn"
                    onClick={onRegenerate}
                  >
                    Regenerate
                  </button>
                )}
              </div>
              {summarySaveError && <div className="dj-save-error">{summarySaveError}</div>}
            </div>
          )}
        </div>
      )}

      {/* Robot Avatar */}
      <div className="dj-avatar" id="dj-byte-avatar">
        <svg viewBox="0 0 140 140" className="dj-svg" xmlns="http://www.w3.org/2000/svg">
          <defs>
            {/* Multi-color gradient for the head outline */}
            <linearGradient id="djHeadGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#00d4ff" />
              <stop offset="40%" stopColor="#b44dff" />
              <stop offset="100%" stopColor="#ff00cc" />
            </linearGradient>
            {/* Eye glow gradient */}
            <radialGradient id="djEyeGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#00ffff" stopOpacity="1" />
              <stop offset="100%" stopColor="#00d4ff" stopOpacity="0.3" />
            </radialGradient>
            {/* Antenna glow */}
            <radialGradient id="djAntennaGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#ff00cc" stopOpacity="1" />
              <stop offset="100%" stopColor="#b44dff" stopOpacity="0.2" />
            </radialGradient>
            {/* Headphone gradient */}
            <linearGradient id="djHpGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#00d4ff" />
              <stop offset="100%" stopColor="#b44dff" />
            </linearGradient>
          </defs>

          {/* Ambient glow rings */}
          <circle cx="70" cy="72" r="60" fill="none" stroke="url(#djHeadGrad)" strokeWidth="0.5" opacity="0.1" />
          <circle cx="70" cy="72" r="55" fill="none" stroke="url(#djHeadGrad)" strokeWidth="0.3" opacity="0.06" />

          {/* Headphone band */}
          <path
            d="M 22 62 Q 22 18, 70 12 Q 118 18, 118 62"
            fill="none"
            stroke="url(#djHpGrad)"
            strokeWidth="4.5"
            strokeLinecap="round"
            className="dj-headband"
          />
          {/* Band highlight */}
          <path
            d="M 35 42 Q 35 26, 70 20 Q 105 26, 105 42"
            fill="none"
            stroke="url(#djHpGrad)"
            strokeWidth="0.8"
            opacity="0.25"
          />

          {/* Headphone pad — left */}
          <rect x="10" y="54" width="18" height="28" rx="6" fill="#b44dff" opacity="0.3" className="dj-pad" />
          <rect x="13" y="57" width="12" height="22" rx="4" fill="none" stroke="#b44dff" strokeWidth="1.5" opacity="0.7" />
          <line x1="16" y1="62" x2="22" y2="62" stroke="#b44dff" strokeWidth="0.8" opacity="0.4" />
          <line x1="16" y1="66" x2="22" y2="66" stroke="#b44dff" strokeWidth="0.8" opacity="0.4" />
          <line x1="16" y1="70" x2="22" y2="70" stroke="#b44dff" strokeWidth="0.8" opacity="0.4" />
          <line x1="16" y1="74" x2="22" y2="74" stroke="#b44dff" strokeWidth="0.8" opacity="0.4" />

          {/* Headphone pad — right */}
          <rect x="112" y="54" width="18" height="28" rx="6" fill="#ff00cc" opacity="0.3" className="dj-pad" />
          <rect x="115" y="57" width="12" height="22" rx="4" fill="none" stroke="#ff00cc" strokeWidth="1.5" opacity="0.7" />
          <line x1="118" y1="62" x2="124" y2="62" stroke="#ff00cc" strokeWidth="0.8" opacity="0.4" />
          <line x1="118" y1="66" x2="124" y2="66" stroke="#ff00cc" strokeWidth="0.8" opacity="0.4" />
          <line x1="118" y1="70" x2="124" y2="70" stroke="#ff00cc" strokeWidth="0.8" opacity="0.4" />
          <line x1="118" y1="74" x2="124" y2="74" stroke="#ff00cc" strokeWidth="0.8" opacity="0.4" />

          {/* Head — main shell */}
          <rect x="30" y="34" width="80" height="68" rx="14" fill="rgba(10,5,25,0.6)" className="dj-head-fill" />
          <rect x="30" y="34" width="80" height="68" rx="14" fill="none" stroke="url(#djHeadGrad)" strokeWidth="3" className="dj-head" />
          <rect x="34" y="38" width="72" height="60" rx="11" fill="none" stroke="url(#djHeadGrad)" strokeWidth="0.6" opacity="0.2" />

          {/* Forehead panel */}
          <line x1="44" y1="44" x2="96" y2="44" stroke="url(#djHeadGrad)" strokeWidth="1" opacity="0.3" />
          <circle cx="48" cy="44" r="2" fill="#00d4ff" opacity="0.5" className="dj-led" />
          <circle cx="70" cy="44" r="1.5" fill="#b44dff" opacity="0.4" className="dj-led" />
          <circle cx="92" cy="44" r="2" fill="#ff00cc" opacity="0.5" className="dj-led" />

          {/* Circuit traces */}
          <path d="M 34 50 L 42 50 L 42 54" fill="none" stroke="#00d4ff" strokeWidth="0.7" opacity="0.2" />
          <circle cx="42" cy="55.5" r="1.2" fill="#00d4ff" opacity="0.25" />
          <path d="M 106 50 L 98 50 L 98 54" fill="none" stroke="#ff00cc" strokeWidth="0.7" opacity="0.2" />
          <circle cx="98" cy="55.5" r="1.2" fill="#ff00cc" opacity="0.25" />

          {/* Visor / face plate */}
          <rect x="40" y="52" width="60" height="24" rx="8" fill="rgba(0,212,255,0.04)" className="dj-visor" />
          <rect x="40" y="52" width="60" height="24" rx="8" fill="none" stroke="url(#djHeadGrad)" strokeWidth="1.2" opacity="0.35" />

          {/* Eyes */}
          <circle cx="55" cy="64" r="7" fill="url(#djEyeGlow)" className="dj-eye dj-eye-left" />
          <circle cx="55" cy="64" r="3.5" fill="none" stroke="rgba(0,0,0,0.25)" strokeWidth="0.8" />
          <circle cx="53" cy="62" r="2.2" fill="rgba(255,255,255,0.55)" />
          <circle cx="57" cy="65.5" r="1" fill="rgba(255,255,255,0.3)" />

          <circle cx="85" cy="64" r="7" fill="url(#djEyeGlow)" className="dj-eye dj-eye-right" />
          <circle cx="85" cy="64" r="3.5" fill="none" stroke="rgba(0,0,0,0.25)" strokeWidth="0.8" />
          <circle cx="83" cy="62" r="2.2" fill="rgba(255,255,255,0.55)" />
          <circle cx="87" cy="65.5" r="1" fill="rgba(255,255,255,0.3)" />

          {/* Nose accent */}
          <line x1="70" y1="60" x2="70" y2="68" stroke="url(#djHeadGrad)" strokeWidth="0.7" opacity="0.15" />

          {/* Mouth — 7-bar equalizer (positioned well inside head) */}
          <g className="dj-eq-group">
            <rect x="46" y="84" width="4" height="6" rx="1.2" className="dj-eq-bar dj-eq-1" />
            <rect x="52" y="82" width="4" height="8" rx="1.2" className="dj-eq-bar dj-eq-2" />
            <rect x="58" y="83" width="4" height="7" rx="1.2" className="dj-eq-bar dj-eq-3" />
            <rect x="64" y="81" width="4" height="9" rx="1.2" className="dj-eq-bar dj-eq-4" />
            <rect x="70" y="83" width="4" height="7" rx="1.2" className="dj-eq-bar dj-eq-5" />
            <rect x="76" y="82" width="4" height="8" rx="1.2" className="dj-eq-bar dj-eq-6" />
            <rect x="82" y="84" width="4" height="6" rx="1.2" className="dj-eq-bar dj-eq-7" />
          </g>

          {/* Chin detail */}
          <line x1="50" y1="97" x2="90" y2="97" stroke="url(#djHeadGrad)" strokeWidth="0.8" opacity="0.15" strokeLinecap="round" />
          <circle cx="70" cy="97" r="1.5" fill="#b44dff" opacity="0.2" />

          {/* Antenna */}
          <line x1="70" y1="34" x2="70" y2="18" stroke="url(#djHeadGrad)" strokeWidth="3" className="dj-antenna-stem" />
          <line x1="70" y1="24" x2="62" y2="18" stroke="#b44dff" strokeWidth="1.2" opacity="0.35" />
          <line x1="70" y1="24" x2="78" y2="18" stroke="#ff00cc" strokeWidth="1.2" opacity="0.35" />
          <circle cx="70" cy="14" r="5" fill="url(#djAntennaGlow)" className="dj-antenna-tip" />
          <circle cx="70" cy="14" r="2.5" fill="#ff00cc" opacity="0.5" />
          <circle cx="68.5" cy="12.5" r="1.2" fill="rgba(255,255,255,0.5)" />

          {/* Side bolts */}
          <circle cx="33" cy="68" r="3" fill="none" stroke="#00d4ff" strokeWidth="1.2" opacity="0.3" />
          <circle cx="33" cy="68" r="1" fill="#00d4ff" opacity="0.4" />
          <circle cx="107" cy="68" r="3" fill="none" stroke="#ff00cc" strokeWidth="1.2" opacity="0.3" />
          <circle cx="107" cy="68" r="1" fill="#ff00cc" opacity="0.4" />
        </svg>
      </div>
    </div>
  );
}

export default DJByte;
