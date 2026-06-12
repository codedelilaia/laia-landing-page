import { describe, expect, it, vi } from 'vitest';
import { createChatSession, submitChatMessage } from '../api/chat';

function makeJsonResponse(body: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    json: async () => body,
  } as Response;
}

describe('chat api', () => {
  it('creates sessions with the requested model and normalises it from the response', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      makeJsonResponse({
        id: 'session-1',
        title: 'Dashboard chat 1',
        model: 'gpt-5.4',
        createdAt: '2026-06-12T08:30:54.686444+00:00',
        updatedAt: '2026-06-12T08:30:54.686444+00:00',
      }, true, 201),
    );
    vi.stubGlobal('fetch', fetchMock);

    const session = await createChatSession(undefined, 'gpt-5.4');

    expect(fetchMock).toHaveBeenCalledWith('/api/chat/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: undefined, model: 'gpt-5.4' }),
    });
    expect(session.model).toBe('gpt-5.4');
  });

  it('sends the chosen model with chat messages', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      makeJsonResponse({
        sessionId: 'session-1',
        inputMessageId: 'msg-user',
        assistantMessageId: 'msg-assistant',
        runId: 'run-1',
        status: 'queued',
      }, true, 202),
    );
    vi.stubGlobal('fetch', fetchMock);

    await submitChatMessage('session-1', 'Hello', 'claude-sonnet-4');

    expect(fetchMock).toHaveBeenCalledWith('/api/chat/sessions/session-1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'Hello', model: 'claude-sonnet-4' }),
    });
  });
});
