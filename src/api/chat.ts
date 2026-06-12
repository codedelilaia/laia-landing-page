import type {
  ChatMessage,
  ChatRun,
  ChatRunStatusResponse,
  ChatSessionSummary,
  ChatThreadState,
  CreateChatMessageResponse,
} from '../types/dashboard';

function normaliseMessage(input: any): ChatMessage {
  return {
    id: String(input.id),
    sessionId: String(input.sessionId ?? input.session_id),
    role: input.role,
    content: String(input.content ?? ''),
    runId: input.runId ?? input.run_id ?? null,
    createdAt: String(input.createdAt ?? input.created_at ?? new Date().toISOString()),
    metadata: input.metadata ?? input.metadata_json ?? null,
  };
}

function normaliseRun(input: any): ChatRun {
  return {
    id: String(input.id),
    sessionId: String(input.sessionId ?? input.session_id),
    status: input.status,
    inputMessageId: String(input.inputMessageId ?? input.input_message_id),
    assistantMessageId: input.assistantMessageId ?? input.assistant_message_id ?? null,
    progressText: input.progressText ?? input.progress_text ?? null,
    errorText: input.errorText ?? input.error_text ?? null,
    createdAt: String(input.createdAt ?? input.created_at ?? new Date().toISOString()),
    startedAt: input.startedAt ?? input.started_at ?? null,
    finishedAt: input.finishedAt ?? input.finished_at ?? null,
    updatedAt: String(input.updatedAt ?? input.updated_at ?? new Date().toISOString()),
  };
}

export function formatApiError(value: unknown, fallback = 'Request failed.'): string {
  if (!value) return fallback;
  if (typeof value === 'string') return value;
  if (value instanceof Error) return value.message || fallback;
  if (typeof value === 'object') {
    const nested = (value as any).error ?? (value as any).message ?? (value as any).detail ?? (value as any).raw;
    if (nested && nested !== value) return formatApiError(nested, fallback);
    try {
      return JSON.stringify(value);
    } catch {
      return fallback;
    }
  }
  return String(value);
}

export function applyRunUpdate(thread: ChatThreadState, update: ChatRunStatusResponse): ChatThreadState {
  const run = normaliseRun(update.run);
  const message = update.message ? normaliseMessage(update.message) : undefined;

  const existingRun = thread.runs.find((item) => item.id === run.id);
  const existingMessage = message ? thread.messages.find((item) => item.id === message.id) : undefined;
  const runChanged = JSON.stringify(existingRun ?? null) !== JSON.stringify(run);
  const messageChanged = message ? JSON.stringify(existingMessage ?? null) !== JSON.stringify(message) : false;

  if (!runChanged && !messageChanged && existingRun) {
    return thread;
  }

  const nextRuns = thread.runs.some((item) => item.id === run.id)
    ? thread.runs.map((item) => (item.id === run.id ? run : item))
    : [...thread.runs, run];

  const nextMessages = message
    ? thread.messages.some((item) => item.id === message.id)
      ? thread.messages.map((item) => (item.id === message.id ? message : item))
      : [...thread.messages, message]
    : thread.messages;

  return {
    ...thread,
    runs: nextRuns,
    messages: nextMessages.sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
  };
}

export function createOptimisticThread(sessionId: string, content: string, response: CreateChatMessageResponse): ChatThreadState {
  const now = new Date().toISOString();
  return {
    sessionId,
    messages: [
      { id: response.inputMessageId, sessionId, role: 'user', content, createdAt: now },
      { id: response.assistantMessageId, sessionId, role: 'assistant', content: 'Working…', runId: response.runId, createdAt: now },
    ],
    runs: [
      {
        id: response.runId,
        sessionId,
        status: response.status,
        inputMessageId: response.inputMessageId,
        assistantMessageId: response.assistantMessageId,
        progressText: 'Queued…',
        createdAt: now,
        updatedAt: now,
      },
    ],
  };
}

export async function fetchChatSessions(): Promise<ChatSessionSummary[]> {
  const response = await fetch('/api/chat/sessions');
  const data: any = await response.json();
  if (!response.ok) throw new Error(formatApiError(data));
  return (data.sessions ?? data).map((session: any) => ({
    id: String(session.id),
    title: String(session.title),
    createdAt: String(session.createdAt ?? session.created_at),
    updatedAt: String(session.updatedAt ?? session.updated_at),
    archivedAt: session.archivedAt ?? session.archived_at ?? null,
  }));
}

export async function createChatSession(title?: string): Promise<ChatSessionSummary> {
  const response = await fetch('/api/chat/sessions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title }),
  });
  const data: any = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(formatApiError(data));
  return {
    id: String(data.id),
    title: String(data.title),
    createdAt: String(data.createdAt ?? data.created_at),
    updatedAt: String(data.updatedAt ?? data.updated_at),
    archivedAt: data.archivedAt ?? data.archived_at ?? null,
  };
}

export async function fetchChatThread(sessionId: string): Promise<ChatThreadState> {
  const response = await fetch(`/api/chat/sessions/${encodeURIComponent(sessionId)}/messages`);
  const data: any = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(formatApiError(data));
  return {
    sessionId,
    messages: (data.messages ?? []).map(normaliseMessage),
    runs: (data.runs ?? []).map(normaliseRun),
  };
}

export async function submitChatMessage(sessionId: string, content: string): Promise<CreateChatMessageResponse> {
  const response = await fetch(`/api/chat/sessions/${encodeURIComponent(sessionId)}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  });
  const data: any = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(formatApiError(data));
  return {
    sessionId: String(data.sessionId ?? data.session_id),
    inputMessageId: String(data.inputMessageId ?? data.input_message_id),
    assistantMessageId: String(data.assistantMessageId ?? data.assistant_message_id),
    runId: String(data.runId ?? data.run_id),
    status: data.status,
  };
}

export async function fetchRunStatus(runId: string): Promise<ChatRunStatusResponse> {
  const response = await fetch(`/api/chat/runs/${encodeURIComponent(runId)}`);
  const data: any = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(formatApiError(data));
  return {
    run: normaliseRun(data.run ?? data),
    message: data.message ? normaliseMessage(data.message) : undefined,
  };
}
