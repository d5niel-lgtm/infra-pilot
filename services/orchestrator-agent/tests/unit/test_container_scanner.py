import pytest
from unittest.mock import MagicMock, patch, AsyncMock
import json
from datetime import datetime

from cogs.container_scanner import ContainerScanner


@pytest.fixture
def bot():
    bot = MagicMock()
    bot.user = "test-bot"
    return bot


@pytest.fixture
def cog(bot):
    with patch("cogs.container_scanner.VPSManager") as MockVPS:
        mock_vps = MockVPS.return_value
        mock_vps._get_db_connection = MagicMock()
        cog = ContainerScanner(bot)
        cog.scheduled_scan_loop.cancel()
        return cog


@pytest.mark.asyncio
async def test_load_save_scans(cog, tmp_path):
    cog.scan_results_file = str(tmp_path / "scan_results.json")
    cog._ensure_data_file()
    scans = [{"scan_id": 1, "image": "nginx:latest"}]
    cog._save_scans(scans)
    loaded = cog._load_scans()
    assert len(loaded) == 1
    assert loaded[0]["image"] == "nginx:latest"


@pytest.mark.asyncio
async def test_ensure_data_file_creates_file(cog, tmp_path):
    test_file = str(tmp_path / "test_scans.json")
    cog.scan_results_file = test_file
    cog._ensure_data_file()
    import os
    assert os.path.exists(test_file)
    with open(test_file) as f:
        assert json.load(f) == []


@pytest.mark.asyncio
async def test_summarize_vulns_empty(cog):
    summary = cog._summarize_vulns([])
    assert summary["total"] == 0
    assert summary["CRITICAL"] == 0


@pytest.mark.asyncio
async def test_summarize_vulns_with_data(cog):
    vulns = [
        {"severity": "CRITICAL", "cve_id": "CVE-2024-0001"},
        {"severity": "HIGH", "cve_id": "CVE-2024-0002"},
        {"severity": "CRITICAL", "cve_id": "CVE-2024-0003"},
        {"severity": "MEDIUM", "cve_id": "CVE-2024-0004"},
    ]
    summary = cog._summarize_vulns(vulns)
    assert summary["total"] == 4
    assert summary["CRITICAL"] == 2
    assert summary["HIGH"] == 1
    assert summary["MEDIUM"] == 1


@pytest.mark.asyncio
async def test_check_policy_no_policies(cog):
    conn = MagicMock()
    cursor = MagicMock()
    cursor.fetchall.return_value = []
    conn.cursor.return_value.__enter__ = MagicMock(return_value=cursor)
    conn.cursor.return_value.__exit__ = MagicMock()

    with patch.object(cog.vps_manager, "_get_db_connection", return_value=conn):
        result = await cog._check_policy([{"severity": "CRITICAL"}])
        assert result == "pass"


@pytest.mark.asyncio
async def test_check_policy_blocks_critical(cog):
    conn = MagicMock()
    cursor = MagicMock()
    cursor.fetchall.return_value = [{"severity": "CRITICAL", "action": "block"}]
    conn.cursor.return_value.__enter__ = MagicMock(return_value=cursor)
    conn.cursor.return_value.__exit__ = MagicMock()

    with patch.object(cog.vps_manager, "_get_db_connection", return_value=conn):
        result = await cog._check_policy([{"severity": "CRITICAL"}])
        assert result == "block"


@pytest.mark.asyncio
async def test_check_policy_allows_low(cog):
    conn = MagicMock()
    cursor = MagicMock()
    cursor.fetchall.return_value = [{"severity": "CRITICAL", "action": "block"}]
    conn.cursor.return_value.__enter__ = MagicMock(return_value=cursor)
    conn.cursor.return_value.__exit__ = MagicMock()

    with patch.object(cog.vps_manager, "_get_db_connection", return_value=conn):
        result = await cog._check_policy([{"severity": "LOW"}])
        assert result == "pass"


@pytest.mark.asyncio
async def test_scan_with_trivy_not_found(cog):
    with patch("cogs.container_scanner.asyncio.create_subprocess_exec", side_effect=FileNotFoundError):
        result = await cog._scan_with_trivy("test:latest")
        assert result["scanner"] == "grype"
