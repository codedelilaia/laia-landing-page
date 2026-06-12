export type ModuleType = 'status' | 'kanban' | 'chart' | 'cards' | 'history';
export type ModuleZone =
  | 'dashboard-primary'
  | 'dashboard-secondary'
  | 'agent-left'
  | 'agent-right'
  | 'history';

export interface StatusPayload {
  items: string[];
}

export interface KanbanPayload {
  columns: Array<{
    title: string;
    cards: Array<{ title: string; body: string }>;
  }>;
}

export interface ChartPayload {
  series: Array<{ date: string; open: number; close: number }>;
}

export interface CardsPayload {
  cards: Array<{ title: string; body: string }>;
}

export interface HistoryPayload {
  entries: Array<{
    date: string;
    title: string;
    summary: string;
    bullets: string[];
    link?: string;
  }>;
}

export type DashboardModulePayload = StatusPayload | KanbanPayload | ChartPayload | CardsPayload | HistoryPayload;

export interface DashboardModule {
  id: string;
  type: ModuleType;
  title: string;
  status: string;
  summary?: string;
  zone: ModuleZone;
  sortOrder: number;
  payload: DashboardModulePayload;
  updatedAt: string;
}

export interface DashboardState {
  owner: string;
  headline: string;
  subheadline: string;
  lastUpdated: string;
  modules: DashboardModule[];
}

export interface ChatSessionSummary {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string | null;
}

export type ChatRole = 'user' | 'assistant' | 'system' | 'tool_status';

export interface ChatMessage {
  id: string;
  sessionId: string;
  role: ChatRole;
  content: string;
  runId?: string | null;
  createdAt: string;
  metadata?: Record<string, unknown> | null;
}

export type ChatRunStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';

export interface ChatRun {
  id: string;
  sessionId: string;
  status: ChatRunStatus;
  inputMessageId: string;
  assistantMessageId?: string | null;
  progressText?: string | null;
  errorText?: string | null;
  createdAt: string;
  startedAt?: string | null;
  finishedAt?: string | null;
  updatedAt: string;
}

export interface ChatThreadState {
  sessionId: string;
  messages: ChatMessage[];
  runs: ChatRun[];
}

export interface ChatRunStatusResponse {
  run: ChatRun;
  message?: ChatMessage | null;
}

export interface CreateChatMessageResponse {
  sessionId: string;
  inputMessageId: string;
  assistantMessageId: string;
  runId: string;
  status: ChatRunStatus;
}

export interface DashboardBootstrap {
  dashboard: DashboardState;
  sessions: ChatSessionSummary[];
  thread?: ChatThreadState;
}
