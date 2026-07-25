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
    <h2>⚠️ 데이터 초기화</h2>
    <button class="btn btn-danger" onclick="resetAllData()">샘플 상태로 초기화</button>
  </div>`;
}
function saveMemberEdits(){
  document.querySelectorAll('.mgmt-row[data-mid]').forEach(row=>{
    const m=memberById(row.getAttribute('data-mid')); if(!m) return;
    m.name = row.querySelector('[data-f="name"]').value.trim()||m.name;
  });
  saveState(); flash('담당자 저장'); renderAll();
}
function addMember(){
  const name=(document.getElementById('newMemberName').value||'').trim();
  if(!name){ flash('이름 입력'); return; }
  const id='m'+Date.now();
  state.members.push({id,name,hidden:false});
  saveState(); switchTab(id);
}
function toggleMemberHide(id){
  const m=memberById(id); if(!m) return;
  m.hidden=!m.hidden;
  if(m.hidden && state.activeTab===id) state.activeTab='main';
  saveState(); renderAll();
}
function deleteMember(id){
  const m=memberById(id); if(!m) return;
  if(!confirm(`「${m.name}」 담당자를 삭제할까요?\n과거 작성 이력(주간 히스토리)은 유지되지만, 신규 작성 탭에서는 사라집니다.`)) return;
  state.members = state.members.filter(x=>x.id!==id);
  if(state.activeTab===id) state.activeTab='main';
  saveState(); flash('담당자가 삭제되었습니다'); renderAll();
}
function saveCenterEdits(){
  document.querySelectorAll('.mgmt-row[data-cid]').forEach(row=>{
    const c=centerById(row.getAttribute('data-cid')); if(!c) return;
    c.name=row.querySelector('[data-f="name"]').value.trim()||c.name;
    c.ownerId=row.querySelector('[data-f="owner"]').value;
  });
  saveState(); flash('센터 저장'); renderAll();
}
function addCenter(){
  const name=(document.getElementById('newCenterName').value||'').trim();
  const ownerId=document.getElementById('newCenterOwner').value;
  if(!name){ flash('센터명 입력'); return; }
  state.centers.push({id:'c'+Date.now(), name, ownerId, hidden:false});
  saveState(); flash('센터 추가'); renderAll();
}
function toggleCenterHide(id){
  const c=centerById(id); if(!c) return;
  c.hidden=!c.hidden; saveState(); renderAll();
}
function deleteCenter(id){
  const c=centerById(id); if(!c) return;
  if(!confirm(`「${c.name}」 삭제?`)) return;
  state.centers=state.centers.filter(x=>x.id!==id);
  saveState(); flash('삭제됨'); renderAll();
}
async function resetAllData(){
  if(!confirm('전체 초기화할까요? (보관함 포함, 팀원 전체에게 반영됩니다)')) return;
  const weekKeys = new Set([...Object.keys(state.reports||{}), ...Object.keys(state.aggregates||{})]);
  const keys = [`${KP}_members`, `${KP}_centers`, `${KP}_ratewidths`, `${KP}_archive`, ...[...weekKeys].map(weekDataKey)];
  await Promise.all(keys.map(apiDelete));
  state=defaultState(); draftBuffers={}; expandedHist={};
  flash('초기화 완료'); refreshWeekChrome(); renderAll();
}
function exportAllJson(){
  const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'});
  downloadBlob(blob, `주간보고취합_백업_${currentMeta().weekKey}.json`);
}
function importAllJson(ev){
  const file=ev.target.files&&ev.target.files[0]; if(!file) return;
  const reader=new FileReader();
  reader.onload=()=>{
    try{
      state=Object.assign(defaultState(), JSON.parse(reader.result));
      saveState(); flash('복원 완료'); renderAll();
    }catch(e){ flash('복원 실패'); }
  };
  reader.readAsText(file); ev.target.value='';
}
