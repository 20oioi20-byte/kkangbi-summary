// 모든 양식이 공용으로 쓰는 /api/storage(Supabase rpt_kv) 클라이언트.
// 키는 항상 ktis_v11__ 로 시작해야 서버에서 허용됨 (api/storage.js 참고).
//
// 회사망처럼 payload 크기 제한이 문서화돼있지 않고 시간대별로 달라지는 네트워크를 통과해야
// 하므로, 값 하나가 크면 자동으로 쪼개서(청크) 보내고, 실패하면 크기를 스스로 줄여가며
// 재시도하고, 그래도 안 되면 백오프 후 몇 번 더 시도한다 — "이 요청이 안전한 크기인지"를
// 코드에 고정 숫자로 박아넣지 않는다 (dev-standards/network-resilient-storage.md 참고).
// 이 파일을 쓰는 쪽(collect-state.js 등)은 이런 내부 동작을 몰라도 된다 —
// apiGet/apiSet/apiList/apiDelete/apiSetMany/apiDeleteMany 시그니처는 그대로다.

const KV_SAFE_SIZE_KEY = 'kkangbi_kv_safe_size_v1'; // localStorage — 알아낸 "안전한 페이로드 크기"를 다음 세션에도 기억
const KV_SIZE_FLOOR = 8 * 1024;       // 여기까지 줄여도 안 되면 크기 문제가 아니라 네트워크/도메인 자체 차단
const KV_SIZE_CEILING = 512 * 1024;   // 회복 시 이 이상은 올리지 않음
const KV_SIZE_DEFAULT = 64 * 1024;
let kvBlockedThisSession = false;      // 이번 세션에 한 번이라도 차단을 겪었으면 크기 회복을 보류

function kvByteLen(s){ return new TextEncoder().encode(s).length; }
function kvSleep(ms){ return new Promise(res=>setTimeout(res, ms)); }
function kvChunkKey(key, i){ return `${key}__chunk__${i}`; }

function kvGetSafeSize(){
  try{
    const v = parseInt(localStorage.getItem(KV_SAFE_SIZE_KEY), 10);
    if(v && v >= KV_SIZE_FLOOR && v <= KV_SIZE_CEILING) return v;
  }catch(e){}
  return KV_SIZE_DEFAULT;
}
function kvSetSafeSize(n){
  const clamped = Math.max(KV_SIZE_FLOOR, Math.min(KV_SIZE_CEILING, Math.round(n)));
  try{ localStorage.setItem(KV_SAFE_SIZE_KEY, String(clamped)); }catch(e){}
  return clamped;
}
function kvShrinkSafeSize(){ return kvSetSafeSize(kvGetSafeSize() / 2); }
function kvGrowSafeSizeIfHealthy(){
  if(kvBlockedThisSession) return; // 방금 겪은 세션에서는 급하게 키우지 않는다
  kvSetSafeSize(kvGetSafeSize() * 1.1); // 성공이 이어지면 아주 천천히 회복
}

// 문자열을 UTF-8 바이트 기준 maxBytes 이하 조각들로 자른다. UTF-16 서로게이트 쌍 중간을
// 자르지 않는다(자르면 재조립 시 글자가 깨짐).
function kvSplitSafe(str, maxBytes){
  const parts = [];
  let i = 0;
  while(i < str.length){
    const remaining = str.length - i;
    const probeLen = Math.min(remaining, 4096);
    const probeBytes = kvByteLen(str.slice(i, i+probeLen)) || 1;
    const ratio = probeBytes / probeLen;
    let guess = Math.max(1, Math.floor(maxBytes / ratio));
    let end = Math.min(str.length, i + guess);
    while(end > i+1 && kvByteLen(str.slice(i, end)) > maxBytes) end--;
    while(end < str.length && kvByteLen(str.slice(i, end+1)) <= maxBytes) end++;
    if(end < str.length){
      const code = str.charCodeAt(end-1);
      if(code >= 0xD800 && code <= 0xDBFF) end--; // 상위 서로게이트에서 끊기지 않게 한 글자 물러남
    }
    if(end <= i) end = i+1; // 항상 앞으로 진행 보장
    parts.push(str.slice(i, end));
    i = end;
  }
  return parts;
}

