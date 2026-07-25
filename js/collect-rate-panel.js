function renderRatePanel(){
  const meta = currentMeta();
  // 응대율 표시 월 = 기준 주차의 월
  if(!state._rateMonth){ state._rateMonth = {y:meta.year, m:meta.month}; }
  const ry = state._rateMonth.y, rm = state._rateMonth.m;
  const monthKey = `${ry}-${pad2(rm)}`;
  const weeks = getWeeksOfMonth(ry, rm);
  const monthShort = `${String(ry).slice(2)}.${rm}월`;
  if(!state.monthRates[monthKey]) state.monthRates[monthKey]={};

  // 정렬하지 않음 — state.centers 배열 순서 그대로(사용자가 순서 변경 버튼으로 직접 관리)
  const centers = visibleCenters();

  // 헤더: 주차 5칸 고정 (없으면 빈 주)
  const weekCols = [1,2,3,4,5].map(i=>{
    const w = weeks[i-1];
    const sub = w ? w.rangeLabel : '-';
    return {i, sub, exists:!!w};
  });

  let headWeeks = weekCols.map(w=>`
    <th class="wk-col">
      ${w.i}주
      <span class="th-sub">${w.sub}</span>
      <div class="copy-row"><button class="btn btn-outline btn-sm" type="button" onclick="copyWeekRates('${monthKey}',${w.i})" ${w.exists?'':'disabled'}>복사</button></div>
      <span class="col-resizer" data-col="wk${w.i}" onmousedown="startColResize(event,'wk${w.i}')"></span>
    </th>`).join('');

  const memberOptions = (selId)=> state.members.map(m=>`<option value="${m.id}" ${m.id===selId?'selected':''}>${escapeHtml(m.name)}</option>`).join('');

  const rows = centers.map((c,idx)=>{
    const row = state.monthRates[monthKey][c.id] || {};
    // 월 평균 자동
    const vals = [1,2,3,4,5].map(i=>parseFloat(row['w'+i])).filter(v=>!isNaN(v));
    const autoAvg = vals.length ? (vals.reduce((a,b)=>a+b,0)/vals.length) : '';
    const monthly = row.monthlyManual ? (row.monthly??'') : (autoAvg===''?'':(Math.round(autoAvg*10)/10));
    const weekInputs = weekCols.map(w=>`
      <td class="wk-col"><span class="pct-wrap"><input type="text" inputmode="decimal" data-cid="${c.id}" data-f="w${w.i}"
        value="${escapeHtml(row['w'+w.i]??'')}" ${w.exists?'':'disabled'}
        onchange="onRateCellChange('${monthKey}','${c.id}','w${w.i}',this.value); renderAll();"></span></td>`).join('');
    return `<tr>
      <td class="order-cell">
        <div class="order-cell-inner">
          <button class="ord-btn" type="button" onclick="moveCenter('${c.id}',-1)" ${idx===0?'disabled':''} title="위로">▲</button>
          <button class="ord-btn" type="button" onclick="moveCenter('${c.id}',1)" ${idx===centers.length-1?'disabled':''} title="아래로">▼</button>
        </div>
      </td>
      <td class="pm"><select data-cid="${c.id}" onchange="updateCenterField('${c.id}','owner',this.value)">${memberOptions(c.ownerId)}</select></td>
      <td class="cname"><input type="text" value="${escapeHtml(c.name)}" onchange="updateCenterField('${c.id}','name',this.value)"></td>
      <td class="avg-col"><span class="pct-wrap"><input class="auto" type="text" inputmode="decimal" title="주차별 평균 자동 / 직접 수정 가능"
        value="${escapeHtml(String(monthly??''))}"
        onchange="onRateCellChange('${monthKey}','${c.id}','monthly',this.value,true); renderAll();"></span></td>
      ${weekInputs}
      <td class="note-cell"><input class="note-in" type="text" title="${escapeHtml(row.note||'')}"
        value="${escapeHtml(row.note||'')}"
        onchange="onRateCellChange('${monthKey}','${c.id}','note',this.value); this.title=this.value;"></td>
      <td class="del-cell"><button class="btn-link" style="color:#a33;" onclick="deleteCenterInline('${c.id}')">삭제</button></td>
    </tr>`;
  }).join('');

  const cw = state.rateColWidths;
  const colgroupHtml = `
    <colgroup>
      <col id="rmcol-order" style="width:${cw.order}px;">
      <col id="rmcol-pm" style="width:${cw.pm}px;">
      <col id="rmcol-cname" style="width:${cw.cname}px;">
      <col id="rmcol-avg" style="width:${cw.avg}px;">
      <col id="rmcol-wk1" style="width:${cw.wk1}px;">
      <col id="rmcol-wk2" style="width:${cw.wk2}px;">
      <col id="rmcol-wk3" style="width:${cw.wk3}px;">
      <col id="rmcol-wk4" style="width:${cw.wk4}px;">
      <col id="rmcol-wk5" style="width:${cw.wk5}px;">
      <col id="rmcol-reason" style="width:${cw.reason}px;">
      <col id="rmcol-del" style="width:${cw.del}px;">
    </colgroup>`;
  const rez = (key)=> `<span class="col-resizer" data-col="${key}" onmousedown="startColResize(event,'${key}')"></span>`;

  return `
  <div class="card">
    <h2>📊 응대율 (월 단위)</h2>
    <div class="month-nav">
      <button class="nav-btn" type="button" onclick="shiftRateMonth(-1)">‹</button>
      <div class="lab">${ry}년 ${rm}월</div>
      <button class="nav-btn" type="button" onclick="shiftRateMonth(1)">›</button>
    </div>
    <p class="hint">
      숫자만 입력해도 %가 자동으로 붙습니다. 표 안에서 <b>담당자·센터명을 바로 수정</b>하고, <b>▲▼</b>로 순서를 변경하고, <b>+ 센터 추가</b>로 새 줄을 만들 수 있습니다.<br>
      <b>컬럼 경계선에 마우스를 올려 드래그하면 폭을 직접 조절</b>할 수 있습니다. 비고칸은 내용이 길면 …으로 줄여 표시되며, 클릭하면 전체 내용이 펼쳐집니다.
      각 주차 <b>복사</b> 버튼 → 센터 순서대로 값이 줄바꿈 복사됩니다. 엑셀 A1에 붙여넣으면 A1, A2, A3…에 순서대로 들어갑니다.
    </p>
    <div class="rate-wrap">
      <table class="rate-matrix" id="rateMatrixTable">
        ${colgroupHtml}
        <thead>
          <tr>
            <th rowspan="2"></th>
            <th rowspan="2">PM${rez('pm')}</th>
            <th rowspan="2">센터명${rez('cname')}</th>
            <th class="top-title" colspan="6">${escapeHtml(monthShort)} 응대율</th>
            <th rowspan="2" class="reason-col">목표대비 미달사유 및 개선계획<br>(특이사항 포함)${rez('reason')}</th>
            <th rowspan="2"></th>
          </tr>
          <tr>
            <th>${rm}월${rez('avg')}</th>
            ${headWeeks}
          </tr>
        </thead>
        <tbody>
          ${rows || `<tr><td colspan="11">센터가 없습니다. 아래 「+ 센터 추가」로 만들어보세요.</td></tr>`}
          <tr><td colspan="11" class="foot-note">* ${rm}월 항목 값 : 월 누적 평균값은 주차별 값의 평균으로 자동 반영 / 수정 가능</td></tr>
        </tbody>
      </table>
    </div>
    <button class="add-row-btn" onclick="addCenterInline()">+ 센터 추가</button>
    <div class="form-actions">
      <button class="btn btn-primary" onclick="saveRateMonth()">💾 응대율 저장</button>
      <button class="btn btn-green" onclick="downloadRateExcel()">⬇ 엑셀 다운로드</button>
    </div>
  </div>`;
}
function startColResize(e, key){
  e.preventDefault();
  e.stopPropagation();
  const colEl = document.getElementById('rmcol-'+key);
  if(!colEl) return;
  const startX = e.clientX;
  const startWidth = colEl.getBoundingClientRect().width || state.rateColWidths[key] || 40;
  const table = document.getElementById('rateMatrixTable');
  const handle = e.target;
  if(table) table.classList.add('resizing-active');
  handle.classList.add('resizing');

  function onMove(ev){
    const delta = ev.clientX - startX;
    const newWidth = Math.max(24, Math.round(startWidth + delta));
    colEl.style.width = newWidth + 'px';
  }
  function onUp(ev){
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
    if(table) table.classList.remove('resizing-active');
    handle.classList.remove('resizing');
    const delta = ev.clientX - startX;
    const newWidth = Math.max(24, Math.round(startWidth + delta));
    state.rateColWidths[key] = newWidth;
    saveState();
  }
  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
}
function moveCenter(id, dir){
  const idx = state.centers.findIndex(c=>c.id===id);
  if(idx<0) return;
  const swapIdx = idx+dir;
  if(swapIdx<0 || swapIdx>=state.centers.length) return;
  const tmp = state.centers[idx];
  state.centers[idx] = state.centers[swapIdx];
  state.centers[swapIdx] = tmp;
  saveState();
  renderAll();
}
function updateCenterField(id, field, value){
  const c = centerById(id); if(!c) return;
  if(field==='name') c.name = value.trim() || c.name;
  else if(field==='owner') c.ownerId = value;
  saveState();
  renderAll();
}
function deleteCenterInline(id){
  const c = centerById(id); if(!c) return;
  if(!confirm(`「${c.name}」 센터를 삭제할까요?`)) return;
  state.centers = state.centers.filter(x=>x.id!==id);
  saveState();
  flash('센터가 삭제되었습니다');
  renderAll();
}
function addCenterInline(){
  const ownerId = (state.members[0]||{}).id;
  const id = 'c'+Date.now();
  state.centers.push({id, name:'새 센터', ownerId, hidden:false});
  saveState();
  renderAll();
}
function shiftRateMonth(delta){
  if(!state._rateMonth){
    const meta=currentMeta();
    state._rateMonth={y:meta.year,m:meta.month};
  }
  state._rateMonth.m += delta;
  if(state._rateMonth.m<1){ state._rateMonth.m=12; state._rateMonth.y--; }
  if(state._rateMonth.m>12){ state._rateMonth.m=1; state._rateMonth.y++; }
  renderAll();
}
function onRateCellChange(monthKey, cid, field, value, isMonthly){
  if(!state.monthRates[monthKey]) state.monthRates[monthKey]={};
  if(!state.monthRates[monthKey][cid]) state.monthRates[monthKey][cid]={};
  const row = state.monthRates[monthKey][cid];
  const clean = String(value??'').replace('%','').trim();
  if(field==='monthly'){
    row.monthly = clean;
    row.monthlyManual = true;
  } else if(field==='note'){
    row.note = value;
  } else {
    row[field] = clean;
    // 주 변경 시 수동 월값이 없으면 자동 재계산 위해 manual 해제하지 않음 — 수동 아니면 표시만 자동
    if(!row.monthlyManual){
      const vals = [1,2,3,4,5].map(i=>parseFloat(row['w'+i])).filter(v=>!isNaN(v));
      row.monthly = vals.length ? String(Math.round(vals.reduce((a,b)=>a+b,0)/vals.length*10)/10) : '';
    }
  }
  saveState();
}
function saveRateMonth(){
  // input onchange already saves; force re-read DOM for safety
  const meta = currentMeta();
  const ry = state._rateMonth?.y ?? meta.year;
  const rm = state._rateMonth?.m ?? meta.month;
  const monthKey = `${ry}-${pad2(rm)}`;
  document.querySelectorAll('.rate-matrix input[data-cid]').forEach(inp=>{
    const cid = inp.getAttribute('data-cid');
    const f = inp.getAttribute('data-f');
    if(!cid||!f) return;
    if(!state.monthRates[monthKey]) state.monthRates[monthKey]={};
    if(!state.monthRates[monthKey][cid]) state.monthRates[monthKey][cid]={};
    state.monthRates[monthKey][cid][f] = String(inp.value??'').replace('%','').trim();
  });
  saveState();
  flash(`${ry}년 ${rm}월 응대율 저장 완료 · 값은 계속 유지됩니다`);
  renderAll();
}
async function copyWeekRates(monthKey, weekIdx){
  const centers = visibleCenters();
  const lines = centers.map(c=>{
    const row = (state.monthRates[monthKey]||{})[c.id] || {};
    return row['w'+weekIdx] ?? '';
  });
  const text = lines.join('\n');
  try{
    await navigator.clipboard.writeText(text);
    flash(`${weekIdx}주 응대율 ${lines.length}건 복사됨 — 엑셀 A1에 붙여넣기`);
  }catch(e){
    // fallback
    const ta=document.createElement('textarea');
    ta.value=text; document.body.appendChild(ta); ta.select();
    document.execCommand('copy'); ta.remove();
    flash(`${weekIdx}주 응대율 복사됨`);
  }
}
function downloadRateExcel(){
  const meta = currentMeta();
  const ry = state._rateMonth?.y ?? meta.year;
  const rm = state._rateMonth?.m ?? meta.month;
  const monthKey = `${ry}-${pad2(rm)}`;
  const weeks = getWeeksOfMonth(ry, rm);
  const centers = visibleCenters();
  const header = ['PM','센터명',`${rm}월`, ...[1,2,3,4,5].map(i=>{
    const w=weeks[i-1]; return w?`${i}주(${w.rangeLabel})`:`${i}주`;
  }), '대비 미달사유 및 개선계획'];
  const rows = [header];
  centers.forEach(c=>{
    const owner = memberById(c.ownerId);
    const row = (state.monthRates[monthKey]||{})[c.id]||{};
    const vals = [1,2,3,4,5].map(i=>parseFloat(row['w'+i])).filter(v=>!isNaN(v));
    const autoAvg = vals.length ? Math.round(vals.reduce((a,b)=>a+b,0)/vals.length*10)/10 : '';
    const monthly = row.monthlyManual ? (row.monthly??'') : autoAvg;
    rows.push([
      owner?owner.name:'', c.name, monthly,
      row.w1??'', row.w2??'', row.w3??'', row.w4??'', row.w5??'',
      row.note??''
    ]);
  });
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, `${rm}월응대율`);
  XLSX.writeFile(wb, `응대율_${ry}${pad2(rm)}_5팀.xlsx`);
  flash('엑셀 다운로드 완료');
}
