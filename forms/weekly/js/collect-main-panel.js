function renderMainPanel(){
  const meta = currentMeta();
  const wk = meta.weekKey;
  const members = visibleMembers();
  let doneR=0, todoR=0, doneRate=0, todoRate=0;
  members.forEach(m=>{
    const rs=memberReportStatus(wk,m.id);
    if(rs==='done') doneR++; else if(rs==='todo') todoR++;
    const rt=memberRateStatus(meta,m.id);
    if(rt==='done'||rt==='none') doneRate++; else if(rt==='todo') todoRate++;
  });

  const statusRows = members.map(m=>{
    const r=memberReport(wk,m.id);
    const rt=memberRateStatus(meta,m.id);
    return `<tr>
      <td class="name">${escapeHtml(m.name)}</td>
      <td>${hasPerf(r)?badge('실적 완료','done'):badge('실적 미작성','todo')}</td>
      <td>${hasPlan(r)?badge('계획 완료','done'):badge('계획 미작성','todo')}</td>
      <td>${rt==='none'?badge('소관없음','partial'):rt==='done'?badge('응대율 완료','done'):rt==='partial'?badge('응대율 일부','partial'):badge('응대율 미작성','todo')}</td>
      <td style="font-size:11px;color:#666">${r&&r.savedAt?new Date(r.savedAt).toLocaleString('ko-KR'):'—'}</td>
      <td><button class="btn-link" onclick="switchTab('${m.id}')">작성 탭</button></td>
    </tr>`;
  }).join('');

  const agg = state.aggregates[wk] || {};
  const finalPerf = agg.perfHtml || '';
  const finalPlan = agg.planHtml || '';

  // 주차별 목록
  const weekKeys = [...new Set([...Object.keys(state.reports||{}), ...Object.keys(state.aggregates||{})])].sort().reverse();
  const histHtml = weekKeys.length ? weekKeys.map(k=>{
    const written = members.filter(m=>hasReport(memberReport(k,m.id))).length;
    return `<div class="hist-acc">
      <div class="hist-acc-head" onclick="jumpToWeekKey('${k}')">
        <div><div class="t">${formatWeekKeyLabel(k)}${k===wk?' · 현재':''}</div>
        <div class="m">작성 ${written}/${members.length}명 ${state.aggregates[k]?'· 취합본 있음':''}</div></div>
        ${state.aggregates[k]?badge('취합','done'):badge('미취합','todo')}
      </div>
    </div>`;
  }).join('') : `<div class="empty">저장된 주차 내역이 없습니다.</div>`;

  return `
  <div class="summary-bar">
    <div class="summary-chip ok"><span>실적·계획 완료</span><b>${doneR} / ${members.length}</b></div>
    <div class="summary-chip no"><span>실적·계획 미착수</span><b>${todoR} 명</b></div>
    <div class="summary-chip ok"><span>응대율 완료</span><b>${doneRate} / ${members.length}</b></div>
    <div class="summary-chip no"><span>응대율 미착수</span><b>${todoRate} 명</b></div>
  </div>
  <div class="card">
    <h2>✅ ${escapeHtml(meta.fullLabel)} 작성 현황</h2>
    <p class="hint">메인에서는 <b>작성하지 않습니다</b>. 미작성 담당자는 「작성 탭」으로 이동하세요.</p>
    <table class="status-tbl">
      <thead><tr><th>담당자</th><th>실적</th><th>계획</th><th>응대율</th><th>최근 저장</th><th>이동</th></tr></thead>
      <tbody>${statusRows||`<tr><td colspan="6">담당자 없음</td></tr>`}</tbody>
    </table>
  </div>
  <div class="card doc-card">
    <h2>📄 취합 최종본 (워드 작성규칙 반영)</h2>
    <p class="hint">담당자 이름 표기 없이 내용만 취합 · 가/나/다 굵게 · ○ 한 칸 · ※ 두 칸 · 소관센터 운영 관련 병합 · 괄호 위첨자(센터 코드 괄호 제외) · <b>최종본을 직접 클릭해서 수정할 수 있습니다</b></p>
    <div class="doc-layout">
      <div>
        <img class="kt-logo" src="${KT_LOGO_DATAURI}" alt="kt is">
        <table class="word-table">
          <tr><td class="hdr-top" colspan="2">AICC사업2단</td></tr>
          <tr><td class="hdr-sub" colspan="2">실 적(${meta.perfRange})</td></tr>
          <tr>
            <td class="teamlabel">사업5팀</td>
            <td><div class="final-box" id="finalPerf" contenteditable="true" data-placeholder="[담당자 내용 전체 취합]을 누르면 여기에 정리됩니다. 직접 입력/수정도 가능합니다." oninput="onFinalEdit()">${finalPerf}</div></td>
          </tr>
          <tr><td class="hdr-sub" colspan="2">계 획(${meta.planRange})</td></tr>
          <tr>
            <td class="teamlabel">사업5팀</td>
            <td><div class="final-box" id="finalPlan" contenteditable="true" data-placeholder="[담당자 내용 전체 취합]을 누르면 여기에 정리됩니다. 직접 입력/수정도 가능합니다." oninput="onFinalEdit()">${finalPlan}</div></td>
          </tr>
        </table>
        ${(finalPerf||finalPlan) ? `<div class="final-badge">취합 완료 · 워드 저장 시 동일 양식 적용</div>` : ''}
      </div>
      <div class="doc-actions">
        <button class="btn btn-primary" onclick="doAggregate()">🔗 담당자 내용 전체 취합</button>
        <button class="btn btn-green btn-2line" onclick="saveWordAndArchive()">💾 워드저장<br><span class="btn-sub">(양식다운로드+보관함)</span></button>
        <button class="btn btn-outline" onclick="downloadRateExcel()">⬇ 응대율 엑셀</button>
      </div>
    </div>
  </div>
  <div class="card">
    <h2>🗂️ 주차별 저장 내역</h2>
    ${histHtml}
  </div>`;
}
function formatWeekKeyLabel(weekKey){
  // 2026-07-W4 → 2026년 7월 4주차
  const m = weekKey.match(/^(\d{4})-(\d{2})-W(\d+)$/);
  if(!m) return weekKey;
  return `${m[1]}년 ${+m[2]}월 ${+m[3]}주차`;
}
function jumpToWeekKey(weekKey){
  const m = weekKey.match(/^(\d{4})-(\d{2})-W(\d+)$/);
  if(!m) return;
  flushFinalEditNow();
  const year=+m[1], month=+m[2], wi=+m[3];
  const weeks = getWeeksOfMonth(year, month);
  const w = weeks[wi-1];
  if(!w) return;
  anchorDate = new Date(w.mon);
  document.getElementById('weekDate').value = fmtISO(anchorDate);
  refreshWeekChrome();
  renderAll();
}
let _finalEditTimer = null;
function onFinalEdit(){
  clearTimeout(_finalEditTimer);
  _finalEditTimer = setTimeout(flushFinalEditNow, 500);
}
function flushFinalEditNow(){
  clearTimeout(_finalEditTimer);
  const meta = currentMeta();
  const fp = document.getElementById('finalPerf');
  const fl = document.getElementById('finalPlan');
  if(!fp && !fl) return;
  if(!state.aggregates[meta.weekKey]) state.aggregates[meta.weekKey] = {};
  const agg = state.aggregates[meta.weekKey];
  if(fp){
    agg.perfHtml = fp.innerHTML;
    agg.linesPerf = domToDocLines(fp);
    agg.perfRaw = docLinesToRaw(agg.linesPerf);
  }
  if(fl){
    agg.planHtml = fl.innerHTML;
    agg.linesPlan = domToDocLines(fl);
    agg.planRaw = docLinesToRaw(agg.linesPlan);
  }
  agg.savedAt = new Date().toISOString();
  saveState();
}
function doAggregate(){
  const meta = currentMeta();
  const linesPerf = aggregateSection('perf');
  const linesPlan = aggregateSection('plan');
  if(!linesPerf.length && !linesPlan.length){
    flash('저장된 담당자 실적/계획이 없습니다. 담당자 탭에서 먼저 저장하세요.');
    return;
  }
  const perfHtml = docLinesToHtml(linesPerf);
  const planHtml = docLinesToHtml(linesPlan);
  state.aggregates[meta.weekKey] = {
    linesPerf, linesPlan,
    perfRaw: docLinesToRaw(linesPerf),
    planRaw: docLinesToRaw(linesPlan),
    perfHtml, planHtml,
    savedAt: new Date().toISOString()
  };
  saveState();
  flash('취합 완료 — 워드 작성규칙 반영');
  renderAll();
}
async function saveWordAndArchive(){
  flushFinalEditNow();
  const meta = currentMeta();
  let agg = state.aggregates[meta.weekKey];
  if(!agg || (!agg.linesPerf?.length && !agg.linesPlan?.length)){
    doAggregate();
    agg = state.aggregates[meta.weekKey];
  }
  if(!agg || (!agg.linesPerf?.length && !agg.linesPlan?.length)){
    flash('취합할 내용이 없습니다.');
    return;
  }
  try{
    const blob = await buildDocxBlob(meta, agg.linesPerf||[], agg.linesPlan||[]);
    const fileName = makeDocFileName(meta);
    const b64 = await blobToBase64(blob);
    // 보관함 추가 (최대 30, 초과 시 오래된 것 삭제)
    state.archive = state.archive || [];
    state.archive.unshift({
      id: 'a'+Date.now(),
      fileName,
      createdAt: new Date().toISOString(),
      weekKey: meta.weekKey,
      weekLabel: meta.fullLabel,
      base64: b64,
      size: blob.size
    });
    while(state.archive.length > ARCHIVE_MAX) state.archive.pop();
    state.archivePage = 1;
    saveState();
    downloadBlob(blob, fileName);
    flash(`저장 완료: ${fileName} (자료보관함 반영)`);
    renderAll();
  }catch(e){
    console.error(e);
    flash('워드 생성 중 오류가 발생했습니다.');
  }
}
