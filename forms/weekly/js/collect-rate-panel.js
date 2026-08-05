// 응대율 기본값 규칙: 센터 + 기간(연/월/주차) + 기본값(%). 그 기간 안에서 값을 직접
// 입력하지 않은 주차는 이 기본값이 자동으로 채워져 보인다. 직접 입력하면 그 값이 우선한다.
function rateWeekSortKey(y,m,w){ return `${y}-${pad2(m)}-${pad2(w)}`; }
function findRateDefault(centerId, y, m, w){
  const key = rateWeekSortKey(y,m,w);
  const matches = (state.rateDefaults||[]).filter(r=>r.centerId===centerId && key>=r.startKey && key<=r.endKey);
  return matches.length ? matches[matches.length-1].value : null; // 겹치면 나중에 추가한 규칙 우선
}
// 실제로 표에 보여줄 값: 직접 입력한 값이 있으면 그 값, 없으면 기본값 규칙, 둘 다 없으면 빈 값
function effectiveRateValue(centerId, ry, rm, weekIdx, row){
  const explicit = row && row['w'+weekIdx];
  if(explicit!==undefined && String(explicit).trim()!=='') return explicit;
  const def = findRateDefault(centerId, ry, rm, weekIdx);
  return def!=null ? def : '';
}
// 자동 계산된 월 평균은 소수점 첫째 자리까지 항상 표시한다(예: 95 -> "95.0") — 사람이 직접
// 입력한 월값(row.monthlyManual)은 이 서식을 강제하지 않고 입력한 그대로 둔다.
function fmtAvg1(n){
  return (n===''||n==null||isNaN(n)) ? '' : Number(n).toFixed(1);
}

// 응대율 표의 고정(sticky) 좌측 컬럼(순서·PM·센터명) 오프셋과 표 전체 폭은 사용자가 드래그로
// 바꿀 수 있는 컬럼 폭(state.rateColWidths)에서 매번 다시 계산해야 한다 — 렌더링 시점과
// 드래그 리사이즈 도중(startColResize) 양쪽에서 같은 계산을 쓰기 위해 공용 함수로 뽑아둠.
// overrides로 "지금 드래그 중이라 아직 state에는 반영 안 된 값"을 임시로 끼워넣을 수 있다.
function rateColMetrics(overrides){
  const cw = Object.assign({}, state.rateColWidths, overrides||{});
  const total = cw.order+cw.pm+cw.cname+cw.avg+cw.wk1+cw.wk2+cw.wk3+cw.wk4+cw.wk5+cw.reason+cw.del;
  return { total, pmLeft: cw.order, cnameLeft: cw.order+cw.pm };
}
// 표 DOM에 이미 그려진 상태에서(드래그 중 등) 폭/오프셋만 즉시 반영 — 리사이즈 직후
// 다시 renderAll()을 거치지 않아도 고정 컬럼이 어긋나지 않도록 한다(2026-07-28 발견).
function syncRateTableMetrics(overrides){
  const table = document.getElementById('rateMatrixTable');
  if(!table) return;
  const m = rateColMetrics(overrides);
  table.style.width = m.total+'px';
  table.style.minWidth = m.total+'px';
  table.style.setProperty('--pm-left', m.pmLeft+'px');
  table.style.setProperty('--cname-left', m.cnameLeft+'px');
}

