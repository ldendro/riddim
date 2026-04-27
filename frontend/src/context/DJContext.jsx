import { createContext, useContext, useState, useRef, useCallback } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const DEBOUNCE_MS = 100;

const TEMPLATES = {
  love: [
    "That song is absolute HEAT! Adding it to the vault.",
    "Certified BANGER! We're on the exact same wavelength.",
    "Whoa, massive energy! I knew you'd love this one.",
    "This one goes incredibly HARD. Locking that in.",
    "Peak sound right here! Taking serious notes.",
    "Total masterpiece! That's what I'm talking about.",
  ],
  like: [
    "Great pick! I'm really feeling that groove.",
    "Solid taste! This track has a fantastic foundation.",
    "Oh nice, a really slick vibe on this one.",
    "You've got a great ear! Building your sound profile.",
    "I'm with you on this one, really cool track.",
    "Yeah, this one definitely hits the spot. Nice.",
  ],
  neutral: [
    "Copy that. Keeping things moving.",
    "Alright, right down the middle. Next.",
    "Noted. Let's see what's next.",
    "Fair enough. Moving along.",
    "Middle of the road. Let's keep exploring.",
    "I hear you. Onward to the next.",
  ],
  reject: [
    "Not your vibe, got it. Recalibrating.",
    "Okay, that's a no-go. I'll do better.",
    "Hard pass, loud and clear.",
    "Shelving that one. Adjusting course.",
    "Missed the mark. Recalibrating your frequency.",
    "Not a fan? My bad, course correcting.",
  ],
};

const MOOD_MAP = {
  love: 'excited',
  like: 'curious',
  neutral: 'neutral',
  reject: 'understanding',
};

const DJContext = createContext(null);

