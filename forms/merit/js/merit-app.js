// 공적조서 화면 렌더링 · AI 초안 · 워드 저장.
// 탭 3개(공적조서 / 수상자 명단 / 센터 관리) 중 하나를 그리고,
// 공적조서 탭은 state.current가 있으면 "편집", 없으면 "목록"을 그린다.

// 편집 중 입력값을 record로 회수 — 저장/AI초안/워드저장/탭이동 직전에 항상 먼저 부른다.
function collectFormIntoRecord(){
  const rec = state.current;
  if(!rec) return;
  const g = id => { const el = document.getElementById(id); return el ? el.value : undefined; };
  ['empNo','rank','name','affiliation','meritField','period','awardTerm',
   'direction','rawFacts','s1','s2','s3',
   'confirmAffiliation','confirmRank','confirmName'].forEach(f=>{
    const v = g('f_'+f);
    if(v !== undefined) rec[f] = v;
  });
  // 소속 = 센터명. 센터 목록에 있는 이름이면 id를 끌어내 목록의 센터 필터에 쓴다.
  rec.centerId = centerIdFromInput(rec.affiliation);
  // "표창 수상 여부"는 여기서 다루지 않는다 — 작성 시점엔 실제 수상 여부를 알 수 없고,
  // 나중에 공적조서 목록에서 체크하면 toggleAwarded()가 서버 값을 직접 갱신한다.
}
/** 표창 수상 시기 선택지(작년~3년 뒤, 상·하반기). 저장된 값이 목록에 없으면 그것도 끼워 넣는다. */
function awardTermOptions(sel){
  const list = awardTermList();
  if(sel && !list.includes(sel)) list.unshift(sel);
  return list.map(t=>`<option value="${t}" ${sel===t?'selected':''}>${termLabel(t)}</option>`).join('');
}
/** 수상 시기를 고르면 공적기간을 그 반기에 맞게 자동으로 채운다(직접 수정도 가능). */
function onAwardTermChange(term){
  const p = document.getElementById('f_period');
  if(p) p.value = termToPeriod(term);
  if(state.current){ state.current.awardTerm = term; state.current.period = termToPeriod(term); }
}
/** datalist 입력값("센터명")을 센터 id로 되돌린다. 없는 이름이면 빈 값. */
function centerIdFromInput(name){
  const t = String(name||'').trim();
  if(!t) return '';
  const c = (state.centers||[]).find(x=>x.name===t);
  return c ? c.id : '';
}

function renderApp(){
  const root = document.getElementById('app');
  if(!root) return;
  if(state.loading){ root.innerHTML = `<div class="card"><div class="empty">불러오는 중…</div></div>`; return; }
  root.innerHTML = renderTabs() + (
    state.tab==='awards'  ? renderAwards()  :
    state.tab==='centers' ? renderCenters() :
    (state.current ? renderEditor() : renderList())
  );
  // 기존 건을 열었을 때도 중복 수상 경고가 바로 보이도록(입력 이벤트 없이도) 한 번 검사한다.
  if(state.tab==='docs' && state.current) checkDupAward(state.current.name);
}
function renderTabs(){
  const t = (id, label)=> `<button class="mtab ${state.tab===id?'active':''}" onclick="switchMeritTab('${id}')">${label}</button>`;
  return `<div class="mtabs">
    ${t('docs','📄 공적조서')}${t('awards','🏆 수상자 명단')}${t('centers','🏢 센터 관리')}
  </div>`;
}
function switchMeritTab(id){
  if(state.tab==='docs' && state.current) collectFormIntoRecord(); // 편집 중 입력 보존
  state.tab = id;
  renderApp();
}

