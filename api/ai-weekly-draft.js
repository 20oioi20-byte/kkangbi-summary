// "깡비서 초안" — 강성호(m1) 전용 AI 초안 생성.
// 깡비서.kr 캘린더(ktis_v11__events__{year})/일일보고(ktis_v11__reports)/업무로그(mt_meetings,
// mt_calls, mt_reports) + 이 시스템의 직전 주 강성호 작성 데이터를 모아 Claude에게 실적/계획
// 초안을 만들게 한다. 다른 담당자는 깡비서에 본인 데이터가 없어 이 기능을 쓰지 않는다
// (클라이언트도 m1에만 버튼을 노출하지만, 이 파일 자체가 항상 강성호 관련 자료만 조회한다 —
// memberId를 파라미터로 받지 않음).
//
// 자료 조회가 일부 실패해도(예: 해당 연도 이벤트 없음, 테이블 없음) 전체 요청을 실패시키지
// 않는다 — 있는 자료만으로 초안을 만들고, 부족하면 AI가 "(확인 필요)"로 표시하도록 지시한다.
const SB_URL = process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const CLAUDE_MODEL = process.env.CLAUDE_MODEL || 'claude-sonnet-4-6';
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
async function sbGetKV(key) {
  if (!isAllowedKey(key)) return null;
  try {
    const r = await sbFetch(`/rest/v1/rpt_kv?key=eq.${encodeURIComponent(key)}&select=value`);
    if (!r.ok) return null;
    const rows = await r.json();
    return rows[0] ? JSON.parse(rows[0].value) : null;
  } catch (e) { return null; }
}
async function sbGetTable(table, qs) {
  try {
    const r = await sbFetch(`/rest/v1/${table}?${qs}`);
    if (!r.ok) return [];
    const rows = await r.json();
    return Array.isArray(rows) ? rows : [];
  } catch (e) { return []; }
}
function inRange(dateStr, start, end) {
  if (!dateStr) return false;
  const d = String(dateStr).slice(0, 10);
  return d >= start && d <= end;
}
function joinBullets(v) {
  if (!v) return '';
  return Array.isArray(v) ? v.join('; ') : String(v);
}
function fmtList(arr, mapper) {
  return arr.length ? arr.map(mapper).join('\n') : '(자료 없음)';
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!SB_URL || !SB_KEY) return res.status(500).json({ error: 'Server missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY' });
  if (!ANTHROPIC_API_KEY) return res.status(500).json({ error: 'Server missing ANTHROPIC_API_KEY' });

  try {
    const { weekKey, prevWeekKey, year, perfStart, perfEnd, planStart, planEnd } = req.body || {};
    if (!weekKey || !perfStart || !perfEnd || !planStart || !planEnd) {
      return res.status(400).json({ error: 'missing required fields' });
    }
    const windowStart = perfStart < planStart ? perfStart : planStart;
    const windowEnd = perfEnd > planEnd ? perfEnd : planEnd;

    const years = new Set([Number(year), Number(String(planEnd).slice(0, 4))]);
    let events = [];
    for (const y of years) {
      const arr = await sbGetKV(`ktis_v11__events__${y}`);
      if (Array.isArray(arr)) events.push(...arr);
    }
    events = events.filter(e => inRange(e && e.date, windowStart, windowEnd));

    const reportsBlob = await sbGetKV('ktis_v11__reports');
    const dailyReports = (reportsBlob && Array.isArray(reportsBlob.dailyReports))
      ? reportsBlob.dailyReports.filter(r => inRange(r && r.date, windowStart, windowEnd))
      : [];

    const [meetings, calls, workReports] = await Promise.all([
      sbGetTable('mt_meetings', `select=title,meeting_date,summary_bullets,center,status&meeting_date=gte.${windowStart}&meeting_date=lte.${windowEnd}&order=meeting_date.desc&limit=80`),
      sbGetTable('mt_calls', `select=call_datetime,summary_bullets,center,counterpart_name,status&call_datetime=gte.${windowStart}&call_datetime=lte.${windowEnd}&order=call_datetime.desc&limit=80`),
      sbGetTable('mt_reports', `select=title,report_date,summary,center&report_date=gte.${windowStart}&report_date=lte.${windowEnd}&order=report_date.desc&limit=80`),
    ]);

    const prevReport = prevWeekKey ? await sbGetKV(`ktis_v11__weekly__rpt__${prevWeekKey}__m1`) : null;

    const contextText = `
[캘린더 일정 (${windowStart} ~ ${windowEnd})]
${fmtList(events, e => `- ${e.date}${e.time ? ' ' + e.time : ''} ${e.title || ''}${e.memo ? ' : ' + e.memo : ''}`)}

[일일보고]
${fmtList(dailyReports, r => `- ${r.date}: ${r.content || ''}`)}

[업무로그 - 미팅]
${fmtList(meetings, m => `- ${m.meeting_date} [${m.center || ''}] ${m.title || ''}${m.summary_bullets ? ' : ' + joinBullets(m.summary_bullets) : ''}`)}

[업무로그 - 통화]
${fmtList(calls, c => `- ${c.call_datetime} [${c.center || ''}] ${c.counterpart_name || ''}${c.summary_bullets ? ' : ' + joinBullets(c.summary_bullets) : ''}`)}

[업무로그 - 보고]
${fmtList(workReports, r => `- ${r.report_date} [${r.center || ''}] ${r.title || ''}${r.summary ? ' : ' + r.summary : ''}`)}

[직전 주(${prevWeekKey || '없음'}) 본인이 작성한 주간보고]
실적: ${prevReport && prevReport.perf ? prevReport.perf : '(없음)'}
계획: ${prevReport && prevReport.plan ? prevReport.plan : '(없음)'}
`.trim();

    const systemPrompt = `당신은 KTIS AICC사업2단 사업5팀 강성호 PM의 주간보고 작성을 돕는 보조입니다.
아래 자료(캘린더 일정, 일일보고, 업무로그, 직전 주 작성 내용)를 바탕으로 이번 주 "실적"과 다음 주 "계획"의 초안을 작성하세요.

반드시 지킬 형식 규칙:
1. 안건 제목은 "가.", "나.", "다." 순서로 시작 (하나의 안건 = 하나의 제목 줄)
2. 제목 아래 상세 내용은 앞에 "○ "를 붙인 줄로 작성
3. 참고사항(있는 경우만)은 앞에 "※ "를 붙인 줄로 작성
4. 실제로 자료에 근거가 있는 내용만 작성 — 근거 없는 내용을 지어내지 않는다
5. 자료가 부족해 확신이 서지 않으면 짧게만 쓰고 "(확인 필요)"라고 표시한다
6. 존댓말/설명체 없이 실제 업무 보고서처럼 간결한 개조식으로 작성

출력은 다른 설명 없이 반드시 아래 형식 그대로:
===실적===
(실적 내용)
===계획===
(계획 내용)`;

    const userPrompt = `${contextText}\n\n위 자료를 바탕으로 이번 주 실적과 다음 주 계획 초안을 작성해줘.`;

    const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: 1500,
        temperature: 0.4,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });
    if (!aiRes.ok) {
      const detail = await aiRes.text();
      return res.status(502).json({ error: 'AI 호출 실패', detail });
    }
    const aiData = await aiRes.json();
    const text = (aiData.content && aiData.content[0] && aiData.content[0].text) || '';
    const perfMatch = text.match(/===\s*실적\s*===([\s\S]*?)(===\s*계획\s*===|$)/);
    const planMatch = text.match(/===\s*계획\s*===([\s\S]*)$/);
    const perf = perfMatch ? perfMatch[1].trim() : text.trim();
    const plan = planMatch ? planMatch[1].trim() : '';

    return res.status(200).json({ perf, plan });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
