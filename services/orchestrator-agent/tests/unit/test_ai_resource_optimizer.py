import asyncio
import sys
import json
import os

from conftest import MockDockerClient


def test_recommendations_file_created(monkeypatch, tmp_path):
    monkeypatch.chdir(tmp_path)

    import importlib
    import docker

    mock_client = MockDockerClient()
    monkeypatch.setattr(docker, "from_env", lambda: mock_client)

    from ai_resource_optimizer import AIResourceOptimizer

    class MockBot:
        loop = asyncio.new_event_loop()

    cog = AIResourceOptimizer(MockBot())
    cog.optimize_loop.cancel()
    cog.cog_unload()

    data_dir = tmp_path / "data"
    assert data_dir.exists()
    rec_file = data_dir / "optimization_recommendations.json"
    assert rec_file.exists()


def test_recommendations_empty_initially(monkeypatch, tmp_path):
    monkeypatch.chdir(tmp_path)

    import importlib
    import docker

    mock_client = MockDockerClient()
    monkeypatch.setattr(docker, "from_env", lambda: mock_client)

    from ai_resource_optimizer import AIResourceOptimizer

    class MockBot:
        loop = asyncio.new_event_loop()

    cog = AIResourceOptimizer(MockBot())
    cog.optimize_loop.cancel()
    cog.cog_unload()

    assert cog.recommendations == []


def test_save_and_load_recommendations(monkeypatch, tmp_path):
    monkeypatch.chdir(tmp_path)

    import importlib
    import docker

    mock_client = MockDockerClient()
    monkeypatch.setattr(docker, "from_env", lambda: mock_client)

    from ai_resource_optimizer import AIResourceOptimizer

    class MockBot:
        loop = asyncio.new_event_loop()

    cog1 = AIResourceOptimizer(MockBot())
    cog1.recommendations.append({"id": "test-1", "vps_id": "vps-1", "status": "pending", "analysis": {}, "created_at": "2025-01-01"})
    cog1._save_recommendations()
    cog1.optimize_loop.cancel()
    cog1.cog_unload()

    cog2 = AIResourceOptimizer(MockBot())
    cog2.optimize_loop.cancel()
    cog2.cog_unload()

    assert len(cog2.recommendations) == 1
    assert cog2.recommendations[0]["id"] == "test-1"


def test_idle_detection():
    import importlib
    import docker
    from ai_resource_optimizer import AIResourceOptimizer

    class MockBot:
        loop = asyncio.new_event_loop()

    cog = AIResourceOptimizer(MockBot())
    cog.optimize_loop.cancel()
    cog.cog_unload()

    from datetime import datetime, timedelta

    recent_low = [
        {"cpu_usage": 2.0, "memory_usage": 5.0, "timestamp": (datetime.now() - timedelta(hours=1)).isoformat()},
        {"cpu_usage": 3.0, "memory_usage": 4.0, "timestamp": (datetime.now() - timedelta(hours=2)).isoformat()},
    ]
    assert cog._detect_idle(recent_low, days=7) is True

    recent_high = [
        {"cpu_usage": 50.0, "memory_usage": 60.0, "timestamp": (datetime.now() - timedelta(hours=1)).isoformat()},
        {"cpu_usage": 45.0, "memory_usage": 55.0, "timestamp": (datetime.now() - timedelta(hours=2)).isoformat()},
    ]
    assert cog._detect_idle(recent_high, days=7) is False
