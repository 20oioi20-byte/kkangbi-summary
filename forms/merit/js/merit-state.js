// 공적조서 상태 · 저장.
//
// 저장 설계(docs/HUB-CODEMAP.md §5 "엔티티 1건 = 저장 키 1개" 원칙):
//   ktis_v11__merit_index          → 목록(메타데이터만: id/성명/직급/소속/수정일)
//   ktis_v11__merit__rec__{id}     → 공적조서 1건의 전체 내용
// 목록에 본문까지 넣으면 건수가 늘수록 페이로드가 커져 회사망 차단에 걸린다 — 절대 합치지 말 것.
const MK = 'ktis_v11__merit';
function meritIndexKey(){ return `${MK}_index`; }
function meritRecKey(id){ return `${MK}__rec__${id}`; }
// 주간보고 양식이 관리하는 팀원 명단을 "읽기 전용"으로 빌려온다(확인자/대상자 이름 자동 채움용).
// 이 양식에서는 절대 이 키에 쓰지 않는다 — 팀원 명단의 주인은 forms/weekly다.
const WEEKLY_MEMBERS_KEY = 'ktis_v11__weekly_members';

const CORE_VALUE_TEXT = '고객을 가장 먼저 생각하고, 동료를 존중하며, 맡은 일은 끝까지 책임지는 자세, 권한 위임과 자발적 역량 강화를 통한 전문성 기반 과감한 실행으로 성과를 창출';

let state = {
  index: [],        // [{id, name, rank, affiliation, updatedAt}]
  members: [],      // 주간보고에서 빌려온 팀원 명단(읽기 전용)
  current: null,    // 지금 편집 중인 공적조서 1건(record)
  loading: true,
};

function defaultRecord(){
  const now = new Date();
  const half = now.getMonth() < 6 ? '1월~6월' : '7월~12월';
  return {
    id: 'mr' + Date.now(),
    // 상단 인적사항
    empNo: '', rank: '', name: '', affiliation: '',
    meritField: "우수직원('혁신', '성장', '화합' 中 선정 기준에 해당하는 공적을 택1 기재)",
    period: `${now.getFullYear()}. ${half}까지`,
    // 입력(초안 생성 근거)
    direction: '',
    rawFacts: '',
    // 3개 섹션 본문
    s1: '', s2: '', s3: '',
    // 확인자
    confirmAffiliation: 'AICC사업5팀', confirmRank: '차장', confirmName: '강성호',
    updatedAt: new Date().toISOString(),
  };
}

// 목록처럼 "여러 명이 각자 다른 항목을 추가/삭제하는" 배열은 저장 직전에 서버 최신값을 다시 읽어
// 그 위에 내 변경 하나만 얹는다. 브라우저를 오래 켜둔 사람이 옛 스냅샷을 통째로 덮어써서 남의
// 항목을 지우는 사고를 막기 위함(forms/weekly에서 실제로 발생했던 문제와 동일한 대비).
async function mutateIndex(mutateFn){
  let fresh;
  try{ const v = await apiGet(meritIndexKey()); fresh = Array.isArray(v) ? v : null; }catch(e){ fresh = null; }
  if(!fresh) fresh = JSON.parse(JSON.stringify(state.index || []));
  const result = mutateFn(fresh) || fresh;
  await apiSet(meritIndexKey(), result);
  state.index = result;
  return result;
}

async function loadMeritState(){
  state.loading = true;
  try{
    const [idx, members] = await Promise.all([
      apiGet(meritIndexKey()),
      apiGet(WEEKLY_MEMBERS_KEY),
    ]);
    state.index = Array.isArray(idx) ? idx : [];
    state.members = Array.isArray(members) ? members.filter(m=>m && !m.hidden) : [];
  }catch(e){
    flash('서버 데이터를 불러오지 못했습니다. 네트워크를 확인해 주세요');
    state.index = []; state.members = [];
  }
  state.loading = false;
  renderApp();
}

async function openRecord(id){
  try{
    const rec = await apiGet(meritRecKey(id));
    if(!rec){ flash('공적조서를 찾을 수 없습니다'); return; }
    state.current = Object.assign(defaultRecord(), rec, {id});
    renderApp();
  }catch(e){ flash('불러오기 실패: 네트워크를 확인해 주세요'); }
}

function newRecord(){
  state.current = defaultRecord();
  renderApp();
}

async function saveCurrent(){
  const rec = state.current;
  if(!rec) return;
  collectFormIntoRecord();
  rec.updatedAt = new Date().toISOString();
  try{
    await apiSet(meritRecKey(rec.id), rec);
    await mutateIndex(arr=>{
      const entry = {
        id: rec.id, name: rec.name, rank: rec.rank,
        affiliation: rec.affiliation, updatedAt: rec.updatedAt,
      };
      const i = arr.findIndex(x=>x && x.id===rec.id);
      if(i>=0) arr[i] = entry; else arr.unshift(entry);
      return arr;
    });
    flash('저장되었습니다');
    renderApp();
  }catch(e){
    flash('저장 실패: 네트워크를 확인해 주세요');
  }
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
