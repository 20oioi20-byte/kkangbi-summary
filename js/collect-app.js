function switchTab(id){
  // draft flush
  flushMemberDraft();
  flushFinalEditNow();
  state.activeTab = id;
  saveState();
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
  flushFinalEditNow();
  anchorDate = new Date(v+'T00:00:00');
  refreshWeekChrome();
  renderAll();
}
function shiftWeek(delta){
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
  flushMemberDraft();
  renderTabs();
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
