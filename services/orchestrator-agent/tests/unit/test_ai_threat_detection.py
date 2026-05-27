import asyncio
import sys
import json
import os

from conftest import MockDockerClient


def test_incidents_file_created(monkeypatch, tmp_path):
    monkeypatch.chdir(tmp_path)

    import docker
    mock_client = MockDockerClient()
    monkeypatch.setattr(docker, "from_env", lambda: mock_client)

    from ai_threat_detection import AIThreatDetection

    class MockBot:
        loop = asyncio.new_event_loop()

    cog = AIThreatDetection(MockBot())
    cog.threat_loop.cancel()
    cog.cog_unload()

    data_dir = tmp_path / "data"
    assert data_dir.exists()
    assert (data_dir / "threat_incidents.json").exists()
    assert (data_dir / "threat_whitelist.json").exists()


def test_empty_incidents_and_whitelist(monkeypatch, tmp_path):
    monkeypatch.chdir(tmp_path)

    import docker
    mock_client = MockDockerClient()
    monkeypatch.setattr(docker, "from_env", lambda: mock_client)

    from ai_threat_detection import AIThreatDetection

    class MockBot:
        loop = asyncio.new_event_loop()

    cog = AIThreatDetection(MockBot())
    cog.threat_loop.cancel()
    cog.cog_unload()

    assert cog.incidents == []
    assert cog.whitelist == []


def test_anomaly_scoring(monkeypatch, tmp_path):
    monkeypatch.chdir(tmp_path)

    import docker
    mock_client = MockDockerClient()
    monkeypatch.setattr(docker, "from_env", lambda: mock_client)

    from ai_threat_detection import AIThreatDetection

    class MockBot:
        loop = asyncio.new_event_loop()

    cog = AIThreatDetection(MockBot())
    cog.threat_loop.cancel()
    cog.cog_unload()

    high_stats = {"cpu_usage": 95.0, "memory_usage": 98.0, "network": {"rx_bytes": 100, "tx_bytes": 200}}
    score = cog._score_anomaly("test", high_stats)
    assert score > 50

    low_stats = {"cpu_usage": 10.0, "memory_usage": 20.0, "network": {"rx_bytes": 100, "tx_bytes": 200}}
    score = cog._score_anomaly("test", low_stats)
    assert score == 0


def test_whitelist_add_remove(monkeypatch, tmp_path):
    monkeypatch.chdir(tmp_path)

    import docker
    mock_client = MockDockerClient()
    monkeypatch.setattr(docker, "from_env", lambda: mock_client)

    from ai_threat_detection import AIThreatDetection

    class MockBot:
        loop = asyncio.new_event_loop()

    cog = AIThreatDetection(MockBot())
    cog.threat_loop.cancel()
    cog.cog_unload()

    cog.whitelist.append({"ip": "192.168.1.1", "added_by": "test", "added_at": "now"})
    cog._save_whitelist()

    assert len(cog.whitelist) == 1

    cog.whitelist = [w for w in cog.whitelist if w["ip"] != "192.168.1.1"]
    cog._save_whitelist()
    assert len(cog.whitelist) == 0


def test_incident_creation(monkeypatch, tmp_path):
    monkeypatch.chdir(tmp_path)

    import docker
    mock_client = MockDockerClient()
    monkeypatch.setattr(docker, "from_env", lambda: mock_client)

    from ai_threat_detection import AIThreatDetection

    class MockBot:
        loop = asyncio.new_event_loop()

    cog = AIThreatDetection(MockBot())
    cog.threat_loop.cancel()
    cog.cog_unload()

    cog.incidents.append({
        "id": "inc-1",
        "vps_id": "vps-1",
        "anomaly_score": 85,
        "alerts": ["High CPU"],
        "detected_at": "2025-01-01T00:00:00",
        "status": "open",
    })
    cog._save_incidents()

    open_incidents = [i for i in cog.incidents if i["status"] == "open"]
    assert len(open_incidents) == 1
    assert open_incidents[0]["anomaly_score"] == 85
