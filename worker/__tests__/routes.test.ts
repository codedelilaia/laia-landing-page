import { describe, expect, it } from 'vitest';
import {
  createInitialDashboardSeed,
  createMessageRunTransaction,
  extractHermesErrorMessage,
  normaliseModulePatch,
  uniqueSessionTitle,
} from '../index';

const seed = createInitialDashboardSeed({
  owner: 'Brian + Hermes',
  headline: 'Laia keeps the board warm while you are away.',
  subheadline: 'Dense editorial view.',
  last_updated: '2026-06-12T08:30:54.686444+00:00',
  modules: [
    { id: 'engagements', type: 'kanban', title: 'Engagement map', status: 'active', summary: 'Current work.', columns: [{ title: 'Active now', cards: [{ title: 'Color Farm / Dharma', body: 'Platform/app setup.' }] }] },
    { id: 'internal_projects', type: 'status', title: 'Internal projects', status: 'active', summary: 'Persistent list.', items: ['TextChest'] },
    { id: 'chores', type: 'status', title: 'Chores', status: 'active', summary: 'Loose operational follow-ups.', items: ['Rerun cloudflared connector with sudo.'] },
    { id: 'market', type: 'chart', title: 'Market pulse', status: 'active', summary: 'VOO latest.', series: [{ date: '2026-06-11', open: 670.1, close: 678.23 }] },
    { id: 'watcher', type: 'cards', title: 'Agent routine', status: 'active', summary: 'Weekday watcher cadence.', cards: [{ title: 'Step 1', body: 'Poll Gmail via read-only OAuth.' }] },
    { id: 'assistant', type: 'cards', title: 'Agent operating rules', status: 'active', summary: 'Rules.', cards: [{ title: 'Email permissions', body: 'Read-only OAuth.' }] },
    { id: 'daily_log', type: 'history', title: 'Daily report log', status: 'active', summary: 'Nightly work log.', entries: [{ date: '2026-06-11', title: 'Dashboard chat and layout hardening', summary: 'Advanced the workspace.', bullets: ['Added async run plan.'] }] },
  ],
});

describe('worker helpers', () => {
  it('keeps chores before market and internal projects on the dashboard seed', () => {
    const ids = seed.modules.map((module) => module.id);
    expect(ids.indexOf('engagements')).toBeLessThan(ids.indexOf('internal_projects'));
    expect(ids.indexOf('internal_projects')).toBeLessThan(ids.indexOf('chores'));
    expect(ids.indexOf('chores')).toBeLessThan(ids.indexOf('market'));
  });

  it('only allows editing chores and internal_projects', () => {
    expect(normaliseModulePatch('chores', { items: ['One'] })).toEqual(['One']);
    expect(() => normaliseModulePatch('market', { items: ['Nope'] })).toThrow(/not editable/i);
  });

  it('creates a durable queued run transaction with placeholder assistant message', () => {
    const tx = createMessageRunTransaction({ sessionId: 'session-1', content: 'Hello Laia' });
    expect(tx.userMessage.role).toBe('user');
    expect(tx.assistantMessage.role).toBe('assistant');
    expect(tx.assistantMessage.content).toMatch(/Working/);
    expect(tx.run.status).toBe('queued');
    expect(tx.run.assistantMessageId).toBe(tx.assistantMessage.id);
  });

  it('unwraps nested Hermes API errors instead of surfacing [object Object]', () => {
    expect(extractHermesErrorMessage({ error: { message: 'Agent loop crashed upstream.' } }, 500)).toBe('Agent loop crashed upstream.');
    expect(extractHermesErrorMessage({ error: { detail: 'Session database unavailable.' } }, 503)).toBe('Session database unavailable.');
  });

  it('creates unique server-side session titles', () => {
    const first = uniqueSessionTitle('Dashboard chat');
    const second = uniqueSessionTitle('Dashboard chat');
    expect(first).not.toBe(second);
    expect(first).toMatch(/^Dashboard chat /);
  });
});
