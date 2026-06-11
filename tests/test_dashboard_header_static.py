from pathlib import Path

INDEX = (Path(__file__).resolve().parents[1] / "index.html").read_text()


def masthead_block():
    start = INDEX.index('<section class="masthead">')
    end = INDEX.index('</section>', start)
    return INDEX[start:end]


def test_header_is_slim_and_keeps_signout_only_action():
    block = masthead_block()
    assert 'class="mast-stats"' not in block
    assert 'Cloudflare protected' not in block
    assert 'Owner' not in block
    assert 'Updated' not in block
    assert 'Inbox' not in block
    assert 'Internal focus' not in block
    assert 'Sign out' in block


def test_header_sync_no_longer_updates_removed_summary_cards():
    assert "getElementById('owner')" not in INDEX
    assert "getElementById('updated')" not in INDEX
    assert "getElementById('header-email')" not in INDEX
    assert "getElementById('header-projects')" not in INDEX
