from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INDEX = (ROOT / "index.html").read_text()
WORKER = (ROOT / "_worker.js").read_text()


def test_dashboard_has_native_hermes_chat_shell():
    assert 'id="hermes-chat-panel"' in INDEX
    assert 'id="hermes-session-list"' in INDEX
    assert 'id="hermes-chat-form"' in INDEX
    assert 'function loadHermesSessions' in INDEX
    assert 'function sendHermesMessage' in INDEX


def test_worker_proxies_hermes_without_exposing_api_key():
    assert "HERMES_API_BASE" in WORKER
    assert "HERMES_API_KEY" in WORKER
    assert "'/api/hermes/status'" in WORKER
    assert "'/api/hermes/sessions'" in WORKER
    assert "'/api/hermes/chat'" in WORKER
    assert "'/api/hermes/fork'" in WORKER
    assert "Authorization: `Bearer ${env.HERMES_API_KEY}`" in WORKER


def test_chat_ui_guides_missing_backend_configuration():
    assert "Hermes backend not connected" in INDEX
    assert "HERMES_API_BASE" in INDEX
    assert "HERMES_API_KEY" in INDEX