// ── 저수준 통신(재시도만, 크기 적응은 상위 함수가 담당) ──
async function kvRawGet(key){
  for(let attempt=0; attempt<3; attempt++){
    try{
      const r = await fetch(`/api/storage?action=get&key=${encodeURIComponent(key)}`);
      if(r.ok){ const d = await r.json(); return {ok:true, value: d.value ?? null}; }
    }catch(e){ /* 네트워크 자체 실패 — 재시도 */ }
    if(attempt<2) await kvSleep(400*(attempt+1));
  }
  return {ok:false, value:null};
}
async function kvRawList(prefix){
  for(let attempt=0; attempt<2; attempt++){
    try{
      const r = await fetch(`/api/storage?action=list&prefix=${encodeURIComponent(prefix)}`);
      if(r.ok){ const d = await r.json(); return d.rows || []; }
    }catch(e){}
    if(attempt<1) await kvSleep(500);
  }
  return null;
}
async function kvRawSet(key, strValue){
  try{
    const r = await fetch('/api/storage', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({action:'set', key, value: strValue})
    });
    return r.ok;
  }catch(e){ return false; }
}
async function kvRawDelete(key){
  try{
    const r = await fetch('/api/storage', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({action:'delete', key})
    });
    return r.ok;
  }catch(e){ return false; }
}
async function kvRawSetMany(items){
  try{
    const r = await fetch('/api/storage', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({action:'setMany', items})
    });
    return r.ok;
  }catch(e){ return false; }
}
async function kvRawDeleteMany(keys){
  try{
    const r = await fetch('/api/storage', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({action:'deleteMany', keys})
    });
    return r.ok;
  }catch(e){ return false; }
}

async function kvWriteSingle(key, str){ return kvRawSet(key, str); }
async function kvWriteChunked(key, str, size){
  const budget = Math.max(1024, size - 256); // 매니페스트/오버헤드 여유
  const parts = kvSplitSafe(str, budget);
  // 조각을 전부 쓴 "뒤에만" 매니페스트를 쓴다 — 중간에 실패하면 매니페스트가 없으니
  // 이전 값(있었다면)이 그대로 유효한 채로 남는다(반쯤 쓰인 손상 데이터를 읽는 사고 방지).
  for(let i=0;i<parts.length;i++){
    const ok = await kvRawSet(kvChunkKey(key,i), parts[i]);
    if(!ok) return false;
  }
  const manifest = JSON.stringify({__chunked:true, n:parts.length, len:str.length});
  return kvRawSet(key, manifest);
}

// 값 하나(문자열)를 안전하게 쓴다: 크기 초과 시 자동 청크, 실패 시 크기를 줄여가며
// 재시도, 바닥까지 줄여도 안 되면 백오프 후 몇 번 더 시도.
async function kvWriteResilient(key, str){
  const BACKOFF = [800, 2000, 5000];
  let firstTry = true;
  while(true){
    const size = kvGetSafeSize();
    const ok = kvByteLen(str) > size ? await kvWriteChunked(key, str, size) : await kvWriteSingle(key, str);
    if(ok){
      if(firstTry) kvGrowSafeSizeIfHealthy();
      return true;
    }
    kvBlockedThisSession = true;
    firstTry = false;
    if(size > KV_SIZE_FLOOR){
      kvShrinkSafeSize();
      await kvSleep(400);
      continue;
    }
    break; // 바닥 크기에서도 실패 → 아래 백오프 단계로
  }
  for(const delay of BACKOFF){
    await kvSleep(delay);
    const size = kvGetSafeSize(); // 이미 floor
    const ok = kvByteLen(str) > size ? await kvWriteChunked(key, str, size) : await kvWriteSingle(key, str);
    if(ok) return true;
  }
  return false;
}

