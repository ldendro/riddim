"""
Riddim — DJ Byte Commentary Engine

Generates contextual DJ commentary and Suno-style music prompts
using Ollama (phi4-mini) for local LLM inference.
Falls back to template-based commentary when Ollama is unavailable.
"""

import asyncio
import random

try:
    import ollama as _ollama

    OLLAMA_AVAILABLE = True
except ImportError:
    OLLAMA_AVAILABLE = False

MODEL = "phi4-mini"

# ── System Prompts ──────────────────────────────────────────────────

COMMENTARY_SYSTEM = """You are DJ Byte, a witty robot DJ obsessed with EDM.
When a user reacts to a track, give ONE short punchy sentence about it.
Reference the genre, BPM, or vibe. Use EDM slang. Keep it under 15 words.
Never use hashtags, emojis, or quotes. Never break character."""

GEN_PROMPT_SYSTEM = """You are an expert music producer. Given audio features of an EDM track,
generate a concise AI music generation prompt (2-3 sentences max).
Describe genre, tempo, energy, bass, mood, and instrumentation.
Output ONLY the prompt text. No quotes, no explanation, no bullet points."""

# ── Template Fallbacks ──────────────────────────────────────────────

TEMPLATES = {
    "love": [
        "That one goes hard. I'm taking notes on your taste.",
        "Big tune energy right there. We're locked in.",
        "Absolute heater. Your vibe is coming through loud and clear.",
        "That track hits different. I see what you're about.",
        "Oh yeah, we're on the same wavelength with that one.",
    ],
    "like": [
        "Solid pick. I can work with that energy.",
        "Good vibes detected. Filing that one away.",
        "Nice taste. That groove says a lot about you.",
        "Not bad at all. Building your sound profile.",
        "I see the appeal. Let me find you more like that.",
    ],
    "skip": [
        "Not your thing? No worries, moving on.",
        "Alright, scratching that off the list.",
        "Fair enough. Everyone's got their limits.",
        "Noted. I'll steer us in a different direction.",
        "Copy that. Let's find your frequency.",
    ],
    "dislike": [
        "Hard pass, got it. I'll keep that out of rotation.",
        "Yikes, not the vibe. Recalibrating.",
        "Loud and clear. That one's getting shelved.",
        "My bad on that one. Let me course correct.",
        "Off the playlist. I'm learning what you don't want too.",
    ],
}

# Map reaction types to mood states
MOOD_MAP = {
    "love": "excited",
    "like": "curious",
    "skip": "neutral",
    "dislike": "understanding",
}


