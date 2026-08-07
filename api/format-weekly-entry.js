// 주간보고 "양식 정리" — 담당자가 자유 문장으로 쓴 실적/계획 메모를 가/나/다·○·※ 양식으로
// 재구성한다. AI 초안(api/ai-weekly-draft.js)과 달리 외부 자료(캘린더/일일보고/업무로그)를
// 전혀 조회하지 않는다 — 순수하게 사용자가 이미 입력한 텍스트만 재구성·압축하는 텍스트 변환기다.
// 그래서 모든 담당자에게 열려있다(AI 초안은 깡비서.kr에 본인 데이터가 있는 강성호만 쓸 수 있음).
//
// 새로운 사실을 지어내면 안 된다 — 원문에 있는 내용만 재배열/요약한다. 이 endpoint가 실적/계획
// 내용을 만들어내면(AI 초안처럼) 안 되므로 프롬프트에서 이 경계를 명확히 긋는다.
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const CLAUDE_MODEL = process.env.CLAUDE_MODEL || 'claude-sonnet-4-6';
const GATEWAY_BASE = (process.env.SOGANG_GATEWAY_BASE || 'https://factchat-cloud.mindlogic.ai/v1/gateway').replace(/\/$/, '');
const GATEWAY_KEY = process.env.SOGANG_GATEWAY_KEY || process.env.SOGANG_GATEWAY_API_KEY || '';
const GATEWAY_MODEL = process.env.SOGANG_GATEWAY_MODEL || 'claude-sonnet-4-6';

async function readJsonBuf(r) {
  const buf = Buffer.from(await r.arrayBuffer());
  return JSON.parse(buf.toString('utf8'));
}
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

