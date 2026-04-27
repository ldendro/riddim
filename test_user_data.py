import sqlite3
import numpy as np

conn = sqlite3.connect("data/db/riddim.db")
c = conn.cursor()
c.execute("SELECT user_id, real_liked_centroid, real_disliked_centroid FROM taste_profiles")
profiles = c.fetchall()
print(f"Profiles: {len(profiles)}")
for p in profiles:
    user_id, l_bytes, d_bytes = p
    print(f"User: {user_id}")
    if l_bytes:
        arr = np.frombuffer(l_bytes, dtype=np.float64)
        print("  Liked:", arr, "size", len(arr))
    if d_bytes:
        arr = np.frombuffer(d_bytes, dtype=np.float64)
        print("  Disliked:", arr, "size", len(arr))
