import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useDJ } from '../context/DJContext';
import './GeneratePage.css';

// ── SVG Icons (matching app aesthetic) ──
const Icons = {
  Bolt: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
    </svg>
  ),
  Scale: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 16v3a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h3"/>
      <line x1="8" y1="12" x2="16" y2="12"/><line x1="12" y1="8" x2="12" y2="16"/>
    </svg>
  ),
  Brain: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2a7 7 0 0 0-7 7c0 3 2 5.5 4 7l3 3 3-3c2-1.5 4-4 4-7a7 7 0 0 0-7-7z"/>
      <path d="M12 12v-2"/><circle cx="12" cy="14" r="1"/>
    </svg>
  ),
  Sliders: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/>
      <line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/>
      <line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/>
      <line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/>
    </svg>
  ),
};

const THINKING_PHRASES = [
  "Analyzing your vibe...",
  "Cross-referencing Taste Map...",
  "Dialing in the optimal BPM...",
  "Tweaking energy thresholds...",
  "Drafting prompt variants..."
];

const DEPTH_PRESETS = [
  { label: 'Fast', Icon: Icons.Bolt, desc: 'Quick & punchy', num_predict: 100 },
  { label: 'Balanced', Icon: Icons.Scale, desc: 'Best of both worlds', num_predict: 150 },
  { label: 'Deep', Icon: Icons.Brain, desc: 'Rich & detailed', num_predict: 200 },
];

const DEPTH_UP_REACTIONS = [
  "AH MY BRAINS! More processing power needed!",
  "Cranking the neural cores to max capacity!",
  "Going DEEP... buckle up, this'll take a moment!",
  "Maximum brainpower ENGAGED! Stand back!",
  "You want the premium stuff? Say less... or more, actually.",
];

const DEPTH_DOWN_REACTIONS = [
  "Turbo mode! My processors thank you!",
  "Speed demon activated! Less thinking, more vibing!",
  "Light work! I'll have these ready in a flash!",
  "Express lane unlocked! Zoom zoom!",
  "Quick and dirty? I can respect that!",
];

const TASTE_ON_REACTIONS = [
  "Plugging into your taste DNA... this is personal now!",
  "Your playlist says a LOT about you. Let me cook with that!",
  "Taste profile LOADED. I see what you're into!",
  "Mixing in your flavor... this is gonna be custom!",
];

const TASTE_OFF_REACTIONS = [
  "Going rogue! No taste filter, pure chaos!",
  "Flying blind! Let's see what we cook up freestyle!",
  "Taste profile? Where we're going, we don't need taste!",
  "Unplugged from your vibe. Full creative freedom!",
];

