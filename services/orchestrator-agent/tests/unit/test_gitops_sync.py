import asyncio
import sys
import json
import os

from conftest import MockDockerClient


def test_state_file_created(monkeypatch, tmp_path):
    monkeypatch.chdir(tmp_path)

    import docker
    mock_client = MockDockerClient()
    monkeypatch.setattr(docker, "from_env", lambda: mock_client)

    from gitops_sync import GitOpsSync

    class MockBot:
        loop = asyncio.new_event_loop()

    cog = GitOpsSync(MockBot())
    cog.drift_loop.cancel()
    cog.cog_unload()

    data_dir = tmp_path / "data"
    assert data_dir.exists()
    assert (data_dir / "gitops_state.json").exists()


def test_empty_state(monkeypatch, tmp_path):
    monkeypatch.chdir(tmp_path)

    import docker
    mock_client = MockDockerClient()
    monkeypatch.setattr(docker, "from_env", lambda: mock_client)

    from gitops_sync import GitOpsSync

    class MockBot:
        loop = asyncio.new_event_loop()

    cog = GitOpsSync(MockBot())
    cog.drift_loop.cancel()
    cog.cog_unload()

    assert cog.sync_history == []
    assert cog.versions == {}


def test_save_and_load_state(monkeypatch, tmp_path):
    monkeypatch.chdir(tmp_path)

    import docker
    mock_client = MockDockerClient()
    monkeypatch.setattr(docker, "from_env", lambda: mock_client)

    from gitops_sync import GitOpsSync

    class MockBot:
        loop = asyncio.new_event_loop()

    cog1 = GitOpsSync(MockBot())
    cog1.sync_history.append({"id": "h-1", "type": "sync", "vps_id": "vps-1", "timestamp": "now"})
    cog1.versions["vps-1"] = [{"version_id": "v-1", "snapshot": {}, "created_at": "now"}]
    cog1._save_state()
    cog1.drift_loop.cancel()
    cog1.cog_unload()

    cog2 = GitOpsSync(MockBot())
    cog2.drift_loop.cancel()
    cog2.cog_unload()

    assert len(cog2.sync_history) == 1
    assert "vps-1" in cog2.versions


def test_detect_drift(monkeypatch, tmp_path):
    monkeypatch.chdir(tmp_path)

    import docker
    mock_client = MockDockerClient()
    monkeypatch.setattr(docker, "from_env", lambda: mock_client)

    from gitops_sync import GitOpsSync
    from vps_manager import VPSManager

    class MockBot:
        loop = asyncio.new_event_loop()

    cog = GitOpsSync(MockBot())
    cog.drift_loop.cancel()
    cog.cog_unload()

    desired = {"config": {"cpu_limit": 2.0, "memory_limit": 1024}}
    if "vps-1" not in cog.vps_manager.vps_instances:
        cog.vps_manager.vps_instances["vps-1"] = {
            "config": {"cpu_limit": 1.0, "memory_limit": 512, "storage_limit": 20, "image": "ubuntu", "ports": {}},
            "status": "running",
        }
    diffs = cog._detect_drift("vps-1", desired)
    assert len(diffs) > 0
    assert any("cpu_limit" in d for d in diffs)
