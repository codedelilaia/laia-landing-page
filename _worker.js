const OWNER = 'brianh20';
const REPO = 'laia-personal-assistant';
const BRANCH = 'main';
const ALLOWED_MODULES = new Set(['internal_projects', 'chores']);

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}

function requireHermes(env) {
  if (!env.HERMES_API_BASE || !env.HERMES_API_KEY) {
    return {
      error: 'Hermes backend not connected. Configure HERMES_API_BASE and HERMES_API_KEY in Cloudflare for dashboard chat.',
    };
  }
  return null;
}

function formatError(value, fallback = 'Request failed.') {
  if (!value) return fallback;
  if (typeof value === 'string') return value;
  if (value instanceof Error) return value.message || fallback;
  if (typeof value === 'object') {
    const nested = value.error || value.message || value.detail || value.raw;
    if (nested && nested !== value) return formatError(nested, fallback);
    try {
      return JSON.stringify(value);
    } catch {
      return fallback;
    }
  }
  return String(value);
}

async function hermes(path, env, init = {}) {
  const missing = requireHermes(env);
  if (missing) throw new Error(missing.error);
  const base = String(env.HERMES_API_BASE).replace(/\/$/, '');
  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${env.HERMES_API_KEY}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
  const text = await res.text();
  let data = {};
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }
  if (!res.ok) throw new Error(formatError(data.error || data.message || text, `Hermes HTTP ${res.status}`));
  return data;
}

function getSessionId(url, body) {
  return body?.sessionId || url.searchParams.get('sessionId') || url.searchParams.get('id');
}

function uniqueHermesTitle(prefix = 'Dashboard chat') {
  const stamp = new Date().toISOString().replace('T', ' ').replace(/\.\d+Z$/, ' UTC');
  const nonce = Math.random().toString(36).slice(2, 8);
  return `${prefix} ${stamp} ${nonce}`;
}

function isDuplicateHermesTitle(err) {
  return /title .*already in use/i.test(formatError(err));
}

async function hermesStatus(env) {
  const missing = requireHermes(env);
  if (missing) return json({ ok: false, configured: false, error: missing.error });
  try {
    const health = await hermes('/health', env, { headers: {} });
    return json({ ok: true, configured: true, health });
  } catch (err) {
    return json({ ok: false, configured: true, error: formatError(err) }, 502);
  }
}

async function hermesSessions(request, env) {
  const url = new URL(request.url);
  if (request.method === 'GET') {
    const limit = url.searchParams.get('limit') || '20';
    const data = await hermes(`/api/sessions?limit=${encodeURIComponent(limit)}&include_children=true`, env);
    return json(data);
  }
  if (request.method === 'POST') {
    const body = await request.json().catch(() => ({}));
    const requestedTitle = String(body.title || '').trim();
    const title = requestedTitle || uniqueHermesTitle('Dashboard chat');
    let data;
    try {
      data = await hermes('/api/sessions', env, {
        method: 'POST',
        body: JSON.stringify({ title, source: 'dashboard' }),
      });
    } catch (err) {
      if (!isDuplicateHermesTitle(err)) throw err;
      data = await hermes('/api/sessions', env, {
        method: 'POST',
        body: JSON.stringify({ title: uniqueHermesTitle(requestedTitle || 'Dashboard chat'), source: 'dashboard' }),
      });
    }
    return json(data);
  }
  return json({ error: 'Method not allowed.' }, 405);
}

async function hermesMessages(request, env) {
  const url = new URL(request.url);
  const sessionId = getSessionId(url, null);
  if (!sessionId) return json({ error: 'Missing sessionId.' }, 400);
  const data = await hermes(`/api/sessions/${encodeURIComponent(sessionId)}/messages`, env);
  return json(data);
}

async function hermesChat(request, env) {
  const body = await request.json();
  const sessionId = getSessionId(new URL(request.url), body);
  const input = String(body?.input || body?.message || '').trim();
  if (!sessionId) return json({ error: 'Missing sessionId.' }, 400);
  if (!input) return json({ error: 'Missing message.' }, 400);
  const data = await hermes(`/api/sessions/${encodeURIComponent(sessionId)}/chat`, env, {
    method: 'POST',
    body: JSON.stringify({ input }),
  });
  return json(data);
}

