import type { DashboardModule, DashboardState } from '../types/dashboard';

const FALLBACK_PLACEMENT: Record<string, { zone: DashboardModule['zone']; sortOrder: number }> = {
  email: { zone: 'dashboard-secondary', sortOrder: 10 },
  engagements: { zone: 'dashboard-primary', sortOrder: 20 },
  internal_projects: { zone: 'dashboard-primary', sortOrder: 30 },
  chores: { zone: 'dashboard-secondary', sortOrder: 40 },
  market: { zone: 'dashboard-secondary', sortOrder: 50 },
  watcher: { zone: 'agent-left', sortOrder: 60 },
  assistant: { zone: 'agent-right', sortOrder: 70 },
  daily_log: { zone: 'history', sortOrder: 80 },
};

function derivePayload(input: any) {
  if (input.payload) return input.payload;
  if (input.payload_json) return JSON.parse(input.payload_json);
  if (input.type === 'status') return { items: input.items ?? [] };
  if (input.type === 'kanban') return { columns: input.columns ?? [] };
  if (input.type === 'chart') return { series: input.series ?? [] };
  if (input.type === 'history') return { entries: input.entries ?? [] };
  return { cards: input.cards ?? [] };
}

function normaliseModule(input: any): DashboardModule {
  const id = String(input.id);
  const fallback = FALLBACK_PLACEMENT[id] ?? { zone: 'dashboard-secondary', sortOrder: 999 };
  return {
    id,
    type: input.type,
    title: String(input.title),
    status: String(input.status ?? 'idle'),
    summary: input.summary ? String(input.summary) : '',
    zone: input.zone ?? fallback.zone,
    sortOrder: Number(input.sortOrder ?? input.sort_order ?? fallback.sortOrder),
    payload: derivePayload(input),
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