// ── 공적조서 목록 ───────────────────────────────────────────
function renderList(){
  const q = (state.q||'').trim().toLowerCase();
  let rows = (state.index||[]).slice()
    .sort((a,b)=> String(b.updatedAt||'').localeCompare(String(a.updatedAt||'')));
  if(state.filterCenter) rows = rows.filter(r=> r.centerId===state.filterCenter);
  if(state.filterAwarded==='y') rows = rows.filter(r=> r.awarded);
  if(state.filterAwarded==='n') rows = rows.filter(r=> !r.awarded);
  if(q) rows = rows.filter(r=> [r.name,r.rank,r.affiliation,r.centerName]
    .filter(Boolean).join(' ').toLowerCase().includes(q));

  const centerOpts = (state.centers||[]).slice()
    .sort((a,b)=>a.name.localeCompare(b.name,'ko'))
    .map(c=>`<option value="${c.id}" ${state.filterCenter===c.id?'selected':''}>${escapeHtml(c.name)}</option>`).join('');

  const items = rows.length ? rows.map(r=>`
    <div class="mr-row">
      <label class="mr-chk" title="표창을 실제로 받았으면 체크">
        <input type="checkbox" ${r.awarded?'checked':''} onchange="toggleAwarded('${r.id}',this.checked)">
      </label>
      <div class="mr-row-main" onclick="openRecord('${r.id}')">
        <div class="mr-row-t">
          ${escapeHtml(r.name||'(이름 미입력)')}
          <span class="mr-rk">${escapeHtml(r.rank||'')}</span>
          ${r.awarded?'<span class="mr-badge award">수상</span>':''}
        </div>
        <div class="mr-row-m">${escapeHtml(r.affiliation||r.centerName||'소속 미입력')}${r.awardTerm?' · '+escapeHtml(termLabel(r.awardTerm)):''} · ${r.updatedAt?new Date(r.updatedAt).toLocaleDateString('ko-KR'):''}</div>
      </div>
      <div class="mr-row-act">
        <button class="btn-mini" title="이 내용을 복제해 다른 대상자로 작성" onclick="duplicateRecord('${r.id}')">복제</button>
        <button class="btn-mini danger" onclick="deleteRecord('${r.id}')">삭제</button>
      </div>
    </div>`).join('')
    : `<div class="empty">${(q||state.filterCenter||state.filterAwarded)?'조건에 맞는 공적조서가 없습니다.':'작성된 공적조서가 없습니다. 「+ 새 공적조서」로 시작하세요.'}</div>`;

  return `
  <div class="card">
    <div class="mr-list-head">
      <h2>📄 공적조서 <span class="cnt">${rows.length}/${(state.index||[]).length}</span></h2>
      <button class="btn btn-primary btn-sm" onclick="newRecord()">+ 새 공적조서</button>
    </div>
    <div class="mr-filters">
      <input class="mr-search" type="search" placeholder="🔍 성명·소속·센터·담당자 검색"
        value="${escapeHtml(state.q)}" oninput="state.q=this.value; renderApp(); requeueFocus('.mr-search')">
      <select onchange="state.filterCenter=this.value; renderApp();">
        <option value="">전체 센터</option>${centerOpts}
      </select>
      <select onchange="state.filterAwarded=this.value; renderApp();">
        <option value="" ${state.filterAwarded===''?'selected':''}>수상여부 전체</option>
        <option value="y" ${state.filterAwarded==='y'?'selected':''}>수상함</option>
        <option value="n" ${state.filterAwarded==='n'?'selected':''}>미수상</option>
      </select>
    </div>
    ${items}
  </div>`;
}
/** 검색창은 매 입력마다 다시 그려지므로 커서를 되돌려 준다. */
function requeueFocus(sel){
  setTimeout(()=>{
    const el = document.querySelector(sel);
    if(el){ const v=el.value; el.focus(); el.setSelectionRange(v.length, v.length); }
  }, 0);
}

