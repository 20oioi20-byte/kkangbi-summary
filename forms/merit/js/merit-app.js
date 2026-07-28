// 공적조서 화면 렌더링 · AI 초안 · 워드 저장.
// 탭 3개(공적조서 / 수상자 명단 / 센터 관리) 중 하나를 그리고,
// 공적조서 탭은 state.current가 있으면 "편집", 없으면 "목록"을 그린다.

// 편집 중 입력값을 record로 회수 — 저장/AI초안/워드저장/탭이동 직전에 항상 먼저 부른다.
function collectFormIntoRecord(){
  const rec = state.current;
  if(!rec) return;
  const g = id => { const el = document.getElementById(id); return el ? el.value : undefined; };
  ['empNo','rank','name','affiliation','meritField','period','ownerName',
   'direction','rawFacts','s1','s2','s3',
   'confirmAffiliation','confirmRank','confirmName','awardYear'].forEach(f=>{
    const v = g('f_'+f);
    if(v !== undefined) rec[f] = v;
  });
  const cid = document.getElementById('f_centerPick');
  if(cid) rec.centerId = centerIdFromInput(cid.value);
  const aw = document.getElementById('f_awarded');
  if(aw) rec.awarded = aw.checked;
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
  if(q) rows = rows.filter(r=> [r.name,r.rank,r.affiliation,r.centerName,r.ownerName]
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
        <div class="mr-row-m">${escapeHtml(r.centerName||r.affiliation||'소속 미입력')}${r.ownerName?' · 담당 '+escapeHtml(r.ownerName):''} · ${r.updatedAt?new Date(r.updatedAt).toLocaleDateString('ko-KR'):''}</div>
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
    <div class="mr-grid">
      <label class="fld"><span>사번</span><input id="f_empNo" value="${escapeHtml(r.empNo)}" placeholder="2390620"></label>
      <label class="fld"><span>직급(호칭)</span><input id="f_rank" value="${escapeHtml(r.rank)}" placeholder="팀장 / 센터장"></label>
      <label class="fld">
        <span>성명</span>
        <div class="fld-row">
          <input id="f_name" value="${escapeHtml(r.name)}" placeholder="이름">
          <select class="mr-pick" onchange="if(this.value){document.getElementById('f_name').value=this.value;} this.selectedIndex=0;">${memberOpts}</select>
        </div>
      </label>
      <label class="fld">
        <span>센터 <small>(입력하면 검색됩니다)</small></span>
        <input id="f_centerPick" list="centerList" value="${escapeHtml(centerNameById(r.centerId))}" placeholder="센터명 입력/선택">
        <datalist id="centerList">${centerList}</datalist>
      </label>
      <label class="fld"><span>소속(양식 표기)</span><input id="f_affiliation" value="${escapeHtml(r.affiliation)}" placeholder="KB손해보험 부천센터"></label>
      <label class="fld">
        <span>담당자(직원)</span>
        <div class="fld-row">
          <input id="f_ownerName" value="${escapeHtml(r.ownerName)}" placeholder="강성호">
          <select class="mr-pick" onchange="if(this.value){document.getElementById('f_ownerName').value=this.value;} this.selectedIndex=0;">${memberOpts}</select>
        </div>
      </label>
      <label class="fld wide"><span>공적 분야</span><input id="f_meritField" value="${escapeHtml(r.meritField)}"></label>
      <label class="fld"><span>공적기간</span><input id="f_period" value="${escapeHtml(r.period)}" placeholder="2026. 1월~6월까지"></label>
      <label class="fld"><span>표창 수상 연도</span><input id="f_awardYear" value="${escapeHtml(r.awardYear)}" placeholder="2026"></label>
      <label class="fld awarded-fld">
        <span>표창 수상 여부</span>
        <label class="mr-inline-chk"><input type="checkbox" id="f_awarded" ${r.awarded?'checked':''}> 실제로 표창을 받음</label>
      </label>
    </div>
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
      <button class="btn btn-outline" onclick="addCurrentToAwards()">🏆 수상자 명단에 추가</button>
    </div>
  </div>`;
}
function backToList(){
  collectFormIntoRecord();
  state.current = null;
  renderApp();
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
    <div class="mr-table-wrap">
      <table class="mr-table">
        <thead><tr><th>연도</th><th>성명</th><th>직책</th><th>센터</th><th>담당자</th><th>비고</th><th>관리</th></tr></thead>
        <tbody>${body}</tbody>
      </table>
    </div>
    <div id="awardForm"></div>
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
/** 편집 중인 공적조서를 수상자 명단으로 옮겨 담는다(대상자 정보 자동 채움). */
function addCurrentToAwards(){
  collectFormIntoRecord();
  const r = state.current;
  if(!r.name){ flash('먼저 성명을 입력하세요'); return; }
  state.tab = 'awards';
  renderApp();
  const a = {
    id:'aw'+Date.now(), year: r.awardYear || String(new Date().getFullYear()),
    name: r.name, position: '', centerId: r.centerId,
    centerName: centerNameById(r.centerId) || r.affiliation,
    ownerName: r.ownerName, meritId: r.id, note: ''
  };
  state.awards.unshift(a);   // 폼에 값을 채우기 위해 임시로 넣고
  editAward(a.id);
  state.awards.shift();      // 저장 전까지는 목록에 남기지 않는다
  flash('직책을 선택하고 저장하세요');
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
    let samples = [];
    if(useRef){
      const ids = (state.index||[])
        .filter(x=>x && x.id!==r.id)
        .sort((a,b)=>String(b.updatedAt||'').localeCompare(String(a.updatedAt||'')))
        .slice(0,2).map(x=>x.id);
      const recs = await Promise.all(ids.map(id=>apiGet(meritRecKey(id)).catch(()=>null)));
      samples = recs.filter(x=>x && (x.s1||x.s2)).map(x=>({
        s1:String(x.s1||'').slice(0,700), s2:String(x.s2||'').slice(0,900), s3:String(x.s3||'').slice(0,700)
      }));
    }
    const res = await fetch('/api/ai-merit-draft', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({
        direction: r.direction, rawFacts: r.rawFacts,
        name: r.name, rank: r.rank,
        affiliation: r.affiliation || centerNameById(r.centerId),
        meritField: r.meritField, period: r.period, samples,
      })
    });
    const data = await res.json();
    if(!res.ok || data.error) throw new Error(data.error || '생성 실패');
    r.s1 = data.s1 || r.s1;
    r.s2 = data.s2 || r.s2;
    r.s3 = data.s3 || r.s3;
    flash('초안이 생성됐습니다 — 내용을 확인·수정하고 「저장」을 눌러주세요.');
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
