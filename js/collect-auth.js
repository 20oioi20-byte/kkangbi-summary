// 화면 잠금(팀 공용 비밀번호) — 진짜 보안이 아니라 "아무나 화면에 들어오지 못하게" 하는
// 가벼운 게이트. 서버에 저장된 비밀번호(ktis_v11__collect_pw)와 비교하고,
// 잊어버렸을 때를 위해 초기값 000000은 항상 예비 비밀번호로 동작한다.
const LOCK_PW_KEY = `${KP}_pw`;
const LOCK_UNLOCKED_KEY = 'kkangbi_collect_unlocked_v1';
const LOCK_MASTER_PW = '000000';

function isLockUnlocked(){ return localStorage.getItem(LOCK_UNLOCKED_KEY) === '1'; }
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
    localStorage.setItem(LOCK_UNLOCKED_KEY, '1');
    hideLockScreen();
    setLockError('');
  } else {
    setLockError('비밀번호가 올바르지 않습니다');
  }
}

(function initLockScreen(){
  if(isLockUnlocked()) hideLockScreen();
  const input = document.getElementById('lockPwInput');
  if(input) input.addEventListener('keydown', e=>{ if(e.key==='Enter') tryUnlock(); });
})();
