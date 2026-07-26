const ARCHIVE_MAX = 30;
const ARCHIVE_PAGE = 10;
const UI_KEY = 'kkangbi_weekly_ui_v1'; // 화면 전용(탭/페이지) — 팀원 간 공유 안 함, 브라우저 로컬
const KP = 'ktis_v11__weekly';
const DEFAULT_MEMBERS = [
  {id:'m1', name:'강성호', hidden:false},
  {id:'m2', name:'이신영', hidden:false},
  {id:'m3', name:'노현미', hidden:false},
  {id:'m4', name:'김경수', hidden:false},
  {id:'m5', name:'최윤정', hidden:false}
];
const DEFAULT_CENTERS = [
  {id:'c1', name:'평택시청사업', ownerId:'m1', hidden:false},
  {id:'c2', name:'서울주택도시공사시설민원사업', ownerId:'m2', hidden:false},
  {id:'c3', name:'충주시청사업', ownerId:'m3', hidden:false},
  {id:'c4', name:'서울신용보증재단사업', ownerId:'m3', hidden:false},
  {id:'c5', name:'KBS사업', ownerId:'m2', hidden:false},
  {id:'c6', name:'K뱅크사업', ownerId:'m1', hidden:false},
  {id:'c7', name:'KB손해보험 제휴CS사업', ownerId:'m1', hidden:false},
  {id:'c8', name:'대신증권사업', ownerId:'m2', hidden:false},
  {id:'c9', name:'대신저축은행사업', ownerId:'m2', hidden:false}
];
const SEED_REPORTS = {
  '2026-07-W4': {
    m1: {perf:'한국투자신탁운용 고객센터(3석) 재계약 체결(7.20)\n○ 경쟁 → 수의, 계약기간 1년(26.8.5.~27.8.4.), 계약금액 169백만원\n케이뱅크(62) 상면 원복공사 요청(경영지원팀, 약 2억, 천장/바닥교체, 가벽 철거 등)', plan:'케이뱅크(62) 운영종료 대응\n○ 인건비 체크(잔여 연차, 7월 급여 등), 렌탈/보안서비스 해지(7.31자) 등\n※ 파일/교재/업무 출력물 등 정보보안 관련 처리 결과 : 8월 1주 별도 제출', savedAt:'2026-07-24T10:00:00'},
    m2: {perf:'KB손보부천(178) VOC민원 처리 업무확대 관련 프로세스 협의(7.20, 고객사/손보CNS/kt is)', plan:'서울신보(19) 상담 프로세스 재정비(7.28)\n○ 보이는 ARS 도입 후 다빈도 문의 유형 지정 → 스크립트 및 매뉴얼 재정비\nKB손보 계약정비(15) 고객사 운영관련 미팅(7.28)', savedAt:'2026-07-24T10:05:00'},
    m3: {perf:'SH시설민원(12) O/B보이스봇(타사 상품) 해피콜 업무 수행관련 개선 협의(7.23)', plan:'정운관세법인(5) 개인통관부호체계 개선(관세청, 8.15~) 대비 업무 협의 (7.31)', savedAt:'2026-07-24T10:10:00'}
  }
};
function defaultState(){
  return {
    members: JSON.parse(JSON.stringify(DEFAULT_MEMBERS)),
    centers: JSON.parse(JSON.stringify(DEFAULT_CENTERS)),
    reports: {},
    // monthRates[YYYY-MM][centerId] = { w1,w2,w3,w4,w5, monthly, note, monthlyManual:bool }
    monthRates: {},
    aggregates: {}, // weekKey -> {perfRaw, planRaw, perfHtml, planHtml, linesPerf, linesPlan, savedAt}
    archive: [],    // {id, fileName, createdAt, weekKey, weekLabel, base64, size}
    activeTab: 'main',
    archivePage: 1,
    memberHistMonth: null, // {y,m} for member tab history nav
    // 응대율 표 컬럼 너비(px) — 사용자가 드래그로 조절한 값을 그대로 유지
    rateColWidths: {order:26, pm:64, cname:190, avg:62, wk1:56, wk2:56, wk3:56, wk4:56, wk5:56, reason:170, del:58},
    // 응대율 기본값 규칙: {id, centerId, startKey, endKey, sy,sm,sw,ey,em,ew, value} — collect-rate-panel.js 참고
    rateDefaults: []
  };
}
let state = defaultState();
let anchorDate = new Date(); // 기준일 (주의 아무 날)
// 담당자 탭의 "아직 저장 안 한 입력중" 내용을 잠깐 들고 있는 버퍼.
// 반드시 주차별로 구분해야 한다 — memberId로만 구분하면, 이번 주에 쓰던 내용이
// 다음 주로 넘어가도 그대로 남아있다가 다음 주 내용을 고칠 때 그 주 것인 척 저장되면서
// 이전 주 데이터까지 덮어써버리는 사고가 난다(2026-07-25).
let draftBuffers = {};
function draftKey(weekKey, memberId){ return `${weekKey}__${memberId}`; }
let expandedHist = {}; // memberId -> weekKey set

