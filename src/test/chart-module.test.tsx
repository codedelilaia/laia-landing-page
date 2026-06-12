import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ChartModule } from '../components/modules/ChartModule';
import type { DashboardModule } from '../types/dashboard';

describe('ChartModule', () => {
  it('restores the VOO open/close summary, legend, and recent price rows', () => {
    const module: DashboardModule = {
      id: 'market',
      type: 'chart',
      title: 'Market pulse',
      status: 'active',
      summary: 'Latest VOO session 2026-06-11: open $670.10, close $678.23.',
      zone: 'dashboard-secondary',
      sortOrder: 50,
      payload: {
        series: [
          { date: '2026-06-09', open: 683.71, close: 677.7 },
          { date: '2026-06-10', open: 674.32, close: 667.05 },
          { date: '2026-06-11', open: 670.1, close: 678.23 },
        ],
      },
      updatedAt: '2026-06-12T08:30:54.686444+00:00',
    };

    render(<ChartModule module={module} />);

    expect(screen.getByText('Open', { selector: '.metric-label' })).toBeInTheDocument();
    expect(screen.getByText('$670.10')).toBeInTheDocument();
    expect(screen.getByText('Close', { selector: '.metric-label' })).toBeInTheDocument();
    expect(screen.getByText('$678.23')).toBeInTheDocument();
    expect(screen.getByText('Day move')).toBeInTheDocument();
    expect(screen.getByText('+$8.13', { selector: '.metric-value' })).toBeInTheDocument();
    expect(screen.getByText('Close minus open')).toBeInTheDocument();
    expect(screen.getByText('Open', { selector: '.legend span' })).toBeInTheDocument();
    expect(screen.getByText('Close', { selector: '.legend span' })).toBeInTheDocument();

    const recentPrices = screen.getByTestId('recent-prices');
    expect(within(recentPrices).getByText('06-11')).toBeInTheDocument();
    expect(within(recentPrices).getByText('Open: $670.10')).toBeInTheDocument();
    expect(within(recentPrices).getByText('Close: $678.23')).toBeInTheDocument();
    expect(within(recentPrices).getByText('+$8.13')).toBeInTheDocument();
  });
});
