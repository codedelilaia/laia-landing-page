from pathlib import Path

INDEX = (Path(__file__).resolve().parents[1] / "index.html").read_text()


def test_dashboard_has_primary_tabs():
    for tab in ["dashboard", "chat", "history", "agent"]:
        assert f'data-tab-target="{tab}"' in INDEX
        assert f'id="tab-{tab}"' in INDEX


def test_chat_is_own_full_width_tab():
    chat_pos = INDEX.index('id="tab-chat"')
    dashboard_pos = INDEX.index('id="tab-dashboard"')
    assert chat_pos > dashboard_pos
    assert 'id="hermes-chat-section"' in INDEX
    assert 'class="tab-panel" id="tab-chat"' in INDEX


def test_history_and_agent_have_dedicated_zones():
    assert 'id="history-zone"' in INDEX
    assert 'id="agent-config-zone"' in INDEX
    assert "daily_log: 'history'" in INDEX
    assert "watcher: 'agentConfig'" in INDEX
