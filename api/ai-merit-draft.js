// "본부장표창 공적조서" AI 초안 — 사용자가 두서없이 적어둔 실적 메모 + 작성 방향성을 받아
// 공적조서 3개 섹션(실적 요약 / 실적 달성을 위한 활동 / 핵심가치 실천·기타사항) 초안을 만든다.
//
// 이 파일은 저장소를 전혀 조회하지 않는다(주간보고 AI 초안과 다른 점) — 근거 자료를 사용자가
// 직접 입력란에 적어 넣는 구조이기 때문. 그래서 SUPABASE_* 환경변수도 필요 없다.
//
// AI 호출 방식은 api/ai-weekly-draft.js와 완전히 동일하다: 서강대 API Gateway를 먼저 시도하고
// 실패하면 Anthropic 직접호출로 자동 폴백. 두 파일 중 하나만 고치고 다른 쪽을 안 고치는 일이
// 없도록 주의(모델명/폴백 규칙이 어긋나면 한쪽만 조용히 옛 모델을 쓰게 된다).
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
// claude-sonnet-5는 Anthropic 직접호출 시 한글 응답이 간헐적으로 깨지는 문제가 깡비서 본체에서
// 실측 확인됨 — 반드시 claude-sonnet-4-6 사용.
const CLAUDE_MODEL = process.env.CLAUDE_MODEL || 'claude-sonnet-4-6';
const GATEWAY_BASE = (process.env.SOGANG_GATEWAY_BASE || 'https://factchat-cloud.mindlogic.ai/v1/gateway').replace(/\/$/, '');
const GATEWAY_KEY = process.env.SOGANG_GATEWAY_KEY || process.env.SOGANG_GATEWAY_API_KEY || '';
const GATEWAY_MODEL = process.env.SOGANG_GATEWAY_MODEL || 'claude-sonnet-4-6';

// 회사 핵심가치 — 3번 섹션은 반드시 이 문장들을 근거로 쓴다(사용자 지정, 임의로 바꾸지 말 것).
const CORE_VALUES = `- 고객을 가장 먼저 생각한다
- 동료를 존중한다
- 맡은 일은 끝까지 책임지는 자세
- 권한 위임과 자발적 역량 강화를 통한 전문성 기반 과감한 실행으로 성과를 창출`;

