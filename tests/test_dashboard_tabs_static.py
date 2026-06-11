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


def test_internal_projects_are_on_dashboard_not_agent_config():
    dashboard_start = INDEX.index('id="tab-dashboard"')
    chat_start = INDEX.index('id="tab-chat"')
    dashboard_block = INDEX[dashboard_start:chat_start]
    assert 'id="personal-section"' in dashboard_block
    assert "internal_projects: 'personal'" in INDEX


def test_chores_are_restored_on_dashboard():
    assert 'id="chores-section"' in INDEX
    assert 'id="chores-zone"' in INDEX
    assert "chores: 'chores'" in INDEX


def test_dashboard_order_is_engagements_internal_projects_chores_market():
    dashboard_start = INDEX.index('id="tab-dashboard"')
    chat_start = INDEX.index('id="tab-chat"')
    dashboard_block = INDEX[dashboard_start:chat_start]
    assert dashboard_block.index('id="engagement-section"') < dashboard_block.index('id="personal-section"')
    assert dashboard_block.index('id="personal-section"') < dashboard_block.index('id="chores-section"')
    assert dashboard_block.index('id="chores-section"') < dashboard_block.index('id="market-section"')


def test_work_history_tab_is_far_right():
    nav_start = INDEX.index('<nav class="tab-nav"')
    nav_end = INDEX.index('</nav>', nav_start)
    nav_block = INDEX[nav_start:nav_end]
    assert nav_block.index('data-tab-target="history"') > nav_block.index('data-tab-target="agent"')
    assert 'tab-spacer' in nav_block


def test_agent_config_blocks_are_side_by_side():
    assert 'agent-grid compact-grid' in INDEX
    assert 'id="rail-section" class="agent-config-section"' in INDEX
    assert 'id="rail-zone" class="stacked-panels compact-grid"' in INDEX
    assert "grid-template-columns: repeat(2, minmax(0, 1fr));" in INDEX
    assert "grid-column: 1 / -1;" in INDEX