async function apiGet(key){
  const {ok, value} = await kvRawGet(key);
  if(!ok || value == null) return null;
  let parsed;
  try{ parsed = JSON.parse(value); }catch(e){ return null; }
  if(parsed && typeof parsed === 'object' && parsed.__chunked){
    const parts = [];
    for(let i=0;i<parsed.n;i++){
      const c = await kvRawGet(kvChunkKey(key,i));
      if(!c.ok || c.value == null) return null; // 조각 하나라도 유실되면 이 항목은 통째로 "없음" 처리
      parts.push(c.value);
    }
    try{ return JSON.parse(parts.join('')); }catch(e){ return null; }
  }
  return parsed;
}
async function apiList(prefix){
  const rows = await kvRawList(prefix);
  return rows || [];
}
async function apiSet(key, value){
  const str = JSON.stringify(value);
  const ok = await kvWriteResilient(key, str);
  if(ok) return;
  // 실패로 확정하기 전에 서버 실제 상태를 재확인한다 — 요청은 반영됐는데 응답만
  // 유실된 경우를 "실패"로 잘못 알리지 않기 위함.
  const verified = await apiGet(key);
  if(JSON.stringify(verified) === str) return;
  throw new Error('save failed');
}
async function apiDelete(key){
  // 청크로 쓰인 값이면 조각들도 같이 지운다(고아 데이터 방지).
  const {ok, value} = await kvRawGet(key);
  if(ok && value != null){
    try{
      const parsed = JSON.parse(value);
      if(parsed && parsed.__chunked){
        for(let i=0;i<parsed.n;i++) await kvRawDelete(kvChunkKey(key,i));
      }
    }catch(e){}
  }
  await kvRawDelete(key);
}

// 여러 항목을 한 번에 저장 — 개별 요청 여러 번 대신 요청 하나로 묶어 보낸다(보안장비의
// "짧은 시간 다발 요청" 패턴 감지를 피하고, 왕복 횟수도 줄인다). 값 하나가 이미 안전
// 크기를 넘으면 배치에 넣지 않고 개별 청크 경로로 보낸다.
// apiSet과 마찬가지로, 끝까지 실패한 항목이 있으면(재확인까지 거친 뒤) 예외를 던진다 —
// 절대 조용히 실패를 삼키지 않는다.
async function apiSetMany(entries){
  if(!entries || !entries.length) return;
  const size = kvGetSafeSize();
  const big = [], small = [];
  entries.forEach(e=>{
    const str = JSON.stringify(e.value);
    (kvByteLen(str) > size ? big : small).push({key:e.key, str});
  });
  const failed = [];
  await Promise.all(big.map(async b=>{
    const ok = await kvWriteResilient(b.key, b.str);
    if(!ok) failed.push(b);
  }));
  failed.push(...await kvSendBatchAdaptive(small));
  if(!failed.length) return;
  const stillBad = [];
  for(const f of failed){
    const verified = await apiGet(f.key);
    if(JSON.stringify(verified) !== f.str) stillBad.push(f.key);
  }
  if(stillBad.length) throw new Error('save failed: ' + stillBad.join(', '));
}
// 실패한(재시도로도 안 된) {key,str} 목록을 반환한다 — apiSetMany가 최종 재확인에 쓴다.
async function kvSendBatchAdaptive(items){
  if(!items.length) return [];
  const size = kvGetSafeSize();
  const totalBytes = items.reduce((s,it)=>s+kvByteLen(it.str), 0);
  if(totalBytes <= size){
    let ok = await kvRawSetMany(items.map(it=>({key:it.key, value:it.str})));
    if(!ok){ await kvSleep(600); ok = await kvRawSetMany(items.map(it=>({key:it.key, value:it.str}))); }
    if(ok) return [];
  }
  if(items.length === 1){
    const ok = await kvWriteResilient(items[0].key, items[0].str); // 더 못 쪼갬 — 단건 경로로 폴백
    return ok ? [] : [items[0]];
  }
  kvBlockedThisSession = true;
  const mid = Math.ceil(items.length/2);
  const [a, b] = await Promise.all([
    kvSendBatchAdaptive(items.slice(0, mid)),
    kvSendBatchAdaptive(items.slice(mid))
  ]);
  return [...a, ...b];
}
async function apiDeleteMany(keys){
  if(!keys || !keys.length) return;
  const ok = await kvRawDeleteMany(keys);
  if(ok) return;
  if(keys.length === 1){ await kvRawDelete(keys[0]); return; }
  const mid = Math.ceil(keys.length/2);
  await apiDeleteMany(keys.slice(0,mid));
  await apiDeleteMany(keys.slice(mid));
}