// r.json()이 한글 등 멀티바이트 응답을 간헐적으로 깨뜨리는 사례가 있어 버퍼를 명시적으로
// UTF-8 디코드한 뒤 파싱한다 — fetch 내부 인코딩 추정에 맡기지 않음.
async function readJsonBuf(r) {
  const buf = Buffer.from(await r.arrayBuffer());
  return JSON.parse(buf.toString('utf8'));
}
/** 서강대 API Gateway(OpenAI 호환 /chat/completions)로 Claude 호출 — 월 제공 크레딧 소모. */
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
      max_tokens: 3000,
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
      max_tokens: 3000,
      // temperature는 일부러 안 보낸다 — 고정값을 보내면 최신 모델이 "deprecated for this
      // model" 오류를 내는 걸 실측 확인해서 뺀 것.
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
  if (!ANTHROPIC_API_KEY) return res.status(500).json({ error: 'Server missing ANTHROPIC_API_KEY' });

  try {
    const { direction, rawFacts, name, rank, affiliation, meritField, period } = req.body || {};
    if (!rawFacts || !String(rawFacts).trim()) {
      return res.status(400).json({ error: '실적 내용을 먼저 입력해 주세요' });
    }

    const systemPrompt = `당신은 KTIS AICC사업2단 사업5팀의 "본부장표창 공적조서" 작성을 돕는 보조입니다.
담당자가 두서없이 적어둔 실적 메모를 읽고, 공적조서 3개 섹션의 초안을 작성하세요.

■ 각 섹션의 역할 (절대 서로 중복되게 쓰지 마세요)
1. 실적 요약 : 이 사람의 공적을 "무엇을 이뤄냈는가" 위주로 핵심만 압축. 3~4개 항목.
   결과·성과 중심으로 쓰고, 세부 실행 방법은 여기 쓰지 않는다.
2. 실적 달성을 위한 활동 : 1번의 성과를 "어떻게 해냈는가". 구체적인 실행 내용과 그로 인한
   효과를 상세하게. 각 항목마다 하위 항목으로 실제 한 일과 효과를 풀어쓴다. 가장 분량이 많은 섹션.
3. 핵심가치 실천/기타사항 : 아래 회사 핵심가치 중 이 사람의 행동에 실제로 해당하는 것을 골라,
   어떤 행동이 그 가치에 부합하는지 작성. 1·2번에서 쓴 성과를 반복하지 말고 "태도와 자세" 관점으로 쓴다.

■ 회사 핵심가치 (3번 섹션의 근거)
${CORE_VALUES}

■ 작성 형식 (반드시 지킬 것)
- 대분류 항목은 "( "로 시작한다. 예: "( 핵심 운영지표인 응대율을 목표 대비 초과 달성"
- 하위 항목은 "- "로 시작한다. 예: "- 운영인력 안정화를 바탕으로 상반기 응대율 누적 98% 이상 유지"
- 존댓말/설명체 없이 개조식으로 쓴다(…함, …기여, …구축 처럼 명사형/서술형 종결).
- 담당자 이름을 문장에 넣지 않는다(공적조서 특성상 주어 없이 서술).

■ 내용 원칙
- 입력 메모에서 확인되는 수치(%, 건수, 금액, 기간, 인원 등)는 반드시 살려서 객관적으로 강조한다.
- 메모에 근거가 있는 범위에서 "현실적으로 그럴듯한 세부 실행 내용"으로 문장을 풍부하게 만든다.
- 단, 메모에 전혀 근거가 없는 성과·수치를 지어내지 않는다. 과장된 미사여구도 쓰지 않는다.
- 수치가 없는 항목은 무리하게 숫자를 만들지 말고 정성적 성과로 쓴다.

출력은 다른 설명 없이 반드시 아래 형식 그대로:
===실적요약===
(1번 내용)
===활동===
(2번 내용)
===핵심가치===
(3번 내용)`;

    const meta = [
      name ? `성명: ${name}` : '',
      rank ? `직급(호칭): ${rank}` : '',
      affiliation ? `소속: ${affiliation}` : '',
      meritField ? `공적 분야: ${meritField}` : '',
      period ? `공적기간: ${period}` : '',
    ].filter(Boolean).join('\n');

    const userPrompt = `${meta ? `[대상자 정보]\n${meta}\n\n` : ''}${
      direction && String(direction).trim()
        ? `[작성 방향성 — 이 방향으로 강조해서 써주세요]\n${direction}\n\n`
        : ''
    }[실적 메모 (두서없이 작성된 원문)]\n${rawFacts}\n\n위 내용을 바탕으로 공적조서 3개 섹션 초안을 작성해줘.`;

    // 깡비서 본체와 동일하게: 게이트웨이 먼저 시도 → 실패하면 Anthropic 직접호출로 조용히 전환.
    let text;
    if (GATEWAY_KEY) {
      try {
        text = await callGatewayClaude({ system: systemPrompt, userMessage: userPrompt });
      } catch (gwErr) {
        console.error('[ai-merit-draft] 게이트웨이 실패, Claude 직접 호출로 전환:', gwErr.message);
        text = await callClaudeDirect({ system: systemPrompt, userMessage: userPrompt });
      }
    } else {
      text = await callClaudeDirect({ system: systemPrompt, userMessage: userPrompt });
    }

    const grab = (startRe, endRe) => {
      const m = text.match(startRe);
      if (!m) return '';
      const rest = text.slice(m.index + m[0].length);
      const e = endRe ? rest.match(endRe) : null;
      return (e ? rest.slice(0, e.index) : rest).trim();
    };
    const s1 = grab(/===\s*실적요약\s*===/, /===\s*활동\s*===/);
    const s2 = grab(/===\s*활동\s*===/, /===\s*핵심가치\s*===/);
    const s3 = grab(/===\s*핵심가치\s*===/, null);

    if (!s1 && !s2 && !s3) {
      // 마커가 하나도 안 잡히면 통째로 1번에 넣어 사용자가 직접 나눌 수 있게 한다.
      return res.status(200).json({ s1: text.trim(), s2: '', s3: '' });
    }
    return res.status(200).json({ s1, s2, s3 });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
