import snapshot from '../dashboard.json';

export interface Env {
  DB: D1Database;
  ASSETS?: Fetcher;
  HERMES_API_BASE?: string;
  HERMES_API_KEY?: string;
  MOCK_HERMES_DELAY_MS?: string;
  MOCK_HERMES_RESPONSE?: string;
}

type ModuleType = 'status' | 'kanban' | 'chart' | 'cards' | 'history';
type ModuleZone = 'dashboard-primary' | 'dashboard-secondary' | 'agent-left' | 'agent-right' | 'history';

interface SnapshotModule {
  id: string;
  type: ModuleType;
  title: string;
  status: string;
  summary?: string;
  items?: string[];
  columns?: Array<{ title: string; cards: Array<{ title: string; body: string }> }>;
  cards?: Array<{ title: string; body: string }>;
  series?: Array<{ date: string; open: number; close: number }>;
  entries?: Array<{ date: string; title: string; summary: string; bullets: string[]; link?: string }>;
}

interface SnapshotDashboard {
  owner: string;
  headline: string;
  subheadline: string;
  last_updated?: string;
  modules: SnapshotModule[];
}

interface DashboardModuleRow {
  id: string;
  type: ModuleType;
  title: string;
  status: string;
  summary: string;
  sort_order: number;
  zone: ModuleZone;
  payload_json: string;
  updated_at: string;
}

interface ChatSessionRow {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
  metadata_json: string | null;
}

interface ChatMessageRow {
  id: string;
  session_id: string;
  role: 'user' | 'assistant' | 'system' | 'tool_status';
  content: string;
  run_id: string | null;
  created_at: string;
  metadata_json: string | null;
}

interface ChatRunRow {
  id: string;
  session_id: string;
  status: 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';
  input_message_id: string;
  assistant_message_id: string | null;
  progress_text: string | null;
  error_text: string | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  updated_at: string;
}

const DEFAULT_CHAT_MODEL = 'gpt-5.4';
const EDITABLE_MODULES = new Set(['chores', 'internal_projects']);
const ZONES: Record<string, { zone: ModuleZone; sortOrder: number }> = {
  email: { zone: 'dashboard-secondary', sortOrder: 10 },
  engagements: { zone: 'dashboard-primary', sortOrder: 20 },
  internal_projects: { zone: 'dashboard-primary', sortOrder: 30 },
  chores: { zone: 'dashboard-secondary', sortOrder: 40 },
  market: { zone: 'dashboard-secondary', sortOrder: 50 },
  watcher: { zone: 'agent-left', sortOrder: 60 },
  assistant: { zone: 'agent-right', sortOrder: 70 },
  daily_log: { zone: 'history', sortOrder: 80 },
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}

function nowIso() {
  return new Date().toISOString();
}

function randomId(prefix: string) {
  return `${prefix}_${crypto.randomUUID()}`;
}

function zoneForModule(moduleId: string): { zone: ModuleZone; sortOrder: number } {
  return ZONES[moduleId] ?? { zone: 'dashboard-secondary', sortOrder: 999 };
}

function payloadFromSnapshot(module: SnapshotModule) {
  if (module.type === 'status') return { items: module.items ?? [] };
  if (module.type === 'kanban') return { columns: module.columns ?? [] };
  if (module.type === 'chart') return { series: module.series ?? [] };
  if (module.type === 'history') return { entries: module.entries ?? [] };
  return { cards: module.cards ?? [] };
}

export function createInitialDashboardSeed(input: SnapshotDashboard = snapshot as SnapshotDashboard) {
  const lastUpdated = input.last_updated ?? nowIso();
  return {
    owner: input.owner,
    headline: input.headline,
    subheadline: input.subheadline,
    lastUpdated,
    modules: input.modules.map((module) => {
      const placement = zoneForModule(module.id);
      return {
        id: module.id,
        type: module.type,
        title: module.title,
        status: module.status ?? 'idle',
        summary: module.summary ?? '',
        zone: placement.zone,
        sortOrder: placement.sortOrder,
        payload: payloadFromSnapshot(module),
        updatedAt: lastUpdated,
      };
    }),
  };
}

function serialiseMetadata(value: unknown) {
  return value ? JSON.stringify(value) : null;
}

function parseMetadata(value: string | null) {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function normaliseChatModel(value: unknown) {
  const model = String(value || '').trim();
  return model || DEFAULT_CHAT_MODEL;
}

function toApiModule(row: DashboardModuleRow) {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    status: row.status,
    summary: row.summary,
    zone: row.zone,
    sortOrder: row.sort_order,
    payload: JSON.parse(row.payload_json),
    updatedAt: row.updated_at,
  };
}

