import logging

import httpx

from app.config import settings

logger = logging.getLogger(__name__)


async def trigger_reload() -> None:
    """POST /reload to mock-service. Logs outcome; never raises."""
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.post(f"{settings.MOCK_SERVICE_URL}/reload")
            response.raise_for_status()
            data = response.json()
            configs_loaded = data.get("configs_loaded", "unknown")
            logger.info("Mock service reloaded — configs_loaded=%s", configs_loaded)
    except httpx.HTTPStatusError as exc:
        logger.warning("Mock service reload returned %s: %s", exc.response.status_code, exc)
    except Exception as exc:
        logger.warning("Mock service reload failed: %s", exc)
