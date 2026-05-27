import pytest
import asyncio
import importlib
import sys
import json

from conftest import MockDockerClient


@pytest.fixture
def build_cog(monkeypatch, tmp_path):
    import docker
    mock_client = MockDockerClient()
    monkeypatch.setattr(docker, "from_env", lambda: mock_client)
    data_dir = tmp_path / "data"
    data_dir.mkdir()
    monkeypatch.setattr("cogs.faas_manager.DATA_FILE", str(data_dir / "faas_functions.json"))
    monkeypatch.chdir(tmp_path)

    from discord.ext import commands
    bot = commands.Bot(command_prefix="/", intents=None)

    if "cogs.faas_manager" in sys.modules:
        module = importlib.reload(sys.modules["cogs.faas_manager"])
    else:
        module = importlib.import_module("cogs.faas_manager")

    cog = module.FaaSManager(bot)
    yield cog, mock_client
    cog.auto_scale_loop.cancel()


@pytest.mark.asyncio
async def test_deploy_function(build_cog):
    cog, _ = build_cog

    await cog._deploy_function(None, "myfunc", "https://github.com/user/repo")

    assert "myfunc" in cog.functions
    assert cog.functions["myfunc"]["repo"] == "https://github.com/user/repo"
    assert cog.functions["myfunc"]["status"] == "active"


@pytest.mark.asyncio
async def test_deploy_duplicate_rejected(build_cog):
    cog, _ = build_cog
    cog.functions["myfunc"] = {"name": "myfunc", "repo": "old", "status": "active"}

    await cog._deploy_function(None, "myfunc", "https://github.com/user/new")

    assert cog.functions["myfunc"]["repo"] == "old"


@pytest.mark.asyncio
async def test_list_functions_empty(build_cog):
    cog, _ = build_cog

    await cog._list_functions(None, None, None)

    assert len(cog.functions) == 0


@pytest.mark.asyncio
async def test_list_functions_with_data(build_cog):
    cog, _ = build_cog
    cog.functions["fn1"] = {"name": "fn1", "status": "active", "replicas": 1, "total_invocations": 0, "billing_balance": 0.0}

    await cog._list_functions(None, None, None)

    assert "fn1" in cog.functions


@pytest.mark.asyncio
async def test_invoke_function_increments_counter(build_cog):
    cog, mock_client = build_cog
    cog.functions["fn1"] = {
        "name": "fn1", "status": "active", "container_id": "container-1",
        "total_invocations": 0, "invocations_24h": 0, "billing_balance": 0.0,
    }

    await cog._invoke_function(None, "fn1", None)

    assert cog.functions["fn1"]["total_invocations"] == 1
    assert cog.functions["fn1"]["invocations_24h"] == 1
    assert cog.functions["fn1"]["billing_balance"] > 0


@pytest.mark.asyncio
async def test_invoke_missing_function(build_cog):
    cog, _ = build_cog

    await cog._invoke_function(None, "nonexistent", None)

    assert "nonexistent" not in cog.functions


@pytest.mark.asyncio
async def test_delete_function(build_cog):
    cog, mock_client = build_cog
    cog.functions["fn1"] = {"name": "fn1", "status": "active", "container_id": "container-1"}

    await cog._delete_function(None, "fn1", None)

    assert "fn1" not in cog.functions


@pytest.mark.asyncio
async def test_logs_missing_function(build_cog):
    cog, _ = build_cog

    await cog._function_logs(None, "nonexistent", None)

    assert "nonexistent" not in cog.functions


@pytest.mark.asyncio
async def test_save_and_reload_functions(build_cog):
    cog, _ = build_cog
    cog.functions["persist"] = {"name": "persist", "status": "active", "repo": "https://example.com/repo"}
    cog.save_functions()

    with open("data/faas_functions.json") as f:
        data = json.load(f)

    assert "persist" in data