// ── 화면 전용 상태(페이지 등) — 팀원마다 다를 수 있어 서버로 보내지 않고 브라우저에만 둔다.
// activeTab(현재 탭)은 일부러 기억하지 않는다 — 들어올 때마다 항상 "메인 취합" 탭부터 보여준다. ──
function loadUiPrefs(){
  try{
    const raw = localStorage.getItem(UI_KEY);
    if(!raw) return;
    const ui = JSON.parse(raw);
    if(ui.archivePage) state.archivePage = ui.archivePage;
    if(ui.memberHistMonth) state.memberHistMonth = ui.memberHistMonth;
  }catch(e){}
}
function saveUiPrefs(){
  try{
    localStorage.setItem(UI_KEY, JSON.stringify({
      archivePage: state.archivePage, memberHistMonth: state.memberHistMonth
    }));
  }catch(e){}
}

// apiGet/apiSet/apiList/apiDelete 는 shared/kv-client.js 제공 (index.html에서 이 파일보다 먼저 로드).
//
// 담당자별 실적/계획, 취합본, 응대율은 팀원 여러 명이 동시에 서로 다른 항목을 저장할 수 있으므로
// "주차 전체를 하나의 키로 통째로 저장"하면 안 된다 — A가 저장할 때 그 시점에 A의 브라우저가
// 갖고 있던 B/C의 (오래됐을 수 있는) 데이터까지 같이 덮어써서, A가 자기 것만 고쳤는데 다른 담당자
// 내용까지 바뀌어 보이는 문제가 생긴다. 그래서 담당자/취합본/응대율은 각각 "본인 몫의 키"에만
// 쓰고, 그 키를 쓰는 사람은 항상 그 담당자 자신(또는 취합 작업 중인 사람)뿐이도록 한다.
const WEEK_PREFIX = `${KP}__`; // ktis_v11__weekly__
function reportKey(weekKey, memberId){ return `${WEEK_PREFIX}rpt__${weekKey}__${memberId}`; }
function aggKey(weekKey){ return `${WEEK_PREFIX}agg__${weekKey}`; }
function rateKey(monthKey, centerId){ return `${WEEK_PREFIX}rate__${monthKey}__${centerId}`; }
function saveKV(key, value){
  apiSet(key, value).catch(()=> flash('저장 실패: 네트워크를 확인해 주세요'));
}

// 자료보관함: 워드 파일(base64)은 항목당 수십~수백KB가 될 수 있고 최대 30개까지 쌓이므로,
// "배열 전체를 한 키에" 저장하면 회사망 payload 크기 차단에 정면으로 걸리는 구조가 된다
// (dev-standards/network-resilient-storage.md 사고 사례와 동일 패턴). 그래서 목록(메타데이터만,
// base64 제외)과 각 항목의 실제 파일(base64)을 분리해서 저장한다 — 목록은 항상 작고, 파일은
// shared/kv-client.js가 필요하면 알아서 청크로 쪼개 보낸다.
function archiveIndexKey(){ return `${KP}_archive_index`; }
function archiveItemKey(id){ return `${KP}_archive_item__${id}`; }

// 최초 진입 시 서버에서 팀 공유 데이터를 불러와 state에 채우고 다시 렌더링한다.
// (스크립트 로드 시점엔 defaultState()로 즉시 그린 뒤, 서버 응답이 오면 갱신되는 구조)
async function loadState(){
  loadUiPrefs();
  try{
    const [membersV, centersV, widthsV, archiveIndexV, rateDefaultsV, weekRows] = await Promise.all([
      apiGet(`${KP}_members`),
      apiGet(`${KP}_centers`),
      apiGet(`${KP}_ratewidths`),
      apiGet(archiveIndexKey()),
      apiGet(`${KP}_ratedefaults`),
      apiList(WEEK_PREFIX)
    ]);
    if(membersV) state.members = membersV;
    if(centersV) state.centers = centersV;
    if(widthsV) state.rateColWidths = widthsV;
    if(archiveIndexV) state.archive = archiveIndexV; // 메타데이터만(base64 없음) — 다운로드 시 개별 조회
    if(rateDefaultsV) state.rateDefaults = rateDefaultsV;

    const reports = {}, aggregates = {}, monthRates = {};
    let hasAnyWeek = false;
    weekRows.forEach(row=>{
      const rest = row.key.slice(WEEK_PREFIX.length); // "rpt__2026-07-W4__m1" / "agg__2026-07-W4" / "rate__2026-07__c3"
      const tagSep = rest.indexOf('__');
      if(tagSep < 0) return;
      const tag = rest.slice(0, tagSep);
      const remainder = rest.slice(tagSep+2);
      let val;
      try{ val = JSON.parse(row.value); }catch(e){ return; }
      if(tag === 'rpt'){
        const sep = remainder.lastIndexOf('__');
        if(sep < 0) return;
        const wk = remainder.slice(0, sep), memberId = remainder.slice(sep+2);
        hasAnyWeek = true;
        if(!reports[wk]) reports[wk] = {};
        reports[wk][memberId] = val;
      } else if(tag === 'agg'){
        aggregates[remainder] = val; // remainder === weekKey
      } else if(tag === 'rate'){
        const sep = remainder.lastIndexOf('__');
        if(sep < 0) return;
        const mk = remainder.slice(0, sep), centerId = remainder.slice(sep+2);
        if(!monthRates[mk]) monthRates[mk] = {};
        monthRates[mk][centerId] = val;
      }
    });
    state.reports = hasAnyWeek ? reports : JSON.parse(JSON.stringify(SEED_REPORTS));
    state.aggregates = aggregates;
    state.monthRates = monthRates;
  }catch(e){
    flash('서버 데이터를 불러오지 못했습니다. 네트워크를 확인해 주세요');
    state.reports = JSON.parse(JSON.stringify(SEED_REPORTS));
  }
  if(typeof renderAll === 'function') renderAll();
}

