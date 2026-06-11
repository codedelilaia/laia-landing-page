import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DASHBOARD = json.loads((ROOT / "dashboard.json").read_text())
UPDATER = (ROOT / "ops/hermes/scripts/update_laia_dashboard.py").read_text()
WORKER = (ROOT / "_worker.js").read_text()


def module(module_id):
    return next((m for m in DASHBOARD["modules"] if m.get("id") == module_id), None)


def test_dashboard_json_contains_chores_module():
    chores = module("chores")
    assert chores is not None
    assert chores["type"] == "status"
    assert chores["title"] == "Chores"
    assert chores["items"]


def test_chores_data_precedes_market_data():
    ids = [m.get("id") for m in DASHBOARD["modules"]]
    assert ids.index("chores") < ids.index("market")


def test_updater_preserves_or_recreates_chores():
    assert "DEFAULT_CHORES" in UPDATER
    assert "existing_chores" in UPDATER
    assert "'id': 'chores'" in UPDATER


def test_chores_are_editable_from_dashboard_ui():
    assert "'chores'" in WORKER
    assert "'chores'" in (ROOT / "index.html").read_text()
