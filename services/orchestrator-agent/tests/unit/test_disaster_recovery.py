import pytest
from unittest.mock import MagicMock, patch, AsyncMock
import json
from datetime import datetime

from cogs.disaster_recovery import DisasterRecovery, DR_PLAN_TYPES


@pytest.fixture
def bot():
    bot = MagicMock()
    bot.user = "test-bot"
    return bot


@pytest.fixture
def cog(bot):
    with patch("cogs.disaster_recovery.VPSManager") as MockVPS:
        mock_vps = MockVPS.return_value
        mock_vps._get_db_connection = MagicMock()
        cog = DisasterRecovery(bot)
        cog.dr_readiness_loop.cancel()
        return cog


@pytest.mark.asyncio
async def test_dr_plan_types():
    assert "active-passive" in DR_PLAN_TYPES
    assert "pilot-light" in DR_PLAN_TYPES
    assert "warm-standby" in DR_PLAN_TYPES


@pytest.mark.asyncio
async def test_generate_drill_steps_active_passive(cog):
    plan = {"plan_type": "active-passive"}
    steps = cog._generate_drill_steps(plan)
    assert len(steps) == 4
    assert steps[0]["action"] == "validate_passive"
    assert steps[1]["action"] == "failover"
    assert steps[2]["action"] == "validate_active"
    assert steps[3]["action"] == "rollback"


@pytest.mark.asyncio
async def test_generate_drill_steps_pilot_light(cog):
    plan = {"plan_type": "pilot-light"}
    steps = cog._generate_drill_steps(plan)
    assert len(steps) == 4
    assert steps[0]["action"] == "scale_pilot"
    assert steps[2]["action"] == "validate"


@pytest.mark.asyncio
async def test_generate_drill_steps_warm_standby(cog):
    plan = {"plan_type": "warm-standby"}
    steps = cog._generate_drill_steps(plan)
    assert len(steps) == 3
    assert steps[0]["action"] == "warm_standby_activate"


@pytest.mark.asyncio
async def test_check_plan_readiness(cog):
    result = await cog._check_plan_readiness({"id": 1})
    assert result["healthy"] is True


@pytest.mark.asyncio
async def test_load_save_plans(cog, tmp_path):
    cog.dr_plans_file = str(tmp_path / "dr_plans.json")
    cog._ensure_data_file()
    plans = [{"name": "test-plan", "type": "active-passive"}]
    cog._save_plans(plans)
    loaded = cog._load_plans()
    assert len(loaded) == 1
    assert loaded[0]["name"] == "test-plan"


@pytest.mark.asyncio
async def test_ensure_data_file_creates_file(cog, tmp_path):
    test_file = str(tmp_path / "test_dr.json")
    cog.dr_plans_file = test_file
    cog._ensure_data_file()
    import os
    assert os.path.exists(test_file)
    with open(test_file) as f:
        assert json.load(f) == []


@pytest.mark.asyncio
async def test_execute_drill_plan_not_found(cog):
    conn = MagicMock()
    cursor = MagicMock()
    cursor.fetchone.return_value = None
    conn.cursor.return_value = cursor
    conn.__enter__ = MagicMock(return_value=conn)
    conn.__exit__ = MagicMock()

    with patch.object(cog.vps_manager, "_get_db_connection", return_value=conn):
        result = await cog._execute_drill(999)
        assert result["success"] is False
        assert "not found" in result["error"]
