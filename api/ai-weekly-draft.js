// "깡비서 초안" — 강성호(m1) 전용 AI 초안 생성.
// 깡비서.kr 일일보고/업무로그(실제 운영 코드 C:\Users\user\kkangbi-calendar 기준으로
// 스키마 확인, 2026-07-26) + 이 시스템의 직전 주 강성호 작성 데이터를 모아 Claude에게 실적/계획
// 초안을 만들게 한다. 다른 담당자는 깡비서에 본인 데이터가 없어 이 기능을 쓰지 않는다
// (클라이언트도 m1에만 버튼을 노출하지만, 이 파일 자체가 항상 강성호 관련 자료만 조회한다 —
// memberId를 파라미터로 받지 않음).
//
// 캘린더 "일정"(이벤트)은 의도적으로 제외한다 — 회의/약속 제목 같은 단순 일정 항목이 초안에서
// 실제 업무 성과보다 과도하게 비중을 차지한다는 사용자 피드백(2026-07-30)에 따라, 일일보고
// 내용을 실적/계획 작성의 주 근거로 삼는다(업무로그도 계속 함께 참고).
//
// 자료 조회가 일부 실패해도 전체 요청을 실패시키지 않는다 — 있는 자료만으로 초안을 만들고,
// 부족하면 AI가 "(확인 필요)"로 표시하도록 지시한다.
const SB_URL = process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
// claude-sonnet-5는 Anthropic 직접호출 시 한글 응답이 간헐적으로 깨지는 문제가 깡비서 본체(api/chat.js)에서
// 실측 확인됨 — 반드시 claude-sonnet-4-6 사용(본체와 동일 컨벤션).
const CLAUDE_MODEL = process.env.CLAUDE_MODEL || 'claude-sonnet-4-6';
// 깡비서 본체(api/chat.js)와 동일하게 서강대 API Gateway(월 제공 크레딧)를 먼저 시도하고,
// 크레딧 소진/오류 등으로 실패하면 Anthropic 직접호출로 자동 전환한다.
const GATEWAY_BASE = (process.env.SOGANG_GATEWAY_BASE || 'https://factchat-cloud.mindlogic.ai/v1/gateway').replace(/\/$/, '');
const GATEWAY_KEY = process.env.SOGANG_GATEWAY_KEY || process.env.SOGANG_GATEWAY_API_KEY || '';
const GATEWAY_MODEL = process.env.SOGANG_GATEWAY_MODEL || 'claude-sonnet-4-6';
const KEY_PREFIX = 'ktis_v11__';
const WL_ITEM_PREFIX = 'ktis_v11__worklog__';