let _saveTimer = null;
function saveState(){
  saveUiPrefs();
  clearTimeout(_saveTimer);
  _saveTimer = setTimeout(flushStateToServer, 300);
}
// 담당자/센터 "목록"과 자료보관함 목록(메타데이터만)은 여기서 요청 하나로 묶어 저장한다 —
// 이 셋은 보통 한 번에 한 사람(관리자)만 손대는 데이터라 통째로 덮어써도 실질적인 충돌
// 위험이 낮고, 개별 요청 여러 번 대신 배치 하나로 보내면 왕복 횟수가 줄어든다. 담당자
// 실적/계획/취합본/응대율은 각자 저장 시점에 reportKey/aggKey/rateKey로 개별 저장한다
// (아래 각 파일 참고). 자료보관함의 실제 파일(base64)은 archiveItemKey로 따로 저장된다.
function flushStateToServer(){
  apiSetMany([
    {key:`${KP}_members`, value: state.members},
    {key:`${KP}_centers`, value: state.centers},
    {key:`${KP}_ratewidths`, value: state.rateColWidths},
    {key: archiveIndexKey(), value: state.archive},
    {key:`${KP}_ratedefaults`, value: state.rateDefaults||[]},
  ]).catch(()=> flash('저장 실패: 네트워크를 확인해 주세요'));
}

function visibleMembers(){ return state.members.filter(m=>!m.hidden); }
function memberById(id){ return state.members.find(m=>m.id===id); }
function centerById(id){ return state.centers.find(c=>c.id===id); }
function visibleCenters(){ return state.centers.filter(c=>!c.hidden); }
function memberReport(weekKey, memberId){ return (state.reports[weekKey]||{})[memberId] || null; }
function hasPerf(r){ return !!(r && r.perf && r.perf.trim()); }
function hasPlan(r){ return !!(r && r.plan && r.plan.trim()); }
function hasReport(r){ return hasPerf(r) || hasPlan(r); }
function memberReportStatus(weekKey, memberId){
  const r = memberReport(weekKey, memberId);
  if(!hasReport(r)) return 'todo';
  if(hasPerf(r) && hasPlan(r)) return 'done';
  return 'partial';
}
function memberRateStatus(meta, memberId){
  const centers = state.centers.filter(c=>c.ownerId===memberId && !c.hidden);
  if(!centers.length) return 'none';
  const mr = (state.monthRates[meta.monthKey]||{});
  const wi = meta.weekOfMonth;
  let filled=0;
  centers.forEach(c=>{
    const row = mr[c.id]||{};
    const v = row['w'+wi];
    const hasExplicit = v!==undefined && String(v).trim()!=='';
    // 기본값 규칙으로 자동 채워지는 주차도 "작성됨"으로 본다 (collect-rate-panel.js의 findRateDefault)
    const hasDefault = !hasExplicit && typeof findRateDefault==='function' && findRateDefault(c.id, meta.year, meta.month, wi)!=null;
    if(hasExplicit || hasDefault) filled++;
  });
  if(filled===0) return 'todo';
  if(filled===centers.length) return 'done';
  return 'partial';
}
function escapeHtml(s){ return String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function badge(text, cls){ return `<span class="badge ${cls}">${text}</span>`; }
function flash(msg){
  const t=document.getElementById('toast');
  t.textContent=msg; t.classList.add('show');
  setTimeout(()=>t.classList.remove('show'), 2600);
}

loadState(); // 서버(Supabase) 데이터 비동기 로드 시작 — 완료되면 내부에서 renderAll() 재호출
