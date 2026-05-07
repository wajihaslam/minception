from motor.motor_asyncio import AsyncIOMotorClient
from app.config import settings

_client: AsyncIOMotorClient | None = None


def get_client() -> AsyncIOMotorClient:
    global _client
    if _client is None:
        _client = AsyncIOMotorClient(settings.MONGO_URL)
    return _client


def get_db():
    """Return the database instance. DB name is embedded in MONGO_URL."""
    client = get_client()
    # Extract DB name from connection string; default to api_gateway_dev
    db_name = settings.MONGO_URL.split("/")[-1].split("?")[0] or "api_gateway_dev"
    return client[db_name]


async def close_client():
    global _client
    if _client:
        _client.close()
        _client = None
