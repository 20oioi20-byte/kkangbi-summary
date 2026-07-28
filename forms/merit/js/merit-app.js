// 공적조서 화면 렌더링 · AI 초안 · 워드 저장.
// 화면은 "목록" 또는 "편집" 둘 중 하나만 그린다(state.current가 있으면 편집).

// 편집 중 입력값을 record로 회수 — 저장/AI초안/워드저장 직전에 항상 먼저 부른다.
// (렌더링을 다시 하면 DOM이 새로 그려지므로, 그 전에 사용자가 친 값을 잃지 않도록.)
function collectFormIntoRecord(){
  const rec = state.current;
  if(!rec) return;
  const g = id => { const el = document.getElementById(id); return el ? el.value : undefined; };
  const fields = ['empNo','rank','name','affiliation','meritField','period',
                  'direction','rawFacts','s1','s2','s3',
                  'confirmAffiliation','confirmRank','confirmName'];
  fields.forEach(f=>{
    const v = g('f_'+f);
    if(v !== undefined) rec[f] = v;
  });
}

function renderApp(){
  const root = document.getElementById('app');
  if(!root) return;
  if(state.loading){ root.innerHTML = `<div class="card"><div class="empty">불러오는 중…</div></div>`; return; }
  root.innerHTML = state.current ? renderEditor() : renderList();
}

function renderList(){
  const rows = (state.index||[]).slice().sort((a,b)=> String(b.updatedAt||'').localeCompare(String(a.updatedAt||'')));
  const items = rows.length ? rows.map(r=>`
    <div class="mr-item">
      <div class="mr-item-main" onclick="openRecord('${r.id}')">
        <div class="t">${escapeHtml(r.name||'(이름 미입력)')} <span class="rk">${escapeHtml(r.rank||'')}</span></div>
        <div class="m">${escapeHtml(r.affiliation||'소속 미입력')} · ${r.updatedAt?new Date(r.updatedAt).toLocaleString('ko-KR'):''}</div>
      </div>
      <div class="mr-item-actions">
        <button class="btn btn-outline btn-sm" onclick="openRecord('${r.id}')">열기</button>
        <button class="btn btn-danger btn-sm" onclick="deleteRecord('${r.id}')">삭제</button>
      </div>
    </div>`).join('') : `<div class="empty">작성된 공적조서가 없습니다. 「+ 새 공적조서」로 시작하세요.</div>`;

  return `
  <div class="card">
    <h2>🏅 본부장표창 공적조서</h2>
    <p class="hint">대상자별로 1건씩 작성합니다. 실적을 두서없이 적어두면 AI가 3개 섹션 초안을 만들어 주고, 확인·수정한 뒤 <b>양식 그대로 워드로 저장</b>할 수 있습니다.</p>
    <button class="add-row-btn" onclick="newRecord()">+ 새 공적조서</button>
    ${items}
  </div>`;
}

function renderEditor(){
  const r = state.current;
  const memberOpts = ['<option value="">직접 입력</option>']
    .concat((state.members||[]).map(m=>`<option value="${escapeHtml(m.name)}">${escapeHtml(m.name)}</option>`))
    .join('');

  return `
  <div class="card">
    <div class="mr-editor-top">
      <h2>🏅 공적조서 작성</h2>
      <button class="btn btn-outline btn-sm" onclick="backToList()">← 목록</button>
    </div>

    <div class="mr-grid">
      <label class="fld"><span>사번</span><input id="f_empNo" value="${escapeHtml(r.empNo)}" placeholder="2390620"></label>
      <label class="fld"><span>직급(호칭)</span><input id="f_rank" value="${escapeHtml(r.rank)}" placeholder="팀장 / 센터장 / 차장"></label>
      <label class="fld">
        <span>성명 <small>(팀원 명단에서 선택 가능)</small></span>
        <div class="fld-row">
          <input id="f_name" value="${escapeHtml(r.name)}" placeholder="이름">
          <select class="mr-pick" onchange="if(this.value){document.getElementById('f_name').value=this.value;} this.selectedIndex=0;">${memberOpts}</select>
        </div>
      </label>
      <label class="fld wide"><span>소속</span><input id="f_affiliation" value="${escapeHtml(r.affiliation)}" placeholder="KB손해보험 부천센터"></label>
      <label class="fld wide"><span>공적 분야</span><input id="f_meritField" value="${escapeHtml(r.meritField)}"></label>
      <label class="fld"><span>공적기간</span><input id="f_period" value="${escapeHtml(r.period)}" placeholder="2026. 1월~6월까지"></label>
    </div>
  </div>

  <div class="card mr-input-card">
    <h3>✍️ AI 초안 입력</h3>
    <div class="field-label">작성 방향성 <small>(어떤 점을 강조해서 쓸지)</small></div>
    <textarea class="input-area sm" id="f_direction" placeholder="예) 응대율 목표 초과 달성과 노무 이슈 해결을 중심으로, 조직 안정화에 기여한 점을 강조">${escapeHtml(r.direction)}</textarea>
    <div class="field-label">실적 내용 <small>(형식 신경 쓰지 말고 편하게 나열해 주세요)</small></div>
    <textarea class="input-area" id="f_rawFacts" placeholder="예) 상반기 응대율 계속 98% 넘김. 목표는 95%였음.&#10;노무 이슈 오래 끌던 거 직접 나서서 해결함.&#10;점심시간 근무조 다시 짜서 응대율 유지.&#10;고객사랑 주 단위로 진행상황 공유하고 요청사항 관리함.">${escapeHtml(r.rawFacts)}</textarea>
    <div class="form-actions">
      <button class="btn btn-primary" id="aiMeritBtn" onclick="generateMeritDraft()">🤖 AI 초안 생성</button>
    </div>
    <p class="hint">입력한 내용에서 확인되는 수치는 그대로 살려 강조하고, 근거 없는 내용은 지어내지 않습니다. 생성된 초안은 아래에서 자유롭게 수정하세요.</p>
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
        <span>성명 <small>(팀원 명단에서 선택 가능)</small></span>
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

async function generateMeritDraft(){
  collectFormIntoRecord();
  const r = state.current;
  if(!r.rawFacts || !r.rawFacts.trim()){ flash('실적 내용을 먼저 입력해 주세요'); return; }
  const btn = document.getElementById('aiMeritBtn');
  if(btn){ btn.disabled = true; btn.textContent = '⏳ 생성 중…'; }
  flash('AI 초안 생성 중… (10~30초 정도 걸립니다)');
  try{
    const res = await fetch('/api/ai-merit-draft', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({
        direction: r.direction, rawFacts: r.rawFacts,
        name: r.name, rank: r.rank, affiliation: r.affiliation,
        meritField: r.meritField, period: r.period,
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
