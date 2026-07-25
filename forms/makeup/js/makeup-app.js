(function(){
  const STATE_KEY = 'ktis_v11__makeup_state'; // 월목록+모든달 데이터+열너비를 하나로 통합 저장 (Supabase rpt_kv)
  const DEFAULT_WIDTHS = {no:50,center:150,bm:92,plan:300,month:80,revenue:140,profit:140,revenueAnnual:140,profitAnnual:140,note:220,actions:90};
  const COL_KEYS = Object.keys(DEFAULT_WIDTHS);

  // 앱 전체 상태 (메모리) — 저장은 항상 이 객체 하나를 통째로 write
  let appState = { colWidths: Object.assign({}, DEFAULT_WIDTHS), months: [], snapshots: {} };

  let currentId = null;
  let rows = [];
  let openMemoIds = new Set();
  let saveTimer = null;
  let busy = false; // 달 전환/생성 중 중복 클릭 방지

  const el = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const genId = () => 'r_' + Date.now() + '_' + Math.random().toString(36).slice(2,8);
  const fmtNum = (n) => (Number(n)||0).toLocaleString('ko-KR');

  function annualRevenue(r){ return (Number(r.revenue)||0) * (13 - (Number(r.month)||0)); }
  function annualProfit(r){ return (Number(r.profit)||0) * (13 - (Number(r.month)||0)); }
  function rowRevenueAnnual(r){ return r.autoRevenue===false ? (Number(r.revenueAnnual)||0) : annualRevenue(r); }
  function rowProfitAnnual(r){ return r.autoProfit===false ? (Number(r.profitAnnual)||0) : annualProfit(r); }
  function combinedNote(r){
    const parts = [];
    if(r.note) parts.push(r.note);
    if(r.memo) parts.push('[메모] ' + r.memo);
    return parts.join(' / ');
  }
  function migrateRow(r){
    return Object.assign({
      id: genId(), center:'', bm:'N-Cap', plan:'', month:'', revenue:0, profit:0, note:'', memo:'',
      autoRevenue:true, autoProfit:true, revenueAnnual:0, profitAnnual:0
    }, r);
  }
  function fmtMonthLabel(id){
    const [y,m] = id.split('-');
    return `${y}년 ${parseInt(m,10)}월`;
  }
  function showWarn(msg){
    const b = el('warnBanner');
    b.textContent = '⚠ ' + msg;
    b.classList.add('show');
  }

  // ---- 저장소: 단일 키로 통합 (읽기 1번, 쓰기는 항상 전체 blob) — shared/kv-client.js 경유 ----
  async function loadState(){
    try{
      const parsed = await apiGet(STATE_KEY);
      if(parsed){
        appState.colWidths = Object.assign({}, DEFAULT_WIDTHS, parsed.colWidths || {});
        appState.months = Array.isArray(parsed.months) ? parsed.months : [];
        appState.snapshots = (parsed.snapshots && typeof parsed.snapshots === 'object') ? parsed.snapshots : {};
      }
    }catch(e){ /* 최초 실행: 기본값 유지 */ }
    appState.months.sort((a,b)=> a.id.localeCompare(b.id));
  }
  async function persistState(){
    try{
      await apiSet(STATE_KEY, appState);
      return true;
    }catch(e){
      console.error('저장 실패', e);
      showWarn('저장소에 접근할 수 없습니다. 잠시 후 "전체 저장"을 다시 눌러주세요.');
      return false;
    }
  }
  // 현재 편집 중인 rows를 appState에 반영 + 저장
  async function commitCurrent(){
    clearTimeout(saveTimer);
    saveTimer = null;
    if(!currentId) return;
    appState.snapshots[currentId] = rows;
    const ok = await persistState();
    setStatus(ok ? ('저장됨 · ' + new Date().toLocaleTimeString('ko-KR')) : '⚠ 저장 실패', ok ? 'ok' : 'warn');
  }
  function scheduleSave(){
    setStatus('저장 중...', null);
    clearTimeout(saveTimer);
    saveTimer = setTimeout(()=>{ saveTimer = null; commitCurrent(); }, 500);
  }
  function setStatus(msg, kind){
    const s = el('statusMsg');
    s.textContent = msg;
    s.className = kind==='ok' ? 'save-flag' : (kind==='warn' ? 'warn-flag' : '');
  }

  // ---- 컬럼 리사이즈 ----
  function applyColWidths(){
    COL_KEYS.forEach(k=>{
      const col = el('col-'+k);
      if(col) col.style.width = appState.colWidths[k]+'px';
    });
  }
  function setupResizers(){
    document.querySelectorAll('.col-resizer').forEach(handle=>{
      handle.addEventListener('mousedown', (e)=>{
        e.preventDefault();
        const key = handle.dataset.col;
        const startX = e.clientX;
        const startWidth = appState.colWidths[key];
        handle.classList.add('active');
        function onMove(ev){
          const delta = ev.clientX - startX;
          appState.colWidths[key] = Math.max(36, startWidth + delta);
          applyColWidths();
        }
        function onUp(){
          document.removeEventListener('mousemove', onMove);
          document.removeEventListener('mouseup', onUp);
          handle.classList.remove('active');
          persistState();
        }
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
      });
    });
  }

  // ---- 복사 (열 단위 / 표 전체) ----
  function colRawValue(r, key){
    switch(key){
      case 'center': return r.center||'';
      case 'bm': return r.bm||'';
      case 'plan': return (r.plan||'').replace(/\r?\n/g,' ');
      case 'month': return (r.month===''||r.month==null) ? '' : r.month;
      case 'revenue': return Number(r.revenue)||0;
      case 'profit': return Number(r.profit)||0;
      case 'revenueAnnual': return rowRevenueAnnual(r);
      case 'profitAnnual': return rowProfitAnnual(r);
      case 'note': return combinedNote(r);
      default: return '';
    }
  }
  function copyColumn(key){
    if(!rows.length){ alert('복사할 데이터가 없습니다.'); return; }
    copyToClipboard(rows.map(r=>colRawValue(r,key)).join('\n'));
  }
  function copyAllTable(){
    if(!rows.length){ alert('복사할 데이터가 없습니다.'); return; }
    const headerLine = ['번호','센터명','BM','make up 계획','반영시기','make up 매출','make up 이익','매출연간증가','이익연간증가','비고'].join('\t');
    const dataLines = rows.map((r,i)=>[
      i+1, r.center||'', r.bm||'', (r.plan||'').replace(/\r?\n/g,' '), r.month||'',
      Number(r.revenue)||0, Number(r.profit)||0, rowRevenueAnnual(r), rowProfitAnnual(r), combinedNote(r)
    ].join('\t'));
    copyToClipboard([headerLine, ...dataLines].join('\n'));
  }
  function copyToClipboard(text){
    if(navigator.clipboard && navigator.clipboard.writeText){
      navigator.clipboard.writeText(text).then(toastCopy).catch(()=>fallbackCopy(text));
    }else{ fallbackCopy(text); }
  }
  function fallbackCopy(text){
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.position='fixed'; ta.style.left='-9999px';
    document.body.appendChild(ta); ta.select();
    try{ document.execCommand('copy'); toastCopy(); }
    catch(e){ alert('복사에 실패했습니다. 직접 선택 후 복사해주세요.'); }
    document.body.removeChild(ta);
  }
  function toastCopy(){
    setStatus('복사되었습니다 · 엑셀에 붙여넣으세요', 'ok');
    setTimeout(()=>setStatus('', null), 3000);
  }
  function setupCopyButtons(){
    document.querySelectorAll('.th-copy-btn').forEach(btn=>{
      btn.addEventListener('click', (e)=>{ e.stopPropagation(); copyColumn(btn.dataset.col); });
    });
  }

  // ---- money 입력 라이브 포맷 ----
  function attachMoneyLive(inputEl, onChange){
    inputEl.addEventListener('input', ()=>{
      let raw = inputEl.value.replace(/[^\d-]/g,'');
      const neg = raw.indexOf('-')===0;
      raw = raw.replace(/-/g,'');
      const num = raw==='' ? 0 : parseInt(raw,10);
      inputEl.value = raw==='' ? (neg?'-':'') : (neg?'-':'') + num.toLocaleString('ko-KR');
      onChange(neg ? -num : num);
    });
  }

  // ---- 렌더 ----
  function renderMonthSelect(){
    const sel = el('monthSelect');
    sel.innerHTML = '';
    const months = appState.months;
    if(months.length===0){
      const opt = document.createElement('option');
      opt.textContent = '저장된 달 없음';
      sel.appendChild(opt);
      el('btnPrevMonth').disabled = true;
      el('btnNextMonth').disabled = true;
      return;
    }
    const latestId = months[months.length-1].id;
    months.slice().reverse().forEach(m=>{
      const opt = document.createElement('option');
      opt.value = m.id;
      opt.textContent = fmtMonthLabel(m.id) + (m.id===latestId ? ' (최신)' : '');
      sel.appendChild(opt);
    });
    if(currentId) sel.value = currentId;
    const idx = months.findIndex(m=>m.id===currentId);
    el('btnPrevMonth').disabled = idx<=0;
    el('btnNextMonth').disabled = idx===-1 || idx>=months.length-1;
  }

  function renderTitle(){
    el('sheetTitle').textContent = currentId
      ? `AICC사업2단 사업5팀 Make up 계획 — ${fmtMonthLabel(currentId)}`
      : 'AICC사업2단 사업5팀 Make up 계획';
  }

  function renderRows(){
    const tbody = el('tbody');
    tbody.innerHTML = '';
    el('emptyState').style.display = (!currentId) ? 'block' : 'none';
    el('planTable').style.display = (!currentId) ? 'none' : 'table';
    el('rowCount').textContent = currentId ? `총 ${rows.length}건` : '';

    rows.forEach((r, idx)=>{
      const tr = document.createElement('tr');
      tr.className = 'data-row' + (r._isNew ? ' new-row' : '');
      delete r._isNew;

      tr.innerHTML = `
        <td class="center">${idx+1}</td>
        <td><input type="text" class="f-center" value="${esc(r.center||'')}" placeholder="센터명"></td>
        <td>
          <select class="f-bm">
            <option value="Cap" ${r.bm==='Cap'?'selected':''}>Cap</option>
            <option value="N-Cap" ${r.bm!=='Cap'?'selected':''}>N-Cap</option>
          </select>
        </td>
        <td><textarea class="f-plan" placeholder="매출/이익 해당사항 작성">${esc(r.plan||'')}</textarea></td>
        <td><input type="number" min="1" max="12" class="f-month center" value="${r.month??''}" placeholder="월"></td>
        <td><input type="text" class="f-revenue money-input" value="${r.revenue?fmtNum(r.revenue):''}" placeholder="0"></td>
        <td><input type="text" class="f-profit money-input" value="${r.profit?fmtNum(r.profit):''}" placeholder="0"></td>
        <td class="auto-cell">
          <div class="auto-wrap">
            <input type="text" class="f-revenueAnnual" value="${fmtNum(rowRevenueAnnual(r))}">
            <button class="reset-auto-btn" data-kind="revenue" style="display:${r.autoRevenue===false?'inline-block':'none'}" title="자동계산으로 되돌리기">↺</button>
          </div>
        </td>
        <td class="auto-cell">
          <div class="auto-wrap">
            <input type="text" class="f-profitAnnual" value="${fmtNum(rowProfitAnnual(r))}">
            <button class="reset-auto-btn" data-kind="profit" style="display:${r.autoProfit===false?'inline-block':'none'}" title="자동계산으로 되돌리기">↺</button>
          </div>
        </td>
        <td>
          <input type="text" class="f-note" value="${esc(r.note||'')}" placeholder="비고">
          <button class="memo-btn ${r.memo?'has-memo':''}" data-memo-toggle>${r.memo?'📝 메모 보기':'+ 메모 추가'}</button>
        </td>
        <td class="center">
          <div class="row-actions">
            <button class="save-row-btn" title="지금 저장 (표 전체 기준)">💾</button>
            <button class="del-btn" title="행 삭제">✕</button>
          </div>
        </td>
      `;
      tbody.appendChild(tr);

      const centerInp = tr.querySelector('.f-center');
      centerInp.addEventListener('input', ()=>{ r.center = centerInp.value; scheduleSave(); });

      const bmSel = tr.querySelector('.f-bm');
      bmSel.addEventListener('change', ()=>{ r.bm = bmSel.value; scheduleSave(); });

      const planInp = tr.querySelector('.f-plan');
      planInp.addEventListener('input', ()=>{ r.plan = planInp.value; scheduleSave(); });

      const revAnnualInp = tr.querySelector('.f-revenueAnnual');
      const revResetBtn = tr.querySelector('[data-kind="revenue"]');
      const profAnnualInp = tr.querySelector('.f-profitAnnual');
      const profResetBtn = tr.querySelector('[data-kind="profit"]');

      function recomputeAuto(){
        if(r.autoRevenue!==false) revAnnualInp.value = fmtNum(annualRevenue(r));
        if(r.autoProfit!==false) profAnnualInp.value = fmtNum(annualProfit(r));
        renderTotals();
      }

      const monthInp = tr.querySelector('.f-month');
      monthInp.addEventListener('input', ()=>{ r.month = monthInp.value; recomputeAuto(); scheduleSave(); });

      const revInp = tr.querySelector('.f-revenue');
      attachMoneyLive(revInp, (num)=>{ r.revenue = num; recomputeAuto(); scheduleSave(); });

      const profInp = tr.querySelector('.f-profit');
      attachMoneyLive(profInp, (num)=>{ r.profit = num; recomputeAuto(); scheduleSave(); });

      attachMoneyLive(revAnnualInp, (num)=>{
        r.autoRevenue = false; r.revenueAnnual = num;
        revResetBtn.style.display = 'inline-block';
        renderTotals(); scheduleSave();
      });
      revResetBtn.addEventListener('click', ()=>{
        r.autoRevenue = true;
        revAnnualInp.value = fmtNum(annualRevenue(r));
        revResetBtn.style.display = 'none';
        renderTotals(); scheduleSave();
      });

      attachMoneyLive(profAnnualInp, (num)=>{
        r.autoProfit = false; r.profitAnnual = num;
        profResetBtn.style.display = 'inline-block';
        renderTotals(); scheduleSave();
      });
      profResetBtn.addEventListener('click', ()=>{
        r.autoProfit = true;
        profAnnualInp.value = fmtNum(annualProfit(r));
        profResetBtn.style.display = 'none';
        renderTotals(); scheduleSave();
      });

      const noteInp = tr.querySelector('.f-note');
      noteInp.addEventListener('input', ()=>{ r.note = noteInp.value; scheduleSave(); });

      const memoBtn = tr.querySelector('[data-memo-toggle]');
      memoBtn.addEventListener('click', ()=>{
        if(openMemoIds.has(r.id)) openMemoIds.delete(r.id); else openMemoIds.add(r.id);
        renderRows();
      });

      const saveRowBtn = tr.querySelector('.save-row-btn');
      saveRowBtn.addEventListener('click', async ()=>{
        await commitCurrent();
        saveRowBtn.textContent = '✅';
        setTimeout(()=>{ saveRowBtn.textContent = '💾'; }, 1200);
      });

      const delBtn = tr.querySelector('.del-btn');
      delBtn.addEventListener('click', ()=>{
        if(confirm('이 항목을 삭제할까요?')){
          rows.splice(idx,1);
          renderRows();
          scheduleSave();
        }
      });

      if(openMemoIds.has(r.id)){
        const memoTr = document.createElement('tr');
        memoTr.className = 'memo-row';
        memoTr.innerHTML = `
          <td colspan="11">
            <label>💬 부가 설명 메모 (해당 금액이 나온 근거 등 — 엑셀 내보내기 시 비고에 함께 저장됩니다)</label>
            <textarea class="memo-textarea" placeholder="예) 반기 실적 기준 6명 증원 시 1인당 평균 처리건수 기준으로 산정">${esc(r.memo||'')}</textarea>
            <div class="memo-actions"><button class="memo-save-btn" data-memo-save>저장하고 닫기</button></div>
          </td>`;
        tbody.appendChild(memoTr);
        const memoTa = memoTr.querySelector('.memo-textarea');
        memoTr.querySelector('[data-memo-save]').addEventListener('click', async ()=>{
          r.memo = memoTa.value;
          openMemoIds.delete(r.id);
          await commitCurrent();
          renderRows();
        });
      }
    });
    renderTotals();
  }

  function renderTotals(){
    let sr=0, sp=0, sra=0, spa=0;
    rows.forEach(r=>{
      sr += Number(r.revenue)||0;
      sp += Number(r.profit)||0;
      sra += rowRevenueAnnual(r);
      spa += rowProfitAnnual(r);
    });
    el('sumRevenue').textContent = fmtNum(sr);
    el('sumProfit').textContent = fmtNum(sp);
    el('sumRevenueAnnual').textContent = fmtNum(sra);
    el('sumProfitAnnual').textContent = fmtNum(spa);
  }

  // 저장소를 다시 읽지 않고, 메모리(appState)에서 즉시 전환 → 지연/유실 없음
  function showMonth(id){
    currentId = id;
    const snap = appState.snapshots[id];
    rows = Array.isArray(snap) ? snap.map(migrateRow) : [];
    openMemoIds = new Set();
    renderMonthSelect();
    renderTitle();
    renderRows();
    setStatus('', null);
  }

  async function switchMonth(id){
    if(busy || id===currentId) return;
    busy = true;
    try{
      await commitCurrent();   // 떠나는 달의 최신 내용을 먼저 확정 저장
      showMonth(id);           // 새 달은 메모리에서 즉시 표시
    } finally { busy = false; }
  }

  // ---- 이벤트 ----
  el('monthSelect').addEventListener('change', (e)=> switchMonth(e.target.value));
  el('btnPrevMonth').addEventListener('click', ()=>{
    const idx = appState.months.findIndex(m=>m.id===currentId);
    if(idx>0) switchMonth(appState.months[idx-1].id);
  });
  el('btnNextMonth').addEventListener('click', ()=>{
    const idx = appState.months.findIndex(m=>m.id===currentId);
    if(idx>=0 && idx<appState.months.length-1) switchMonth(appState.months[idx+1].id);
  });

  el('btnAddRow').addEventListener('click', ()=>{
    if(!currentId){ alert('먼저 달을 선택하거나 추가하세요.'); return; }
    const nr = migrateRow({});
    nr._isNew = true;
    rows.push(nr);
    renderRows();
    scheduleSave();
  });

  const newMonthWrap = document.querySelector('.new-month-wrap');
  const newMonthPanel = el('newMonthPanel');
  el('btnNewMonth').addEventListener('click', (e)=>{
    e.stopPropagation();
    newMonthPanel.classList.toggle('open');
    if(newMonthPanel.classList.contains('open')){
      const now = new Date();
      const next = currentId ? nextMonthOf(currentId) : `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
      el('newMonthInput').value = next;
    }
  });
  document.addEventListener('click', (e)=>{
    if(newMonthPanel.classList.contains('open') && !newMonthWrap.contains(e.target)){
      newMonthPanel.classList.remove('open');
    }
  });
  el('btnCancelNewMonth').addEventListener('click', ()=> newMonthPanel.classList.remove('open'));

  function nextMonthOf(id){
    let [y,m] = id.split('-').map(Number);
    m += 1; if(m>12){ m=1; y+=1; }
    return `${y}-${String(m).padStart(2,'0')}`;
  }

  el('btnCreateMonth').addEventListener('click', async ()=>{
    if(busy) return;
    const val = el('newMonthInput').value;
    if(!val){ alert('기준월을 선택하세요.'); return; }
    if(appState.months.some(m=>m.id===val)){ alert('이미 존재하는 달입니다. 목록에서 선택해주세요.'); return; }

    busy = true;
    try{
      await commitCurrent(); // 현재 보고 있는 달의 최신 입력을 먼저 확정 저장 (appState.snapshots[currentId] = rows 포함)

      // 직전 달 내용을 항상 그대로 복사해서 새 달 시작 (appState 기준 — 저장소 재조회 없이 메모리에서 바로 복제)
      const baseRows = currentId
        ? rows.map(r => Object.assign(migrateRow(r), {id:genId(), _isNew:false}))
        : [];

      appState.months.push({id:val, label:fmtMonthLabel(val), createdAt:Date.now()});
      appState.months.sort((a,b)=> a.id.localeCompare(b.id));
      appState.snapshots[val] = baseRows;
      await persistState();

      showMonth(val); // 메모리에 이미 있는 baseRows로 즉시 반영 (재조회 없음 → 유실/지연 원천 차단)
      newMonthPanel.classList.remove('open');
    } finally { busy = false; }
  });

  el('btnDeleteMonth').addEventListener('click', async ()=>{
    if(!currentId) return;
    if(!confirm(`${fmtMonthLabel(currentId)} 스냅샷을 삭제할까요? 이 작업은 되돌릴 수 없습니다.`)) return;
    clearTimeout(saveTimer); saveTimer = null;

    delete appState.snapshots[currentId];
    appState.months = appState.months.filter(m=>m.id!==currentId);
    await persistState();

    if(appState.months.length){
      showMonth(appState.months[appState.months.length-1].id);
    }else{
      currentId = null; rows = [];
      renderMonthSelect(); renderTitle(); renderRows();
    }
  });

  el('btnSaveAll').addEventListener('click', async ()=>{
    if(!currentId){ alert('저장할 달이 없습니다.'); return; }
    await commitCurrent();
    const btn = el('btnSaveAll');
    const original = btn.textContent;
    btn.textContent = '✅ 저장 완료';
    setTimeout(()=>{ btn.textContent = original; }, 1400);
  });

  el('btnCopyAll').addEventListener('click', copyAllTable);

  el('btnExport').addEventListener('click', async ()=>{
    if(!currentId || !rows.length){ alert('내보낼 데이터가 없습니다.'); return; }
    try{ await exportStyledExcel(); }
    catch(e){ console.error('엑셀 내보내기 실패', e); alert('엑셀 생성 중 문제가 발생했습니다. 다시 시도해주세요.'); }
  });

  async function exportStyledExcel(){
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Make up 계획(사업2단)');

    const headers = ['번호','센터명','BM','make up 계획\n(매출/이익 해당사항 작성)','반영시기\n(실적반영월)','make up 매출\n(월기준)','make up 이익\n(월기준)','매출연간\n증가','이익연간\n증가','비고'];
    const keys = ['no','center','bm','plan','month','revenue','profit','revenueAnnual','profitAnnual','note'];
    ws.columns = keys.map(k=>({ width: Math.max(6, Math.round((appState.colWidths[k]||100)/6.2)) }));

    const thin = {style:'thin', color:{argb:'FF7F7F7F'}};
    const borderAll = {top:thin,left:thin,bottom:thin,right:thin};

    ws.mergeCells(1,1,1,10);
    const titleCell = ws.getCell(1,1);
    titleCell.value = `AICC사업2단 사업5팀 Make up 계획 — ${fmtMonthLabel(currentId)}`;
    titleCell.font = {bold:true, size:14};
    titleCell.alignment = {vertical:'middle'};

    ws.mergeCells(2,1,2,10);
    const unitCell = ws.getCell(2,1);
    unitCell.value = '(단위 : 원)';
    unitCell.font = {bold:true, size:10, color:{argb:'FF333333'}};
    unitCell.alignment = {horizontal:'right'};

    const headerRowIdx = 3;
    const headerRow = ws.getRow(headerRowIdx);
    headers.forEach((h, i)=>{
      const cell = headerRow.getCell(i+1);
      cell.value = h;
      cell.font = {bold:true, size:11};
      cell.alignment = {horizontal:'center', vertical:'middle', wrapText:true};
      cell.border = borderAll;
      if(i<=6) cell.fill = {type:'pattern', pattern:'solid', fgColor:{argb:'FFFFFF00'}};
      else if(i<=8) cell.fill = {type:'pattern', pattern:'solid', fgColor:{argb:'FFFFC000'}};
      else cell.fill = {type:'pattern', pattern:'solid', fgColor:{argb:'FFF2F2F2'}};
    });
    headerRow.height = 34;

    rows.forEach((r, i)=>{
      const rowIdx = headerRowIdx + 1 + i;
      const values = [
        i+1, r.center||'', r.bm||'', r.plan||'', r.month||'',
        Number(r.revenue)||0, Number(r.profit)||0,
        rowRevenueAnnual(r), rowProfitAnnual(r), combinedNote(r)
      ];
      const row = ws.getRow(rowIdx);
      values.forEach((v, ci)=>{
        const cell = row.getCell(ci+1);
        cell.value = v;
        cell.border = borderAll;
        cell.alignment = {vertical:'middle', wrapText:(ci===3||ci===9), horizontal:(ci===0||ci===2||ci===4)?'center':(ci>=5&&ci<=8?'right':'left')};
        if(ci>=5 && ci<=8) cell.numFmt = '#,##0';
        if(ci>=7 && ci<=8) cell.fill = {type:'pattern', pattern:'solid', fgColor:{argb:'FFFFF6E5'}};
      });
      row.height = 30;
    });

    const sumRowIdx = headerRowIdx + 1 + rows.length;
    let sr=0, sp=0, sra=0, spa=0;
    rows.forEach(r=>{
      sr += Number(r.revenue)||0; sp += Number(r.profit)||0;
      sra += rowRevenueAnnual(r); spa += rowProfitAnnual(r);
    });
    const sumRow = ws.getRow(sumRowIdx);
    ws.mergeCells(sumRowIdx,1,sumRowIdx,5);
    const sumLabel = sumRow.getCell(1);
    sumLabel.value = '합계';
    sumLabel.alignment = {horizontal:'center', vertical:'middle'};
    sumLabel.font = {bold:true};
    sumLabel.border = borderAll;
    [sr, sp, sra, spa].forEach((v, idx)=>{
      const cell = sumRow.getCell(6+idx);
      cell.value = v;
      cell.numFmt = '#,##0';
      cell.font = {bold:true};
      cell.alignment = {horizontal:'right', vertical:'middle'};
      cell.fill = {type:'pattern', pattern:'solid', fgColor:{argb:'FFF2F2F2'}};
      cell.border = borderAll;
    });
    const sumNoteCell = sumRow.getCell(10);
    sumNoteCell.border = borderAll;
    sumNoteCell.fill = {type:'pattern', pattern:'solid', fgColor:{argb:'FFF2F2F2'}};

    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], {type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `makeup_사업2단_${currentId}.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // ---- 초기화 ----
  function seedRowsData(){
    return [
      {center:'농협교육센터(카드)', bm:'N-Cap', plan:'외국인 상담업무 확대로 인력 증원(6명)', month:6, revenue:22850000, profit:1290000, note:'확정'},
      {center:'SH시설센터', bm:'N-Cap', plan:'채용보류 인원(1명) 채용 진행', month:6, revenue:4000000, profit:1000000, note:'확정'},
      {center:'KB손해보험', bm:'N-Cap', plan:'자동이체 전환 업무 수수료', month:5, revenue:1500000, profit:1500000, note:'확정'},
      {center:'KB손해보험', bm:'N-Cap', plan:'장마/한파 긴급출동 업무 지원', month:11, revenue:1000000, profit:1000000, note:'확정'},
      {center:'대신증권', bm:'N-Cap', plan:'채용보류 인원(2명) 채용 진행 협의 추진', month:8, revenue:7400000, profit:400000, note:''},
      {center:'한국투자신탁금융', bm:'N-Cap', plan:'단가 1.6% 인상 & 수의계약 제안', month:8, revenue:290000, profit:0, note:''},
      {center:'파견사업 확대', bm:'N-Cap', plan:'연간 총 9명 증원', month:8, revenue:26400000, profit:400000, note:''},
      {center:'LG전자AS', bm:'N-Cap', plan:'주 5일제 1개팀 운영 제안 추진(5명은 kt is 부담)', month:9, revenue:17500000, profit:-30000000, note:'미확정 / 현실적으로 불가 예상'},
      {center:'케이뱅크', bm:'Cap', plan:'한계사업 종료, 손실 방어', month:7, revenue:-250000000, profit:31000000, note:'케이뱅크 원복비용(약 2억원) 예상, 종료시 make up 이익 재검토 필요'},
      {center:'LG전자성수기', bm:'N-Cap', plan:'분단가 구조에 따른 실적(통화시간) 향상 및 단기 종료일 8/21→8/31 연장 제안을 통한 매출 및 이익 확대', month:8, revenue:40000000, profit:20000000, note:''}
    ].map(migrateRow);
  }

  async function init(){
    await loadState();
    applyColWidths();
    setupResizers();
    setupCopyButtons();

    if(appState.months.length===0){
      const seedId = '2026-07';
      const seedRows = seedRowsData();
      appState.months = [{id:seedId, label:fmtMonthLabel(seedId), createdAt:Date.now()}];
      appState.snapshots[seedId] = seedRows;
      showMonth(seedId);
      await persistState();
    }else{
      showMonth(appState.months[appState.months.length-1].id);
    }
  }
  init().catch(e=>{
    console.error('초기화 중 오류', e);
    showWarn('초기 로딩 중 문제가 발생했습니다. 화면을 새로고침해 주세요.');
  });
})();
