const OWNER = 'brianh20';
const REPO = 'laia-personal-assistant';
const BRANCH = 'main';
const ALLOWED_MODULES = new Set(['internal_projects']);

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
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
        return json({ error: String(err.message || err) }, 500);
      }
    }

    if (url.pathname === '/api/dashboard-update') {
      if (request.method !== 'POST') {
        return json({ error: 'Method not allowed.' }, 405);
      }
      try {
        return await updateDashboard(request, env);
      } catch (err) {
        return json({ error: String(err.message || err) }, 500);
      }
    }

    return env.ASSETS.fetch(request);
  },
};