// ── 공적조서 편집 ───────────────────────────────────────────
function renderEditor(){
  const r = state.current;
  const memberOpts = ['<option value="">직접 입력</option>']
    .concat((state.members||[]).map(m=>`<option value="${escapeHtml(m.name)}">${escapeHtml(m.name)}</option>`)).join('');
  const centerList = (state.centers||[]).slice().sort((a,b)=>a.name.localeCompare(b.name,'ko'))
    .map(c=>`<option value="${escapeHtml(c.name)}"></option>`).join('');

  return `
  <div class="mr-editbar">
    <button class="btn btn-outline btn-sm" onclick="backToList()">← 목록으로</button>
    <span class="mr-editbar-who">${escapeHtml(r.name||'새 공적조서')}</span>
    <span class="grow"></span>
    <button class="btn btn-primary btn-sm" onclick="saveCurrent()">💾 저장</button>
  </div>

  <div class="card">
    <h3>대상자 정보</h3>
    <div id="dupWarn"></div>
    <div class="mr-grid">
      <label class="fld"><span>사번</span><input id="f_empNo" value="${escapeHtml(r.empNo)}" placeholder="2390620"></label>
      <label class="fld"><span>직급(호칭)</span><input id="f_rank" value="${escapeHtml(r.rank)}" placeholder="팀장 / 센터장"></label>
      <label class="fld">
        <span>성명</span>
        <input id="f_name" value="${escapeHtml(r.name)}" placeholder="이름" oninput="checkDupAward(this.value)">
      </label>
      <label class="fld wide">
        <span>소속 <small>(센터명을 입력하면 검색됩니다)</small></span>
        <input id="f_affiliation" list="centerList" value="${escapeHtml(r.affiliation)}" placeholder="KB손해보험 부천센터">
        <datalist id="centerList">${centerList}</datalist>
      </label>
      <label class="fld wide"><span>공적 분야</span><input id="f_meritField" value="${escapeHtml(r.meritField)}"></label>
      <label class="fld">
        <span>표창 수상 시기</span>
        <select id="f_awardTerm" onchange="onAwardTermChange(this.value)">${awardTermOptions(r.awardTerm)}</select>
      </label>
      <label class="fld"><span>공적기간 <small>(수상 시기 선택 시 자동)</small></span><input id="f_period" value="${escapeHtml(r.period)}" placeholder="2026. 1월~6월까지"></label>
    </div>
    <p class="hint">표창을 실제로 받았는지는 작성 시점엔 알 수 없으므로 여기서 다루지 않습니다 — 나중에
      <b>공적조서 목록</b>에서 체크하면 자동으로 수상자 명단에 등록되고, 체크를 풀면 명단에서도 함께 빠집니다.</p>
  </div>

  <div class="card mr-input-card">
    <h3>✍️ AI 초안 입력</h3>
    <div class="field-label">작성 방향성 <small>(어떤 점을 강조해서 쓸지)</small></div>
    <textarea class="input-area sm" id="f_direction" placeholder="예) 응대율 목표 초과 달성과 노무 이슈 해결을 중심으로, 조직 안정화에 기여한 점을 강조">${escapeHtml(r.direction)}</textarea>
    <div class="field-label">실적 내용 <small>(형식 신경 쓰지 말고 편하게 나열해 주세요)</small></div>
    <textarea class="input-area" id="f_rawFacts" placeholder="예) 상반기 응대율 계속 98% 넘김. 목표는 95%였음.&#10;노무 이슈 오래 끌던 거 직접 나서서 해결함.">${escapeHtml(r.rawFacts)}</textarea>
    <label class="mr-inline-chk ref-chk">
      <input type="checkbox" id="f_useRef" checked> 기존에 작성된 공적조서 문체·수준을 참고해서 작성
    </label>
    <div class="form-actions">
      <button class="btn btn-primary" id="aiMeritBtn" onclick="generateMeritDraft()">🤖 AI 초안 생성</button>
    </div>
    <p class="hint">입력한 내용에서 확인되는 수치는 그대로 살려 강조하고, 근거 없는 내용은 지어내지 않습니다.</p>
  </div>

  <div class="card">
    <h3>📄 공적조서 본문</h3>
    <p class="hint">글머리표 규칙 — 대분류는 <b>( </b>로, 하위 항목은 <b>- </b>로 시작하면 워드에서 원본 양식과 동일하게 들여쓰기됩니다.</p>
    <div class="field-label">1. 실적 요약 <small>(무엇을 이뤄냈는가 — 핵심만)</small></div>
    <textarea class="input-area" id="f_s1">${escapeHtml(r.s1)}</textarea>
    <div class="field-label">2. 실적 달성을 위한 활동 <small>(어떻게 해냈는가 — 구체적 실행과 효과)</small></div>
    <textarea class="input-area lg" id="f_s2">${escapeHtml(r.s2)}</textarea>
    <div class="field-label">3. 핵심가치 실천/기타사항 <small>(회사 핵심가치 기반)</small></div>
    <textarea class="input-area" id="f_s3">${escapeHtml(r.s3)}</textarea>
    <p class="hint core-values">핵심가치 : ${escapeHtml(CORE_VALUE_TEXT)}</p>
  </div>

  <div class="card">
    <h3>✅ 확인자</h3>
    <div class="mr-grid">
      <label class="fld"><span>소속</span><input id="f_confirmAffiliation" value="${escapeHtml(r.confirmAffiliation)}"></label>
      <label class="fld"><span>직급(호칭)</span><input id="f_confirmRank" value="${escapeHtml(r.confirmRank)}"></label>
      <label class="fld">
        <span>성명</span>
        <div class="fld-row">
          <input id="f_confirmName" value="${escapeHtml(r.confirmName)}">
          <select class="mr-pick" onchange="if(this.value){document.getElementById('f_confirmName').value=this.value;} this.selectedIndex=0;">${memberOpts}</select>
        </div>
      </label>
    </div>
    <div class="form-actions">
      <button class="btn btn-primary" onclick="saveCurrent()">💾 저장</button>
      <button class="btn btn-green" onclick="downloadMeritWord()">⬇ 워드로 저장 (양식 그대로)</button>
    </div>
  </div>`;
}
function backToList(){
  collectFormIntoRecord();
  state.current = null;
  renderApp();
}

