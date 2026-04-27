import asyncio
from backend.api.routes.tastemap import get_tastemap_points

async def main():
    try:
        user = {"user_id": "test_auto"} # try someone
        res = await get_tastemap_points("intensity", current_user=user)
        print("Done")
    except Exception as e:
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(main())
