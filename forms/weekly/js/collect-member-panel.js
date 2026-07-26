function flushMemberDraft(){
  if(state.activeTab && String(state.activeTab).startsWith('m')){
    const pe=document.getElementById('draft-perf');
    const pl=document.getElementById('draft-plan');
    if(pe&&pl) draftBuffers[draftKey(currentMeta().weekKey, state.activeTab)]={perf:pe.value, plan:pl.value};
  }
}
function renderMemberPanel(memberId){
  const m = memberById(memberId);
  if(!m) return `<div class="empty">담당자 없음</div>`;
  const meta = currentMeta();
  const saved = memberReport(meta.weekKey, memberId) || {perf:'', plan:''};
  const draft = draftBuffers[draftKey(meta.weekKey, memberId)] || {perf:saved.perf||'', plan:saved.plan||''};

  // 히스토리 월
  let hy, hm;
  if(state.memberHistMonth){ hy=state.memberHistMonth.y; hm=state.memberHistMonth.m; }
  else { hy=meta.year; hm=meta.month; }

  const monthPrefix = `${hy}-${pad2(hm)}`;
  const histKeys = Object.keys(state.reports||{})
    .filter(k => k.startsWith(monthPrefix+'-W') && state.reports[k][memberId] && hasReport(state.reports[k][memberId]))
    .sort()
    .reverse();

  const openSet = expandedHist[memberId] || {};
  const histHtml = histKeys.length ? histKeys.map(k=>{
    const r = state.reports[k][memberId];
    const open = !!openSet[k];
    return `<div class="hist-acc">
      <div class="hist-acc-head" onclick="toggleMemberHist('${memberId}','${k}')">
        <div>
          <div class="t">${formatWeekKeyLabel(k)}${k===meta.weekKey?' · 현재 주차':''}</div>
          <div class="m">${r.savedAt?new Date(r.savedAt).toLocaleString('ko-KR'):''}</div>
        </div>
        <div style="display:flex;gap:6px;align-items:center">
          ${hasPerf(r)?badge('실적','done'):''}
          ${hasPlan(r)?badge('계획','done'):''}
          <span style="font-size:12px;color:#888">${open?'▲':'▼'}</span>
        </div>
      </div>
      <div class="hist-acc-body ${open?'open':''}">
        <div class="block"><b>실적</b><pre>${escapeHtml(r.perf||'(없음)')}</pre></div>
        <div class="block"><b>계획</b><pre>${escapeHtml(r.plan||'(없음)')}</pre></div>
        <button class="btn btn-outline btn-sm" onclick="event.stopPropagation(); loadHistToDraft('${memberId}','${k}')">이 내용을 현재 입력란에 불러오기</button>
      </div>
    </div>`;
  }).join('') : `<div class="empty">${hy}년 ${hm}월에 저장된 히스토리가 없습니다.</div>`;

  const rs = memberReportStatus(meta.weekKey, memberId);
  const rt = memberRateStatus(meta, memberId);

  return `
  <div class="card">
    <h2>✏️ ${escapeHtml(m.name)} · ${escapeHtml(meta.fullLabel)}</h2>
    <p class="hint">실적 ${meta.perfRange} / 계획 ${meta.planRange}<br>
      ${rs==='done'?badge('실적·계획 완료','done'):rs==='partial'?badge('일부 작성','partial'):badge('미작성','todo')}
      · 응대율 ${rt==='done'?badge('완료','done'):rt==='partial'?badge('일부','partial'):rt==='none'?badge('소관없음','partial'):badge('미작성','todo')}
    </p>
    <div class="field-label-row">
      <div class="field-label">실적 (${meta.perfRange})</div>
      ${memberId==='m1' ? `<button type="button" class="btn btn-outline btn-sm ai-draft-btn" id="aiDraftBtn" onclick="generateAiDraft('${memberId}')">🤖 깡비서 초안</button>` : ''}
    </div>
    <textarea class="input-area" id="draft-perf" placeholder="자유롭게 작성 (가/나/다, ○, ※ 형식이 있으면 취합 시 그대로 반영)">${escapeHtml(draft.perf)}</textarea>
    <div class="field-label">계획 (${meta.planRange})</div>
    <textarea class="input-area" id="draft-plan" placeholder="다음 주 계획">${escapeHtml(draft.plan)}</textarea>
    <div class="form-actions">
      <button class="btn btn-primary" onclick="saveMemberDraft('${memberId}')">💾 이번 주차 저장</button>
      <button class="btn btn-outline" onclick="switchTab('main')">메인 현황</button>
    </div>
  </div>
  <div class="card">
    <h2>🗂️ ${escapeHtml(m.name)} 주간 히스토리 (월별)</h2>
    <div class="month-nav">
      <button class="nav-btn" type="button" onclick="shiftMemberHistMonth(-1)">‹</button>
      <div class="lab">${hy}년 ${hm}월</div>
      <button class="nav-btn" type="button" onclick="shiftMemberHistMonth(1)">›</button>
    </div>
    <p class="hint">해당 월에 저장된 주차만 표시됩니다. 클릭하면 내용이 펼쳐집니다.</p>
    ${histHtml}
  </div>`;
}
function shiftMemberHistMonth(delta){
  const meta = currentMeta();
  let y = state.memberHistMonth?.y ?? meta.year;
  let m = state.memberHistMonth?.m ?? meta.month;
  m += delta;
  if(m<1){ m=12; y--; }
  if(m>12){ m=1; y++; }
  state.memberHistMonth = {y,m};
  saveState();
  flushMemberDraft(); // 입력 draft 보존 (activeTab은 그대로라 안전)
  renderAll();
}
function toggleMemberHist(memberId, weekKey){
  if(!expandedHist[memberId]) expandedHist[memberId]={};
  expandedHist[memberId][weekKey] = !expandedHist[memberId][weekKey];
  // 입력 draft 보존
  flushMemberDraft();
  renderAll();
}
function loadHistToDraft(memberId, weekKey){
  const r = memberReport(weekKey, memberId);
  if(!r) return;
  // weekKey는 "불러오는 원본"(과거 주차)일 뿐, 실제로 채워 넣는 곳은 지금 보고 있는 주차다.
  const meta = currentMeta();
  draftBuffers[draftKey(meta.weekKey, memberId)] = {perf:r.perf||'', plan:r.plan||''};
  flash('히스토리 내용을 입력란에 불러왔습니다. 저장 버튼을 눌러 현재 주차에 반영하세요.');
  renderAll();
}
// "깡비서 초안" — 강성호(m1) 전용. 깡비서.kr 캘린더/일일보고/업무로그 + 직전 주 본인 작성
// 내용을 서버(api/ai-weekly-draft.js)가 모아 Claude에게 실적/계획 초안을 만들게 한 뒤,
// 두 입력란을 채운다(자동 저장은 하지 않음 — 확인하고 「이번 주차 저장」을 눌러야 반영됨).
async function generateAiDraft(memberId){
  if(memberId !== 'm1') return; // 다른 담당자는 깡비서 데이터가 없어 이 기능 대상이 아님
  const btn = document.getElementById('aiDraftBtn');
  const meta = currentMeta();
  const prevEntry = prevWeekEntry(meta.year, meta.month, meta.weekOfMonth);
  const prevWeekKey = `${prevEntry.year}-${pad2(prevEntry.month)}-W${prevEntry.week.index}`;
  if(btn){ btn.disabled = true; btn.textContent = '⏳ 생성 중…'; }
  flash('깡비서 초안 생성 중… (캘린더·업무로그 불러오는 중)');
  try{
    const res = await fetch('/api/ai-weekly-draft', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({
        weekKey: meta.weekKey,
        prevWeekKey,
        year: meta.year,
        perfStart: fmtISO(meta.mon), perfEnd: fmtISO(meta.sun),
        planStart: fmtISO(meta.nextMon), planEnd: fmtISO(meta.nextSun)
      })
    });
    const data = await res.json();
    if(!res.ok || data.error) throw new Error(data.error || '생성 실패');
    draftBuffers[draftKey(meta.weekKey, memberId)] = {perf:data.perf||'', plan:data.plan||''};
    flash('깡비서 초안이 생성됐습니다 — 내용을 확인하고 「이번 주차 저장」을 눌러주세요.');
    renderAll();
  }catch(e){
    console.error(e);
    flash('초안 생성 실패: ' + (e.message || '네트워크를 확인해 주세요'));
    if(btn){ btn.disabled = false; btn.textContent = '🤖 깡비서 초안'; }
  }
}
function saveMemberDraft(memberId){
  const perf = document.getElementById('draft-perf').value;
  const plan = document.getElementById('draft-plan').value;
  const meta = currentMeta();
  const report = {perf, plan, savedAt:new Date().toISOString()};
  if(!state.reports[meta.weekKey]) state.reports[meta.weekKey]={};
  state.reports[meta.weekKey][memberId] = report;
  draftBuffers[draftKey(meta.weekKey, memberId)] = {perf, plan};
  // 이 담당자 몫의 키에만 쓴다 — 다른 담당자 데이터는 건드리지 않음(동시 저장 시 서로 덮어쓰지 않도록)
  saveKV(reportKey(meta.weekKey, memberId), report);
  flash(`${memberById(memberId).name} · ${meta.fullLabel} 저장 완료`);
  renderAll();
}