const WL_TYPE_LABEL = { meeting: '회의', call: '통화', report: '보고', mail: '메일', meet: '미팅', memo: '메모' };

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
async function sbListRaw(prefix) {
  try {
    const r = await sbFetch(`/rest/v1/rpt_kv?key=like.${encodeURIComponent(prefix)}*&select=key,value`);
    if (!r.ok) return [];
    const rows = await r.json();
    return Array.isArray(rows) ? rows : [];
  } catch (e) { return []; }
}
async function sbGetRaw(key) {
  if (!isAllowedKey(key)) return null;
  try {
    const r = await sbFetch(`/rest/v1/rpt_kv?key=eq.${encodeURIComponent(key)}&select=value`);
    if (!r.ok) return null;
    const rows = await r.json();
    return rows[0] ? rows[0].value : null;
  } catch (e) { return null; }
}
// 깡비서 플랫폼은 값이 크면 {key}__chunk__{i} 조각 + 매니페스트({__chunked:true,n,len})로 나눠
// 저장한다(이 프로젝트 shared/kv-client.js와 동일 방식) — 그대로 재조립해야 실제 값을 읽을 수 있다.
function looksChunked(v) {
  return typeof v === 'string' && v.length < 200 && v.indexOf('"__chunked"') >= 0;
}
async function resolveManifest(key, raw) {
  try {
    const mf = JSON.parse(raw);
    if (!(mf && mf.__chunked === true && mf.n > 0)) return JSON.parse(raw);
    const chunkRows = await sbListRaw(`${key}__chunk__`);
    const pieces = {};
    chunkRows.forEach(r => { const m = /__chunk__(\d+)$/.exec(r.key || ''); if (m) pieces[+m[1]] = r.value; });
    let full = '';
    for (let i = 0; i < mf.n; i++) { if (pieces[i] === undefined) return null; full += pieces[i]; }
    return JSON.parse(full);
  } catch (e) { return null; }
}
async function sbGetKV(key) {
  const raw = await sbGetRaw(key);
  if (raw == null) return null;
  if (looksChunked(raw)) return resolveManifest(key, raw);
  try { return JSON.parse(raw); } catch (e) { return null; }
}
// prefix로 여러 항목을 한 번에 읽고, 청크로 나뉜 항목은 병합해서 돌려준다(항목별 업무로그 등).
async function listResolvedKV(prefix) {
  const rows = await sbListRaw(prefix);
  const chunkMap = {}; // baseKey -> {idx: value}
  const baseRows = [];
  rows.forEach(row => {
    const m = /^(.+)__chunk__(\d+)$/.exec(row.key || '');
    if (m) { const bk = m[1], idx = +m[2]; if (!chunkMap[bk]) chunkMap[bk] = {}; chunkMap[bk][idx] = row.value; }
    else baseRows.push(row);
  });
  const out = [];
  for (const row of baseRows) {
    let value = row.value;
    if (looksChunked(value)) {
      try {
        const mf = JSON.parse(value);
        if (mf && mf.__chunked === true && mf.n > 0) {
          const pieces = chunkMap[row.key] || {};
          let full = ''; let ok = true;
          for (let i = 0; i < mf.n; i++) { if (pieces[i] === undefined) { ok = false; break; } full += pieces[i]; }
          value = ok ? full : null;
        }
      } catch (e) { /* not actually a manifest, keep raw */ }
    }
    if (value == null) continue;
    try { out.push({ key: row.key, value: JSON.parse(value) }); } catch (e) { /* skip unparsable */ }
  }
  return out;
}

function inRange(dateStr, start, end) {
  if (!dateStr) return false;
  const d = String(dateStr).slice(0, 10);
  return d >= start && d <= end;
}
function fmtList(arr, mapper) {
  return arr.length ? arr.map(mapper).join('\n') : '(자료 없음)';
}

// r.json()이 한글 등 멀티바이트 응답을 간헐적으로 깨뜨리는 사례가 있어(깡비서 본체 api/chat.js
// 실측) 버퍼를 명시적으로 UTF-8 디코드한 뒤 파싱한다 — fetch 내부 인코딩 추정에 맡기지 않음.
async function readJsonBuf(r) {
  const buf = Buffer.from(await r.arrayBuffer());
  return JSON.parse(buf.toString('utf8'));
}
/** 서강대 API Gateway(OpenAI 호환 /chat/completions)로 Claude 호출 — 월 제공 크레딧 소모.
 * 깡비서 본체 api/chat.js의 callGateway와 동일한 방식. */
