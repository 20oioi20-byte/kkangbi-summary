// Supabase 프록시 — 반드시 rpt_kv 사용 (app_storage 금지: 회사망 POST 차단)
// service_role 키로만 접근 (rpt_kv는 RLS로 anon 접근 차단됨). 키는 Vercel 환경변수로만 주입.
const SB_URL = process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const KEY_PREFIX = 'ktis_v11__collect';

function isAllowedKey(key) {
  return typeof key === 'string' && key.startsWith(KEY_PREFIX);
}

async function sbFetch(path, init) {
  return fetch(`${SB_URL}${path}`, {
    ...init,
    headers: {
      apikey: SB_KEY,
      Authorization: `Bearer ${SB_KEY}`,
      'Content-Type': 'application/json',
      ...(init && init.headers),
    },
  });
}

export default async function handler(req, res) {
  if (!SB_URL || !SB_KEY) {
    return res.status(500).json({ error: 'Server missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY' });
  }

  try {
    if (req.method === 'GET') {
      const { action, key, prefix } = req.query;

      if (action === 'list') {
        if (!isAllowedKey(prefix || '')) return res.status(400).json({ error: 'invalid prefix' });
        const r = await sbFetch(
          `/rest/v1/rpt_kv?key=like.${encodeURIComponent(prefix)}*&select=key,value`
        );
        if (!r.ok) return res.status(502).json({ error: 'supabase list failed' });
        const rows = await r.json();
        return res.status(200).json({ rows });
      }

      // action === 'get' (default)
      if (!isAllowedKey(key || '')) return res.status(400).json({ error: 'invalid key' });
      const r = await sbFetch(
        `/rest/v1/rpt_kv?key=eq.${encodeURIComponent(key)}&select=value`
      );
      if (!r.ok) return res.status(502).json({ error: 'supabase get failed' });
      const rows = await r.json();
      return res.status(200).json({ value: rows[0] ? rows[0].value : null });
    }

    if (req.method === 'POST') {
      const { action, key, value } = req.body || {};
      if (!isAllowedKey(key || '')) return res.status(400).json({ error: 'invalid key' });

      if (action === 'delete') {
        const r = await sbFetch(`/rest/v1/rpt_kv?key=eq.${encodeURIComponent(key)}`, {
          method: 'DELETE',
        });
        return res.status(r.ok ? 200 : 502).json({ ok: r.ok });
      }

      // action === 'set' (default)
      const r = await sbFetch(`/rest/v1/rpt_kv`, {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates' },
        body: JSON.stringify({
          key,
          value: typeof value === 'string' ? value : JSON.stringify(value),
          updated_at: new Date().toISOString(),
        }),
      });
      return res.status(r.ok ? 200 : 502).json({ ok: r.ok });
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
