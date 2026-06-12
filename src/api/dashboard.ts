import type { DashboardModule, DashboardState } from '../types/dashboard';

function normaliseModule(input: any): DashboardModule {
  return {
    id: String(input.id),
    type: input.type,
    title: String(input.title),
    status: String(input.status ?? 'idle'),
    summary: input.summary ? String(input.summary) : '',
    zone: input.zone,
    sortOrder: Number(input.sortOrder ?? input.sort_order ?? 0),
    payload: input.payload ?? JSON.parse(input.payload_json ?? '{}'),
    updatedAt: String(input.updatedAt ?? input.updated_at ?? new Date().toISOString()),
  };
}

export function normaliseDashboardState(input: any): DashboardState {
  return {
    owner: String(input.owner ?? 'Brian + Hermes'),
    headline: String(input.headline ?? ''),
    subheadline: String(input.subheadline ?? ''),
    lastUpdated: String(input.lastUpdated ?? input.last_updated ?? new Date().toISOString()),
    modules: Array.isArray(input.modules) ? input.modules.map(normaliseModule) : [],
  };
}

export async function fetchDashboardState(): Promise<DashboardState> {
  const response = await fetch('/api/dashboard');
  if (!response.ok) {
    throw new Error(`Dashboard HTTP ${response.status}`);
  }
  const data: any = await response.json();
  return normaliseDashboardState(data);
}

export async function updateEditableModule(moduleId: string, items: string[]): Promise<DashboardState> {
  const response = await fetch(`/api/modules/${encodeURIComponent(moduleId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items }),
  });

  const data: any = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || data.message || 'Module update failed.');
  }

  return normaliseDashboardState(data.dashboard ?? data);
}
