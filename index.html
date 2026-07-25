# COLLECT-DEPLOY-CHECKLIST.md — kkangbi-collect 배포 체크

> 본체 `DEPLOY-CHECKLIST.md` / `AUTO-DEPLOY.md`와 동일한 방식(GitHub push → Vercel 자동배포)을 따른다.
> 지금 단계는 **로컬 프로토타입**(localStorage 저장) → **실배포**(Supabase 연동) 전환이 필요하다.

---

## 1. 지금 상태 (로컬 프로토타입)

- 정적 파일만으로 동작 (`index.html` + `css/` + `js/`), 서버 없음
- 데이터는 각자 브라우저의 `localStorage`에만 저장됨 → **팀원끼리 공유되지 않음**
- 그대로 배포해도 "개인 데모"로는 동작하지만, 실제 팀 협업(팀원 5명이 각자 입력 → 자동 취합)에는 아직 부족

## 2. 실배포 전 필요한 작업 (Supabase 연동)

| 항목 | 내용 |
|---|---|
| 신규 API | `api/collect-storage.js` — 기존 `api/storage.js`와 동일 패턴(service_role 경유, `GET ?action=get/list`, `POST ?action=set/delete`) |
| 저장 키 | `ktis_v11__collect__{weekKey}` (주차별 취합 데이터), `ktis_v11__collect_members`, `ktis_v11__collect_centers`, `ktis_v11__collect_ratewidths` |
| 세션 인증 | 팀원 제출 화면은 **개인 토큰 기반**(로그인 세션과 별도 트랙), 관리자 화면은 기존 `apiFetch()`(세션 토큰) 재사용 |
| `collect-state.js` 교체 | `loadState()`/`saveState()` 내부만 `localStorage` → `apiFetch('/api/collect-storage', ...)`로 교체. **다른 파일은 손댈 필요 없음** (이 파일만 담당자가 있으면 바로 작업 가능한 구조로 이미 분리해둠) |

## 3. 배포 경로 (본체와 동일 컨벤션)

```
로컬 수정 → git commit → git push (main)
        → GitHub 저장소 갱신 → Vercel 웹훅 → 자동 Production 배포
```

- 신규 Vercel 프로젝트로 별도 배포 권장: `kkangbi-collect` (센터실적 리포트가 `kkangbi-report`로 별도 배포된 것과 동일 패턴 — `SYSTEM.md` §4.6 참고)
- Root Directory: 저장소 루트, 포함 필수: `index.html`, `js/`, `css/`, `api/`
- 도메인 예: `collect.깡비서.kr` 또는 서브패스

## 4. 배포 전 최종 확인

- [ ] `app_storage` 문자열 코드에 없는지 확인 (`grep -r "app_storage" .`)
- [ ] `api/collect-storage.js`가 `SUPABASE_SERVICE_ROLE_KEY`를 쓰는지 확인 (anon key 아님)
- [ ] 팀원 제출 링크의 토큰이 다른 사람 데이터에 접근 못 하는지 실제로 테스트 (본인 토큰으로 남의 주차 데이터 URL 직접 쳐서 접근 시도 → 차단되는지)
- [ ] 워드 저장(.docx) 다운로드가 실제 MS Word에서 정상 열리는지, 로고·표 서식·자간이 의도대로인지 확인
- [ ] `Ctrl+F5`로 캐시 무시 후 전체 탭(메인/담당자별/응대율/자료보관함/관리) 스모크 테스트

## 5. 배포 순서 제안

1. 지금 이 프로토타입(로컬 저장 버전)을 팀 내부 링크로 먼저 공유 — UI/기능 자체에 대한 팀원 피드백 수집 (아직 Supabase 연동 전이라 데이터 공유는 안 되지만, "이렇게 입력하면 되는구나"를 먼저 검증)
2. 피드백 반영 후 `api/collect-storage.js` 작업 착수 (별도 세션에서, 이 문서 + `COLLECT-CODEMAP.md` 첨부)
3. Supabase 연동 완료 후 실제 팀원 5명 대상 정식 오픈
4. 두 번째 양식부터는 이 배포 파이프라인에 "허브 화면 항목 추가" 형태로 붙여나감
