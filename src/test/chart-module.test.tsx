import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ChartModule } from '../components/modules/ChartModule';
import type { DashboardModule } from '../types/dashboard';

function makeModule(): DashboardModule {
  return {
    id: 'market',
    type: 'chart',
    title: 'Market pulse',
    status: 'active',
    summary: 'Latest VOO session 2026-06-11: open $670.10, close $678.23.',
    zone: 'dashboard-secondary',
    sortOrder: 50,
    payload: {
      series: [
        { date: '2026-06-02', open: 650.12, close: 652.44 },
        { date: '2026-06-03', open: 652.4, close: 655.1 },
        { date: '2026-06-04', open: 656.03, close: 654.2 },
        { date: '2026-06-05', open: 655.11, close: 660.52 },
        { date: '2026-06-06', open: 661.3, close: 663.9 },
        { date: '2026-06-07', open: 664.21, close: 662.7 },
        { date: '2026-06-08', open: 663.04, close: 668.11 },
        { date: '2026-06-09', open: 683.71, close: 677.7 },
        { date: '2026-06-10', open: 674.32, close: 667.05 },
        { date: '2026-06-11', open: 670.1, close: 678.23 },
      ],
    },
    updatedAt: '2026-06-12T08:30:54.686444+00:00',
  };
}

describe('ChartModule', () => {
  it('restores the richer VOO summary, range controls, and recent price rows', () => {
    render(<ChartModule module={makeModule()} />);

    expect(screen.getByText('Open', { selector: '.metric-label' })).toBeInTheDocument();
    expect(screen.getByText('$670.10')).toBeInTheDocument();
    expect(screen.getByText('Close', { selector: '.metric-label' })).toBeInTheDocument();
    expect(screen.getByText('$678.23')).toBeInTheDocument();
    expect(screen.getByText('Day move')).toBeInTheDocument();
    expect(screen.getByText('+$8.13', { selector: '.metric-value' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '5D' })).toBeInTheDocument();
    expect(screen.getByLabelText('Start date')).toBeInTheDocument();
    expect(screen.getByLabelText('End date')).toBeInTheDocument();

    const recentPrices = screen.getByTestId('recent-prices');
    expect(within(recentPrices).getByText('06-11')).toBeInTheDocument();
    expect(within(recentPrices).getByText('Open: $670.10')).toBeInTheDocument();
    expect(within(recentPrices).getByText('Close: $678.23')).toBeInTheDocument();
    expect(within(recentPrices).getByText('+$8.13')).toBeInTheDocument();
  });

  it('updates dollar and percent gain/loss for the selected period', () => {
    render(<ChartModule module={makeModule()} />);

    fireEvent.click(screen.getByRole('button', { name: '5D' }));

    expect(screen.getByText('Period return')).toBeInTheDocument();
    expect(screen.getByText('+$14.02', { selector: '.metric-value' })).toBeInTheDocument();
    expect(screen.getByText('+2.11%', { selector: '.metric-value' })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Start date'), { target: { value: '2026-06-09' } });
    fireEvent.change(screen.getByLabelText('End date'), { target: { value: '2026-06-10' } });

    expect(screen.getByText('-$16.66', { selector: '.metric-value' })).toBeInTheDocument();
    expect(screen.getByText('-2.44%', { selector: '.metric-value' })).toBeInTheDocument();
  });
});
