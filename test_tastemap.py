import asyncio
from backend.api.routes.tastemap import get_tastemap_points

async def main():
    try:
        user = {"user_id": "auto_lukas"}
        res = await get_tastemap_points("intensity", current_user=user)
        print("Intensity success, points:", len(res["points"]))
        res2 = await get_tastemap_points("genre", current_user=user)
        print("Genre success, points:", len(res2["points"]))
    except Exception as e:
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(main())
