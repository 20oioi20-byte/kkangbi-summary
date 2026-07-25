function renderArchivePanel(){
  const list = state.archive || [];
  const total = list.length;
  const pages = Math.max(1, Math.ceil(total / ARCHIVE_PAGE));
  let page = state.archivePage || 1;
  if(page > pages) page = pages;
  state.archivePage = page;
  const start = (page-1)*ARCHIVE_PAGE;
  const slice = list.slice(start, start+ARCHIVE_PAGE);

  const items = slice.length ? slice.map(a=>`
    <div class="arch-item">
      <div>
        <div class="t">${escapeHtml(a.fileName)}</div>
        <div class="m">${escapeHtml(a.weekLabel||a.weekKey||'')} · ${a.createdAt?new Date(a.createdAt).toLocaleString('ko-KR'):''} · ${a.size?Math.round(a.size/1024)+'KB':''}</div>
      </div>
      <div class="mgmt-actions">
        <button class="btn btn-green btn-sm" onclick="redownloadArchive('${a.id}')">다시 다운로드</button>
        <button class="btn btn-danger btn-sm" onclick="deleteArchive('${a.id}')">삭제</button>
      </div>
    </div>
  `).join('') : `<div class="empty">보관된 자료가 없습니다. 메인에서 「워드 저장」을 하면 여기에 쌓입니다. (최대 ${ARCHIVE_MAX}개)</div>`;

  return `
  <div class="card">
    <h2>📁 자료보관함</h2>
    <p class="hint">워드 저장본이 최대 <b>${ARCHIVE_MAX}개</b>까지 보관됩니다. 초과 시 가장 오래된 항목이 자동 삭제됩니다. · 페이지당 ${ARCHIVE_PAGE}개 · 현재 ${total}개</p>
    ${items}
    <div class="pager">
      <button class="nav-btn" type="button" onclick="shiftArchivePage(-1)" ${page<=1?'disabled':''}>‹</button>
      <span>${page} / ${pages}</span>
      <button class="nav-btn" type="button" onclick="shiftArchivePage(1)" ${page>=pages?'disabled':''}>›</button>
    </div>
  </div>`;
}
function shiftArchivePage(d){
  state.archivePage = (state.archivePage||1)+d;
  renderAll();
}
function redownloadArchive(id){
  const a = (state.archive||[]).find(x=>x.id===id);
  if(!a){ flash('자료를 찾을 수 없습니다'); return; }
  const blob = base64ToBlob(a.base64, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  downloadBlob(blob, a.fileName);
  flash('다운로드 시작');
}
function deleteArchive(id){
  if(!confirm('이 자료를 보관함에서 삭제할까요?')) return;
  state.archive = (state.archive||[]).filter(x=>x.id!==id);
  saveState();
  flash('삭제되었습니다');
  renderAll();
}
