import importlib


def test_core_orchestrator_modules_import():
    module = importlib.import_module("vps_manager")
    assert hasattr(module, "VPSManager")
    assert hasattr(module, "VPSConfig")


def test_disaster_recovery_cog_imports():
    module = importlib.import_module("cogs.disaster_recovery")
    assert hasattr(module, "DisasterRecovery")
    assert hasattr(module, "DR_PLAN_TYPES")


def test_runbook_automation_cog_imports():
    module = importlib.import_module("cogs.runbook_automation")
    assert hasattr(module, "RunbookAutomation")


def test_synthetic_monitoring_cog_imports():
    module = importlib.import_module("cogs.synthetic_monitoring")
    assert hasattr(module, "SyntheticMonitoring")
    assert hasattr(module, "CHECK_TYPES")


def test_container_scanner_cog_imports():
    module = importlib.import_module("cogs.container_scanner")
    assert hasattr(module, "ContainerScanner")