export function DJProvider({ children }) {
  const [lastComment, setLastComment] = useState('');
  const [lastPrompt, setLastPrompt] = useState(null);
  const [currentTrackId, setCurrentTrackId] = useState(null);
  const [currentTrackContext, setCurrentTrackContext] = useState(null);
  const [mood, setMood] = useState('neutral');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLLMResponse, setIsLLMResponse] = useState(false);
  const [isAvailable, setIsAvailable] = useState(true);
  const [isTasteSummary, setIsTasteSummary] = useState(false);
  const [onRegenerate, setOnRegenerate] = useState(null);
  
  // Studio Chat State
  const [studioMessages, setStudioMessages] = useState([]);
  const [isStudioLoading, setIsStudioLoading] = useState(false);
  
  const debounceRef = useRef(null);
  const speakTimeoutRef = useRef(null);

  const triggerDJComment = useCallback((context) => {
    const reaction = context.reaction || 'skip';

    // Disallow skip unless is explicit direct injection
    if (reaction === 'skip' && !context.direct) return;

    // Debounce rapid feedback
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (speakTimeoutRef.current) clearTimeout(speakTimeoutRef.current);

    debounceRef.current = setTimeout(async () => {
      if (context.direct) {
        // ─── Direct injection (e.g. Taste Map Commentary) ───
        setMood(context.mood || 'hype');
        setLastComment(context.comment);
        setLastPrompt(null);
        setCurrentTrackId(null);
        setCurrentTrackContext(null);
        setIsLLMResponse(true);
        setIsSpeaking(true);
        setIsGenerating(context.isGenerating !== undefined ? context.isGenerating : false);
        setIsTasteSummary(context.isTasteSummary || false);
        setOnRegenerate(context.onRegenerate ? () => context.onRegenerate : null);
        return;
      }

      // ─── Phase 1: Instant template (zero latency) ───
      const moodState = MOOD_MAP[reaction] || 'neutral';
      const templates = TEMPLATES[reaction] || TEMPLATES.like;
      const templateComment = templates[Math.floor(Math.random() * templates.length)];
      
      setMood(moodState);
      setLastComment(templateComment);
      setLastPrompt(null);
      setCurrentTrackId(context.track_id || null);
      setCurrentTrackContext(context);
      setIsLLMResponse(false);
      setIsSpeaking(true);
      setIsTasteSummary(false);
      setOnRegenerate(null);

      const needsLLM = reaction === 'love' || reaction === 'like';

      if (needsLLM) {
        // ─── Phase 2: Fire LLM call in background ───
        setIsGenerating(true);

        try {
          const res = await fetch(`${API_BASE}/api/dj/comment`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(context),
          });

          if (!res.ok) throw new Error('DJ API error');

          const data = await res.json();

          // ─── Phase 3: Swap in detailed LLM response ───
          setLastComment(data.comment || templateComment);
          setLastPrompt(data.suno_prompt || null);
          setIsGenerating(false);
          setIsLLMResponse(true);

        } catch (err) {
          console.debug('DJ Byte LLM unavailable:', err.message);
          setIsGenerating(false);
        }
      }
    }, DEBOUNCE_MS);
  }, []);

  const dismissBubble = useCallback(() => {
    setIsSpeaking(false);
    setIsGenerating(false);
  }, []);

  const savePrompt = useCallback(async (itemId, promptText, token) => {
    try {
      const res = await fetch(`${API_BASE}/api/dj/save-prompt`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ item_id: itemId, prompt_text: promptText }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        return { success: false, error: data.detail || 'Failed to save' };
      }
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }, []);

  const saveTasteSummary = useCallback(async (summaryText, token) => {
    try {
      const res = await fetch(`${API_BASE}/api/dj/save-summary`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ summary: summaryText }),
      });
      if (!res.ok) throw new Error('Failed to save summary');
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }, []);

  const fetchStudioSession = useCallback(async (token) => {
    try {
      const res = await fetch(`${API_BASE}/api/generate/session`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.history) {
        setStudioMessages(data.history);
      }
    } catch (err) {
      console.error("Failed to fetch studio session:", err);
    }
  }, []);

  const sendStudioMessage = useCallback(async (messageText, token, depthOpts = {}) => {
    if (isStudioLoading) return;
    setIsStudioLoading(true);

    // Optimistically add user message
    setStudioMessages(prev => [...prev, { sender: 'user', text: messageText, type: 'user' }]);

    try {
      const res = await fetch(`${API_BASE}/api/generate/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ 
          message: messageText,
          num_ctx: depthOpts.num_ctx || 1024,
          num_predict: depthOpts.num_predict || 350,
          depth: depthOpts.depth || 'balanced',
          include_taste: depthOpts.include_taste !== undefined ? depthOpts.include_taste : true,
        })
      });
      
      const data = await res.json();
      
      setStudioMessages(prev => [...prev, { 
        sender: 'dj', 
        text: data.response, 
        type: 'bot',
        prompt: data.prompt
      }]);
    } catch (err) {
      console.error("Studio chat error:", err);
    } finally {
      setIsStudioLoading(false);
    }
  }, [isStudioLoading]);

  return (
    <DJContext.Provider value={{
      triggerDJComment,
      dismissBubble,
      savePrompt,
      saveTasteSummary,
      lastComment,
      lastPrompt,
      currentTrackId,
      currentTrackContext,
      mood,
      isSpeaking,
      isGenerating,
      isLLMResponse,
      isAvailable,
      isTasteSummary,
      onRegenerate,
      studioMessages,
      isStudioLoading,
      sendStudioMessage,
      fetchStudioSession
    }}>
      {children}
    </DJContext.Provider>
  );
}

export function useDJ() {
  const ctx = useContext(DJContext);
  if (!ctx) return {
    isGenerating: false,
    isStudioLoading: false,
    isSpeaking: false,
    triggerDJComment: () => {},
    dismissBubble: () => {},
    savePrompt: async () => ({ success: false }),
    studioMessages: [],
    sendStudioMessage: () => {},
    fetchStudioSession: () => {},
  };
  return ctx;
}
