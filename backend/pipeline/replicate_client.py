import os
import time
import uuid
import asyncio
import requests
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

# We only require replicate if the token is present to allow mock development
HAS_KEY = bool(os.getenv("REPLICATE_API_TOKEN"))
if HAS_KEY:
    import replicate

class ReplicateClient:
    def __init__(self):
        self.model_id = "meta/musicgen:671ac645ce5e552cc63a54a2bbff63fcf798043055d2dac5fc9e36a837eedcfb"
        self.session = requests.Session()

    def generate_music_single(self, prompt: str, duration: int = 15):
        """Generates a single track using MusicGen on Replicate."""
        if not HAS_KEY:
            # For mock, we just return one of the mock items
            return self._mock_generation(prompt)[0]

        try:
            output_uri = replicate.run(
                self.model_id,
                input={
                    "prompt": prompt,
                    "duration": duration,
                    "model_version": "large",
                    "output_format": "wav"
                }
            )
            return {
                "id": str(uuid.uuid4()),
                "title": "Replicate MusicGen Variation",
                "audio_url": str(output_uri),
                "metadata": {"prompt": prompt, "tags": "musicgen-large"}
            }
        except Exception as e:
            print(f"❌ Replicate API Error: {e}")
            return None

    def generate_music(self, prompt: str, duration: int = 15):
        """
        Legacy sequential wrapper. Generates exactly 2 variants.
        (Note: Generate route now uses generate_music_single in parallel).
        """
        if not HAS_KEY:
            return self._mock_generation(prompt)

        clips = []
        for i in range(2):
            clip = self.generate_music_single(prompt, duration)
            if clip:
                clips.append(clip)
                
        return clips if clips else self._mock_generation(prompt)

    def download_audio(self, url: str, output_path: Path):
        """Downloads the audio file from the given URL."""
        if url.startswith("mock://"):
            import shutil
            import random
            ncs_dir = Path("data/ncs/audio")
            if ncs_dir.exists():
                choices = list(ncs_dir.glob("*.mp3")) + list(ncs_dir.glob("*.wav"))
                if choices:
                    shutil.copy2(random.choice(choices), output_path)
                    return True
            # Creating dummy file as last resort
            with open(output_path, "wb") as f:
                f.write(b"dummy wav data")
            return True

        try:
            resp = self.session.get(url, stream=True, timeout=30)
            if resp.status_code == 200:
                with open(output_path, 'wb') as f:
                    for chunk in resp.iter_content(chunk_size=1024):
                        if chunk:
                            f.write(chunk)
                return True
        except Exception as e:
            print(f"Failed to download from {url}: {e}")
            
        return False

    def _mock_generation(self, prompt: str):
        """Returns mock clip data when running locally without Replicate Credentials."""
        print("⚠️ No REPLICATE_API_TOKEN found. Falling back to MOCK mode.")
        time.sleep(2)  # Simulate small delay
        id1 = str(uuid.uuid4())
        id2 = str(uuid.uuid4())
        return [
            {
                "id": id1,
                "title": "Mock Replicate Var A",
                "audio_url": f"mock://audio/{id1}.wav",
                "metadata": {"prompt": prompt, "tags": "musicgen-mock"},
            },
            {
                "id": id2,
                "title": "Mock Replicate Var B",
                "audio_url": f"mock://audio/{id2}.wav",
                "metadata": {"prompt": prompt, "tags": "musicgen-mock"},
            }
        ]

replicate_client = ReplicateClient()
