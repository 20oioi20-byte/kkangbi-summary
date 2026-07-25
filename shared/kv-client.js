// 모든 양식이 공용으로 쓰는 /api/storage(Supabase rpt_kv) 클라이언트.
// 키는 항상 ktis_v11__ 로 시작해야 서버에서 허용됨 (api/storage.js 참고).
async function apiGet(key){
  const r = await fetch(`/api/storage?action=get&key=${encodeURIComponent(key)}`);
  if(!r.ok) return null;
  const d = await r.json();
  return d.value ? JSON.parse(d.value) : null;
}
async function apiList(prefix){
  const r = await fetch(`/api/storage?action=list&prefix=${encodeURIComponent(prefix)}`);
  if(!r.ok) return [];
  const d = await r.json();
  return d.rows || [];
}
async function apiSet(key, value){
  const r = await fetch('/api/storage', {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify({action:'set', key, value: JSON.stringify(value)})
  });
  if(!r.ok) throw new Error('save failed');
}
async function apiDelete(key){
  await fetch('/api/storage', {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify({action:'delete', key})
  });
}
