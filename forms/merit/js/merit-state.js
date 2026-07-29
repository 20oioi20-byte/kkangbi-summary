// 공적조서 상태 · 저장.
//
// 저장 설계(docs/HUB-CODEMAP.md §5 "엔티티 1건 = 저장 키 1개" 원칙):
//   ktis_v11__merit_index          → 공적조서 목록(메타데이터만: 본문 제외)
//   ktis_v11__merit__rec__{id}     → 공적조서 1건의 전체 내용
//   ktis_v11__merit_award__{id}    → 표창 수상자 1명 (항목이 작아 apiList 한 번으로 전부 읽는다)
//   ktis_v11__merit_centers        → 이 양식이 쓰는 센터 목록(최초 1회 주간보고에서 씨앗을 받아옴)
// 목록에 본문까지 넣으면 건수가 늘수록 페이로드가 커져 회사망 차단에 걸린다 — 절대 합치지 말 것.
const MK = 'ktis_v11__merit';
function meritIndexKey(){ return `${MK}_index`; }
function meritRecKey(id){ return `${MK}__rec__${id}`; }
const AWARD_PREFIX = `${MK}_award__`;
function awardKey(id){ return `${AWARD_PREFIX}${id}`; }
const MERIT_CENTERS_KEY = `${MK}_centers`;
// 주간보고 양식이 관리하는 팀원/센터 명단을 "읽기 전용"으로 참조한다.
// 이 양식에서는 절대 이 키들에 쓰지 않는다 — 주인은 forms/weekly다.
// (센터를 여기서 직접 고치면 주간보고 응대율 표에 행이 생겨버리므로, 이 양식은 자기 센터
//  목록을 따로 두고 주간보고 것은 "가져오기"로만 합친다.)
const WEEKLY_MEMBERS_KEY = 'ktis_v11__weekly_members';
const WEEKLY_CENTERS_KEY = 'ktis_v11__weekly_centers';

const CORE_VALUE_TEXT = '고객을 가장 먼저 생각하고, 동료를 존중하며, 맡은 일은 끝까지 책임지는 자세, 권한 위임과 자발적 역량 강화를 통한 전문성 기반 과감한 실행으로 성과를 창출';
const POSITIONS = ['부장','차장','과장','대리','사원'];

// 표창 수상 시기는 "연도 + 반기"로 고른다(예: 2026-H1 = 2026년 상반기).
// 고르면 공적기간이 그 반기에 맞게 자동으로 채워진다(원본 양식 표기: "2026. 1월~6월까지").
function termToPeriod(term){
  const m = /^(\d{4})-H([12])$/.exec(String(term||''));
  if(!m) return '';
  return m[2]==='1' ? `${m[1]}. 1월~6월까지` : `${m[1]}. 7월~12월까지`;
}
function termToYear(term){
  const m = /^(\d{4})-H([12])$/.exec(String(term||''));
  return m ? m[1] : '';
}
function termLabel(term){
  const m = /^(\d{4})-H([12])$/.exec(String(term||''));
  return m ? `${m[1]}년 ${m[2]==='1'?'상반기':'하반기'}` : '';
}
function currentTerm(){
  const n = new Date();
  return `${n.getFullYear()}-H${n.getMonth() < 6 ? 1 : 2}`;
}
/** 선택 목록: 작년 ~ 3년 뒤까지 상·하반기 */
function awardTermList(){
  const y0 = new Date().getFullYear();
  const out = [];
  for(let y = y0 - 1; y <= y0 + 3; y++){ out.push(`${y}-H1`); out.push(`${y}-H2`); }
  return out;
}

let state = {
  tab: 'docs',      // docs | awards | centers
  index: [],        // 공적조서 목록 [{id,name,rank,affiliation,centerName,awarded,updatedAt}]
  awards: [],       // 수상자 명단 [{id,year,name,position,centerId,centerName,ownerName,meritId,note}]
  centers: [],      // 이 양식의 센터 목록 [{id,name}]
  members: [],      // 주간보고 팀원 명단(읽기 전용)
  current: null,    // 편집 중인 공적조서
  q: '',            // 목록 검색어
  filterCenter: '', // 목록 센터 필터
  filterAwarded: '',// '' | 'y' | 'n'
  awardQ: '', awardYear: '', awardCenter: '',
  loading: true,
};

function defaultRecord(){
  const term = currentTerm();
  return {
    id: 'mr' + Date.now(),
    // 대상자 정보는 원본 양식과 같이 사번·직급·성명·소속만 받는다.
    // 소속은 센터 목록으로 검색·선택할 수 있고, 목록의 센터 필터는 여기서 centerId를 끌어낸다.
    empNo: '', rank: '', name: '', affiliation: '', centerId: '',
    meritField: "우수직원('혁신', '성장', '화합' 中 선정 기준에 해당하는 공적을 택1 기재)",
    awardTerm: term,
    period: termToPeriod(term),
    direction: '', rawFacts: '',
    s1: '', s2: '', s3: '',
    confirmAffiliation: 'AICC사업5팀', confirmRank: '차장', confirmName: '강성호',
    awarded: false,
    // AI가 만들어 준 원본 초안 스냅샷. 사람이 고친 최종본과 비교해 "우리 팀이 실제로 쓰는 톤"을
    // 다음 초안 생성 때 참고 자료로 쓴다(제안3 피드백 루프).
    aiDraft: null,
    updatedAt: new Date().toISOString(),
  };
}

