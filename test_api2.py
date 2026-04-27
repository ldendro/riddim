import asyncio
from backend.api.routes.tastemap import get_tastemap_points

async def main():
    user = {"user_id": "ae704f6a-4113-49f5-9cb3-7b2ad04cf0f2"}
    res = await get_tastemap_points("intensity", current_user=user)
    print("User ae704:", [p for p in res["points"] if p["type"] == "centroid"])
    
    user = {"user_id": "ab0c035b-893a-40d0-b13f-be5d2c6b6e89"}
    res = await get_tastemap_points("intensity", current_user=user)
    print("User ab0c0:", [p for p in res["points"] if p["type"] == "centroid"])

import sys
if 'backend' not in sys.path:
    sys.path.append('.')
asyncio.run(main())