function GeneratePage() {
  const { token } = useAuth();
  const { 
    studioMessages, 
    isStudioLoading, 
    sendStudioMessage, 
    fetchStudioSession,
    triggerDJComment 
  } = useDJ();
  
  const [input, setInput] = useState('');
  const [thinkingIndex, setThinkingIndex] = useState(0);
  const [depthIndex, setDepthIndex] = useState(1); // Default: Balanced
  const [includeTaste, setIncludeTaste] = useState(true);
  const chatEndRef = useRef(null);
  const prevDepthRef = useRef(1);

  useEffect(() => {
    if (token && studioMessages.length === 0) {
      fetchStudioSession(token);
    }
  }, [token, fetchStudioSession, studioMessages.length]);

  useEffect(() => {
    let interval;
    if (isStudioLoading) {
      interval = setInterval(() => {
        setThinkingIndex((prev) => (prev + 1) % THINKING_PHRASES.length);
      }, 2500);
    } else {
      setThinkingIndex(0);
    }
    return () => clearInterval(interval);
  }, [isStudioLoading]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [studioMessages, thinkingIndex]);

  const handleDepthChange = useCallback((newIndex) => {
    if (newIndex === prevDepthRef.current) return;
    const oldIndex = prevDepthRef.current;
    setDepthIndex(newIndex);
    prevDepthRef.current = newIndex;

    // Pick a corny reaction based on direction
    const pool = newIndex > oldIndex ? DEPTH_UP_REACTIONS : DEPTH_DOWN_REACTIONS;
    const reaction = pool[Math.floor(Math.random() * pool.length)];
    
    triggerDJComment({
      direct: true,
      comment: reaction,
      mood: newIndex > oldIndex ? 'excited' : 'curious',
    });
  }, [triggerDJComment]);

  const handleTasteToggle = useCallback(() => {
    const newVal = !includeTaste;
    setIncludeTaste(newVal);
    const pool = newVal ? TASTE_ON_REACTIONS : TASTE_OFF_REACTIONS;
    const reaction = pool[Math.floor(Math.random() * pool.length)];
    triggerDJComment({
      direct: true,
      comment: reaction,
      mood: newVal ? 'excited' : 'curious',
    });
  }, [includeTaste, triggerDJComment]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim() || isStudioLoading) return;

    const userMsg = input;
    setInput('');
    const preset = DEPTH_PRESETS[depthIndex];
    sendStudioMessage(userMsg, token, {
      num_predict: preset.num_predict,
      depth: preset.label.toLowerCase(),
      include_taste: includeTaste,
    });
  };

  const currentPreset = DEPTH_PRESETS[depthIndex];

  return (
    <div className="generate-page animate-fade-in chat-mode">
      <div className="page-header">
        <h1><span className="text-gradient">The Studio</span></h1>
        <p>Dynamic Prompt Engineering with DJ Byte</p>
      </div>

      <div className="studio-layout">
        <div className="chat-container glass-card">
          <div className="messages-list">
            {studioMessages?.map((msg, i) => (
              <div key={i} className={`message-wrapper ${msg?.type || ''}`}>
                <div className="message-bubble">
                  <div className="sender-tag">{msg?.sender === 'dj' ? '🤖 DJ BYTE' : '🎧 YOU'}</div>
                  <div className="message-text">{msg?.text}</div>
                  {msg?.prompt && (
                    <div className="prompt-block">
                      <div className="prompt-label">
                        <Icons.Bolt /> GENERATION PROMPT
                      </div>
                      <div className="prompt-text">{String(msg.prompt)}</div>
                      <button 
                        className="copy-btn"
                        onClick={() => {
                          navigator.clipboard.writeText(String(msg.prompt));
                        }}
                      >
                        Copy
                      </button>
                    </div>
                  )}
                  {/* Legacy support for old 3-variant data */}
                  {!msg?.prompt && msg?.variants && typeof msg.variants === 'object' && msg.variants.prompt && (
                    <div className="prompt-block">
                      <div className="prompt-label">
                        <Icons.Bolt /> GENERATION PROMPT
                      </div>
                      <div className="prompt-text">{String(msg.variants.prompt)}</div>
                      <button className="copy-btn">Copy</button>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {isStudioLoading && (
              <div className="message-wrapper bot">
                <div className="message-bubble thinking-bubble">
                  <div className="sender-tag">🤖 DJ BYTE</div>
                  <div className="thinking-content">
                    <div className="message-text">{THINKING_PHRASES[thinkingIndex] || 'Thinking...'}</div>
                    <div className="dj-generating-dots"><span>.</span><span>.</span><span>.</span></div>
                  </div>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          <form className="chat-input-area" onSubmit={handleSend}>
            <input
              type="text"
              placeholder="Describe the vibe you want to generate..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={isStudioLoading}
            />
            <button type="submit" className="btn btn-primary" disabled={isStudioLoading}>
              Send
            </button>
          </form>
        </div>

        {/* ── Prompt Depth Controls ── */}
        <div className="depth-panel glass-card">
          <div className="depth-header">
            <span className="depth-icon"><Icons.Sliders /></span>
            <span className="depth-title">Prompt Depth</span>
          </div>

          <div className="depth-slider-track">
            {DEPTH_PRESETS.map((preset, i) => (
              <button
                key={preset.label}
                className={`depth-preset ${i === depthIndex ? 'active' : ''}`}
                onClick={() => handleDepthChange(i)}
                disabled={isStudioLoading}
              >
                <span className="depth-preset-icon"><preset.Icon /></span>
                <span className="depth-preset-label">{preset.label}</span>
              </button>
            ))}
          </div>

          <div className="depth-bar-container">
            <div className="depth-bar">
              <div 
                className="depth-bar-fill" 
                style={{ width: `${((depthIndex + 1) / DEPTH_PRESETS.length) * 100}%` }}
              />
            </div>
            <div className="depth-bar-labels">
              <span className="depth-hint"><Icons.Bolt /> Fast</span>
              <span className="depth-hint"><Icons.Brain /> Rich</span>
            </div>
          </div>

          <p className="depth-desc">{currentPreset.desc}</p>

          {/* ── Taste Toggle ── */}
          <div className="taste-toggle-section">
            <div className="taste-toggle-header">
              <span className="depth-title">Taste Profile</span>
            </div>
            <button 
              className={`taste-toggle ${includeTaste ? 'active' : ''}`}
              onClick={handleTasteToggle}
              disabled={isStudioLoading}
            >
              <span className="taste-toggle-track">
                <span className="taste-toggle-thumb" />
              </span>
              <span className="taste-toggle-label">
                {includeTaste ? 'Enabled' : 'Disabled'}
              </span>
            </button>
            <p className="depth-desc">
              {includeTaste 
                ? 'Your listening history influences the prompt.' 
                : 'Prompt is based only on your request.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default GeneratePage;
