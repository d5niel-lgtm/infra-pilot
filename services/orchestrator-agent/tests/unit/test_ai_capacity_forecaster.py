import asyncio
import sys
import json
import os

from conftest import MockDockerClient


def test_forecasts_file_created(monkeypatch, tmp_path):
    monkeypatch.chdir(tmp_path)

    import docker
    mock_client = MockDockerClient()
    monkeypatch.setattr(docker, "from_env", lambda: mock_client)

    from ai_capacity_forecaster import AICapacityForecaster

    class MockBot:
        loop = asyncio.new_event_loop()

    cog = AICapacityForecaster(MockBot())
    cog.forecast_loop.cancel()
    cog.cog_unload()

    data_dir = tmp_path / "data"
    assert data_dir.exists()
    assert (data_dir / "capacity_forecasts.json").exists()


def test_forecasts_empty_initially(monkeypatch, tmp_path):
    monkeypatch.chdir(tmp_path)

    import docker
    mock_client = MockDockerClient()
    monkeypatch.setattr(docker, "from_env", lambda: mock_client)

    from ai_capacity_forecaster import AICapacityForecaster

    class MockBot:
        loop = asyncio.new_event_loop()

    cog = AICapacityForecaster(MockBot())
    cog.forecast_loop.cancel()
    cog.cog_unload()

    assert cog.forecasts == []


def test_linear_trend():
    import docker
    mock_client = MockDockerClient()

    from ai_capacity_forecaster import AICapacityForecaster

    class MockBot:
        loop = asyncio.new_event_loop()

    cog = AICapacityForecaster(MockBot())
    cog.forecast_loop.cancel()
    cog.cog_unload()

    increasing = [10, 20, 30, 40, 50]
    slope = cog._linear_trend(increasing)
    assert slope > 0

    decreasing = [50, 40, 30, 20, 10]
    slope = cog._linear_trend(decreasing)
    assert slope < 0

    flat = [30, 30, 30, 30, 30]
    slope = cog._linear_trend(flat)
    assert slope == 0


def test_predict():
    import docker
    mock_client = MockDockerClient()

    from ai_capacity_forecaster import AICapacityForecaster

    class MockBot:
        loop = asyncio.new_event_loop()

    cog = AICapacityForecaster(MockBot())
    cog.forecast_loop.cancel()
    cog.cog_unload()

    history = [{"cpu_usage": float(i * 10)} for i in range(1, 20)]
    predicted = cog._predict(history, "cpu_usage", 30)
    assert predicted >= 0
    assert predicted <= 100


def test_forecast_save_and_load(monkeypatch, tmp_path):
    monkeypatch.chdir(tmp_path)

    import docker
    mock_client = MockDockerClient()
    monkeypatch.setattr(docker, "from_env", lambda: mock_client)

    from ai_capacity_forecaster import AICapacityForecaster

    class MockBot:
        loop = asyncio.new_event_loop()

    cog1 = AICapacityForecaster(MockBot())
    cog1.forecasts.append({"id": "f-1", "vps_id": "vps-1", "created_at": "now", "forecast": {}})
    cog1._save_forecasts()
    cog1.forecast_loop.cancel()
    cog1.cog_unload()

    cog2 = AICapacityForecaster(MockBot())
    cog2.forecast_loop.cancel()
    cog2.cog_unload()

    assert len(cog2.forecasts) == 1
    assert cog2.forecasts[0]["id"] == "f-1"
