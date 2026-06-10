#!/usr/bin/env python3
import argparse
import base64
import datetime as dt
import json
import shutil
import subprocess
import tempfile
import urllib.request
from pathlib import Path

ROOT = Path('/Users/computer/laia-landing-page')
DASHBOARD = ROOT / 'dashboard.json'
PAT_PATH = Path.home() / '.hermes' / 'secrets' / 'github_pat_codedelilaia.txt'
YAHOO_URL = 'https://query1.finance.yahoo.com/v8/finance/chart/VOO?range=1mo&interval=1d'
MAX_DAILY_LOG_ENTRIES = 60

ENGAGEMENT_COLUMNS = [
    {
        'title': 'Active now',
        'cards': [
            {
                'title': 'Color Farm / Dharma',
                'body': 'Platform/app setup, access coordination, recordings, and implementation motion.',
            },
            {
                'title': 'ZenHammer',
                'body': 'Payment workflow work around NMI / SwipeSum, onboarding, and KYC concerns.',
            },
            {
                'title': 'Monostate',
                'body': 'Recurring planning / sprint-style engagement and currently active work.',
            },
        ],
    },
    {
        'title': 'Waiting on others',
        'cards': [
            {
                'title': 'Uanaknow / Sagastume',
                'body': 'Waiting on the next Uanaknow job, now focused on Sagastume.',
            },
            {
                'title': 'Yurbban',
                'body': 'Pending follow-up on their side; not waiting on Brian to move it right now.',
            },
        ],
    },
]

WATCHER_ACTIONS = [
    'Poll Gmail via read-only OAuth; do not send, label, archive, or modify anything.',
    'Compare recent mail against Hermes last-seen state, not unread status.',
    'Filter obvious noise and spam-like patterns before surfacing anything.',
    'Separate likely replies from FYI mail and draft a useful suggested response.',
    'Notify only when something relevant exists.',
    'Refresh this dashboard so the website stays aligned with the latest watcher state.',
]

DEFAULT_CHORES = [
    'Laundry / linens reset',
    'Kitchen reset + dishwasher',
    'Trash / recycling check',
    'Water plants',
]

DEFAULT_INTERNAL_PROJECTS = [
    'Secrets',
    'TextChest',
]


