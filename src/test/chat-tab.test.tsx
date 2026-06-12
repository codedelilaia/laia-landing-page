import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ChatTab } from '../components/ChatTab';
import type { ChatSessionSummary, ChatThreadState, CreateChatMessageResponse } from '../types/dashboard';
import * as chatApi from '../api/chat';

vi.mock('../api/chat', async () => {
  const actual = await vi.importActual<typeof import('../api/chat')>('../api/chat');
  return {
    ...actual,
    createChatSession: vi.fn(),
    fetchChatThread: vi.fn(),
    submitChatMessage: vi.fn(),
  };
});

const createChatSessionMock = vi.mocked(chatApi.createChatSession);
const fetchChatThreadMock = vi.mocked(chatApi.fetchChatThread);
const submitChatMessageMock = vi.mocked(chatApi.submitChatMessage);

const sessions: ChatSessionSummary[] = [
  {
    id: 'session-1',
    title: 'Dashboard chat 1',
    model: 'gpt-5.4',
    updatedAt: '2026-06-12T08:30:54.686444+00:00',
    createdAt: '2026-06-12T08:30:54.686444+00:00',
  },
];

function Harness({ initialSessions = sessions }: { initialSessions?: ChatSessionSummary[] }) {
  const [currentSessions, setCurrentSessions] = useState(initialSessions);
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
  beforeEach(() => {
    vi.clearAllMocks();
    createChatSessionMock.mockResolvedValue({
      id: 'session-new',
      title: 'Dashboard chat new',
      model: 'claude-sonnet-4',
      updatedAt: '2026-06-12T09:30:54.686444+00:00',
      createdAt: '2026-06-12T09:30:54.686444+00:00',
    });
    fetchChatThreadMock.mockResolvedValue({ sessionId: 'session-1', messages: [], runs: [] });
    submitChatMessageMock.mockResolvedValue({
      sessionId: 'session-1',
      inputMessageId: 'msg-user',
      assistantMessageId: 'msg-assistant',
      runId: 'run-1',
      status: 'queued',
    } satisfies CreateChatMessageResponse);
  });

  it('fetches an empty thread only once instead of looping forever', async () => {
    render(<Harness />);

    await waitFor(() => expect(fetchChatThreadMock).toHaveBeenCalledTimes(1));
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(fetchChatThreadMock).toHaveBeenCalledTimes(1);
    expect(fetchChatThreadMock).toHaveBeenCalledWith('session-1');
  });

  it('defaults the model selector to gpt-5.4 and uses the selected model for new chats', async () => {
    render(<Harness />);

    const modelSelect = await screen.findByLabelText('Model');
    expect(modelSelect).toHaveValue('gpt-5.4');

    fireEvent.change(modelSelect, { target: { value: 'claude-sonnet-4' } });
    fireEvent.click(screen.getByRole('button', { name: 'New' }));

    await waitFor(() => expect(createChatSessionMock).toHaveBeenCalledWith(undefined, 'claude-sonnet-4'));
  });

  it('sends the active session model with queued messages', async () => {
    render(<Harness />);

    fireEvent.change(await screen.findByLabelText('Message'), { target: { value: 'Please help.' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Send' }).closest('form')!);

    await waitFor(() => expect(submitChatMessageMock).toHaveBeenCalledWith('session-1', 'Please help.', 'gpt-5.4'));
  });
});
