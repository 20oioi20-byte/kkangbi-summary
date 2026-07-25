// Supabase 프록시 — 반드시 rpt_kv 사용 (app_storage 금지: 회사망 POST 차단)
// service_role 키로만 접근 (rpt_kv는 RLS로 anon 접근 차단됨). 키는 Vercel 환경변수로만 주입.
// 허브의 모든 양식(주간보고/Makeup/향후 추가되는 양식)이 이 엔드포인트 하나를 공유한다 —
// 양식별로 별도 API를 만들지 않고, 키 접두어(ktis_v11__{formSlug}_*)로만 구분한다.
const SB_URL = process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const KEY_PREFIX = 'ktis_v11__';

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
        if (!r.ok) return res.status(502).json({ error: 'supabase list failed', supabaseStatus: r.status, supabaseBody: await r.text() });
        const rows = await r.json();
        return res.status(200).json({ rows });
      }

      // action === 'get' (default)
      if (!isAllowedKey(key || '')) return res.status(400).json({ error: 'invalid key' });
      const r = await sbFetch(
        `/rest/v1/rpt_kv?key=eq.${encodeURIComponent(key)}&select=value`
      );
      if (!r.ok) return res.status(502).json({ error: 'supabase get failed', supabaseStatus: r.status, supabaseBody: await r.text() });
      const rows = await r.json();
      return res.status(200).json({ value: rows[0] ? rows[0].value : null });
    }

    if (req.method === 'POST') {
      const { action, key, value, items, keys } = req.body || {};

      if (action === 'setMany') {
        const list = Array.isArray(items) ? items : [];
        if (!list.length) return res.status(400).json({ error: 'no items' });
        for (const it of list) {
          if (!isAllowedKey(it && it.key)) return res.status(400).json({ error: 'invalid key: ' + (it && it.key) });
        }
        const rows = list.map(it => ({
          key: it.key,
          value: typeof it.value === 'string' ? it.value : JSON.stringify(it.value),
          updated_at: new Date().toISOString(),
        }));
        const r = await sbFetch(`/rest/v1/rpt_kv`, {
          method: 'POST',
          headers: { Prefer: 'resolution=merge-duplicates' },
          body: JSON.stringify(rows),
        });
        if (!r.ok) return res.status(502).json({ error: 'supabase setMany failed', supabaseStatus: r.status, supabaseBody: await r.text() });
        return res.status(200).json({ ok: true, count: rows.length });
      }

      if (action === 'deleteMany') {
        const list = Array.isArray(keys) ? keys : [];
        if (!list.length) return res.status(400).json({ error: 'no keys' });
        for (const k of list) {
          if (!isAllowedKey(k)) return res.status(400).json({ error: 'invalid key: ' + k });
        }
        const inList = list.map(k => `"${String(k).replace(/"/g, '\\"')}"`).join(',');
        const r = await sbFetch(`/rest/v1/rpt_kv?key=in.(${inList})`, { method: 'DELETE' });
        if (!r.ok) return res.status(502).json({ error: 'supabase deleteMany failed', supabaseStatus: r.status, supabaseBody: await r.text() });
        return res.status(200).json({ ok: true });
      }

      if (!isAllowedKey(key || '')) return res.status(400).json({ error: 'invalid key' });

      if (action === 'delete') {
        const r = await sbFetch(`/rest/v1/rpt_kv?key=eq.${encodeURIComponent(key)}`, {
          method: 'DELETE',
        });
        if (!r.ok) return res.status(502).json({ error: 'supabase delete failed', supabaseStatus: r.status, supabaseBody: await r.text() });
        return res.status(200).json({ ok: true });
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
      if (!r.ok) return res.status(502).json({ error: 'supabase set failed', supabaseStatus: r.status, supabaseBody: await r.text() });
      return res.status(200).json({ ok: true });
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