def load_existing_dashboard():
    if not PAT_PATH.exists():
        raise SystemExit(f'Missing GitHub PAT at {PAT_PATH}')
    token = PAT_PATH.read_text().strip()
    req = urllib.request.Request(
        'https://api.github.com/repos/brianh20/laia-personal-assistant/contents/dashboard.json?ref=main',
        headers={
            'Authorization': f'Bearer {token}',
            'Accept': 'application/vnd.github+json',
            'User-Agent': 'laia-dashboard-updater',
        },
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        payload = json.loads(resp.read().decode())
    content = base64.b64decode(payload['content'])
    return json.loads(content.decode())


def find_module(data, module_id):
    for mod in data.get('modules', []):
        if mod.get('id') == module_id:
            return mod
    return {}


def fetch_voo_history():
    req = urllib.request.Request(YAHOO_URL, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req, timeout=30) as resp:
        payload = json.loads(resp.read().decode())
    result = payload['chart']['result'][0]
    stamps = result.get('timestamp', [])
    quote = result['indicators']['quote'][0]
    opens = quote.get('open', [])
    closes = quote.get('close', [])
    rows = []
    for ts, opn, cls in zip(stamps, opens, closes):
        if opn is None or cls is None:
            continue
        rows.append({
            'date': dt.datetime.utcfromtimestamp(ts).strftime('%Y-%m-%d'),
            'open': round(float(opn), 2),
            'close': round(float(cls), 2),
        })
    latest = rows[-1] if rows else None
    return rows[-20:], latest


def normalize_daily_log_entry(raw_entry):
    entry = json.loads(raw_entry)
    if not isinstance(entry, dict):
        raise SystemExit('daily log entry must be a JSON object')

    date = str(entry.get('date') or dt.date.today().isoformat())
    title = str(entry.get('title') or f'Daily report · {date}').strip()
    summary = str(entry.get('summary') or '').strip()
    bullets = [str(item).strip() for item in (entry.get('bullets') or []) if str(item).strip()]

    normalized = {
        'date': date,
        'title': title,
        'summary': summary,
        'bullets': bullets,
    }
    if entry.get('link'):
        normalized['link'] = str(entry['link']).strip()
    return normalized


def merge_daily_log(existing_entries, raw_entry):
    entries = [entry for entry in (existing_entries or []) if isinstance(entry, dict)]
    if not raw_entry:
        return entries[:MAX_DAILY_LOG_ENTRIES]

    new_entry = normalize_daily_log_entry(raw_entry)
    filtered = [entry for entry in entries if entry.get('date') != new_entry['date']]
    return [new_entry, *filtered][:MAX_DAILY_LOG_ENTRIES]


def build_dashboard(args):
    existing = load_existing_dashboard()
    history, latest = fetch_voo_history()

    existing_email = find_module(existing, 'email')
    existing_chores = find_module(existing, 'home_chores')
    existing_projects = find_module(existing, 'internal_projects')
    existing_daily_log = find_module(existing, 'daily_log')

    email_status = args.email_status if args.email_status is not None else existing_email.get('status', 'idle')
    email_summary = args.email_summary if args.email_summary is not None else existing_email.get(
        'summary', 'No new non-spam email at the latest check.'
    )
    email_items = json.loads(args.email_items) if args.email_items is not None else existing_email.get('items', [])

    chore_items = existing_chores.get('items') or DEFAULT_CHORES
    project_items = existing_projects.get('items') or DEFAULT_INTERNAL_PROJECTS
    daily_log_entries = merge_daily_log(existing_daily_log.get('entries') or [], args.daily_log_entry)
    daily_log_summary = (
        f"Nightly work log. {len(daily_log_entries)} day{'s' if len(daily_log_entries) != 1 else ''} saved; newest first."
        if daily_log_entries
        else 'Nightly work log. No summaries published yet.'
    )

    return {
        'owner': 'Brian + Hermes',
        'headline': 'Laia keeps the board warm while you are away.',
        'subheadline': 'Dense editorial view of inbox, engagements, routines, home chores, and live operating context.',
        'last_updated': dt.datetime.now(dt.timezone.utc).isoformat(),
        'modules': [
            {
                'id': 'email',
                'type': 'status',
                'title': 'Inbox needing attention',
                'status': email_status,
                'summary': email_summary,
                'items': email_items,
            },
            {
                'id': 'engagements',
                'type': 'kanban',
                'title': 'Engagement map',
                'status': 'active',
                'summary': 'Current company work arranged by motion, follow-up, and blockers.',
                'columns': ENGAGEMENT_COLUMNS,
            },
            {
                'id': 'home_chores',
                'type': 'status',
                'title': 'Home chores',
                'status': 'active',
                'summary': 'Persistent household list; can be updated from chat.',
                'items': chore_items,
            },
            {
                'id': 'internal_projects',
                'type': 'status',
                'title': 'Internal projects',
                'status': 'active',
                'summary': 'Persistent list of internal products we are building together.',
                'items': project_items,
            },
            {
                'id': 'daily_log',
                'type': 'history',
                'title': 'Daily report log',
                'status': 'active' if daily_log_entries else 'idle',
                'summary': daily_log_summary,
                'entries': daily_log_entries,
            },
            {
                'id': 'watcher',
                'type': 'cards',
                'title': 'Agent routine',
                'status': 'active',
                'summary': 'Weekday watcher cadence at :00 and :30 from 09:00 through 18:00.',
                'cards': [{'title': f'Step {i+1}', 'body': text} for i, text in enumerate(WATCHER_ACTIONS)],
            },
            {
                'id': 'market',
                'type': 'chart',
                'title': 'Market pulse',
                'status': 'active',
                'summary': (
                    f"Latest VOO session {latest['date']}: open ${latest['open']:.2f}, close ${latest['close']:.2f}."
                    if latest else 'VOO market data unavailable.'
                ),
                'series': history,
            },
            {
                'id': 'assistant',
                'type': 'cards',
                'title': 'Agent operating rules',
                'status': 'active',
                'summary': 'What the agent can do, what it will not do, and how the dashboard stays in sync.',
                'cards': [
                    {'title': 'Email permissions', 'body': 'Gmail access is read-only OAuth.'},
                    {'title': 'Automation safety', 'body': 'No email auto-replies or mailbox mutations are enabled.'},
                    {'title': 'Sync policy', 'body': 'Remote repo state is authoritative; dashboard history is appended nightly.'},
                ],
            },
        ],
    }


def publish_dashboard():
    if not PAT_PATH.exists():
        raise SystemExit(f'Missing GitHub PAT at {PAT_PATH}')
    token = PAT_PATH.read_text().strip()
    remote = f'https://{token}@github.com/brianh20/laia-personal-assistant.git'

    with tempfile.TemporaryDirectory(prefix='laia-dashboard-publish-') as tmp:
        tmp_path = Path(tmp)
        subprocess.run(['git', 'clone', '--depth', '1', remote, str(tmp_path)], check=True, stdout=subprocess.DEVNULL)
        shutil.copy2(DASHBOARD, tmp_path / 'dashboard.json')
        subprocess.run(['git', 'add', 'dashboard.json'], cwd=tmp_path, check=True)
        diff = subprocess.run(['git', 'diff', '--cached', '--quiet'], cwd=tmp_path)
        if diff.returncode == 0:
            return False
        subprocess.run(['git', 'commit', '-m', 'chore: update dashboard'], cwd=tmp_path, check=True, stdout=subprocess.DEVNULL)
        subprocess.run(['git', 'push', 'origin', 'main'], cwd=tmp_path, check=True, stdout=subprocess.DEVNULL)
    return True


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--email-status', default=None)
    p.add_argument('--email-summary', default=None)
    p.add_argument('--email-items', default=None)
    p.add_argument('--daily-log-entry', default=None)
    args = p.parse_args()
    dashboard = build_dashboard(args)
    DASHBOARD.write_text(json.dumps(dashboard, indent=2) + '\n')
    changed = publish_dashboard()
    print(json.dumps({'dashboard': str(DASHBOARD), 'pushed': changed, 'updated': dashboard['last_updated']}))


if __name__ == '__main__':
    main()
