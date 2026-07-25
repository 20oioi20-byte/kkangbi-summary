// 화면 잠금(팀 공용 비밀번호) — 진짜 보안이 아니라 "아무나 화면에 들어오지 못하게" 하는
// 가벼운 게이트. 허브 전체가 비밀번호 하나를 공유한다(양식별로 따로 묻지 않음).
// 서버에 저장된 비밀번호(ktis_v11__hub_pw)와 비교하고, 잊어버렸을 때를 위해
// 초기값 000000은 항상 예비 비밀번호로 동작한다.
// 같은 PC(같은 브라우저)에서는 통과 시각을 localStorage에 남겨 하루 동안은 다시 묻지 않는다.
// 의존: shared/kv-client.js(apiGet) — 이 스크립트보다 먼저 로드돼 있어야 한다.
const LOCK_PW_KEY = 'ktis_v11__hub_pw';
const LOCK_UNLOCKED_KEY = 'kkangbi_hub_unlocked_v1';
const LOCK_MASTER_PW = '000000';
const LOCK_UNLOCKED_TTL_MS = 24 * 60 * 60 * 1000; // 하루

function isLockUnlocked(){
  try{
    const raw = localStorage.getItem(LOCK_UNLOCKED_KEY);
    if(!raw) return false;
    const data = JSON.parse(raw);
    return !!(data && typeof data.t === 'number' && (Date.now() - data.t) < LOCK_UNLOCKED_TTL_MS);
  }catch(e){ return false; }
}
function markUnlocked(){
  localStorage.setItem(LOCK_UNLOCKED_KEY, JSON.stringify({t: Date.now()}));
}
function hideLockScreen(){
  const el = document.getElementById('lockScreen');
  if(el) el.classList.add('hidden');
}
function setLockError(msg){
  const err = document.getElementById('lockErr');
  if(err) err.textContent = msg || '';
}
async function tryUnlock(){
  const input = document.getElementById('lockPwInput');
  const pw = (input && input.value || '').trim();
  if(!pw){ setLockError('비밀번호를 입력하세요'); return; }
  setLockError('확인 중…');
  let stored = null;
  try{ stored = await apiGet(LOCK_PW_KEY); }catch(e){ /* 네트워크 실패 시 마스터 비번으로만 진입 허용 */ }
  const current = stored || LOCK_MASTER_PW;
  if(pw === current || pw === LOCK_MASTER_PW){
    markUnlocked();
    hideLockScreen();
    setLockError('');
  } else {
    setLockError('비밀번호가 올바르지 않습니다');
  }
}
async function changeHubPw(newPw){
  await apiSet(LOCK_PW_KEY, newPw);
}

(function initLockScreen(){
  if(isLockUnlocked()) hideLockScreen();
  const input = document.getElementById('lockPwInput');
  if(input) input.addEventListener('keydown', e=>{ if(e.key==='Enter') tryUnlock(); });
})();
