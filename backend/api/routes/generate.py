"""
Riddim — Generate (Studio Chat) Routes

Endpoints for interacting with DJ Byte to develop AI music prompts.
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from backend.api.deps import get_current_user
from backend.db.database import query_all
from backend.models.dj_engine import dj_engine
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/generate", tags=["generate"])

class ChatMessage(BaseModel):
    message: str
    num_ctx: int = 1024
    num_predict: int = 350
    depth: str = "balanced"
    include_taste: bool = True

@router.get("/session")
async def get_chat_session(current_user: dict = Depends(get_current_user)):
    """Initialize or retrieve the current Studio Chat session."""
    from backend.db.database import query_all
    import json
    
    user_id = current_user["user_id"]
    query = "SELECT role, content, variants FROM studio_chat_messages WHERE user_id = ? ORDER BY created_at ASC"
    messages = query_all(query, (user_id,))
    
    formatted_history = []
    for msg in messages:
        variants_data = json.loads(msg["variants"]) if msg["variants"] else None
        prompt = None
        if variants_data:
            prompt = variants_data.get("prompt", variants_data.get("A", None))
        formatted_history.append({
            "sender": msg["role"],
            "text": msg["content"],
            "type": "bot" if msg["role"] == "dj" else "user",
            "prompt": prompt
        })
        
    return {
        "status": "ready",
        "history": formatted_history
    }

@router.post("/chat")
async def studio_chat(
    msg: ChatMessage,
    current_user: dict = Depends(get_current_user),
):
    """
    Primary endpoint for DJ Byte Studio interaction.
    Accepts user input, processes against taste profile, and returns prompt suggestions.
    """
    # TODO: Integration with LLM (DJ Byte) and taste profile cross-referencing
    logger.info(f"Studio chat from {current_user['user_id']}: {msg.message}")
    user_id = current_user["user_id"]
    from backend.db.database import get_db
    import json
    
    # 0. Save User Message
    with get_db() as conn:
        conn.execute("INSERT INTO studio_chat_messages (user_id, role, content) VALUES (?, ?, ?)",
                     (user_id, "user", msg.message))
    
    # 1. Gather Taste Context (only if user wants it)
    taste_context = {}
    if msg.include_taste:
        reactions = query_all("SELECT item_id, reaction FROM reactions WHERE user_id = ?", (user_id,))
        liked = [r for r in reactions if r["reaction"] in ["love", "like"]]
        
        if liked:
            item_ids = [r["item_id"] for r in liked]
            placeholders = ",".join("?" * len(item_ids))
            tracks = query_all(
                f"SELECT i.genre, f.bpm, f.energy_rms FROM items i JOIN features f ON i.id = f.item_id WHERE i.id IN ({placeholders})",
                tuple(item_ids)
            )
            if tracks:
                avg_bpm = sum((float(t.get("bpm") or 128) for t in tracks)) / len(tracks)
                avg_energy = sum((float(t.get("energy_rms") or 0.5) for t in tracks)) / len(tracks)
                genres = {}
                for t in tracks:
                    g = t.get("genre", "electronic").lower()
                    genres[g] = genres.get(g, 0) + 1
                top_genres = sorted(genres.items(), key=lambda x: x[1], reverse=True)[:3]
                taste_context = {
                    "bpm": avg_bpm,
                    "energy_rms": avg_energy,
                    "genres": ", ".join([g[0] for g in top_genres])
                }

    # 2. Query DJ Engine for prompt (with user-controlled depth)
    result = await dj_engine.generate_studio_prompts(
        msg.message, taste_context, 
        num_ctx=msg.num_ctx, num_predict=msg.num_predict,
        depth=msg.depth
    )
    logger.info(f"LLM result keys: {list(result.keys())}")
    
    response_text = str(result.get("intro", "Here's your generated prompt!"))
    prompt_text = str(result.get("prompt", ""))
    
    # 3. Save DJ Response
    with get_db() as conn:
        conn.execute("INSERT INTO studio_chat_messages (user_id, role, content, variants) VALUES (?, ?, ?, ?)",
                     (user_id, "dj", response_text, json.dumps({"prompt": prompt_text})))
    
    return {
        "response": response_text,
        "prompt": prompt_text
    }
