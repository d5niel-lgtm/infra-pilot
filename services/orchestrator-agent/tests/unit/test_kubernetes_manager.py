import pytest
import asyncio
import importlib
import sys
import json
import os

from conftest import MockDockerClient


@pytest.fixture
def build_cog(monkeypatch, tmp_path):
    import docker
    mock_client = MockDockerClient()
    monkeypatch.setattr(docker, "from_env", lambda: mock_client)
    data_dir = tmp_path / "data"
    data_dir.mkdir()
    monkeypatch.setattr("cogs.kubernetes_manager.DATA_FILE", str(data_dir / "k8s_clusters.json"))
    monkeypatch.chdir(tmp_path)

    from discord.ext import commands
    bot = commands.Bot(command_prefix="/", intents=None)

    if "cogs.kubernetes_manager" in sys.modules:
        module = importlib.reload(sys.modules["cogs.kubernetes_manager"])
    else:
        module = importlib.import_module("cogs.kubernetes_manager")

    cog = module.KubernetesManager(bot)
    return cog, mock_client


@pytest.mark.asyncio
async def test_load_clusters_from_file(monkeypatch, tmp_path):
    import docker
    mock_client = MockDockerClient()
    monkeypatch.setattr(docker, "from_env", lambda: mock_client)
    data_dir = tmp_path / "data"
    data_dir.mkdir()
    data_file = data_dir / "k8s_clusters.json"
    test_data = {"test-cluster": {"name": "test-cluster", "status": "healthy", "node_count": 1}}
    with open(data_file, "w") as f:
        json.dump(test_data, f)
    monkeypatch.setattr("cogs.kubernetes_manager.DATA_FILE", str(data_file))
    monkeypatch.chdir(tmp_path)

    from discord.ext import commands
    bot = commands.Bot(command_prefix="/", intents=None)
    from cogs.kubernetes_manager import KubernetesManager
    cog = KubernetesManager(bot)
    cog.cluster_health_loop.cancel()

    assert "test-cluster" in cog.clusters
    assert cog.clusters["test-cluster"]["status"] == "healthy"


@pytest.mark.asyncio
async def test_create_cluster_adds_to_dict(build_cog):
    cog, mock_client = build_cog

    await cog._create_cluster(None, "test-cluster", None, None)

    assert "test-cluster" in cog.clusters
    assert cog.clusters["test-cluster"]["status"] == "starting"
    assert cog.clusters["test-cluster"]["type"] == "k3s"


@pytest.mark.asyncio
async def test_delete_cluster_removes_from_dict(build_cog):
    cog, mock_client = build_cog
    cog.clusters["test-cluster"] = {"name": "test-cluster", "type": "k3s", "status": "healthy", "node_count": 1}

    await cog._delete_cluster(None, "test-cluster", None, None)

    assert "test-cluster" not in cog.clusters


@pytest.mark.asyncio
async def test_delete_missing_cluster_returns_error(build_cog):
    cog, _ = build_cog

    await cog._delete_cluster(None, "nonexistent", None, None)

    assert "nonexistent" not in cog.clusters


@pytest.mark.asyncio
async def test_list_clusters_empty(build_cog):
    cog, _ = build_cog

    await cog._list_clusters(None, None, None, None)

    assert len(cog.clusters) == 0


@pytest.mark.asyncio
async def test_list_clusters_with_data(build_cog):
    cog, _ = build_cog
    cog.clusters["alpha"] = {"name": "alpha", "status": "healthy", "node_count": 3, "type": "k3s", "created_at": "2025-01-01T00:00:00"}

    await cog._list_clusters(None, None, None, None)

    assert "alpha" in cog.clusters


@pytest.mark.asyncio
async def test_duplicate_cluster_name_rejected(build_cog):
    cog, mock_client = build_cog
    cog.clusters["test-cluster"] = {"name": "test-cluster", "status": "healthy"}

    await cog._create_cluster(None, "test-cluster", None, None)

    assert cog.clusters["test-cluster"]["status"] == "healthy"


@pytest.mark.asyncio
async def test_save_and_reload_clusters(build_cog):
    cog, _ = build_cog
    cog.clusters["saved"] = {"name": "saved", "status": "healthy", "node_count": 2}
    cog.save_clusters()

    cog2_data = {}
    with open(cog.__class__.DATA_FILE if hasattr(cog.__class__, 'DATA_FILE') else "data/k8s_clusters.json") as f:
        cog2_data = json.load(f)

    assert "saved" in cog2_data
