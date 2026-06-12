#!/usr/bin/env python3
import json
from pathlib import Path

ROOT = Path('/Users/computer/laia-landing-page')
DASHBOARD = ROOT / 'dashboard.json'
SEED = ROOT / 'worker' / 'db' / 'seed.sql'

ZONE_MAP = {
    'email': ('dashboard-secondary', 10),
    'engagements': ('dashboard-primary', 20),
    'internal_projects': ('dashboard-primary', 30),
    'chores': ('dashboard-primary', 40),
    'market': ('dashboard-secondary', 50),
    'watcher': ('agent-left', 60),
    'assistant': ('agent-right', 70),
    'daily_log': ('history', 80),
}


def sql_quote(value: str) -> str:
    return "'" + value.replace("'", "''") + "'"


def payload_for(module: dict) -> dict:
    if module['type'] == 'status':
        return {'items': module.get('items', [])}
    if module['type'] == 'kanban':
        return {'columns': module.get('columns', [])}
    if module['type'] == 'chart':
        return {'series': module.get('series', [])}
    if module['type'] == 'history':
        return {'entries': module.get('entries', [])}
    return {'cards': module.get('cards', [])}


def main() -> None:
    dashboard = json.loads(DASHBOARD.read_text())
    updated_at = dashboard.get('last_updated')
    statements = ['DELETE FROM dashboard_modules;']
    for module in dashboard.get('modules', []):
        zone, sort_order = ZONE_MAP.get(module['id'], ('dashboard-secondary', 999))
        payload_json = json.dumps(payload_for(module), separators=(',', ':'))
        statements.append(
            'INSERT INTO dashboard_modules (id, type, title, status, summary, sort_order, zone, payload_json, updated_at) VALUES ({id}, {type}, {title}, {status}, {summary}, {sort_order}, {zone}, {payload}, {updated_at});'.format(
                id=sql_quote(module['id']),
                type=sql_quote(module['type']),
                title=sql_quote(module['title']),
                status=sql_quote(module.get('status', 'idle')),
                summary=sql_quote(module.get('summary', '')),
                sort_order=sort_order,
                zone=sql_quote(zone),
                payload=sql_quote(payload_json),
                updated_at=sql_quote(updated_at),
            )
        )
    SEED.write_text('\n'.join(statements) + '\n')
    print(SEED)


if __name__ == '__main__':
    main()