const SYSTEM_PROMPT = `당신은 KTIS AICC사업2단 사업5팀의 주간보고 작성 도우미입니다. 담당자가 편하게 자유
문장으로 쓴 실적/계획 메모를 회사 주간보고 양식 규칙에 맞게 "정리"만 합니다.

가장 중요한 규칙: 원문에 없는 내용(수치, 결론, 이유, 계획 등)을 지어내지 않습니다. 새 사실을
만들어내지 말고, 입력된 내용만 재배열·압축·개조식으로 다듬으세요.

반드시 지킬 형식 규칙:
1. 서로 다른 주제/안건마다 "가.", "나.", "다." 순서로 제목 줄을 만든다. 제목 앞에 아래 카테고리
   중 원문 내용에 가장 알맞은 것 하나를 대괄호로 붙인다: [리텐션] [인력] [계약] [기타]
   예: "가. [리텐션] KB손보 정비(15) 운영회의 진행(8.6)"
   안건과 안건 사이에 빈 줄을 넣지 않고 바로 이어서 작성한다.
2. 각 제목 바로 다음 줄에 공백 1칸 + "○ "로 시작하는 줄을 안건당 정확히 1개만 쓴다. 원문의
   핵심만 최대한 압축해서 2줄을 넘기지 않는다 — 원문을 그대로 옮기지 말고 개조식으로 다듬는다.
3. 참고사항(부가 조건, 후속 일정, 검토사항 등)이 원문에 있으면 공백 2칸 + "※ "로 시작하는 줄을
   그 아래에 추가한다(없으면 아예 생략).
4. 존댓말/설명체 없이 실제 업무 보고서처럼 간결한 개조식으로 작성한다(...함, ...진행 등).
5. 원문이 이미 이 규칙을 따르고 있으면(가/나/다 제목이 있으면) 내용을 그대로 유지하고 사소한
   표현만 다듬는다 — 이미 잘 정리된 내용을 임의로 재작성하지 않는다.
6. 한 원문 안에 여러 주제가 섞여 있으면 주제별로 나눠서 각각 "가.", "나."로 분리한다.
7. **괄호는 센터/사업명 뒤에 바로 붙는 짧은 코드에만 쓴다**(예: 정비(15), K뱅크(62), 손보(3석)).
   그 외의 설명·조건·시점·이유 등 문장형 내용은 절대 괄호로 묶지 않는다 — 이 시스템은 짧은
   코드가 아닌 괄호 내용을 워드 문서에서 자동으로 작은 위첨자 글씨로 바꾸기 때문에, 문장형
   내용을 괄호에 넣으면 실제 워드 출력에서 읽기 힘든 작은 글씨로 깨져 보인다. 그런 부가 설명은
   ○ 줄에 자연스럽게 풀어 쓰거나, 후속 조건/시점 성격이면 규칙 3의 ※ 참고사항 줄로 뺀다.
8. 다음처럼 비중이 작은 센터 운영·협의성 내용은 개별 안건으로 만들지 않고 제목을 정확히
   "소관센터 운영 관련"이라고만 쓴다(대괄호 카테고리 태그 없이) — VOC 대응, 정기 협의, 미팅,
   개선 요청, 해피콜, 단순 업무 확대 같은 짧고 사소한 협조성 내용이 해당된다. 반대로 재계약,
   원복공사, 운영종료, 계약체결, 입찰, 수의계약, 리텐션, 프로세스 재정비, 상담 프로세스 재정비
   처럼 비중 있는 주요 안건은 이 규칙 대상이 아니다 — 각자 구체적인 제목으로 별도 안건을 만든다.

출력 예시(줄바꿈·들여쓰기·안건 사이 빈 줄 없음까지 정확히 그대로 지킬 것 — 부가 설명은
괄호가 아니라 ※ 줄로 뺀 것에 주의):
가. [리텐션] KB손보 정비(15) 운영회의 진행(8.6)
 ○ 목적물소멸 미처리건 추가 인력투입 효과를 바탕으로 증원 필요성 제안
  ※ 추후 재계약 시점 적용 검토
나. 소관센터 운영 관련
 ○ (사소한 협조·미팅·VOC성 내용이 있을 때만 이 제목으로)

출력은 다른 설명 없이 반드시 아래 형식 그대로(해당 항목 원문이 없으면 그 섹션은 비워둘 것):
===실적===
(정리된 실적 내용, 없으면 빈 칸)
===계획===
(정리된 계획 내용, 없으면 빈 칸)`;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!ANTHROPIC_API_KEY) return res.status(500).json({ error: 'Server missing ANTHROPIC_API_KEY' });

  try {
    const { perf, plan } = req.body || {};
    const hasPerf = perf && String(perf).trim();
    const hasPlan = plan && String(plan).trim();
    if (!hasPerf && !hasPlan) {
      return res.status(400).json({ error: '정리할 내용이 없습니다' });
    }

    const userPrompt = `[실적 원문]\n${hasPerf ? perf : '(없음 — 정리하지 말 것)'}\n\n[계획 원문]\n${hasPlan ? plan : '(없음 — 정리하지 말 것)'}\n\n위 원문을 양식 규칙에 맞게 정리해줘.`;

    let text;
    if (GATEWAY_KEY) {
      try {
        text = await callGatewayClaude({ system: SYSTEM_PROMPT, userMessage: userPrompt });
      } catch (gwErr) {
        console.error('[format-weekly-entry] 게이트웨이 실패, Claude 직접 호출로 전환:', gwErr.message);
        text = await callClaudeDirect({ system: SYSTEM_PROMPT, userMessage: userPrompt });
      }
    } else {
      text = await callClaudeDirect({ system: SYSTEM_PROMPT, userMessage: userPrompt });
    }

    const perfMatch = text.match(/===\s*실적\s*===([\s\S]*?)(===\s*계획\s*===|$)/);
    const planMatch = text.match(/===\s*계획\s*===([\s\S]*)$/);
    const outPerf = hasPerf ? (perfMatch ? perfMatch[1].trim() : perf) : '';
    const outPlan = hasPlan ? (planMatch ? planMatch[1].trim() : plan) : '';

    return res.status(200).json({ perf: outPerf, plan: outPlan });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