/** AI 초안과 사람이 고친 최종본이 의미 있게 다른가 — 다르면 문체 학습 자료가 된다. */
function isMeaningfulCorrection(rec){
  const d = rec && rec.aiDraft;
  if(!d) return false;
  const norm = s => String(s||'').replace(/\s+/g,' ').trim();
  return ['s1','s2','s3'].some(k=>{
    const before = norm(d[k]), after = norm(rec[k]);
    return before && after && after.length > 30 && after !== before;
  });
}

// 목록처럼 "여러 명이 각자 다른 항목을 추가/삭제하는" 배열은 저장 직전에 서버 최신값을 다시 읽어
// 그 위에 내 변경 하나만 얹는다(오래 켜둔 브라우저가 남의 항목을 지우는 사고 방지).
async function mutateShared(key, localFallback, mutateFn){
  let fresh;
  try{ const v = await apiGet(key); fresh = Array.isArray(v) ? v : null; }catch(e){ fresh = null; }
  if(!fresh) fresh = JSON.parse(JSON.stringify(localFallback || []));
  const result = mutateFn(fresh) || fresh;
  await apiSet(key, result);
  return result;
}
const mutateIndex   = fn => mutateShared(meritIndexKey(), state.index,   arr=>fn(arr)).then(r=>(state.index=r));
const mutateCenters = fn => mutateShared(MERIT_CENTERS_KEY, state.centers, arr=>fn(arr)).then(r=>(state.centers=r));

function centerNameById(id){
  const c = (state.centers||[]).find(x=>x.id===id);
  return c ? c.name : '';
}

async function loadMeritState(){
  state.loading = true;
  try{
    const [idx, members, weeklyCenters, myCenters, awardRows] = await Promise.all([
      apiGet(meritIndexKey()),
      apiGet(WEEKLY_MEMBERS_KEY),
      apiGet(WEEKLY_CENTERS_KEY),
      apiGet(MERIT_CENTERS_KEY),
      apiList(AWARD_PREFIX),
    ]);
    state.index   = Array.isArray(idx) ? idx : [];
    state.members = Array.isArray(members) ? members.filter(m=>m && !m.hidden) : [];
    state._weeklyCenters = Array.isArray(weeklyCenters) ? weeklyCenters.filter(c=>c && !c.hidden) : [];

    // 센터 목록: 처음 들어왔을 때만 주간보고 센터로 씨앗을 심는다. 이후에는 이 양식이 독립 관리.
    if(Array.isArray(myCenters) && myCenters.length){
      state.centers = myCenters;
    }else if(state._weeklyCenters.length){
      state.centers = state._weeklyCenters.map(c=>({id:c.id, name:c.name}));
      try{ await apiSet(MERIT_CENTERS_KEY, state.centers); }catch(e){}
    }else{
      state.centers = [];
    }

    state.awards = (awardRows||[]).map(r=>{
      try{ return JSON.parse(r.value); }catch(e){ return null; }
    }).filter(Boolean);
  }catch(e){
    flash('서버 데이터를 불러오지 못했습니다. 네트워크를 확인해 주세요');
    state.index = []; state.members = []; state.centers = []; state.awards = [];
  }
  state.loading = false;
  renderApp();
}

/** 주간보고에 새로 생긴 센터를 이 양식 목록에 합친다(기존 항목은 건드리지 않음). */
async function syncCentersFromWeekly(){
  const weekly = state._weeklyCenters || [];
  if(!weekly.length){ flash('주간보고에서 가져올 센터가 없습니다'); return; }
  let added = 0;
  try{
    await mutateCenters(arr=>{
      weekly.forEach(w=>{
        if(!arr.some(c=>c.id===w.id || c.name===w.name)){ arr.push({id:w.id, name:w.name}); added++; }
      });
      return arr;
    });
    flash(added ? `주간보고 센터 ${added}개를 추가했습니다` : '새로 추가할 센터가 없습니다');
    renderApp();
  }catch(e){ flash('저장 실패: 네트워크를 확인해 주세요'); }
}

// ── 공적조서 ────────────────────────────────────────────────
async function openRecord(id){
  try{
    const rec = await apiGet(meritRecKey(id));
    if(!rec){ flash('공적조서를 찾을 수 없습니다'); return; }
    state.current = Object.assign(defaultRecord(), rec, {id});
    renderApp();
  }catch(e){ flash('불러오기 실패: 네트워크를 확인해 주세요'); }
}
function newRecord(){ state.current = defaultRecord(); renderApp(); }

