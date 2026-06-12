import { applyRunUpdate, formatApiError } from '../api/chat';
import type { ChatRun, ChatRunStatusResponse, ChatThreadState } from '../types/dashboard';

const baseThread: ChatThreadState = {
  sessionId: 'session-1',
  messages: [
    { id: 'm1', sessionId: 'session-1', role: 'user', content: 'Hello', createdAt: '2026-06-12T08:30:54.686444+00:00' },
    { id: 'm2', sessionId: 'session-1', role: 'assistant', content: 'Working…', runId: 'run-1', createdAt: '2026-06-12T08:30:55.686444+00:00' },
  ],
  runs: [
    { id: 'run-1', sessionId: 'session-1', status: 'queued', inputMessageId: 'm1', assistantMessageId: 'm2', progressText: 'Queued…', createdAt: '2026-06-12T08:30:55.686444+00:00', updatedAt: '2026-06-12T08:30:55.686444+00:00' },
  ],
};

function status(run: Partial<ChatRun>, overrides: Partial<ChatRunStatusResponse> = {}): ChatRunStatusResponse {
  return {
    run: {
      id: 'run-1',
      sessionId: 'session-1',
      status: 'queued',
      inputMessageId: 'm1',
      assistantMessageId: 'm2',
      createdAt: '2026-06-12T08:30:55.686444+00:00',
      updatedAt: '2026-06-12T08:30:55.686444+00:00',
      ...run,
    },
    message: { id: 'm2', sessionId: 'session-1', role: 'assistant', content: 'Working…', runId: 'run-1', createdAt: '2026-06-12T08:30:55.686444+00:00' },
    ...overrides,
  };
}

describe('chat run state helpers', () => {
  it('rehydrates queued and running progress without dropping the assistant placeholder', () => {
    const updated = applyRunUpdate(baseThread, status({ status: 'running', progressText: 'Still working…' }));
    expect(updated.runs[0].status).toBe('running');
    expect(updated.runs[0].progressText).toBe('Still working…');
    expect(updated.messages.find((message) => message.id === 'm2')?.content).toBe('Working…');
  });

  it('replaces the placeholder with final assistant content when the run succeeds', () => {
    const updated = applyRunUpdate(
      baseThread,
      status(
        { status: 'succeeded', progressText: 'Done', finishedAt: '2026-06-12T08:31:55.686444+00:00' },
        { message: { id: 'm2', sessionId: 'session-1', role: 'assistant', content: 'Done.', runId: 'run-1', createdAt: '2026-06-12T08:30:55.686444+00:00' } },
      ),
    );

    expect(updated.runs[0].status).toBe('succeeded');
    expect(updated.messages.find((message) => message.id === 'm2')?.content).toBe('Done.');
  });

  it('formats object-shaped errors without rendering [Object object]', () => {
    expect(formatApiError({ error: { detail: 'Hermes backend not connected.' } })).toBe('Hermes backend not connected.');
    expect(formatApiError({})).not.toBe('[Object object]');
  });
});
