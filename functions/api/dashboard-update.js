const OWNER = 'brianh20';
const REPO = 'laia-personal-assistant';
const BRANCH = 'main';
const ALLOWED_MODULES = new Set(['home_chores', 'internal_projects']);

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
      'authorization': `Bearer ${token}`,
      'accept': 'application/vnd.github+json',
      'user-agent': 'laia-dashboard-editor',
      ...(init.headers || {}),
    },
  });
  const text = await res.text();
  let data = {};
  try { data = JSON.parse(text); } catch { data = { raw: text }; }
  if (!res.ok) throw new Error(data.message || text || `GitHub HTTP ${res.status}`);
  return data;
}

export async function onRequestPost(context) {
  try {
    const token = context.env.GITHUB_TOKEN;
    if (!token) return json({ error: 'Missing GITHUB_TOKEN environment variable.' }, 500);

    const body = await context.request.json();
    const moduleId = body?.moduleId;
    const items = body?.items;

    if (!ALLOWED_MODULES.has(moduleId)) {
      return json({ error: 'Module is not editable.' }, 400);
    }
    if (!Array.isArray(items) || items.some((x) => typeof x !== 'string')) {
      return json({ error: 'items must be an array of strings.' }, 400);
    }

    const contentPath = `/repos/${OWNER}/${REPO}/contents/dashboard.json?ref=${BRANCH}`;
    const current = await github(contentPath, token);
    const decoded = atob(current.content.replace(/\n/g, ''));
    const dashboard = JSON.parse(decoded);
    const modules = dashboard.modules || [];
    const target = modules.find((m) => m.id === moduleId);
    if (!target) return json({ error: 'Module not found in dashboard.' }, 404);

    target.items = items;
    dashboard.last_updated = new Date().toISOString();

    const updated = JSON.stringify(dashboard, null, 2) + '\n';
    const encoded = btoa(unescape(encodeURIComponent(updated)));

    const result = await github(`/repos/${OWNER}/${REPO}/contents/dashboard.json`, token, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        message: `chore: update ${moduleId} from dashboard UI`,
        content: encoded,
        sha: current.sha,
        branch: BRANCH,
      }),
    });

    return json({ ok: true, commit: result.commit?.sha || null });
  } catch (err) {
    return json({ error: String(err.message || err) }, 500);
  }
}