function toApiSession(row: ChatSessionRow) {
  const metadata = parseMetadata(row.metadata_json) as Record<string, unknown> | null;
  return {
    id: row.id,
    title: row.title,
    model: normaliseChatModel(metadata?.model),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    archivedAt: row.archived_at,
  };
}

function toApiMessage(row: ChatMessageRow) {
  return {
    id: row.id,
    sessionId: row.session_id,
    role: row.role,
    content: row.content,
    runId: row.run_id,
    createdAt: row.created_at,
    metadata: parseMetadata(row.metadata_json),
  };
}

function toApiRun(row: ChatRunRow) {
  return {
    id: row.id,
    sessionId: row.session_id,
    status: row.status,
    inputMessageId: row.input_message_id,
    assistantMessageId: row.assistant_message_id,
    progressText: row.progress_text,
    errorText: row.error_text,
    createdAt: row.created_at,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    updatedAt: row.updated_at,
  };
}

export function normaliseModulePatch(moduleId: string, body: { items?: unknown }) {
  if (!EDITABLE_MODULES.has(moduleId)) {
    throw new Error(`Module ${moduleId} is not editable.`);
  }
  if (!Array.isArray(body.items)) {
    throw new Error('items must be an array of strings.');
  }
  const items = body.items.map((item) => String(item).trim()).filter(Boolean);
  if (items.length > 100) throw new Error('Too many items.');
  return items;
}

export function uniqueSessionTitle(prefix = 'Dashboard chat') {
  const stamp = new Date().toISOString().replace('T', ' ').replace(/\.\d+Z$/, ' UTC');
  const nonce = Math.random().toString(36).slice(2, 8);
  return `${prefix} ${stamp} ${nonce}`;
}

export function createMessageRunTransaction({ sessionId, content }: { sessionId: string; content: string }) {
  const createdAt = nowIso();
  const userMessage: {
    id: string;
    sessionId: string;
    role: 'user';
    content: string;
    runId: null;
    createdAt: string;
    metadata: null;
  } = {
    id: randomId('msg'),
    sessionId,
    role: 'user' as const,
    content,
    runId: null,
    createdAt,
    metadata: null,
  };
  const assistantMessage: {
    id: string;
    sessionId: string;
    role: 'assistant';
    content: string;
    runId: string | null;
    createdAt: string;
    metadata: null;
  } = {
    id: randomId('msg'),
    sessionId,
    role: 'assistant' as const,
    content: 'Working…',
    runId: null,
    createdAt,
    metadata: null,
  };
  const run = {
    id: randomId('run'),
    sessionId,
    status: 'queued' as const,
    inputMessageId: userMessage.id,
    assistantMessageId: assistantMessage.id,
    progressText: 'Queued…',
    errorText: null,
    createdAt,
    startedAt: null,
    finishedAt: null,
    updatedAt: createdAt,
  };
  assistantMessage.runId = run.id;
  return { userMessage, assistantMessage, run };
}