/** 기존 공적조서 내용을 그대로 가져와 "대상자만 다른" 새 건을 만든다. */
async function duplicateRecord(id){
  try{
    const src = await apiGet(meritRecKey(id));
    if(!src){ flash('원본을 찾을 수 없습니다'); return; }
    const rec = Object.assign(defaultRecord(), {
      // 본문·방향성·메모는 그대로 가져오고, 대상자 인적사항만 비운다
      direction: src.direction||'', rawFacts: src.rawFacts||'',
      s1: src.s1||'', s2: src.s2||'', s3: src.s3||'',
      meritField: src.meritField||'', period: src.period||'',
      confirmAffiliation: src.confirmAffiliation||'', confirmRank: src.confirmRank||'',
      confirmName: src.confirmName||'',
    });
    state.current = rec;
    flash('내용을 복제했습니다 — 대상자 정보를 새로 입력하세요');
    renderApp();
  }catch(e){ flash('복제 실패: 네트워크를 확인해 주세요'); }
}

async function saveCurrent(){
  const rec = state.current;
  if(!rec) return;
  collectFormIntoRecord();
  rec.updatedAt = new Date().toISOString();
  rec.hasCorrection = isMeaningfulCorrection(rec);
  try{
    await apiSet(meritRecKey(rec.id), rec);
    await mutateIndex(arr=>{
      const entry = {
        id: rec.id, name: rec.name, rank: rec.rank, affiliation: rec.affiliation,
        centerId: rec.centerId, centerName: centerNameById(rec.centerId),
        awarded: !!rec.awarded, awardTerm: rec.awardTerm,
        // 본문은 넣지 않고 "고친 이력이 있다"는 표시만 — 초안 생성 때 어떤 건을 불러올지 고르는 용도
        hasCorrection: !!rec.hasCorrection,
        updatedAt: rec.updatedAt,
      };
      const i = arr.findIndex(x=>x && x.id===rec.id);
      if(i>=0) arr[i] = entry; else arr.unshift(entry);
      return arr;
    });
    flash('저장되었습니다');
    renderApp();
  }catch(e){ flash('저장 실패: 네트워크를 확인해 주세요'); }
}

async function deleteRecord(id){
  const t = (state.index.find(x=>x.id===id)||{}).name || '';
  if(!confirm(`${t?`「${t}」 `:''}공적조서를 삭제할까요? 되돌릴 수 없습니다.`)) return;
  try{
    await mutateIndex(arr=> arr.filter(x=> x && x.id!==id));
    await apiDelete(meritRecKey(id));
    if(state.current && state.current.id===id) state.current = null;
    flash('삭제되었습니다');
    renderApp();
  }catch(e){ flash('삭제 실패: 네트워크를 확인해 주세요'); }
}

/** 목록에서 바로 "표창 수상" 체크를 토글한다(본문은 건드리지 않음). */
async function toggleAwarded(id, checked){
  try{
    const rec = await apiGet(meritRecKey(id));
    if(rec){ rec.awarded = !!checked; await apiSet(meritRecKey(id), rec); }
    await mutateIndex(arr=>{
      const e = arr.find(x=>x && x.id===id);
      if(e) e.awarded = !!checked;
      return arr;
    });
    if(state.current && state.current.id===id) state.current.awarded = !!checked;
    flash(checked ? '표창 수상으로 표시했습니다' : '표창 수상 표시를 해제했습니다');
    renderApp();
  }catch(e){ flash('저장 실패: 네트워크를 확인해 주세요'); }
}

// ── 표창 수상자 명단 ────────────────────────────────────────
async function saveAward(entry){
  try{
    await apiSet(awardKey(entry.id), entry);
    const i = state.awards.findIndex(a=>a.id===entry.id);
    if(i>=0) state.awards[i] = entry; else state.awards.unshift(entry);
    flash('수상자 명단에 저장했습니다');
    renderApp();
  }catch(e){ flash('저장 실패: 네트워크를 확인해 주세요'); }
}
async function deleteAward(id){
  const a = state.awards.find(x=>x.id===id);
  if(!confirm(`${a&&a.name?`「${a.name}」 `:''}수상자 항목을 삭제할까요?`)) return;
  try{
    await apiDelete(awardKey(id));
    state.awards = state.awards.filter(x=>x.id!==id);
    flash('삭제되었습니다');
    renderApp();
  }catch(e){ flash('삭제 실패: 네트워크를 확인해 주세요'); }
}

function escapeHtml(s){
  return String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
let _toastTimer = null;
function flash(msg){
  const el = document.getElementById('toast');
  if(!el) return;
  el.textContent = msg;
  el.style.display = 'block';
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(()=>{ el.style.display='none'; }, 2600);
}
