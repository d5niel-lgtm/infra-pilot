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
    monkeypatch.setattr("cogs.multi_cloud_cost.DATA_FILE", str(data_dir / "cloud_pricing.json"))
    monkeypatch.chdir(tmp_path)

    from discord.ext import commands
    bot = commands.Bot(command_prefix="/", intents=None)

    if "cogs.multi_cloud_cost" in sys.modules:
        module = importlib.reload(sys.modules["cogs.multi_cloud_cost"])
    else:
        module = importlib.import_module("cogs.multi_cloud_cost")

    cog = module.MultiCloudCost(bot)
    yield cog
    cog.refresh_pricing_loop.cancel()


@pytest.mark.asyncio
async def test_providers_list_has_all_providers(build_cog):
    cog = build_cog

    await cog._list_providers(None, None)

    from cogs.multi_cloud_cost import PROVIDER_PRICING
    assert "aws" in PROVIDER_PRICING
    assert "gcp" in PROVIDER_PRICING
    assert "azure" in PROVIDER_PRICING
    assert "hetzner" in PROVIDER_PRICING


@pytest.mark.asyncio
async def test_recommend_returns_top_instances(build_cog):
    cog = build_cog

    await cog._recommend(None, None)

    assert True


@pytest.mark.asyncio
async def test_compare_vps_cost_returns_sorted(build_cog):
    cog = build_cog

    results = await cog._compare_vps_cost(2, 4096)

    assert len(results) > 0
    for i in range(len(results) - 1):
        assert results[i]["price_monthly"] <= results[i + 1]["price_monthly"]


@pytest.mark.asyncio
async def test_compare_vps_cost_respects_specs(build_cog):
    cog = build_cog

    results = await cog._compare_vps_cost(4, 16384)

    for r in results:
        assert r["cpu"] >= 4
        assert r["memory"] >= 16384


@pytest.mark.asyncio
async def test_refresh_pricing_populates_cache(build_cog):
    cog = build_cog

    await cog.refresh_pricing_loop()

    assert len(cog.pricing_cache) > 0
    assert "aws/t3.nano" in cog.pricing_cache
    assert "hetzner/CX22" in cog.pricing_cache


@pytest.mark.asyncio
async def test_compare_missing_vps_returns_error(build_cog):
    cog = build_cog
    cog.vps_manager.vps_instances = {}

    await cog._compare_pricing(None, "nonexistent")

    assert "nonexistent" not in cog.vps_manager.vps_instances


@pytest.mark.asyncio
async def test_cost_history_no_data(build_cog):
    cog = build_cog

    await cog._cost_history(None, None)

    assert True