/** 표창은 형평성을 따지므로, 이미 수상 이력이 있는 사람이면 작성 단계에서 바로 알려준다.
 *  (수상자 명단을 사람이 눈으로 뒤지지 않아도 되게 — 제안1) */
function checkDupAward(name){
  const el = document.getElementById('dupWarn');
  if(!el) return;
  const t = String(name||'').trim();
  if(!t){ el.innerHTML = ''; return; }
  const hits = (state.awards||[]).filter(a => String(a.name||'').trim() === t);
  if(!hits.length){ el.innerHTML = ''; return; }
  const detail = hits
    .sort((a,b)=> String(b.year||'').localeCompare(String(a.year||'')))
    .map(h => `${escapeHtml(h.year||'?')}년${h.centerName?' · '+escapeHtml(h.centerName):''}${h.position?' · '+escapeHtml(h.position):''}`)
    .join(' / ');
  el.innerHTML = `<div class="dup-warn">
    ⚠️ <b>${escapeHtml(t)}</b> 님은 이미 표창 수상 이력이 있습니다 — ${detail}
    <button class="btn-mini" onclick="switchMeritTab('awards')">명단 보기</button>
  </div>`;
}

// ── 표창 수상자 명단 ────────────────────────────────────────
function renderAwards(){
  const q = (state.awardQ||'').trim().toLowerCase();
  let rows = (state.awards||[]).slice().sort((a,b)=>
    String(b.year||'').localeCompare(String(a.year||'')) || String(a.name||'').localeCompare(String(b.name||''),'ko'));
  if(state.awardYear)   rows = rows.filter(a=> String(a.year)===String(state.awardYear));
  if(state.awardCenter) rows = rows.filter(a=> a.centerId===state.awardCenter);
  if(q) rows = rows.filter(a=> [a.name,a.position,a.centerName,a.ownerName,a.note]
    .filter(Boolean).join(' ').toLowerCase().includes(q));

  const years = [...new Set((state.awards||[]).map(a=>String(a.year||'')).filter(Boolean))].sort().reverse();
  const yearOpts = years.map(y=>`<option value="${y}" ${state.awardYear===y?'selected':''}>${y}년</option>`).join('');
  const centerOpts = (state.centers||[]).slice().sort((a,b)=>a.name.localeCompare(b.name,'ko'))
    .map(c=>`<option value="${c.id}" ${state.awardCenter===c.id?'selected':''}>${escapeHtml(c.name)}</option>`).join('');

  const body = rows.length ? rows.map(a=>`
    <tr>
      <td>${escapeHtml(a.year||'')}</td>
      <td class="nm">${escapeHtml(a.name||'')}</td>
      <td>${escapeHtml(a.position||'')}</td>
      <td>${escapeHtml(a.centerName||'')}</td>
      <td>${escapeHtml(a.ownerName||'')}</td>
      <td class="note">${escapeHtml(a.note||'')}</td>
      <td class="act">
        <button class="btn-mini" onclick="editAward('${a.id}')">수정</button>
        <button class="btn-mini danger" onclick="deleteAward('${a.id}')">삭제</button>
      </td>
    </tr>`).join('')
    : `<tr><td colspan="7" class="empty-cell">${(q||state.awardYear||state.awardCenter)?'조건에 맞는 수상자가 없습니다.':'등록된 수상자가 없습니다.'}</td></tr>`;

  return `
  <div class="card">
    <div class="mr-list-head">
      <h2>🏆 표창 수상자 명단 <span class="cnt">${rows.length}/${(state.awards||[]).length}</span></h2>
      <button class="btn btn-primary btn-sm" onclick="editAward('')">+ 수상자 추가</button>
    </div>
    <div class="mr-filters">
      <input class="mr-search" type="search" placeholder="🔍 성명·직책·센터·담당자 검색"
        value="${escapeHtml(state.awardQ)}" oninput="state.awardQ=this.value; renderApp(); requeueFocus('.mr-search')">
      <select onchange="state.awardYear=this.value; renderApp();">
        <option value="">전체 연도</option>${yearOpts}
      </select>
      <select onchange="state.awardCenter=this.value; renderApp();">
        <option value="">전체 센터</option>${centerOpts}
      </select>
    </div>
    ${renderAwardSummary(rows)}
    <div class="mr-table-wrap">
      <table class="mr-table">
        <thead><tr><th>연도</th><th>성명</th><th>직책</th><th>센터</th><th>담당자</th><th>비고</th><th>관리</th></tr></thead>
        <tbody>${body}</tbody>
      </table>
    </div>
    <div id="awardForm"></div>
  </div>`;
}

