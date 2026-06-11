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


def test_chat_new_session_handles_object_errors_and_optimistic_insert():
    assert "function formatHermesValue" in INDEX
    assert "function formatHermesError" in INDEX
    assert "function uniqueHermesChatTitle" in INDEX
    assert "async function createHermesSession(title = uniqueHermesChatTitle())" in INDEX
    assert "upsertHermesSession" in INDEX
    assert "hermesState.configured = true" in INDEX
    assert "New conversation ready." in INDEX
    assert "String(err.message || err)" not in INDEX


def test_worker_formats_upstream_object_errors():
    assert "function formatError" in WORKER
    assert "throw new Error(formatError" in WORKER


def test_worker_uses_unique_hermes_session_titles_and_retries_duplicates():
    assert "function uniqueHermesTitle" in WORKER
    assert "function isDuplicateHermesTitle" in WORKER
    assert "uniqueHermesTitle('Dashboard chat')" in WORKER
    assert "uniqueHermesTitle(requestedTitle || 'Dashboard chat')" in WORKER
    assert "uniqueHermesTitle('Dashboard branch')" in WORKER
    assert "'Dashboard chat', source: 'dashboard'" not in WORKER