async function ensureSeeded(env: Env) {
  const seed = createInitialDashboardSeed();
  await env.DB.batch(
    seed.modules.flatMap((module) => [
      env.DB.prepare(
        `INSERT OR IGNORE INTO dashboard_modules (id, type, title, status, summary, sort_order, zone, payload_json, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).bind(
        module.id,
        module.type,
        module.title,
        module.status,
        module.summary,
        module.sortOrder,
        module.zone,
        JSON.stringify(module.payload),
        module.updatedAt,
      ),
      env.DB.prepare('UPDATE dashboard_modules SET sort_order = ?, zone = ? WHERE id = ?').bind(
        module.sortOrder,
        module.zone,
        module.id,
      ),
    ]),
  );
}

async function getDashboard(env: Env) {
  await ensureSeeded(env);
  const rows = await env.DB.prepare(
    'SELECT id, type, title, status, summary, sort_order, zone, payload_json, updated_at FROM dashboard_modules ORDER BY sort_order ASC',
  ).all<DashboardModuleRow>();
  const seed = createInitialDashboardSeed();
  return json({
    owner: seed.owner,
    headline: seed.headline,
    subheadline: seed.subheadline,
    lastUpdated: rows.results.at(-1)?.updated_at ?? seed.lastUpdated,
    modules: rows.results.map(toApiModule),
  });
}

async function patchModule(request: Request, env: Env, moduleId: string) {
  await ensureSeeded(env);
  const body: any = await request.json().catch(() => ({}));
  let items: string[];
  try {
    items = normaliseModulePatch(moduleId, body);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Invalid module payload.' }, 400);
  }

  const row = await env.DB.prepare('SELECT * FROM dashboard_modules WHERE id = ?').bind(moduleId).first<DashboardModuleRow>();
  if (!row) return json({ error: 'Module not found.' }, 404);
  const payload = JSON.parse(row.payload_json);
  payload.items = items;
  const updatedAt = nowIso();
  await env.DB.prepare('UPDATE dashboard_modules SET payload_json = ?, updated_at = ?, status = ? WHERE id = ?')
    .bind(JSON.stringify(payload), updatedAt, items.length ? 'active' : 'idle', moduleId)
    .run();
  return getDashboard(env);
}

async function listSessions(env: Env) {
  const sessions = await env.DB.prepare(
    'SELECT id, title, created_at, updated_at, archived_at, metadata_json FROM chat_sessions ORDER BY updated_at DESC',
  ).all<ChatSessionRow>();
  return json({ sessions: sessions.results.map(toApiSession) });
}

async function createSession(request: Request, env: Env) {
  const body: any = await request.json().catch(() => ({}));
  const title = String(body.title || '').trim() || uniqueSessionTitle('Dashboard chat');
  const model = normaliseChatModel(body.model);
  const session = {
    id: randomId('session'),
    title,
    model,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  await env.DB.prepare(
    'INSERT INTO chat_sessions (id, title, created_at, updated_at, archived_at, metadata_json) VALUES (?, ?, ?, ?, NULL, ?)',
  )
    .bind(session.id, session.title, session.createdAt, session.updatedAt, serialiseMetadata({ model }))
    .run();
  return json(session, 201);
}

async function getThread(env: Env, sessionId: string) {
  const messages = await env.DB.prepare(
    'SELECT id, session_id, role, content, run_id, created_at, metadata_json FROM chat_messages WHERE session_id = ? ORDER BY created_at ASC',
  )
    .bind(sessionId)
    .all<ChatMessageRow>();
  const runs = await env.DB.prepare(
    'SELECT id, session_id, status, input_message_id, assistant_message_id, progress_text, error_text, created_at, started_at, finished_at, updated_at FROM chat_runs WHERE session_id = ? ORDER BY created_at ASC',
  )
    .bind(sessionId)
    .all<ChatRunRow>();
  return json({
    sessionId,
    messages: messages.results.map(toApiMessage),
    runs: runs.results.map(toApiRun),
  });
}

async function ensureHermesSession(env: Env, sessionId: string) {
  const session = await env.DB.prepare('SELECT id, title, metadata_json FROM chat_sessions WHERE id = ?').bind(sessionId).first<ChatSessionRow>();
  const metadata = parseMetadata(session?.metadata_json ?? null) as Record<string, unknown> | null;
  const model = normaliseChatModel(metadata?.model);
  if (metadata?.hermesSessionId) return String(metadata.hermesSessionId);
  if (!env.HERMES_API_BASE || !env.HERMES_API_KEY) return null;

  const response = await fetch(`${String(env.HERMES_API_BASE).replace(/\/$/, '')}/api/sessions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.HERMES_API_KEY}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ title: uniqueSessionTitle(session?.title || 'Dashboard chat'), source: 'dashboard-async', model }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error((data as any).error || (data as any).message || `Hermes HTTP ${response.status}`);
  const hermesSessionId = String((data as any).id || (data as any).sessionId || (data as any).session_id);
  await env.DB.prepare('UPDATE chat_sessions SET metadata_json = ?, updated_at = ? WHERE id = ?')
    .bind(serialiseMetadata({ ...(metadata ?? {}), hermesSessionId }), nowIso(), sessionId)
    .run();
  return hermesSessionId;
}

function extractAssistantContent(data: any) {
  return (
    data?.message?.content ??
    data?.assistant?.content ??
    data?.output ??
    data?.response ??
    data?.content ??
    data?.text ??
    'Done.'
  );
}

async function runHermes(env: Env, sessionId: string, content: string) {
  const mockDelay = Number(env.MOCK_HERMES_DELAY_MS || 0);
  if (mockDelay > 0) {
    await new Promise((resolve) => setTimeout(resolve, mockDelay));
    return env.MOCK_HERMES_RESPONSE || `Mock Hermes reply: ${content}`;
  }
  const hermesSessionId = await ensureHermesSession(env, sessionId);
  if (!hermesSessionId) {
    throw new Error('Hermes backend not connected. Configure HERMES_API_BASE and HERMES_API_KEY or use MOCK_HERMES_DELAY_MS locally.');
  }
  const response = await fetch(`${String(env.HERMES_API_BASE).replace(/\/$/, '')}/api/sessions/${encodeURIComponent(hermesSessionId)}/chat`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.HERMES_API_KEY}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ input: content }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error((data as any).error || (data as any).message || `Hermes HTTP ${response.status}`);
  return String(extractAssistantContent(data));
}

async function processRun(env: Env, runId: string) {
  const run = await env.DB.prepare('SELECT * FROM chat_runs WHERE id = ?').bind(runId).first<ChatRunRow>();
  if (!run || run.status === 'cancelled') return;

  const startedAt = nowIso();
  await env.DB.prepare('UPDATE chat_runs SET status = ?, progress_text = ?, started_at = ?, updated_at = ? WHERE id = ?')
    .bind('running', 'Still working…', startedAt, startedAt, runId)
    .run();

  const message = await env.DB.prepare('SELECT * FROM chat_messages WHERE id = ?').bind(run.input_message_id).first<ChatMessageRow>();
  if (!message) return;

  try {
    const answer = await runHermes(env, run.session_id, message.content);
    const finishedAt = nowIso();
    await env.DB.batch([
      env.DB.prepare('UPDATE chat_runs SET status = ?, progress_text = ?, error_text = NULL, finished_at = ?, updated_at = ? WHERE id = ?').bind(
        'succeeded',
        'Completed.',
        finishedAt,
        finishedAt,
        runId,
      ),
      env.DB.prepare('UPDATE chat_messages SET content = ?, metadata_json = ? WHERE id = ?').bind(
        answer,
        serialiseMetadata({ completedAt: finishedAt }),
        run.assistant_message_id,
      ),
      env.DB.prepare('UPDATE chat_sessions SET updated_at = ? WHERE id = ?').bind(finishedAt, run.session_id),
    ]);
  } catch (error) {
    const finishedAt = nowIso();
    const text = error instanceof Error ? error.message : 'Run failed.';
    await env.DB.batch([
      env.DB.prepare('UPDATE chat_runs SET status = ?, progress_text = ?, error_text = ?, finished_at = ?, updated_at = ? WHERE id = ?').bind(
        'failed',
        'Failed.',
        text,
        finishedAt,
        finishedAt,
        runId,
      ),
      env.DB.prepare('UPDATE chat_messages SET content = ?, metadata_json = ? WHERE id = ?').bind(
        'I hit an inline error while working on that request.',
        serialiseMetadata({ error: text }),
        run.assistant_message_id,
      ),
      env.DB.prepare('UPDATE chat_sessions SET updated_at = ? WHERE id = ?').bind(finishedAt, run.session_id),
    ]);
  }
}

async function createMessage(request: Request, env: Env, sessionId: string, ctx: ExecutionContext) {
  const body: any = await request.json().catch(() => ({}));
  const content = String(body.content || body.message || '').trim();
  if (!content) return json({ error: 'Missing message.' }, 400);

  const session = await env.DB.prepare('SELECT id, metadata_json FROM chat_sessions WHERE id = ?').bind(sessionId).first<ChatSessionRow>();
  if (!session) return json({ error: 'Session not found.' }, 404);

  const metadata = (parseMetadata(session.metadata_json) as Record<string, unknown> | null) ?? {};
  const requestedModel = normaliseChatModel(body.model ?? metadata.model);
  if (metadata.hermesSessionId && requestedModel !== normaliseChatModel(metadata.model)) {
    return json({ error: 'Model is locked after the first queued message. Start a new conversation to switch models.' }, 409);
  }

  const nextMetadata = { ...metadata, model: requestedModel };
  const tx = createMessageRunTransaction({ sessionId, content });
  await env.DB.batch([
    env.DB.prepare(
      'INSERT INTO chat_messages (id, session_id, role, content, run_id, created_at, metadata_json) VALUES (?, ?, ?, ?, ?, ?, ?)',
    ).bind(tx.userMessage.id, sessionId, tx.userMessage.role, tx.userMessage.content, null, tx.userMessage.createdAt, null),
    env.DB.prepare(
      'INSERT INTO chat_messages (id, session_id, role, content, run_id, created_at, metadata_json) VALUES (?, ?, ?, ?, ?, ?, ?)',
    ).bind(
      tx.assistantMessage.id,
      sessionId,
      tx.assistantMessage.role,
      tx.assistantMessage.content,
      tx.assistantMessage.runId,
      tx.assistantMessage.createdAt,
      null,
    ),
    env.DB.prepare(
      'INSERT INTO chat_runs (id, session_id, status, input_message_id, assistant_message_id, progress_text, error_text, created_at, started_at, finished_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    ).bind(
      tx.run.id,
      sessionId,
      tx.run.status,
      tx.run.inputMessageId,
      tx.run.assistantMessageId,
      tx.run.progressText,
      null,
      tx.run.createdAt,
      null,
      null,
      tx.run.updatedAt,
    ),
    env.DB.prepare('UPDATE chat_sessions SET updated_at = ?, metadata_json = ? WHERE id = ?').bind(
      tx.run.updatedAt,
      serialiseMetadata(nextMetadata),
      sessionId,
    ),
  ]);

  ctx.waitUntil(processRun(env, tx.run.id));
  return json(
    {
      sessionId,
      inputMessageId: tx.userMessage.id,
      assistantMessageId: tx.assistantMessage.id,
      runId: tx.run.id,
      status: tx.run.status,
    },
    202,
  );
}

async function kickRunIfNeeded(env: Env, run: ChatRunRow, ctx?: ExecutionContext) {
  if (!ctx) return;
  if (run.status === 'queued') {
    ctx.waitUntil(processRun(env, run.id));
    return;
  }

  if (run.status !== 'running') return;

  const lastTouched = Date.parse(run.updated_at || run.started_at || run.created_at || '');
  if (Number.isNaN(lastTouched)) return;
  if (Date.now() - lastTouched > 15_000) {
    ctx.waitUntil(processRun(env, run.id));
  }
}

async function getRun(env: Env, runId: string, ctx?: ExecutionContext) {
  const run = await env.DB.prepare('SELECT * FROM chat_runs WHERE id = ?').bind(runId).first<ChatRunRow>();
  if (!run) return json({ error: 'Run not found.' }, 404);
  await kickRunIfNeeded(env, run, ctx);
  const message = run.assistant_message_id
    ? await env.DB.prepare('SELECT * FROM chat_messages WHERE id = ?').bind(run.assistant_message_id).first<ChatMessageRow>()
    : null;
  return json({ run: toApiRun(run), message: message ? toApiMessage(message) : null });
}

async function cancelRun(env: Env, runId: string) {
  const finishedAt = nowIso();
  await env.DB.prepare('UPDATE chat_runs SET status = ?, progress_text = ?, finished_at = ?, updated_at = ? WHERE id = ?')
    .bind('cancelled', 'Cancelled.', finishedAt, finishedAt, runId)
    .run();
  return getRun(env, runId);
}

async function handleApi(request: Request, env: Env, ctx: ExecutionContext) {
  const url = new URL(request.url);
  const pathname = url.pathname;

  if (pathname === '/api/dashboard' && request.method === 'GET') return getDashboard(env);
  if (pathname.startsWith('/api/modules/') && request.method === 'PATCH') {
    return patchModule(request, env, decodeURIComponent(pathname.split('/').at(-1) || ''));
  }
  if (pathname === '/api/chat/sessions' && request.method === 'GET') return listSessions(env);
  if (pathname === '/api/chat/sessions' && request.method === 'POST') return createSession(request, env);

  const sessionMatch = pathname.match(/^\/api\/chat\/sessions\/([^/]+)\/messages$/);
  if (sessionMatch && request.method === 'GET') return getThread(env, decodeURIComponent(sessionMatch[1]));
  if (sessionMatch && request.method === 'POST') return createMessage(request, env, decodeURIComponent(sessionMatch[1]), ctx);

  const runMatch = pathname.match(/^\/api\/chat\/runs\/([^/]+)$/);
  if (runMatch && request.method === 'GET') return getRun(env, decodeURIComponent(runMatch[1]), ctx);

  const cancelMatch = pathname.match(/^\/api\/chat\/runs\/([^/]+)\/cancel$/);
  if (cancelMatch && request.method === 'POST') return cancelRun(env, decodeURIComponent(cancelMatch[1]));

  return null;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    try {
      const apiResponse = await handleApi(request, env, ctx);
      if (apiResponse) return apiResponse;
      if (env.ASSETS) return env.ASSETS.fetch(request);
      return json({ error: 'Not found.' }, 404);
    } catch (error) {
      return json({ error: error instanceof Error ? error.message : 'Unexpected error.' }, 500);
    }
  },
};