/** 센터별·담당자별 수상 집계 + "아직 수상자가 없는 센터" — 반기마다 대상자를 고를 때
 *  배분이 한쪽으로 쏠렸는지 한눈에 보기 위한 요약(제안2). 현재 필터가 적용된 목록 기준. */
function renderAwardSummary(rows){
  if(!rows.length) return '';
  const tally = (key)=>{
    const m = new Map();
    rows.forEach(r=>{ const k=(r[key]||'').trim(); if(k) m.set(k,(m.get(k)||0)+1); });
    return [...m.entries()].sort((a,b)=> b[1]-a[1] || a[0].localeCompare(b[0],'ko'));
  };
  const byCenter = tally('centerName');
  const byOwner  = tally('ownerName');
  const chips = (arr, max)=> arr.slice(0,max)
    .map(([k,v])=>`<span class="sum-chip">${escapeHtml(k)} <b>${v}</b></span>`).join('')
    + (arr.length>max ? `<span class="sum-more">외 ${arr.length-max}곳</span>` : '');

  // 이 목록에 한 번도 등장하지 않은 센터 = 배분에서 빠지고 있는 곳
  const awarded = new Set(rows.map(r=>(r.centerName||'').trim()).filter(Boolean));
  const missing = (state.centers||[]).map(c=>c.name).filter(n=>!awarded.has(n));

  return `
  <div class="mr-summary">
    <div class="sum-row"><span class="sum-label">총 수상</span><b class="sum-total">${rows.length}명</b></div>
    <div class="sum-row"><span class="sum-label">센터별</span><span class="sum-chips">${chips(byCenter,5)}</span></div>
    <div class="sum-row"><span class="sum-label">담당자별</span><span class="sum-chips">${chips(byOwner,5)}</span></div>
    ${missing.length ? `<div class="sum-row missing">
      <span class="sum-label">수상자 없는 센터</span>
      <span class="sum-chips">${missing.slice(0,8).map(n=>`<span class="sum-chip none">${escapeHtml(n)}</span>`).join('')}${missing.length>8?`<span class="sum-more">외 ${missing.length-8}곳</span>`:''}</span>
    </div>` : ''}
  </div>`;
}
function editAward(id){
  const a = (state.awards||[]).find(x=>x.id===id) || {
    id:'aw'+Date.now(), year:String(new Date().getFullYear()),
    name:'', position:'', centerId:'', centerName:'', ownerName:'', meritId:'', note:''
  };
  const posOpts = POSITIONS.map(p=>`<option value="${p}" ${a.position===p?'selected':''}>${p}</option>`).join('');
  const memberOpts = ['<option value="">직접 입력</option>']
    .concat((state.members||[]).map(m=>`<option value="${escapeHtml(m.name)}">${escapeHtml(m.name)}</option>`)).join('');
  const centerList = (state.centers||[]).slice().sort((x,y)=>x.name.localeCompare(y.name,'ko'))
    .map(c=>`<option value="${escapeHtml(c.name)}"></option>`).join('');

  document.getElementById('awardForm').innerHTML = `
  <div class="mr-subform">
    <h4>${id?'수상자 수정':'수상자 추가'}</h4>
    <div class="mr-grid">
      <label class="fld"><span>연도</span><input id="a_year" value="${escapeHtml(a.year)}" placeholder="2026"></label>
      <label class="fld"><span>성명</span><input id="a_name" value="${escapeHtml(a.name)}" placeholder="반수진"></label>
      <label class="fld"><span>직책</span><select id="a_position"><option value="">선택</option>${posOpts}</select></label>
      <label class="fld">
        <span>센터 <small>(입력하면 검색됩니다)</small></span>
        <input id="a_center" list="awCenterList" value="${escapeHtml(a.centerName)}" placeholder="센터명 입력/선택">
        <datalist id="awCenterList">${centerList}</datalist>
      </label>
      <label class="fld">
        <span>담당자(직원)</span>
        <div class="fld-row">
          <input id="a_owner" value="${escapeHtml(a.ownerName)}" placeholder="강성호">
          <select class="mr-pick" onchange="if(this.value){document.getElementById('a_owner').value=this.value;} this.selectedIndex=0;">${memberOpts}</select>
        </div>
      </label>
      <label class="fld wide"><span>비고</span><input id="a_note" value="${escapeHtml(a.note)}" placeholder="표창명 등"></label>
    </div>
    <div class="form-actions">
      <button class="btn btn-primary btn-sm" onclick="submitAward('${a.id}','${a.meritId||''}')">저장</button>
      <button class="btn btn-outline btn-sm" onclick="document.getElementById('awardForm').innerHTML=''">취소</button>
    </div>
  </div>`;
  document.getElementById('awardForm').scrollIntoView({behavior:'smooth', block:'nearest'});
}
function submitAward(id, meritId){
  const v = i => (document.getElementById(i)||{}).value || '';
  const name = v('a_name').trim();
  if(!name){ flash('성명을 입력하세요'); return; }
  const centerName = v('a_center').trim();
  saveAward({
    id, meritId: meritId||'',
    year: v('a_year').trim(), name,
    position: v('a_position'),
    centerId: centerIdFromInput(centerName), centerName,
    ownerName: v('a_owner').trim(), note: v('a_note').trim(),
  });
}
// ── 센터 관리 ───────────────────────────────────────────────
function renderCenters(){
  const q = (state.centerQ||'').trim().toLowerCase();
  let list = (state.centers||[]).slice().sort((a,b)=>a.name.localeCompare(b.name,'ko'));
  if(q) list = list.filter(c=>c.name.toLowerCase().includes(q));
  const rows = list.length ? list.map(c=>`
    <div class="mr-row compact">
      <input class="mr-center-name" value="${escapeHtml(c.name)}" onchange="renameCenter('${c.id}', this.value)">
      <button class="btn-mini danger" onclick="removeCenter('${c.id}')">삭제</button>
    </div>`).join('') : `<div class="empty">센터가 없습니다.</div>`;
  return `
  <div class="card">
    <div class="mr-list-head">
      <h2>🏢 센터 관리 <span class="cnt">${list.length}/${(state.centers||[]).length}</span></h2>
      <button class="btn btn-outline btn-sm" onclick="syncCentersFromWeekly()">주간보고 센터 가져오기</button>
    </div>
    <p class="hint">이 목록은 <b>공적조서 양식 전용</b>입니다. 여기서 고쳐도 주간보고 응대율 표에는 영향을 주지 않습니다.
      주간보고에 새 센터가 생겼으면 「주간보고 센터 가져오기」로 합칠 수 있습니다.</p>
    <div class="mr-filters">
      <input class="mr-search" type="search" placeholder="🔍 센터 검색"
        value="${escapeHtml(state.centerQ||'')}" oninput="state.centerQ=this.value; renderApp(); requeueFocus('.mr-search')">
    </div>
    ${rows}
    <div class="mr-add-center">
      <input id="newCenterName" placeholder="새 센터명">
      <button class="btn btn-green btn-sm" onclick="addCenter()">+ 추가</button>
    </div>
  </div>`;
}
async function addCenter(){
  const el = document.getElementById('newCenterName');
  const name = (el.value||'').trim();
  if(!name){ flash('센터명을 입력하세요'); return; }
  if((state.centers||[]).some(c=>c.name===name)){ flash('이미 있는 센터입니다'); return; }
  try{
    await mutateCenters(arr=>{ arr.push({id:'mc'+Date.now(), name}); return arr; });
    flash('센터를 추가했습니다'); renderApp();
  }catch(e){ flash('저장 실패: 네트워크를 확인해 주세요'); }
}
async function renameCenter(id, name){
  const t = String(name||'').trim();
  if(!t) { renderApp(); return; }
  try{
    await mutateCenters(arr=>{ const c=arr.find(x=>x.id===id); if(c) c.name=t; return arr; });
    flash('센터명을 수정했습니다'); renderApp();
  }catch(e){ flash('저장 실패: 네트워크를 확인해 주세요'); }
}
async function removeCenter(id){
  const c = (state.centers||[]).find(x=>x.id===id);
  const used = (state.index||[]).filter(r=>r.centerId===id).length;
  if(!confirm(`「${c?c.name:''}」 센터를 목록에서 삭제할까요?${used?`\n이 센터로 작성된 공적조서 ${used}건은 삭제되지 않습니다.`:''}`)) return;
  try{
    await mutateCenters(arr=> arr.filter(x=>x.id!==id));
    flash('삭제되었습니다'); renderApp();
  }catch(e){ flash('삭제 실패: 네트워크를 확인해 주세요'); }
}

