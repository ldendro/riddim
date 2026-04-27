import asyncio
from backend.api.routes.tastemap import get_tastemap_points

async def main():
    user = {"user_id": "3c0aa66c-c84b-4e5c-bc40-091268dda70e"}
    res = await get_tastemap_points("intensity", current_user=user)
    for p in res["points"]:
        if p["type"] == "centroid":
            print("Intensity Centroid:", p)
            
    res2 = await get_tastemap_points("genre", current_user=user)
    for p in res2["points"]:
        if p["type"] == "centroid":
            print("Genre Centroid:", p)

import sys
if 'backend' not in sys.path:
    sys.path.append('.')
asyncio.run(main())
