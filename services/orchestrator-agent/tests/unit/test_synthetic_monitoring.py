import pytest
from unittest.mock import MagicMock, patch, AsyncMock
import json
from datetime import datetime

from cogs.synthetic_monitoring import SyntheticMonitoring, CHECK_TYPES


@pytest.fixture
def bot():
    bot = MagicMock()
    bot.user = "test-bot"
    return bot


@pytest.fixture
def cog(bot):
    with patch("cogs.synthetic_monitoring.VPSManager") as MockVPS:
        mock_vps = MockVPS.return_value
        mock_vps._get_db_connection = MagicMock()
        cog = SyntheticMonitoring(bot)
        cog.synthetic_check_loop.cancel()
        return cog


@pytest.mark.asyncio
async def test_check_types():
    assert "http" in CHECK_TYPES
    assert "https" in CHECK_TYPES
    assert "tcp" in CHECK_TYPES
    assert "ping" in CHECK_TYPES
    assert "ssl" in CHECK_TYPES
    assert "dns" in CHECK_TYPES


@pytest.mark.asyncio
async def test_probe_locations(cog):
    assert len(cog.probe_locations) == 10
    assert "us-east-1" in cog.probe_locations


@pytest.mark.asyncio
async def test_load_save_checks(cog, tmp_path):
    cog.checks_file = str(tmp_path / "synthetic_checks.json")
    cog._ensure_data_file()
    checks = [{"type": "http", "target": "example.com"}]
    cog._save_checks(checks)
    loaded = cog._load_checks()
    assert len(loaded) == 1
    assert loaded[0]["target"] == "example.com"


@pytest.mark.asyncio
async def test_ensure_data_file_creates_file(cog, tmp_path):
    test_file = str(tmp_path / "test_monitor.json")
    cog.checks_file = test_file
    cog._ensure_data_file()
    import os
    assert os.path.exists(test_file)
    with open(test_file) as f:
        assert json.load(f) == []


@pytest.mark.asyncio
async def test_unknown_check_type(cog):
    result = await cog._run_check("invalid", "target")
    assert result["status"] == "failed"


@pytest.mark.asyncio
async def test_check_http_success(cog):
    with patch("cogs.synthetic_monitoring.aiohttp.ClientSession") as MockSession:
        mock_resp = AsyncMock()
        mock_resp.status = 200
        mock_session = AsyncMock()
        mock_session.get.return_value.__aenter__.return_value = mock_resp
        MockSession.return_value.__aenter__.return_value = mock_session

        result = await cog._check_http("example.com")
        assert result["status"] == "passed"
        assert result["status_code"] == 200


@pytest.mark.asyncio
async def test_update_check_status(cog):
    conn = MagicMock()
    cursor = MagicMock()
    conn.cursor.return_value = cursor

    with patch.object(cog.vps_manager, "_get_db_connection", return_value=conn):
        cog._update_check_status(1, "passed")
        cursor.execute.assert_called_once()


@pytest.mark.asyncio
async def test_store_result(cog):
    conn = MagicMock()
    cursor = MagicMock()
    conn.cursor.return_value = cursor

    with patch.object(cog.vps_manager, "_get_db_connection", return_value=conn):
        cog._store_result(1, "us-east-1", {"status": "passed", "response_time_ms": 100})
        cursor.execute.assert_called_once()