// 응대율 표시 월 초기값 보정 — 상단 월 이동바(renderRateMonthNavBar)와 본문 표(renderRatePanel)가
// 둘 다 state._rateMonth를 참조하므로, 어느 쪽이 먼저 렌더링되든 안전하게 공용으로 뽑아둔다.
function ensureRateMonth(){
  if(!state._rateMonth){ const meta=currentMeta(); state._rateMonth = {y:meta.year, m:meta.month}; }
  return state._rateMonth;
}
// 상단 공용 툴바(week-bar)에 들어가는 응대율 월 이동 컨트롤 — 응대율 탭일 때만
// "기준 주차" 자리 대신 표시된다(renderAll에서 토글).
function renderRateMonthNavBar(){
  const {y:ry, m:rm} = ensureRateMonth();
  return `
    <span class="rate-nav-label">📊 응대율 (월 단위)</span>
    <button class="nav-btn" type="button" onclick="shiftRateMonth(-1)" title="이전 달">‹</button>
    <div class="rate-nav-month">${ry}년 ${rm}월</div>
    <button class="nav-btn" type="button" onclick="shiftRateMonth(1)" title="다음 달">›</button>`;
}
function renderRatePanel(){
  const meta = currentMeta();
  const {y:ry, m:rm} = ensureRateMonth();
  const monthKey = `${ry}-${pad2(rm)}`;
  const weeks = getRateWeeksOfMonth(ry, rm); // 응대율은 월 anchored 주차(주간보고와 기준 다름)
  const monthShort = `${String(ry).slice(2)}.${rm}월`;
  if(!state.monthRates[monthKey]) state.monthRates[monthKey]={};

  // 정렬하지 않음 — state.centers 배열 순서 그대로(사용자가 순서 변경 버튼으로 직접 관리)
  // 종료된 센터는 삭제 대신 숨기기를 쓰므로, "숨긴 센터도 보기"를 켜면 과거 자료 확인을 위해 함께 보여준다.
  const showHidden = !!state._rateShowHidden;
  let centers = showHidden ? state.centers : visibleCenters();
  const memberFilter = state._rateMemberFilter || '';
  if(memberFilter) centers = centers.filter(c=>c.ownerId===memberFilter);

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
  const cw = state.rateColWidths;
  // 좌측 고정(sticky) 컬럼(순서/PM/센터명) 오프셋과 표 전체 폭 — CSS 쪽(--pm-left/--cname-left
  // 커스텀 속성 + 모바일 미디어쿼리)이 실제 고정 동작을 담당하고, 여기서는 그 값만 계산한다.
  const rcm = rateColMetrics();

  const rows = centers.map((c,idx)=>{
    const row = state.monthRates[monthKey][c.id] || {};
    // 월 평균 자동 — 직접 입력값이 없으면 기본값 규칙도 평균에 포함시킨다
    const vals = [1,2,3,4,5].map(i=>parseFloat(effectiveRateValue(c.id, ry, rm, i, row))).filter(v=>!isNaN(v));
    const autoAvg = vals.length ? (vals.reduce((a,b)=>a+b,0)/vals.length) : '';
    const monthly = row.monthlyManual ? (row.monthly??'') : fmtAvg1(autoAvg);
    const weekInputs = weekCols.map(w=>{
      const explicit = row['w'+w.i];
      const hasExplicit = explicit!==undefined && String(explicit).trim()!=='';
      const def = hasExplicit ? null : findRateDefault(c.id, ry, rm, w.i);
      const displayVal = hasExplicit ? explicit : (def!=null ? def : '');
      const isDefault = !hasExplicit && def!=null;
      return `<td class="wk-col"><span class="pct-wrap"><input type="text" inputmode="decimal" data-cid="${c.id}" data-f="w${w.i}"
        class="${isDefault?'auto':''}" ${isDefault?'title="기본값 규칙이 자동 적용됨 — 직접 입력하면 그 값이 우선합니다"':''}
        value="${escapeHtml(String(displayVal))}" ${w.exists?'':'disabled'}
        onchange="onRateCellChange('${monthKey}','${c.id}','w${w.i}',this.value); renderAll();"></span></td>`;
    }).join('');
    return `<tr class="${c.hidden?'hidden-row':''}">
      <td class="order-cell">
        <div class="order-cell-inner">
          <button class="ord-btn" type="button" onclick="moveCenter('${c.id}',-1)" ${idx===0?'disabled':''} title="위로">▲</button>
          <button class="ord-btn" type="button" onclick="moveCenter('${c.id}',1)" ${idx===centers.length-1?'disabled':''} title="아래로">▼</button>
        </div>
      </td>
      <td class="pm"><select data-cid="${c.id}" onchange="updateCenterField('${c.id}','owner',this.value)">${memberOptions(c.ownerId)}</select></td>
      <td class="cname">${c.hidden?'<span class="hidden-badge" title="숨김 처리된 센터(과거 자료 열람용)">숨김</span>':''}<input type="text" value="${escapeHtml(c.name)}" onchange="updateCenterField('${c.id}','name',this.value)"></td>
      <td class="avg-col"><span class="pct-wrap"><input class="auto" type="text" inputmode="decimal" title="주차별 평균 자동 / 직접 수정 가능"
        value="${escapeHtml(String(monthly??''))}"
        onchange="onRateCellChange('${monthKey}','${c.id}','monthly',this.value,true); renderAll();"></span></td>
      ${weekInputs}
      <td class="note-cell"><input class="note-in" type="text" title="${escapeHtml(row.note||'')}"
        value="${escapeHtml(row.note||'')}"
        onchange="onRateCellChange('${monthKey}','${c.id}','note',this.value); this.title=this.value;"></td>
      <td class="del-cell">
        <div class="del-cell-inner">
          <button class="btn-link" onclick="toggleCenterHide('${c.id}')">${c.hidden?'표시':'숨기기'}</button>
          <button class="btn-link" style="color:#a33;" onclick="deleteCenterInline('${c.id}')">삭제</button>
        </div>
      </td>
    </tr>`;
  }).join('');

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
  // table-layout:fixed는 table 자체에 명시적 width가 없으면(=auto) 좁은 화면(모바일)에서 colgroup
  // 폭을 무시하고 전 컬럼을 비율대로 욱여넣어버린다 — sticky 센터명 칸까지 찌그러들면서 옆 칸과의
  // 경계 픽셀이 어긋나 흰 여백처럼 보이는 원인이었다. 컬럼 폭 합계를 table 자체 폭으로 강제 지정해
  // 항상 실제 폭 그대로 렌더링되게 하고(모자란 폭은 .rate-wrap의 가로 스크롤로 해결).

  return `
  <div class="card">
    <!-- 📊 응대율(월 단위) 제목·월 이동 컨트롤은 상단 툴바(week-bar)의 "기준 주차" 자리로
         옮겨졌다 — renderRateMonthNavBar() 참고. 이 탭이 열려있을 때만 그 자리에 표시된다. -->
    <p class="hint">
      숫자만 입력해도 %가 자동으로 붙습니다. 표 안에서 <b>담당자·센터명을 바로 수정</b>하고, <b>▲▼</b>로 순서를 변경하고, <b>+ 센터 추가</b>로 새 줄을 만들 수 있습니다.<br>
      <b>컬럼 경계선에 마우스를 올려 드래그하면 폭을 직접 조절</b>할 수 있습니다. 비고칸은 내용이 길면 …으로 줄여 표시되며, 클릭하면 전체 내용이 펼쳐집니다.
      각 주차 <b>복사</b> 버튼 → 센터 순서대로 값이 줄바꿈 복사됩니다. 엑셀 A1에 붙여넣으면 A1, A2, A3…에 순서대로 들어갑니다.<br>
      센터가 종료됐다면 <b>삭제 대신 숨기기</b>를 눌러주세요 — 지난 응대율 기록이 그대로 남고, 아래 체크박스로 언제든 다시 볼 수 있습니다.
    </p>
    <label class="show-hidden-toggle">
      <input type="checkbox" ${showHidden?'checked':''} onchange="toggleRateShowHidden(this.checked)"> 숨긴 센터도 보기 (과거 자료 확인용)
    </label>
    <div class="rate-filter-bar">
      <label>담당자 필터</label>
      <select class="rate-filter-select" onchange="setRateMemberFilter(this.value)">
        <option value="">전체</option>
        ${state.members.map(m=>`<option value="${m.id}" ${memberFilter===m.id?'selected':''}>${escapeHtml(m.name)}</option>`).join('')}
      </select>
    </div>
    <div class="rate-wrap">
      <table class="rate-matrix" id="rateMatrixTable" style="width:${rcm.total}px;min-width:${rcm.total}px;--pm-left:${rcm.pmLeft}px;--cname-left:${rcm.cnameLeft}px;">
        ${colgroupHtml}
        <thead>
          <tr>
            <th rowspan="2" class="order-cell"></th>
            <th rowspan="2" class="pm">PM${rez('pm')}</th>
            <th rowspan="2" class="cname">센터명${rez('cname')}</th>
            <th class="top-title" colspan="6">${escapeHtml(monthShort)} 응대율</th>
            <th rowspan="2" class="reason-col">목표대비 미달사유 및 개선계획<br>(특이사항 포함)${rez('reason')}</th>
            <th rowspan="2">관리${rez('del')}</th>
          </tr>
          <tr>
            <th>${rm}월${rez('avg')}</th>
            ${headWeeks}
          </tr>
        </thead>
        <tbody>
          ${rows || `<tr><td colspan="11">${memberFilter?'이 담당자가 맡은 센터가 없습니다.':'센터가 없습니다. 아래 「+ 센터 추가」로 만들어보세요.'}</td></tr>`}
          <tr><td colspan="11" class="foot-note">* ${rm}월 항목 값 : 월 누적 평균값은 주차별 값의 평균으로 자동 반영 / 수정 가능</td></tr>
        </tbody>
      </table>
    </div>
    <button class="add-row-btn" onclick="addCenterInline()">+ 센터 추가</button>
    <button class="add-row-btn rate-settings-toggle-btn" onclick="toggleRateSettings()">⚙ 설정 ${state._rateSettingsOpen?'▲':'▼'}</button>
    ${state._rateSettingsOpen ? renderRateDefaultsPanel(meta) : ''}
    <div class="form-actions">
      <button class="btn btn-primary" onclick="saveRateMonth()">💾 응대율 저장</button>
      <button class="btn btn-green" onclick="downloadRateExcel()">⬇ 엑셀 다운로드</button>
    </div>
  </div>`;
}
function renderRateDefaultsPanel(meta){
  const yearOptions = [];
  for(let y=meta.year-1; y<=meta.year+3; y++) yearOptions.push(y);
  const yOpts = (sel) => yearOptions.map(y=>`<option value="${y}" ${y===sel?'selected':''}>${y}년</option>`).join('');
  const mOpts = (sel) => Array.from({length:12},(_,i)=>i+1).map(m=>`<option value="${m}" ${m===sel?'selected':''}>${m}월</option>`).join('');
  const wOpts = (sel) => [1,2,3,4,5,6].map(w=>`<option value="${w}" ${w===sel?'selected':''}>${w}주차</option>`).join('');
  const centerOpts = state.centers.map(c=>`<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');

  // 규칙이 10개를 넘으면 스크롤 대신 페이지 단위로 넘겨본다(자료보관함 탭과 동일한 페이징 패턴).
  const RD_PAGE_SIZE = 10;
  const allRules = state.rateDefaults||[];
  const rdPages = Math.max(1, Math.ceil(allRules.length / RD_PAGE_SIZE));
  if(!state._rdPage || state._rdPage < 1) state._rdPage = 1;
  if(state._rdPage > rdPages) state._rdPage = rdPages;
  const rdPageRules = allRules.slice((state._rdPage-1)*RD_PAGE_SIZE, state._rdPage*RD_PAGE_SIZE);

  const rules = allRules.length ? `<div class="rd-rules-list">${rdPageRules.map(r=>{
    const c = centerById(r.centerId);
    return `<div class="rd-rule-row">
      <span class="rd-rule-text" title="${escapeHtml(c?c.name:'(삭제된 센터)')} · ${r.sy}.${r.sm}월${r.sw}주 ~ ${r.ey}.${r.em}월${r.ew}주 · ${escapeHtml(r.value)}%">${escapeHtml(c?c.name:'(삭제된 센터)')} · ${r.sy}.${r.sm}월${r.sw}주 ~ ${r.ey}.${r.em}월${r.ew}주 · <b>${escapeHtml(r.value)}%</b></span>
      <button class="btn-link" style="color:#a33;" onclick="deleteRateDefault('${r.id}')">삭제</button>
    </div>`;
  }).join('')}</div>${rdPages>1 ? `
    <div class="pager">
      <button class="nav-btn" type="button" onclick="shiftRdPage(-1)" ${state._rdPage<=1?'disabled':''}>‹</button>
      <span>${state._rdPage} / ${rdPages} 페이지 (총 ${allRules.length}개)</span>
      <button class="nav-btn" type="button" onclick="shiftRdPage(1)" ${state._rdPage>=rdPages?'disabled':''}>›</button>
    </div>` : ''}` : `<div class="empty" style="padding:14px;font-size:12px;">등록된 기본값 규칙이 없습니다.</div>`;

  return `
  <div class="card rate-defaults-card">
    <h3>⚙ 응대율 기본값 설정</h3>
    <p class="hint">센터·기간·기본값을 등록하면 그 기간 동안 값을 직접 입력하지 않은 주차에 이 기본값이 자동으로 채워집니다. 직접 입력한 값은 항상 우선합니다.</p>
    ${rules}
    <div class="inline-form">
      <div class="fld grow"><span>센터</span><select id="rdCenter">${centerOpts}</select></div>
      <div class="fld"><span>시작</span>
        <div class="rd-period-group">
          <select id="rdStartY">${yOpts(meta.year)}</select><select id="rdStartM">${mOpts(meta.month)}</select><select id="rdStartW">${wOpts(1)}</select>
        </div>
      </div>
      <div class="fld"><span>종료</span>
        <div class="rd-period-group">
          <select id="rdEndY">${yOpts(meta.year+1)}</select><select id="rdEndM">${mOpts(12)}</select><select id="rdEndW">${wOpts(5)}</select>
        </div>
      </div>
      <div class="fld"><span>기본값</span><span class="pct-wrap"><input id="rdValue" type="text" inputmode="decimal" placeholder="99.9" style="width:70px;"></span></div>
      <button class="btn btn-green" onclick="addRateDefault()">저장</button>
    </div>
  </div>`;
}
function toggleRateSettings(){
  state._rateSettingsOpen = !state._rateSettingsOpen;
  renderAll();
}
async function addRateDefault(){
  const centerId = document.getElementById('rdCenter').value;
  const sy = +document.getElementById('rdStartY').value;
  const sm = +document.getElementById('rdStartM').value;
  const sw = +document.getElementById('rdStartW').value;
  const ey = +document.getElementById('rdEndY').value;
  const em = +document.getElementById('rdEndM').value;
  const ew = +document.getElementById('rdEndW').value;
  const value = document.getElementById('rdValue').value.replace('%','').trim();
  if(!centerId){ flash('센터를 선택하세요'); return; }
  if(!value){ flash('기본값을 입력하세요'); return; }
  const startKey = rateWeekSortKey(sy,sm,sw);
  const endKey = rateWeekSortKey(ey,em,ew);
  if(startKey > endKey){ flash('시작 기간이 종료 기간보다 늦을 수 없습니다'); return; }
  const newRule = {id:'rd'+Date.now(), centerId, startKey, endKey, sy, sm, sw, ey, em, ew, value};
  state.rateDefaults = await mutateSharedList(`${KP}_ratedefaults`, state.rateDefaults, arr=>{
    arr.push(newRule); return arr;
  });
  // 새로 추가한 규칙이 바로 보이도록 마지막 페이지로 이동
  state._rdPage = Math.max(1, Math.ceil(state.rateDefaults.length / 10));
  flash('기본값 규칙이 저장되었습니다');
  renderAll();
}
async function deleteRateDefault(id){
  if(!confirm('이 기본값 규칙을 삭제할까요?')) return;
  state.rateDefaults = await mutateSharedList(`${KP}_ratedefaults`, state.rateDefaults, arr=> arr.filter(r=>r.id!==id));
  renderAll(); // 삭제로 페이지가 남으면 renderRateDefaultsPanel의 클램프 로직이 자동으로 보정
}
function shiftRdPage(delta){
  state._rdPage = (state._rdPage||1) + delta;
  renderAll();
}
function setRateMemberFilter(val){
  state._rateMemberFilter = val;
  renderAll();
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
    // order/pm 폭을 드래그하는 도중에도 표 전체 폭과 고정(sticky) 오프셋을 실시간으로 맞춰준다 —
    // 안 그러면 리사이즈 직후 다시 렌더링 전까지 고정 컬럼 사이가 어긋나 보인다(2026-07-28).
    syncRateTableMetrics({[key]: newWidth});
  }
  function onUp(ev){
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
    if(table) table.classList.remove('resizing-active');
    handle.classList.remove('resizing');
    const delta = ev.clientX - startX;
    const newWidth = Math.max(24, Math.round(startWidth + delta));
    state.rateColWidths[key] = newWidth;
    syncRateTableMetrics();
    mutateSharedObject(`${KP}_ratewidths`, state.rateColWidths, obj=>{ obj[key] = newWidth; return obj; })
      .then(fresh=>{ state.rateColWidths = fresh; syncRateTableMetrics(); });
  }
  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
}
async function moveCenter(id, dir){
  // 로컬에 남아있던 순서가 아니라, 서버의 최신 순서를 기준으로 이웃과 자리를 바꾼다.
  state.centers = await mutateSharedList(`${KP}_centers`, state.centers, arr=>{
    const idx = arr.findIndex(c=>c.id===id);
    if(idx<0) return arr;
    const swapIdx = idx+dir;
    if(swapIdx<0 || swapIdx>=arr.length) return arr;
    const tmp = arr[idx]; arr[idx] = arr[swapIdx]; arr[swapIdx] = tmp;
    return arr;
  });
  renderAll();
}
async function updateCenterField(id, field, value){
  state.centers = await mutateSharedList(`${KP}_centers`, state.centers, arr=>{
    const c = arr.find(x=>x.id===id); if(!c) return arr;
    if(field==='name') c.name = value.trim() || c.name;
    else if(field==='owner') c.ownerId = value;
    return arr;
  });
  renderAll();
}
function toggleRateShowHidden(checked){
  state._rateShowHidden = checked;
  renderAll();
}
async function deleteCenterInline(id){
  const c = centerById(id); if(!c) return;
  if(!confirm(`「${c.name}」 센터를 삭제할까요?\n지난 응대율 기록도 화면에서 더 이상 보이지 않게 됩니다.\n나중에 과거 자료를 다시 볼 수 있으려면 삭제 대신 "숨기기"를 눌러주세요.`)) return;
  state.centers = await mutateSharedList(`${KP}_centers`, state.centers, arr=> arr.filter(x=>x.id!==id));
  flash('센터가 삭제되었습니다');
  renderAll();
}
async function addCenterInline(){
  const ownerId = (state.members[0]||{}).id;
  const id = 'c'+Date.now();
  state.centers = await mutateSharedList(`${KP}_centers`, state.centers, arr=>{
    arr.push({id, name:'새 센터', ownerId, hidden:false}); return arr;
  });
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
      const [ry, rm] = monthKey.split('-').map(Number);
      const vals = [1,2,3,4,5].map(i=>parseFloat(effectiveRateValue(cid, ry, rm, i, row))).filter(v=>!isNaN(v));
      row.monthly = vals.length ? fmtAvg1(vals.reduce((a,b)=>a+b,0)/vals.length) : '';
    }
  }
  // 이 센터 몫의 키에만 쓴다 — 다른 센터를 담당하는 PM이 동시에 입력해도 서로 덮어쓰지 않도록
  saveKV(rateKey(monthKey, cid), row);
}
function saveRateMonth(){
  // input onchange already saves; force re-read DOM for safety
  const meta = currentMeta();
  const ry = state._rateMonth?.y ?? meta.year;
  const rm = state._rateMonth?.m ?? meta.month;
  const monthKey = `${ry}-${pad2(rm)}`;
  const touchedCids = new Set();
  document.querySelectorAll('.rate-matrix input[data-cid]').forEach(inp=>{
    const cid = inp.getAttribute('data-cid');
    const f = inp.getAttribute('data-f');
    if(!cid||!f) return;
    if(!state.monthRates[monthKey]) state.monthRates[monthKey]={};
    if(!state.monthRates[monthKey][cid]) state.monthRates[monthKey][cid]={};
    state.monthRates[monthKey][cid][f] = String(inp.value??'').replace('%','').trim();
    touchedCids.add(cid);
  });
  touchedCids.forEach(cid=> saveKV(rateKey(monthKey, cid), state.monthRates[monthKey][cid]));
  flash(`${ry}년 ${rm}월 응대율 저장 완료 · 값은 계속 유지됩니다`);
  renderAll();
}
async function copyWeekRates(monthKey, weekIdx){
  const [ry, rm] = monthKey.split('-').map(Number);
  const centers = visibleCenters();
  const lines = centers.map(c=>{
    const row = (state.monthRates[monthKey]||{})[c.id] || {};
    return effectiveRateValue(c.id, ry, rm, weekIdx, row);
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
  const weeks = getRateWeeksOfMonth(ry, rm); // 응대율은 월 anchored 주차(주간보고와 기준 다름)
  const centers = visibleCenters();
  const header = ['PM','센터명',`${rm}월`, ...[1,2,3,4,5].map(i=>{
    const w=weeks[i-1]; return w?`${i}주(${w.rangeLabel})`:`${i}주`;
  }), '대비 미달사유 및 개선계획'];
  const rows = [header];
  centers.forEach(c=>{
    const owner = memberById(c.ownerId);
    const row = (state.monthRates[monthKey]||{})[c.id]||{};
    const vals = [1,2,3,4,5].map(i=>parseFloat(effectiveRateValue(c.id, ry, rm, i, row))).filter(v=>!isNaN(v));
    const autoAvg = vals.length ? fmtAvg1(vals.reduce((a,b)=>a+b,0)/vals.length) : '';
    const monthly = row.monthlyManual ? (row.monthly??'') : autoAvg;
    rows.push([
      owner?owner.name:'', c.name, monthly,
      effectiveRateValue(c.id,ry,rm,1,row), effectiveRateValue(c.id,ry,rm,2,row),
      effectiveRateValue(c.id,ry,rm,3,row), effectiveRateValue(c.id,ry,rm,4,row), effectiveRateValue(c.id,ry,rm,5,row),
      row.note??''
    ]);
  });
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, `${rm}월응대율`);
  XLSX.writeFile(wb, `응대율_${ry}${pad2(rm)}_5팀.xlsx`);
  flash('엑셀 다운로드 완료');
}
