import { fireEvent, render, screen, within } from '@testing-library/react';
import { App } from '../App';
import type { DashboardModule, DashboardState, ChatSessionSummary, ChatThreadState, ChatRunStatusResponse } from '../types/dashboard';

const modules: DashboardModule[] = [
  {
    id: 'engagements',
    type: 'kanban',
    title: 'Engagement map',
    status: 'active',
    summary: 'Current work.',
    zone: 'dashboard-primary',
    sortOrder: 20,
    payload: {
      columns: [{ title: 'Active now', cards: [{ title: 'Color Farm / Dharma', body: 'Platform/app setup.' }] }],
    },
    updatedAt: '2026-06-12T08:30:54.686444+00:00',
  },
  {
    id: 'internal_projects',
    type: 'status',
    title: 'Internal projects',
    status: 'active',
    summary: 'Persistent list.',
    zone: 'dashboard-primary',
    sortOrder: 30,
    payload: { items: ['TextChest'] },
    updatedAt: '2026-06-12T08:30:54.686444+00:00',
  },
  {
    id: 'chores',
    type: 'status',
    title: 'Chores',
    status: 'active',
    zone: 'dashboard-secondary',
    sortOrder: 40,
    summary: 'Loose operational follow-ups.',
    payload: { items: ['Rerun cloudflared connector with sudo.'] },
    updatedAt: '2026-06-12T08:30:54.686444+00:00',
  },
  {
    id: 'market',
    type: 'chart',
    title: 'Market pulse',
    status: 'active',
    zone: 'dashboard-secondary',
    sortOrder: 50,
    summary: 'VOO latest.',
    payload: { series: [{ date: '2026-06-11', open: 670.1, close: 678.23 }] },
    updatedAt: '2026-06-12T08:30:54.686444+00:00',
  },
  {
    id: 'watcher',
    type: 'cards',
    title: 'Agent routine',
    status: 'active',
    zone: 'agent-left',
    sortOrder: 60,
    summary: 'Weekday watcher cadence.',
    payload: { cards: [{ title: 'Step 1', body: 'Poll Gmail via read-only OAuth.' }] },
    updatedAt: '2026-06-12T08:30:54.686444+00:00',
  },
  {
    id: 'assistant',
    type: 'cards',
    title: 'Agent operating rules',
    status: 'active',
    zone: 'agent-right',
    sortOrder: 70,
    summary: 'Rules.',
    payload: { cards: [{ title: 'Email permissions', body: 'Read-only OAuth.' }] },
    updatedAt: '2026-06-12T08:30:54.686444+00:00',
  },
  {
    id: 'daily_log',
    type: 'history',
    title: 'Daily report log',
    status: 'active',
    zone: 'history',
    sortOrder: 80,
    summary: 'Nightly work log.',
    payload: { entries: [{ date: '2026-06-11', title: 'Dashboard chat and layout hardening', summary: 'Advanced the workspace.', bullets: ['Added async run plan.'] }] },
    updatedAt: '2026-06-12T08:30:54.686444+00:00',
  },
];

const dashboard: DashboardState = {
  owner: 'Brian + Hermes',
  headline: 'Laia keeps the board warm while you are away.',
  subheadline: 'Dense editorial view.',
  lastUpdated: '2026-06-12T08:30:54.686444+00:00',
  modules,
};

const sessions: ChatSessionSummary[] = [{ id: 'session-1', title: 'Dashboard chat 1', model: 'gpt-5.4', updatedAt: '2026-06-12T08:30:54.686444+00:00', createdAt: '2026-06-12T08:30:54.686444+00:00' }];
const thread: ChatThreadState = {
  sessionId: 'session-1',
  messages: [
    { id: 'm1', sessionId: 'session-1', role: 'user', content: 'Hello', createdAt: '2026-06-12T08:30:54.686444+00:00' },
    { id: 'm2', sessionId: 'session-1', role: 'assistant', content: 'Working…', runId: 'run-1', createdAt: '2026-06-12T08:30:55.686444+00:00' },
  ],
  runs: [{ id: 'run-1', sessionId: 'session-1', status: 'succeeded', inputMessageId: 'm1', assistantMessageId: 'm2', progressText: 'Completed.', createdAt: '2026-06-12T08:30:55.686444+00:00', updatedAt: '2026-06-12T08:30:55.686444+00:00', finishedAt: '2026-06-12T08:31:55.686444+00:00' }],
};

const activeRun: ChatRunStatusResponse = {
  run: { id: 'run-1', sessionId: 'session-1', status: 'succeeded', inputMessageId: 'm1', assistantMessageId: 'm2', progressText: 'Completed.', createdAt: '2026-06-12T08:30:55.686444+00:00', updatedAt: '2026-06-12T08:30:55.686444+00:00', finishedAt: '2026-06-12T08:31:55.686444+00:00' },
  message: thread.messages[1],
};

function renderApp() {
  return render(
    <App
      initialDashboard={dashboard}
      initialSessions={sessions}
      initialThread={thread}
      initialRunStatuses={{ 'run-1': activeRun }}
    />,
  );
}

describe('Laia React layout', () => {
  it('keeps chores above market and internal projects below engagement map on the dashboard tab', () => {
    renderApp();

    const dashboardTab = screen.getByRole('button', { name: 'Dashboard' });
    dashboardTab.click();

    const sections = screen.getAllByTestId(/module-/).map((node) => node.getAttribute('data-module-id'));
    expect(sections.indexOf('engagements')).toBeLessThan(sections.indexOf('internal_projects'));
    const secondarySections = within(screen.getByTestId('dashboard-secondary-column'))
      .getAllByTestId(/module-/)
      .map((node) => node.getAttribute('data-module-id'));
    expect(secondarySections).toEqual(['chores', 'market']);
  });

  it('renders a full-width chat workspace and keeps work history visually separated at the far right', () => {
    renderApp();

    const navTabs = within(screen.getByRole('navigation', { name: 'Laia sections' }))
      .getAllByRole('button')
      .map((button) => button.textContent);
    expect(navTabs.slice(0, 3)).toEqual(['Dashboard', 'Chat', 'Agent config']);
    expect(navTabs.at(-1)).toBe('Work history');
    expect(screen.getByTestId('tab-spacer')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Chat' }));
    expect(screen.getByTestId('chat-tab')).toHaveClass('chat-tab--full-width');
  });

  it('keeps agent config limited to routines and rules', () => {
    renderApp();
    fireEvent.click(screen.getByRole('button', { name: 'Agent config' }));

    expect(screen.getByText('Agent routine')).toBeInTheDocument();
    expect(screen.getByText('Agent operating rules')).toBeInTheDocument();
    expect(screen.queryByText('Internal projects')).not.toBeInTheDocument();
  });
});
