import { normaliseDashboardState } from '../api/dashboard';
import { describe, expect, it } from 'vitest';

describe('normaliseDashboardState', () => {
  it('preserves top-level chart series from dashboard.json snapshots', () => {
    const dashboard = normaliseDashboardState({
      owner: 'Brian + Hermes',
      headline: 'Laia keeps the board warm while you are away.',
      subheadline: 'Dense editorial view.',
      last_updated: '2026-06-12T08:30:54.686444+00:00',
      modules: [
        {
          id: 'market',
          type: 'chart',
          title: 'Market pulse',
          status: 'active',
          summary: 'VOO latest.',
          series: [{ date: '2026-06-11', open: 670.1, close: 678.23 }],
        },
      ],
    });

    expect((dashboard.modules[0].payload as any).series).toEqual([{ date: '2026-06-11', open: 670.1, close: 678.23 }]);
  });
});
