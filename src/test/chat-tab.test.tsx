import { render, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ChatTab } from '../components/ChatTab';
import type { ChatSessionSummary, ChatThreadState } from '../types/dashboard';

const sessions: ChatSessionSummary[] = [
  {
    id: 'session-1',
    title: 'Dashboard chat 1',
    updatedAt: '2026-06-12T08:30:54.686444+00:00',
    createdAt: '2026-06-12T08:30:54.686444+00:00',
  },
];

function Harness() {
  const [currentSessions, setCurrentSessions] = useState(sessions);
  const [thread, setThread] = useState<ChatThreadState | null>(null);

  return (
    <ChatTab
      sessionsHydrated
      sessions={currentSessions}
      setSessions={setCurrentSessions}
      thread={thread}
      setThread={setThread}
    />
  );
}

describe('ChatTab', () => {
  it('fetches an empty thread only once instead of looping forever', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ messages: [], runs: [] }),
    });

    vi.stubGlobal('fetch', fetchMock);

    render(<Harness />);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith('/api/chat/sessions/session-1/messages');
  });
});
