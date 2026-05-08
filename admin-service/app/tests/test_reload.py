import pytest
import httpx
from unittest.mock import AsyncMock, MagicMock, patch

from app.services.reload import trigger_reload


@pytest.mark.asyncio
async def test_trigger_reload_success(mocker: "pytest_mock.MockerFixture") -> None:
    mock_response = MagicMock()
    mock_response.json.return_value = {"configs_loaded": 5}
    mock_response.raise_for_status.return_value = None

    mock_client = AsyncMock()
    mock_client.post.return_value = mock_response
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=False)

    mocker.patch("app.services.reload.httpx.AsyncClient", return_value=mock_client)

    await trigger_reload()

    mock_client.post.assert_awaited_once()


@pytest.mark.asyncio
async def test_trigger_reload_connection_error(mocker: "pytest_mock.MockerFixture") -> None:
    mock_client = AsyncMock()
    mock_client.post.side_effect = httpx.ConnectError("unreachable")
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=False)

    mocker.patch("app.services.reload.httpx.AsyncClient", return_value=mock_client)

    # Must not raise
    await trigger_reload()


@pytest.mark.asyncio
async def test_trigger_reload_http_500(mocker: "pytest_mock.MockerFixture") -> None:
    mock_response = MagicMock(spec=httpx.Response)
    mock_response.status_code = 500
    mock_response.raise_for_status.side_effect = httpx.HTTPStatusError(
        "500", request=MagicMock(), response=mock_response
    )

    mock_client = AsyncMock()
    mock_client.post.return_value = mock_response
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=False)

    mocker.patch("app.services.reload.httpx.AsyncClient", return_value=mock_client)

    # Must not raise
    await trigger_reload()