class DJByteEngine:
    """Generates contextual DJ commentary via Ollama (phi4-mini)."""

    # Shared performance options for all Ollama calls
    _FAST_OPTS = {
        "num_ctx": 1024,      # Reduced context window (our prompts are short)
        "num_batch": 512,     # Process more tokens per step
    }

    def __init__(self):
        self._ollama_checked = False
        self._ollama_live = False

    async def check_health(self) -> bool:
        """Check if Ollama + phi4-mini are available, and pre-warm the model."""
        if not OLLAMA_AVAILABLE:
            return False
        try:
            result = await asyncio.to_thread(_ollama.list)
            models = [m.model for m in result.models] if hasattr(result, 'models') else []
            self._ollama_live = any(MODEL in m for m in models)
            self._ollama_checked = True
            
            # Pre-warm: send a tiny request to load model into GPU memory
            if self._ollama_live:
                try:
                    await asyncio.to_thread(
                        _ollama.chat,
                        model=MODEL,
                        messages=[{"role": "user", "content": "hi"}],
                        options={"num_predict": 1, "num_ctx": 32},
                        keep_alive="30m",
                    )
                    print(f"  ✅ {MODEL} pre-warmed and loaded into memory")
                except Exception:
                    pass
            
            return self._ollama_live
        except Exception:
            self._ollama_live = False
            self._ollama_checked = True
            return False

    async def generate_comment(self, context: dict) -> dict:
        """
        Generate a DJ comment based on feedback context.

        Args:
            context: {
                "event_type": "reaction",
                "reaction": "love" | "like" | "skip" | "dislike",
                "track_title": "Artist - Title",
                "track_features": { "bpm": 128, "energy_rms": 0.8, ... }
            }

        Returns:
            { "comment": "...", "mood": "excited", "suno_prompt": "..." }
        """
        reaction = context.get("reaction", "skip")
        mood = MOOD_MAP.get(reaction, "neutral")
        include_gen_prompt = reaction in ("love", "like")

        # Try LLM first
        if not self._ollama_checked:
            await self.check_health()

        if self._ollama_live:
            try:
                comment = await self._llm_comment(context)
                gen_prompt = None
                if include_gen_prompt:
                    gen_prompt = await self._llm_gen_prompt(context)
                return {
                    "comment": comment,
                    "mood": mood,
                    **({
                        "suno_prompt": gen_prompt} if gen_prompt else {}),
                }
            except Exception as e:
                print(f"  ⚠ LLM inference failed, falling back to templates: {e}")

        # Fallback to templates
        templates = TEMPLATES.get(reaction, TEMPLATES["skip"])
        return {
            "comment": random.choice(templates),
            "mood": mood,
        }

    async def _llm_comment(self, context: dict) -> str:
        """Generate commentary via Ollama."""
        reaction = context.get("reaction", "skip")
        title = context.get("track_title", "Unknown Track")
        features = context.get("track_features", {})

        bpm = features.get("bpm", "unknown")
        genre = features.get("genre", "EDM")
        energy = features.get("energy_rms", 0)
        bass = features.get("bass_energy", 0)

        energy_desc = "low" if energy < 0.3 else "medium" if energy < 0.6 else "high"
        bass_desc = "light" if bass < 0.02 else "moderate" if bass < 0.05 else "heavy"

        user_prompt = (
            f'User reacted "{reaction}" to "{title}". '
            f"{bpm} BPM {genre}, {energy_desc} energy, {bass_desc} bass. "
            f"One short punchy sentence."
        )

        response = await asyncio.to_thread(
            _ollama.chat,
            model=MODEL,
            messages=[
                {"role": "system", "content": COMMENTARY_SYSTEM},
                {"role": "user", "content": user_prompt},
            ],
            keep_alive="30m",
            options={**self._FAST_OPTS, "temperature": 0.85, "num_predict": 40},
        )

        text = response.message.content.strip().strip('"').strip("'")
        return text

    async def _llm_gen_prompt(self, context: dict) -> str:
        """Generate an AI music generation prompt via Ollama."""
        title = context.get("track_title", "Unknown Track")
        features = context.get("track_features", {})

        bpm = features.get("bpm", 128)
        genre = features.get("genre", "EDM")
        energy = features.get("energy_rms", 0)
        bass = features.get("bass_energy", 0)

        energy_desc = "chill and relaxed" if energy < 0.3 else "medium energy" if energy < 0.6 else "high energy and explosive"
        bass_desc = "minimal bass" if bass < 0.02 else "warm punchy bass" if bass < 0.05 else "deep heavy bass with sub drops"

        user_prompt = (
            f'AI music generation prompt for a track like "{title}". '
            f"Style: {genre}, {bpm} BPM, {energy_desc}, {bass_desc}."
        )

        response = await asyncio.to_thread(
            _ollama.chat,
            model=MODEL,
            messages=[
                {"role": "system", "content": GEN_PROMPT_SYSTEM},
                {"role": "user", "content": user_prompt},
            ],
            keep_alive="30m",
            options={**self._FAST_OPTS, "temperature": 0.7, "num_predict": 100},
        )


        text = response.message.content.strip().strip('"').strip("'")
        return text

    async def generate_taste_analysis(self, prompt: str) -> str:
        """Run a taste analysis prompt through DJ Byte."""
        if not self._ollama_checked:
            await self.check_health()
            
        if not self._ollama_live:
            return "My audio processors are offline right now. Check your backend Ollama instance!"

        try:
            # Enforce conciseness to ensure the analysis finishes within the 150 token cap
            guarded_prompt = prompt + "\nCRITICAL: You are strictly limited in space. You MUST complete your entire thought within 100 words. Do not let your sentence trail off."
            response = await asyncio.to_thread(
                _ollama.chat,
                model=MODEL,
                messages=[
                    {"role": "system", "content": COMMENTARY_SYSTEM},
                    {"role": "user", "content": guarded_prompt},
                ],
                keep_alive="30m",
                options={**self._FAST_OPTS, "temperature": 0.8, "num_predict": 150},
            )
            return response.message.content.strip().strip('"').strip("'")
        except Exception as e:
            print(f"  ⚠ LLM analysis failed: {e}")
            return "My circuits are scrambled at the moment. Can't analyze your taste right now."

    async def generate_studio_prompts(self, request_msg: str, taste_context: dict, num_ctx: int = 1024, num_predict: int = 350, depth: str = "balanced") -> dict:
        """Generate a single studio prompt that combines user taste with their request."""
        if not self._ollama_checked:
            await self.check_health()
            
        if not self._ollama_live:
            return {
                "intro": "My neural link is offline, but here's a template from my archive.",
                "prompt": "128 BPM melodic house track with warm detuned supersaw pads, rolling four-on-the-floor kick sidechained to deep analog sub-bass. Crisp 909 hi-hats, layered clap transients, wide stereo reverb. Master bus glue compression with high-end shimmer."
            }

        # Length guidance based on depth setting
        length_guide = {
            "fast": "The prompt MUST be 1-2 short sentences. Be extremely concise.",
            "balanced": "The prompt should be 2-3 sentences with good detail.",
            "deep": "The prompt should be 4-5 rich sentences with extensive production detail.",
        }.get(depth, "The prompt should be 2-3 sentences with good detail.")

        system_prompt = (
            "You are DJ Byte, an expert AI prompt engineer for Suno and Udio. "
            "Respond with JSON: {\"intro\": \"...\", \"prompt\": \"...\"}. "
            "ALL VALUES MUST BE PLAIN STRINGS.\n"
            "'intro': short 1-sentence conversational response.\n"
            "'prompt': a natural-language paragraph Suno can directly use. "
            "Include genre, BPM, instruments, synthesis, rhythm, mix details as prose.\n"
            f"LENGTH: {length_guide}\n"
            "EXAMPLE: \"128 BPM melodic house with detuned supersaw pads, four-on-the-floor kick "
            "sidechained to analog sub-bass. 909 hi-hats, clap transients, stereo reverb. "
            "Glue compression with high-end shimmer.\""
        )

        # Build user prompt — conditionally include taste
        taste_part = ""
        if taste_context:
            avg_bpm = round(taste_context.get('bpm', 128))
            energy = f"{int(taste_context.get('energy_rms', 0.5) * 100)}%"
            genres = taste_context.get('genres', 'EDM')
            taste_part = f"Taste: {genres}, {avg_bpm} BPM, Energy {energy}. "

        user_prompt = f"{taste_part}Request: '{request_msg}'"

        try:
            import json
            response = await asyncio.to_thread(
                _ollama.chat,
                model=MODEL,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                format="json",
                keep_alive="30m",
                options={**self._FAST_OPTS, "num_ctx": num_ctx, "temperature": 0.7, "num_predict": num_predict},
            )
            text = response.message.content.strip()
            print(f"  ℹ LLM raw ({len(text)} chars): {text[:200]}")
            
            if text.startswith('```'):
                text = text.split('\n', 1)[-1]
            if text.endswith('```'):
                text = text[:-3]
            text = text.strip()
            
            parsed = json.loads(text)
            
            def _flatten(v):
                if isinstance(v, dict):
                    return '. '.join(f"{k}: {', '.join(v2) if isinstance(v2, list) else v2}" for k, v2 in v.items())
                if isinstance(v, list):
                    return ', '.join(str(x) for x in v)
                return str(v) if v else ''
            
            return {
                "intro": _flatten(parsed.get("intro", "Here's your prompt!")),
                "prompt": _flatten(parsed.get("prompt", "")),
            }
        except Exception as e:
            print(f"  ⚠ Studio gen failed: {e}")
            return {
                "intro": "Hit a snag — here's a precision-engineered alternative.",
                "prompt": "128 BPM melodic house with detuned supersaw pads, four-on-the-floor kick sidechained to analog sub-bass. 909 hi-hats, layered claps, wide stereo reverb. Glue compression with shimmer."
            }

# Singleton instance

dj_engine = DJByteEngine()
