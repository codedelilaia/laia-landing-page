import { useEffect, useMemo, useState } from 'react';
import {
  applyRunUpdate,
  createChatSession,
  createOptimisticThread,
  fetchChatThread,
  formatApiError,
  submitChatMessage,
} from '../api/chat';
import type { ChatRunStatusResponse, ChatSessionSummary, ChatThreadState } from '../types/dashboard';
import { useChatRunPolling } from '../hooks/useChatRunPolling';

const DEFAULT_CHAT_MODEL = 'gpt-5.4';
const CHAT_MODEL_OPTIONS = [
  { value: 'gpt-5.4', label: 'GPT-5.4' },
  { value: 'gpt-5', label: 'GPT-5' },
  { value: 'o4-mini', label: 'o4-mini' },
  { value: 'claude-sonnet-4', label: 'Claude Sonnet 4' },
];

interface ChatTabProps {
  sessionsHydrated: boolean;
  sessions: ChatSessionSummary[];
  setSessions: (sessions: ChatSessionSummary[]) => void;
  thread: ChatThreadState | null;
  setThread: (thread: ChatThreadState | null) => void;
  initialRunStatuses?: Record<string, ChatRunStatusResponse>;
}

export function ChatTab({ sessionsHydrated, sessions, setSessions, thread, setThread, initialRunStatuses = {} }: ChatTabProps) {
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(thread?.sessionId ?? sessions[0]?.id ?? null);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [selectedModel, setSelectedModel] = useState<string>(sessions[0]?.model ?? DEFAULT_CHAT_MODEL);
  const activeSession = sessions.find((session) => session.id === selectedSessionId) ?? null;
  const threadForActiveSession = thread?.sessionId === selectedSessionId ? thread : null;
  const modelLocked = Boolean(threadForActiveSession && (threadForActiveSession.messages.length > 0 || threadForActiveSession.runs.length > 0));
  const activeRunIds = useMemo(
    () => (thread?.runs ?? []).filter((run) => run.status === 'queued' || run.status === 'running').map((run) => run.id),
    [thread?.runs],
  );

  const runStatuses = useChatRunPolling(activeRunIds, initialRunStatuses);

  useEffect(() => {
    if (selectedSessionId || sessions.length === 0) return;
    setSelectedSessionId(sessions[0].id);
  }, [selectedSessionId, sessions]);

  useEffect(() => {
    if (!activeSession) {
      setSelectedModel(DEFAULT_CHAT_MODEL);
      return;
    }
    setSelectedModel(activeSession.model || DEFAULT_CHAT_MODEL);
  }, [activeSession]);

  useEffect(() => {
    if (!sessionsHydrated || sessions.length !== 0 || selectedSessionId) return;
    createChatSession(undefined, selectedModel)
      .then((session) => {
        setSessions([session]);
        setSelectedSessionId(session.id);
        setSelectedModel(session.model);
        setThread({ sessionId: session.id, messages: [], runs: [] });
      })
      .catch((err) => setError(formatApiError(err)));
  }, [selectedModel, selectedSessionId, sessions, sessionsHydrated, setSessions, setThread]);

  useEffect(() => {
    if (!selectedSessionId) return;
    if (thread?.sessionId === selectedSessionId) {
      return;
    }
    fetchChatThread(selectedSessionId)
      .then((nextThread) => setThread(nextThread))
      .catch((err) => setError(formatApiError(err)));
  }, [selectedSessionId, setThread, thread]);

  useEffect(() => {
    if (!thread) return;
    let nextThread = thread;
    for (const runId of Object.keys(runStatuses)) {
      const status = runStatuses[runId];
      if (status) {
        nextThread = applyRunUpdate(nextThread, status);
      }
    }
    if (nextThread !== thread) {
      setThread(nextThread);
    }
  }, [runStatuses, setThread, thread]);

  const handleModelChange = (nextModel: string) => {
    setSelectedModel(nextModel);
    if (!activeSession || modelLocked) return;
    setSessions(
      sessions.map((session) => (session.id === activeSession.id ? { ...session, model: nextModel } : session)),
    );
  };

  const handleNewSession = async () => {
    setError(null);
    try {
      const session = await createChatSession(undefined, selectedModel);
      setSessions([session, ...sessions.filter((item) => item.id !== session.id)]);
      setSelectedSessionId(session.id);
      setSelectedModel(session.model);
      setThread({ sessionId: session.id, messages: [], runs: [] });
    } catch (err) {
      setError(formatApiError(err));
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedSessionId || !draft.trim()) return;
    setSubmitting(true);
    setError(null);
    const content = draft.trim();
    setDraft('');

    try {
      const response = await submitChatMessage(selectedSessionId, content, selectedModel);
      const optimistic = createOptimisticThread(selectedSessionId, content, response);
      setThread(thread ? { ...thread, messages: [...thread.messages, ...optimistic.messages], runs: [...thread.runs, ...optimistic.runs] } : optimistic);
      const nextSessions = sessions.map((session) =>
        session.id === selectedSessionId ? { ...session, model: selectedModel, updatedAt: new Date().toISOString() } : session,
      );
      setSessions(nextSessions);
    } catch (err) {
      setError(formatApiError(err));
      setDraft(content);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="tab-panel chat-tab chat-tab--full-width" data-testid="chat-tab" id="tab-chat">
      <div className="chat-layout">
        <aside className="chat-sidebar panel">
          <div className="module-header">
            <h2 className="section-title">Conversations</h2>
            <button className="ghost-button" onClick={handleNewSession} type="button">
              New
            </button>
          </div>
          <div className="session-list" id="hermes-session-list">
            {sessions.map((session) => (
              <button
                className={`session-chip ${selectedSessionId === session.id ? 'active' : ''}`.trim()}
                key={session.id}
                onClick={() => setSelectedSessionId(session.id)}
                type="button"
              >
                <span>{session.title}</span>
                <small>{session.model || DEFAULT_CHAT_MODEL}</small>
                <small>{new Date(session.updatedAt).toLocaleString()}</small>
              </button>
            ))}
          </div>
        </aside>
        <div className="chat-main panel">
          <h2 className="section-title">Talk to Hermes</h2>
          <p className="tab-intro">Messages persist immediately, runs continue asynchronously, and progress rehydrates after refresh.</p>
          <div className="chat-toolbar">
            <label className="chat-field">
              <span className="chat-field-label">Model</span>
              <select aria-label="Model" className="chat-select" disabled={modelLocked} onChange={(event) => handleModelChange(event.target.value)} value={selectedModel}>
                {CHAT_MODEL_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <p className="chat-helper-text">
              {modelLocked ? 'Model is locked after the first queued message in a conversation. Start a new chat to switch.' : 'New chats default to GPT-5.4.'}
            </p>
          </div>
          {error ? <div className="inline-error">{error}</div> : null}
          <div className="chat-thread" id="hermes-chat-panel">
            {(thread?.messages ?? []).map((message) => {
              const run = thread?.runs.find((item) => item.id === message.runId);
              return (
                <article className={`chat-bubble chat-bubble--${message.role}`} key={message.id}>
                  <strong>{message.role === 'user' ? 'You' : 'Hermes'}</strong>
                  <p>{message.content}</p>
                  {run && (run.status === 'queued' || run.status === 'running') ? (
                    <small>{run.progressText || 'Still working…'}</small>
                  ) : null}
                  {run?.status === 'failed' ? <small className="inline-error">{run.errorText || 'Run failed.'}</small> : null}
                </article>
              );
            })}
          </div>
          <form className="chat-form" id="hermes-chat-form" onSubmit={handleSubmit}>
            <label className="chat-field">
              <span className="chat-field-label">Message</span>
              <textarea
                aria-label="Message"
                onChange={(event) => setDraft(event.target.value)}
                placeholder="Ask Hermes to keep working in the background."
                rows={4}
                value={draft}
              />
            </label>
            <button className="primary-button" disabled={submitting || !selectedSessionId} type="submit">
              {submitting ? 'Queueing…' : 'Send'}
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}
