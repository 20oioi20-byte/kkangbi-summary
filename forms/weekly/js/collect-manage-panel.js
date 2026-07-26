function renderManagePanel(){
  const memRows = state.members.map(m=>`
    <div class="mgmt-row ${m.hidden?'hidden-item':''}" data-mid="${m.id}">
      <input class="grow" value="${escapeHtml(m.name)}" data-f="name">
      <button class="btn btn-outline btn-sm" onclick="toggleMemberHide('${m.id}')">${m.hidden?'표시':'숨기기'}</button>
      <button class="btn btn-danger btn-sm" onclick="deleteMember('${m.id}')">삭제</button>
    </div>`).join('');

  const cenRows = state.centers.map(c=>`
    <div class="mgmt-row ${c.hidden?'hidden-item':''}" data-cid="${c.id}">
      <input class="grow" value="${escapeHtml(c.name)}" data-f="name">
      <select data-f="owner">
        ${state.members.map(m=>`<option value="${m.id}" ${m.id===c.ownerId?'selected':''}>${escapeHtml(m.name)}</option>`).join('')}
      </select>
      <button class="btn btn-outline btn-sm" onclick="toggleCenterHide('${c.id}')">${c.hidden?'표시':'숨기기'}</button>
      <button class="btn btn-danger btn-sm" onclick="deleteCenter('${c.id}')">삭제</button>
    </div>`).join('');

  return `
  <div class="card">
    <h2>👤 담당자 관리</h2>
    <p class="hint">추가 · 이름 수정 · 삭제 · 숨기기 (히스토리 유지)</p>
    ${memRows}
    <div class="form-actions"><button class="btn btn-primary" onclick="saveMemberEdits()">이름 저장</button></div>
    <div class="inline-form">
      <div class="fld grow"><span>새 담당자</span><input id="newMemberName" placeholder="이름"></div>
      <button class="btn btn-green" onclick="addMember()">+ 추가</button>
    </div>
  </div>
  <div class="card">
    <h2>🏢 센터 관리</h2>
    <p class="hint">추가 · 보완(이름/담당) · 삭제 · 숨기기</p>
    ${cenRows}
    <div class="form-actions"><button class="btn btn-primary" onclick="saveCenterEdits()">센터 저장</button></div>
    <div class="inline-form">
      <div class="fld grow"><span>새 센터명</span><input id="newCenterName" placeholder="센터명"></div>
      <div class="fld"><span>담당</span>
        <select id="newCenterOwner">${state.members.filter(m=>!m.hidden).map(m=>`<option value="${m.id}">${escapeHtml(m.name)}</option>`).join('')}</select>
      </div>
      <button class="btn btn-green" onclick="addCenter()">+ 추가</button>
    </div>
  </div>
  <div class="card">
    <h2>🔒 허브 비밀번호 변경</h2>
    <p class="hint">허브 전체(모든 양식 공통)가 공유하는 화면 잠금 비밀번호입니다. 잊어버려도 초기 비밀번호 <b>000000</b>으로는 언제나 입장할 수 있습니다.</p>
    <div class="inline-form">
      <div class="fld grow"><span>새 비밀번호</span><input id="newLockPw" placeholder="새 비밀번호"></div>
      <button class="btn btn-primary" onclick="changeLockPw()">변경</button>
    </div>
  </div>
  <div class="card">
    <h2>⚠️ 데이터 초기화</h2>
    <button class="btn btn-danger" onclick="resetAllData()">샘플 상태로 초기화</button>
  </div>`;
}
async function changeLockPw(){
  const input = document.getElementById('newLockPw');
  const pw = (input && input.value || '').trim();
  if(!pw){ flash('새 비밀번호를 입력하세요'); return; }
  await changeHubPw(pw);
  if(input) input.value = '';
  flash('비밀번호가 변경되었습니다 (000000은 계속 예비 비밀번호로 사용 가능)');
}
async function saveMemberEdits(){
  // DOM에 보이는 대로 "이 id는 이 이름으로" 의도만 뽑아두고, 실제 반영은 서버의 최신 목록
  // 위에 적용한다(이 화면을 열어둔 사이 다른 사람이 담당자를 추가/삭제했을 수 있으므로).
  const edits = {};
  document.querySelectorAll('.mgmt-row[data-mid]').forEach(row=>{
    const id = row.getAttribute('data-mid');
    const name = row.querySelector('[data-f="name"]').value.trim();
    if(name) edits[id] = name;
  });
  state.members = await mutateSharedList(`${KP}_members`, state.members, arr=>{
    arr.forEach(m=>{ if(edits[m.id]) m.name = edits[m.id]; });
    return arr;
  });
  flash('담당자 저장'); renderAll();
}
async function addMember(){
  const name=(document.getElementById('newMemberName').value||'').trim();
  if(!name){ flash('이름 입력'); return; }
  const id='m'+Date.now();
  state.members = await mutateSharedList(`${KP}_members`, state.members, arr=>{
    arr.push({id,name,hidden:false}); return arr;
  });
  switchTab(id);
}
async function toggleMemberHide(id){
  state.members = await mutateSharedList(`${KP}_members`, state.members, arr=>{
    const m = arr.find(x=>x.id===id); if(m) m.hidden = !m.hidden; return arr;
  });
  const m = memberById(id);
  if(m && m.hidden && state.activeTab===id) state.activeTab='main';
  renderAll();
}
async function deleteMember(id){
  const m=memberById(id); if(!m) return;
  if(!confirm(`「${m.name}」 담당자를 삭제할까요?\n과거 작성 이력(주간 히스토리)은 유지되지만, 신규 작성 탭에서는 사라집니다.`)) return;
  state.members = await mutateSharedList(`${KP}_members`, state.members, arr=> arr.filter(x=>x.id!==id));
  if(state.activeTab===id) state.activeTab='main';
  flash('담당자가 삭제되었습니다'); renderAll();
}
async function saveCenterEdits(){
  const edits = {};
  document.querySelectorAll('.mgmt-row[data-cid]').forEach(row=>{
    const id = row.getAttribute('data-cid');
    const name = row.querySelector('[data-f="name"]').value.trim();
    const ownerId = row.querySelector('[data-f="owner"]').value;
    edits[id] = {name, ownerId};
  });
  state.centers = await mutateSharedList(`${KP}_centers`, state.centers, arr=>{
    arr.forEach(c=>{
      const e = edits[c.id]; if(!e) return;
      if(e.name) c.name = e.name;
      c.ownerId = e.ownerId;
    });
    return arr;
  });
  flash('센터 저장'); renderAll();
}
async function addCenter(){
  const name=(document.getElementById('newCenterName').value||'').trim();
  const ownerId=document.getElementById('newCenterOwner').value;
  if(!name){ flash('센터명 입력'); return; }
  state.centers = await mutateSharedList(`${KP}_centers`, state.centers, arr=>{
    arr.push({id:'c'+Date.now(), name, ownerId, hidden:false}); return arr;
  });
  flash('센터 추가'); renderAll();
}
async function toggleCenterHide(id){
  state.centers = await mutateSharedList(`${KP}_centers`, state.centers, arr=>{
    const c = arr.find(x=>x.id===id); if(c) c.hidden = !c.hidden; return arr;
  });
  renderAll();
}
async function deleteCenter(id){
  const c=centerById(id); if(!c) return;
  if(!confirm(`「${c.name}」 삭제?`)) return;
  state.centers = await mutateSharedList(`${KP}_centers`, state.centers, arr=> arr.filter(x=>x.id!==id));
  flash('삭제됨'); renderAll();
}
async function resetAllData(){
  if(!confirm('전체 초기화할까요? (보관함 포함, 팀원 전체에게 반영됩니다)')) return;
  // 자료보관함 실제 파일들은 청크가 있을 수 있어 apiDelete(청크까지 정리)로 개별 삭제
  const archiveIds = (state.archive||[]).map(a=>a.id);
  await Promise.all(archiveIds.map(id => apiDelete(archiveItemKey(id))));
  const weekRows = await apiList(WEEK_PREFIX); // 담당자별 실적/계획, 취합본, 응대율 전부 이 접두어 아래에 있음
  const smallKeys = [`${KP}_members`, `${KP}_centers`, `${KP}_ratewidths`, `${KP}_ratedefaults`, archiveIndexKey(), ...weekRows.map(r=>r.key)];
  await apiDeleteMany(smallKeys);
  state=defaultState(); draftBuffers={}; expandedHist={};
  flash('초기화 완료'); refreshWeekChrome(); renderAll();
}
function exportAllJson(){
  // 자료보관함 실제 파일(base64)은 포함하지 않는다(용량이 커서) — 목록(메타데이터)만 담긴다.
  // 파일 자체는 서버(archiveItemKey)에 그대로 남아있으니 필요하면 자료보관함에서 개별 다운로드.
  const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'});
  downloadBlob(blob, `주간보고취합_백업_${currentMeta().weekKey}.json`);
}
function importAllJson(ev){
  const file=ev.target.files&&ev.target.files[0]; if(!file) return;
  const reader=new FileReader();
  reader.onload=async ()=>{
    try{
      state=Object.assign(defaultState(), JSON.parse(reader.result));
      // 복원은 사용자가 명시적으로 고른 백업 상태로 "그대로 되돌리기"이므로, 여기서만
      // 목록류(담당자/센터/응대율 컬럼폭/보관함 목록/응대율 기본값)를 의도적으로 통째로 덮어쓴다.
      await flushStateToServer();
      // 담당자별 실적/계획·취합본·응대율은 각자 키로 저장해야 서버에 실제 반영된다
      // (flushStateToServer()는 목록류만 저장함 — 이걸 빠뜨리면 "복원됐다"는 화면만 보이고
      // 새로고침하면 서버에서 다시 불러오면서 사라진다).
      const entries = [];
      Object.keys(state.reports||{}).forEach(wk=>{
        Object.keys(state.reports[wk]||{}).forEach(mid=>{
          entries.push({key: reportKey(wk, mid), value: state.reports[wk][mid]});
        });
      });
      Object.keys(state.aggregates||{}).forEach(wk=>{
        entries.push({key: aggKey(wk), value: state.aggregates[wk]});
      });
      Object.keys(state.monthRates||{}).forEach(mk=>{
        Object.keys(state.monthRates[mk]||{}).forEach(cid=>{
          entries.push({key: rateKey(mk, cid), value: state.monthRates[mk][cid]});
        });
      });
      if(entries.length) await apiSetMany(entries).catch(()=> flash('일부 데이터 복원 저장 실패: 네트워크를 확인해 주세요'));
      flash('복원 완료'); renderAll();
    }catch(e){ flash('복원 실패'); }
  };
  reader.readAsText(file); ev.target.value='';
}
