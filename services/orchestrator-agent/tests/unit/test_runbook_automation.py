import pytest
from unittest.mock import MagicMock, patch, AsyncMock
import json
import yaml
from datetime import datetime

from cogs.runbook_automation import RunbookAutomation


@pytest.fixture
def bot():
    bot = MagicMock()
    bot.user = "test-bot"
    return bot


@pytest.fixture
def cog(bot):
    with patch("cogs.runbook_automation.VPSManager") as MockVPS:
        mock_vps = MockVPS.return_value
        mock_vps._get_db_connection = MagicMock()
        cog = RunbookAutomation(bot)
        cog.scheduled_runbook_loop.cancel()
        return cog


@pytest.mark.asyncio
async def test_load_save_runbooks(cog, tmp_path):
    cog.runbooks_file = str(tmp_path / "runbooks.json")
    cog._ensure_data_file()
    runbooks = [{"name": "test-runbook", "steps": 5}]
    cog._save_runbooks(runbooks)
    loaded = cog._load_runbooks()
    assert len(loaded) == 1
    assert loaded[0]["name"] == "test-runbook"


@pytest.mark.asyncio
async def test_ensure_data_file_creates_file(cog, tmp_path):
    test_file = str(tmp_path / "test_runbooks.json")
    cog.runbooks_file = test_file
    cog._ensure_data_file()
    import os
    assert os.path.exists(test_file)
    with open(test_file) as f:
        assert json.load(f) == []


@pytest.mark.asyncio
async def test_check_gate(cog):
    result = await cog._check_gate({"condition": "test"})
    assert result is True


@pytest.mark.asyncio
async def test_run_step_sleep(cog):
    result = await cog._run_step({"action": "sleep", "duration": 1})
    assert result["status"] == "ok"


@pytest.mark.asyncio
async def test_yaml_parsing(cog):
    yaml_content = """
name: test-runbook
description: Test runbook
steps:
  - action: sleep
    duration: 1
  - action: sleep
    duration: 1
gates:
  - condition: always
rollback:
  - action: sleep
    duration: 1
trigger:
  type: manual
"""
    data = yaml.safe_load(yaml_content)
    assert data["name"] == "test-runbook"
    assert len(data["steps"]) == 2
    assert len(data["gates"]) == 1
    assert data["trigger"]["type"] == "manual"