// ── AI 초안 · 워드 ──────────────────────────────────────────
async function generateMeritDraft(){
  collectFormIntoRecord();
  const r = state.current;
  if(!r.rawFacts || !r.rawFacts.trim()){ flash('실적 내용을 먼저 입력해 주세요'); return; }
  const btn = document.getElementById('aiMeritBtn');
  const useRef = (document.getElementById('f_useRef')||{}).checked;
  if(btn){ btn.disabled = true; btn.textContent = '⏳ 생성 중…'; }
  flash('AI 초안 생성 중… (10~30초 정도 걸립니다)');
  try{
    // 기존 공적조서 본문을 문체 참고용으로 최대 2건 함께 보낸다(자기 자신은 제외).
    // 여기에 더해, "AI 초안 → 담당자가 실제로 고친 최종본" 쌍이 있으면 그것도 보낸다 —
    // 담당자가 어느 방향으로 고치는지(과장 제거 등)를 학습시키기 위함(제안3 피드백 루프).
    let samples = [], corrections = [];
    if(useRef){
      const others = (state.index||[]).filter(x=>x && x.id!==r.id)
        .sort((a,b)=>String(b.updatedAt||'').localeCompare(String(a.updatedAt||'')));
      const corrIds = others.filter(x=>x.hasCorrection).slice(0,2).map(x=>x.id);
      const sampIds = others.filter(x=>!corrIds.includes(x.id)).slice(0,2).map(x=>x.id);
      const [corrRecs, sampRecs] = await Promise.all([
        Promise.all(corrIds.map(id=>apiGet(meritRecKey(id)).catch(()=>null))),
        Promise.all(sampIds.map(id=>apiGet(meritRecKey(id)).catch(()=>null))),
      ]);
      corrections = corrRecs.filter(x=>x && x.aiDraft).map(x=>({
        before: { s1:String(x.aiDraft.s1||'').slice(0,400), s2:String(x.aiDraft.s2||'').slice(0,600) },
        after:  { s1:String(x.s1||'').slice(0,400),         s2:String(x.s2||'').slice(0,600) },
      })).filter(c => c.after.s1 || c.after.s2);
      samples = sampRecs.filter(x=>x && (x.s1||x.s2)).map(x=>({
        s1:String(x.s1||'').slice(0,700), s2:String(x.s2||'').slice(0,900), s3:String(x.s3||'').slice(0,700)
      }));
    }
    const res = await fetch('/api/ai-merit-draft', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({
        direction: r.direction, rawFacts: r.rawFacts,
        name: r.name, rank: r.rank,
        affiliation: r.affiliation,
        meritField: r.meritField, period: r.period, samples, corrections,
      })
    });
    const data = await res.json();
    if(!res.ok || data.error) throw new Error(data.error || '생성 실패');
    r.s1 = data.s1 || r.s1;
    r.s2 = data.s2 || r.s2;
    r.s3 = data.s3 || r.s3;
    // 생성 직후 원본을 스냅샷으로 남긴다 — 저장할 때 사람이 고친 최종본과 비교해
    // 다음 초안 생성의 문체 학습 자료로 쓴다.
    r.aiDraft = { s1: data.s1||'', s2: data.s2||'', s3: data.s3||'', at: new Date().toISOString() };
    flash(`초안이 생성됐습니다${corrections.length?` (기존 수정이력 ${corrections.length}건 반영)`:''} — 확인·수정 후 「저장」을 눌러주세요.`);
    renderApp();
  }catch(e){
    console.error(e);
    flash('초안 생성 실패: ' + (e.message || '네트워크를 확인해 주세요'));
    if(btn){ btn.disabled = false; btn.textContent = '🤖 AI 초안 생성'; }
  }
}

async function downloadMeritWord(){
  collectFormIntoRecord();
  const r = state.current;
  if(!r) return;
  try{
    const blob = await buildMeritDocxBlob(r);
    meritDownloadBlob(blob, meritFileName(r));
    flash('워드 파일이 저장되었습니다');
  }catch(e){
    console.error(e);
    flash('워드 생성 중 오류가 발생했습니다');
  }
}

loadMeritState();