async function hermesFork(request, env) {
  const body = await request.json().catch(() => ({}));
  const sessionId = getSessionId(new URL(request.url), body);
  if (!sessionId) return json({ error: 'Missing sessionId.' }, 400);
  const requestedTitle = String(body.title || '').trim();
  const title = requestedTitle || uniqueHermesTitle('Dashboard branch');
  const data = await hermes(`/api/sessions/${encodeURIComponent(sessionId)}/fork`, env, {
    method: 'POST',
    body: JSON.stringify({ title }),
  });
  return json(data);
}

async function github(path, token, init = {}) {
  const res = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${token}`,
      accept: 'application/vnd.github+json',
      'user-agent': 'laia-dashboard-editor',
      ...(init.headers || {}),
    },
  });
  const text = await res.text();
  let data = {};
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }
  if (!res.ok) throw new Error(data.message || text || `GitHub HTTP ${res.status}`);
  return data;
}

function decodeBase64Json(content) {
  const binary = atob(content.replace(/\n/g, ''));
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes));
}

function encodeJsonBase64(data) {
  const text = JSON.stringify(data, null, 2) + '\n';
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

async function loadDashboard(token) {
  const current = await github(`/repos/${OWNER}/${REPO}/contents/dashboard.json?ref=${BRANCH}`, token);
  return {
    sha: current.sha,
    dashboard: decodeBase64Json(current.content),
  };
}

async function getDashboard(env) {
  if (!env.GITHUB_TOKEN) {
    return json({ error: 'Missing GITHUB_TOKEN secret.' }, 500);
  }
  const { dashboard } = await loadDashboard(env.GITHUB_TOKEN);
  return json({ ok: true, dashboard });
}

async function updateDashboard(request, env) {
  if (!env.GITHUB_TOKEN) {
    return json({ error: 'Missing GITHUB_TOKEN secret.' }, 500);
  }

  const body = await request.json();
  const moduleId = body?.moduleId;
  const items = body?.items;

  if (!ALLOWED_MODULES.has(moduleId)) {
    return json({ error: 'Module is not editable.' }, 400);
  }
  if (!Array.isArray(items) || items.some((x) => typeof x !== 'string')) {
    return json({ error: 'items must be an array of strings.' }, 400);
  }

  const { sha, dashboard } = await loadDashboard(env.GITHUB_TOKEN);
  const target = (dashboard.modules || []).find((m) => m.id === moduleId);
  if (!target) {
    return json({ error: 'Module not found in dashboard.' }, 404);
  }

  target.items = items;
  dashboard.last_updated = new Date().toISOString();

  const result = await github(`/repos/${OWNER}/${REPO}/contents/dashboard.json`, env.GITHUB_TOKEN, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      message: `chore: update ${moduleId} from dashboard UI`,
      content: encodeJsonBase64(dashboard),
      sha,
      branch: BRANCH,
    }),
  });

  return json({ ok: true, commit: result.commit?.sha || null, dashboard });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/api/dashboard-state') {
      if (request.method !== 'GET') {
        return json({ error: 'Method not allowed.' }, 405);
      }
      try {
        return await getDashboard(env);
      } catch (err) {
        return json({ error: formatError(err) }, 500);
      }
    }

    if (url.pathname === '/api/dashboard-update') {
      if (request.method !== 'POST') {
        return json({ error: 'Method not allowed.' }, 405);
      }
      try {
        return await updateDashboard(request, env);
      } catch (err) {
        return json({ error: formatError(err) }, 500);
      }
    }

    if (url.pathname === '/api/hermes/status') {
      return await hermesStatus(env);
    }

    if (url.pathname === '/api/hermes/sessions') {
      try {
        return await hermesSessions(request, env);
      } catch (err) {
        return json({ error: formatError(err) }, 502);
      }
    }

    if (url.pathname === '/api/hermes/messages') {
      if (request.method !== 'GET') return json({ error: 'Method not allowed.' }, 405);
      try {
        return await hermesMessages(request, env);
      } catch (err) {
        return json({ error: formatError(err) }, 502);
      }
    }

    if (url.pathname === '/api/hermes/chat') {
      if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
      try {
        return await hermesChat(request, env);
      } catch (err) {
        return json({ error: formatError(err) }, 502);
      }
    }

    if (url.pathname === '/api/hermes/fork') {
      if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
      try {
        return await hermesFork(request, env);
      } catch (err) {
        return json({ error: formatError(err) }, 502);
      }
    }

    return env.ASSETS.fetch(request);
  },
};
