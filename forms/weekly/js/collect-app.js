function switchTab(id){
  // draft flush
  flushMemberDraft();
  flushFinalEditNow();
  state.activeTab = id;
  // 주의: 여기서 saveState()를 부르지 않는다(2026-07-27 발견). saveState()는 담당자/센터
  // 목록·응대율 컬럼폭·자료보관함 목록·응대율 기본값 규칙을 "배열 전체 덮어쓰기"로 서버에
  // 보낸다 — 이 데이터는 최초 접속 시 한 번만 불러오고 이후 새로고침하지 않으므로, 브라우저를
  // 오래 켜둔 사람이 탭만 눌러도(실제 편집 없이) 자기 브라우저의 오래된 스냅샷을 서버로 다시
  // 밀어넣어 그 사이 다른 사람이 추가/수정한 내용을 지워버릴 수 있다. activeTab 자체는
  // 서버로 보내지 않는 값이라(팀원마다 다른 탭을 보고 있어야 하므로) 애초에 저장할 이유도 없다.
  renderAll();
}
function renderTabs(){
  const meta = currentMeta();
  const wk = meta.weekKey;
  let html = `<button class="tab main-tab ${state.activeTab==='main'?'active':''}" onclick="switchTab('main')">📋 메인 취합</button>`;
  visibleMembers().forEach(m=>{
    const rs = memberReportStatus(wk, m.id);
    const rt = memberRateStatus(meta, m.id);
    let dot='no';
    if(rs==='done' && (rt==='done'||rt==='none')) dot='ok';
    else if(rs!=='todo' || (rt!=='todo'&&rt!=='none')) dot='part';
    html += `<button class="tab ${state.activeTab===m.id?'active':''}" onclick="switchTab('${m.id}')"><span class="dot ${dot}"></span>${escapeHtml(m.name)}</button>`;
  });
  html += `<button class="tab rate-tab ${state.activeTab==='rate'?'active':''}" onclick="switchTab('rate')">📊 응대율</button>`;
  html += `<button class="tab archive-tab ${state.activeTab==='archive'?'active':''}" onclick="switchTab('archive')">📁 자료보관함</button>`;
  html += `<button class="tab manage-tab ${state.activeTab==='manage'?'active':''}" onclick="switchTab('manage')">⚙️ 관리</button>`;
  document.getElementById('tabs').innerHTML = html;
}
function onWeekDateChange(){
  const v = document.getElementById('weekDate').value;
  if(!v) return;
  flushMemberDraft();
  flushFinalEditNow();
  anchorDate = new Date(v+'T00:00:00');
  refreshWeekChrome();
  renderAll();
}
function shiftWeek(delta){
  flushMemberDraft();
  flushFinalEditNow();
  const {year, month, week} = findWeekOfMonth(anchorDate);
  let entry = {year, month, week};
  const steps = Math.abs(delta);
  for(let i=0;i<steps;i++){
    entry = delta > 0
      ? nextWeekEntry(entry.year, entry.month, entry.week.index)
      : prevWeekEntry(entry.year, entry.month, entry.week.index);
  }
  anchorDate = new Date(entry.week.mon);
  document.getElementById('weekDate').value = fmtISO(anchorDate);
  refreshWeekChrome();
  renderAll();
}
function refreshWeekChrome(){
  const meta = currentMeta();
  document.getElementById('weekLabel').textContent = meta.fullLabel;
  document.getElementById('weekRange').textContent = `실적 ${meta.perfRange} · 계획 ${meta.planRange}`;
  document.getElementById('weekDate').value = fmtISO(meta.mon);
}
function renderAll(){
  // 주의: 여기서 flushMemberDraft()를 부르지 않는다. renderAll()이 호출되는 시점엔
  // state.activeTab이 이미 "다음" 탭으로 바뀌어 있는 경우가 많아서(예: switchTab),
  // 그때 DOM에 아직 남아있는 "이전" 탭의 입력값을 새 탭 담당자 것으로 잘못 저장해버리는
  // 사고가 났었다(2026-07-25). 초안을 남겨야 하는 곳(switchTab, shiftWeek 등)은
  // activeTab을 바꾸기 전에 각자 flushMemberDraft()를 직접 호출한다.
  renderTabs();
  // 응대율 탭은 월 단위(자체 월 이동 컨트롤)라 상단 "기준 주차" 네비게이션은 의미가 없어 숨기고,
  // 그 자리에 응대율 월 이동 컨트롤을 대신 채운다(두 개의 날짜 이동 UI가 동시에 보여서 헷갈리는 것을 방지).
  const isRate = state.activeTab==='rate';
  const weekNavGroup = document.getElementById('weekNavGroup');
  if(weekNavGroup) weekNavGroup.style.display = isRate ? 'none' : 'flex';
  const rateMonthNavGroup = document.getElementById('rateMonthNavGroup');
  if(rateMonthNavGroup){
    rateMonthNavGroup.style.display = isRate ? 'flex' : 'none';
    rateMonthNavGroup.innerHTML = isRate ? renderRateMonthNavBar() : '';
  }
  const panels=document.getElementById('panels');
  let html='';
  html += `<div class="panel ${state.activeTab==='main'?'active':''}">${state.activeTab==='main'?renderMainPanel():''}</div>`;
  visibleMembers().forEach(m=>{
    html += `<div class="panel ${state.activeTab===m.id?'active':''}">${state.activeTab===m.id?renderMemberPanel(m.id):''}</div>`;
  });
  html += `<div class="panel ${state.activeTab==='rate'?'active':''}">${state.activeTab==='rate'?renderRatePanel():''}</div>`;
  html += `<div class="panel ${state.activeTab==='archive'?'active':''}">${state.activeTab==='archive'?renderArchivePanel():''}</div>`;
  html += `<div class="panel ${state.activeTab==='manage'?'active':''}">${state.activeTab==='manage'?renderManagePanel():''}</div>`;
  panels.innerHTML=html;
}

(function init(){
  // 시드 주차(7.20~7.26 = 4주차)로 기본 진입
  anchorDate = new Date(2026, 6, 22); // 2026-07-22
  document.getElementById('weekDate').value = fmtISO(anchorDate);
  refreshWeekChrome();
  // 마이그레이션: 예전 키 무시
  renderAll();
})();
