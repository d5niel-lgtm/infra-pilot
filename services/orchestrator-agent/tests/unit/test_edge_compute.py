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
    monkeypatch.setattr("cogs.edge_compute.DATA_FILE", str(data_dir / "edge_nodes.json"))
    monkeypatch.chdir(tmp_path)

    from discord.ext import commands
    bot = commands.Bot(command_prefix="/", intents=None)

    if "cogs.edge_compute" in sys.modules:
        module = importlib.reload(sys.modules["cogs.edge_compute"])
    else:
        module = importlib.import_module("cogs.edge_compute")

    cog = module.EdgeCompute(bot)
    return cog, mock_client


@pytest.mark.asyncio
async def test_register_node(build_cog):
    cog, _ = build_cog

    await cog._register_node(None, "edge-1", "us-east", None, None)

    assert "edge-1" in cog.edge_nodes
    assert cog.edge_nodes["edge-1"]["location"] == "us-east"
    assert cog.edge_nodes["edge-1"]["status"] == "registered"


@pytest.mark.asyncio
async def test_register_duplicate_rejected(build_cog):
    cog, _ = build_cog
    cog.edge_nodes["edge-1"] = {"name": "edge-1", "location": "us-east", "status": "registered"}

    await cog._register_node(None, "edge-1", "eu-west", None, None)

    assert cog.edge_nodes["edge-1"]["location"] == "us-east"


@pytest.mark.asyncio
async def test_list_nodes_empty(build_cog):
    cog, _ = build_cog

    await cog._list_nodes(None, None, None, None, None)

    assert len(cog.edge_nodes) == 0


@pytest.mark.asyncio
async def test_list_nodes_with_data(build_cog):
    cog, _ = build_cog
    cog.edge_nodes["node-a"] = {"name": "node-a", "location": "us-west", "status": "online", "functions": []}

    await cog._list_nodes(None, None, None, None, None)

    assert "node-a" in cog.edge_nodes


@pytest.mark.asyncio
async def test_deploy_to_node_missing(build_cog):
    cog, _ = build_cog

    await cog._deploy_to_node(None, None, None, "nonexistent", "nginx:latest")

    assert "nonexistent" not in cog.edge_nodes


@pytest.mark.asyncio
async def test_deploy_to_node_adds_function(build_cog):
    cog, mock_client = build_cog
    cog.edge_nodes["edge-1"] = {"name": "edge-1", "location": "us-east", "status": "registered", "functions": [], "container_id": ""}

    await cog._deploy_to_node(None, None, None, "edge-1", "nginx:latest")

    assert len(cog.edge_nodes["edge-1"]["functions"]) == 1
    assert cog.edge_nodes["edge-1"]["functions"][0]["image"] == "nginx:latest"


@pytest.mark.asyncio
async def test_node_status(build_cog):
    cog, _ = build_cog
    cog.edge_nodes["node-z"] = {
        "name": "node-z", "location": "eu-central", "status": "online",
        "functions": [], "last_ping": "2025-01-01T00:00:00", "registered_at": "2025-01-01T00:00:00",
    }

    await cog._node_status(None, None, None, "node-z", None)

    assert cog.edge_nodes["node-z"]["status"] == "online"


@pytest.mark.asyncio
async def test_save_and_reload_nodes(build_cog):
    cog, _ = build_cog
    cog.edge_nodes["persist"] = {"name": "persist", "location": "ap-southeast", "status": "registered", "functions": []}
    cog.save_nodes()

    with open("data/edge_nodes.json") as f:
        data = json.load(f)

    assert "persist" in data