async function callGatewayClaude({ system, userMessage }) {
  const r = await fetch(`${GATEWAY_BASE}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': GATEWAY_KEY },
    body: JSON.stringify({
      model: GATEWAY_MODEL,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: userMessage },
      ],
      max_tokens: 1500,
    }),
  });
  if (!r.ok) {
    const errText = await r.text().catch(() => '');
    throw new Error(`Gateway error (status ${r.status}): ${errText.slice(0, 200)}`);
  }
  const data = await readJsonBuf(r);
  const text = data?.choices?.[0]?.message?.content || '';
  if (!text) throw new Error('Gateway returned empty content');
  return text;
}
/** Anthropic 직접 호출 — 게이트웨이 미설정/실패 시 폴백. */
async function callClaudeDirect({ system, userMessage }) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 1500,
      // temperature는 일부러 안 보낸다 — 깡비서 본체(api/chat.js)에서 고정값을 보내면 최신
      // 모델이 "temperature is deprecated for this model" 오류를 내는 걸 실측 확인해서 뺀 것.
      system,
      messages: [{ role: 'user', content: userMessage }],
    }),
  });
  const data = await readJsonBuf(r);
  if (!r.ok) {
    const msg = data?.error?.message || `Claude error (status ${r.status})`;
    throw new Error(msg);
  }
  const text = (data.content || []).filter(b => b.type === 'text').map(b => b.text || '').join('').trim();
  if (!text) throw new Error('Claude returned empty content');
  return text;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!SB_URL || !SB_KEY) return res.status(500).json({ error: 'Server missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY' });
  if (!ANTHROPIC_API_KEY) return res.status(500).json({ error: 'Server missing ANTHROPIC_API_KEY' });

  try {
    const { weekKey, prevWeekKey, perfStart, perfEnd, planStart, planEnd } = req.body || {};
    if (!weekKey || !perfStart || !perfEnd || !planStart || !planEnd) {
      return res.status(400).json({ error: 'missing required fields' });
    }
    const windowStart = perfStart < planStart ? perfStart : planStart;
    const windowEnd = perfEnd > planEnd ? perfEnd : planEnd;

    // 자료 조회는 서로 의존관계가 없어 병렬로 실행한다(순차 호출 대비 대기 시간 단축).
    // 단, AI 모델 자체가 답을 생성하는 시간(수 초)은 이 최적화와 무관하게 그대로 걸린다 —
    // callGatewayClaude/callClaudeDirect 호출 자체가 병목이며 더 줄일 수 있는 여지가 없다.
    const [reportsBlob, wlAgg, wlItems, prevReport] = await Promise.all([
      sbGetKV('ktis_v11__reports'),
      sbGetKV('ktis_v11__worklogs'),
      listResolvedKV(WL_ITEM_PREFIX),
      prevWeekKey ? sbGetKV(`ktis_v11__weekly__rpt__${prevWeekKey}__m1`) : Promise.resolve(null),
    ]);

    // 1) 일일보고 (ktis_v11__reports.dailyReports) — 캘린더 "일정"은 의도적으로 제외(위 주석 참고).
    const dailyReports = (reportsBlob && Array.isArray(reportsBlob.dailyReports))
      ? reportsBlob.dailyReports.filter(r => inRange(r && r.date, windowStart, windowEnd))
      : [];

    // 2) 업무로그 — 구 통합 키(ktis_v11__worklogs) + 항목별 키(ktis_v11__worklog__{id}) 병합,
    //    항목별이 우선(같은 id면 항목별 값으로 덮어씀) — 깡비서 본체 storage.js와 동일한 병합 규칙.
    const wlMap = new Map();
    ((wlAgg && wlAgg.workLogs) || []).forEach(w => { if (w && w.id) wlMap.set(w.id, w); });
    wlItems.forEach(({ value: w }) => { if (w && w.id) wlMap.set(w.id, w); });
    const workLogs = [...wlMap.values()]
      .filter(w => inRange(w && w.date, windowStart, windowEnd))
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
      .slice(0, 100);
    // 3) 이 시스템 자체의 직전 주 강성호 작성 내용은 위 Promise.all에서 이미 조회됨(prevReport)

    const contextText = `
[일일보고]
${fmtList(dailyReports, r => `- ${r.date}: ${r.content || ''}`)}

[업무로그]
${fmtList(workLogs, w => `- ${w.date} [${WL_TYPE_LABEL[w.type] || w.type || ''}]${w.center ? ' ' + w.center : ''} ${w.title || ''}${(w.oneLiner || w.aiSummary) ? ' : ' + (w.oneLiner || w.aiSummary) : ''}${w.followUp ? ' (후속: ' + w.followUp + ')' : ''}${w.nextMeeting ? ' (다음 일정: ' + w.nextMeeting + ')' : ''}`)}

[직전 주(${prevWeekKey || '없음'}) 본인이 작성한 주간보고]
실적: ${prevReport && prevReport.perf ? prevReport.perf : '(없음)'}
계획: ${prevReport && prevReport.plan ? prevReport.plan : '(없음)'}
`.trim();

    const systemPrompt = `당신은 KTIS AICC사업2단 사업5팀 강성호 PM의 주간보고 작성을 돕는 보조입니다.
아래 자료(일일보고, 업무로그, 직전 주 작성 내용)를 바탕으로 이번 주 "실적"과 다음 주 "계획"의 초안을 작성하세요.
일일보고 내용을 실적/계획의 핵심 근거로 삼고, 업무로그는 세부 사실 확인·보완용으로 참고하세요.

반드시 지킬 형식 규칙:
1. 안건 제목은 "가.", "나.", "다." 순서로 시작한다(하나의 안건 = 하나의 제목 줄). 안건과 안건 사이에 빈 줄을 넣지 말고 바로 이어서 작성한다.
2. 각 제목 바로 다음 줄에 공백 1칸 + "○ "로 시작하는 줄을 안건당 정확히 1개만 작성한다. 여러 개로 나누지 말고 핵심만 최대한 요약해서 2줄을 넘기지 않는다.
3. 참고사항이 있을 때만 공백 2칸 + "※ "로 시작하는 줄을 그 아래에 추가한다(없으면 아예 생략).
4. 실제로 자료에 근거가 있는 내용만 작성 — 근거 없는 내용을 지어내지 않는다
5. 자료가 부족해 확신이 서지 않으면 짧게만 쓰고 "(확인 필요)"라고 표시한다
6. 존댓말/설명체 없이 실제 업무 보고서처럼 간결한 개조식으로 작성

출력 예시(줄바꿈·들여쓰기·안건 사이 빈 줄 없음까지 정확히 그대로 지킬 것):
가. 안건 제목
 ○ 핵심만 최대한 요약한 한두 줄
  ※ 참고사항(있는 경우만)
나. 다음 안건 제목
 ○ 핵심만 최대한 요약한 한두 줄

출력은 다른 설명 없이 반드시 아래 형식 그대로:
===실적===
(위 규칙을 지킨 실적 내용)
===계획===
(위 규칙을 지킨 계획 내용)`;

    const userPrompt = `${contextText}\n\n위 자료를 바탕으로 이번 주 실적과 다음 주 계획 초안을 작성해줘.`;

    // 깡비서 본체와 동일하게: 게이트웨이(SOGANG_GATEWAY_KEY 설정 시) 먼저 시도 → 실패하면
    // Anthropic 직접호출로 조용히 전환. 사용자에게는 결과만 보이면 된다.
    let text;
    if (GATEWAY_KEY) {
      try {
        text = await callGatewayClaude({ system: systemPrompt, userMessage: userPrompt });
      } catch (gwErr) {
        console.error('[ai-weekly-draft] 게이트웨이 실패, Claude 직접 호출로 전환:', gwErr.message);
        text = await callClaudeDirect({ system: systemPrompt, userMessage: userPrompt });
      }
    } else {
      text = await callClaudeDirect({ system: systemPrompt, userMessage: userPrompt });
    }

    const perfMatch = text.match(/===\s*실적\s*===([\s\S]*?)(===\s*계획\s*===|$)/);
    const planMatch = text.match(/===\s*계획\s*===([\s\S]*)$/);
    const perf = perfMatch ? perfMatch[1].trim() : text.trim();
    const plan = planMatch ? planMatch[1].trim() : '';

    return res.status(200).json({ perf, plan });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
