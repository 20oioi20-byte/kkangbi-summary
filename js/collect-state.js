const STORE_KEY = 'kkangbi_weekly_collect_v3';
const ARCHIVE_MAX = 30;
const ARCHIVE_PAGE = 10;
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
    reports: JSON.parse(JSON.stringify(SEED_REPORTS)),
    // monthRates[YYYY-MM][centerId] = { w1,w2,w3,w4,w5, monthly, note, monthlyManual:bool }
    monthRates: {},
    aggregates: {}, // weekKey -> {perfRaw, planRaw, perfHtml, planHtml, linesPerf, linesPlan, savedAt}
    archive: [],    // {id, fileName, createdAt, weekKey, weekLabel, base64, size}
    activeTab: 'main',
    archivePage: 1,
    memberHistMonth: null, // {y,m} for member tab history nav
    // 응대율 표 컬럼 너비(px) — 사용자가 드래그로 조절한 값을 그대로 유지
    rateColWidths: {order:26, pm:64, cname:190, avg:62, wk1:56, wk2:56, wk3:56, wk4:56, wk5:56, reason:170, del:40}
  };
}
let state = loadState();
let anchorDate = new Date(); // 기준일 (주의 아무 날)
let draftBuffers = {};
let expandedHist = {}; // memberId -> weekKey set
function loadState(){
  try{
    const raw = localStorage.getItem(STORE_KEY);
    if(!raw) return defaultState();
    return Object.assign(defaultState(), JSON.parse(raw));
  }catch(e){ return defaultState(); }
}
function saveState(){
  try{ localStorage.setItem(STORE_KEY, JSON.stringify(state)); }
  catch(e){ flash('저장 공간 부족: 자료보관함 일부를 삭제해 주세요'); }
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
    if(v!==undefined && String(v).trim()!=='') filled++;
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
