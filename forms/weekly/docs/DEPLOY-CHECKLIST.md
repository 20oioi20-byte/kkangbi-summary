# DEPLOY-CHECKLIST.md — forms/weekly (주간보고 취합) 배포 기록

> 이 문서는 초기 프로토타입 → 실배포 전환 과정의 기록이다. **현재 상태는 완료됨** —
> Supabase 연동 완료, 허브(`kkangbi-summary`) 구조로 통합 완료. 저장 키 등 현재 스펙은
> [CODEMAP.md](./CODEMAP.md) §5를 최신 기준으로 본다(이 문서와 다르면 CODEMAP.md가 맞음).

---

## 완료된 것 (2026-07-25 기준)

- [x] `api/storage.js` — service_role 경유 `rpt_kv` 프록시, 허브 전체 양식 공용
- [x] `js/collect-state.js` — `loadState()`/`saveState()`를 서버 저장(`shared/kv-client.js`)으로 전환
- [x] 허브 구조로 통합: `forms/weekly/`로 이동, 화면 잠금·로고·저장 클라이언트는 `shared/`로 승격
- [x] `app_storage` 문자열 미사용 확인
- [x] `SUPABASE_SERVICE_ROLE_KEY`를 Vercel 환경변수로 주입(anon key 아님)

## 아직 안 된 것

- [ ] 팀원별 개인 토큰 기반 접근 제어 — 지금은 허브 공용 비밀번호(화면 잠금)만 있고, API 자체 인증은 없음. 실제 팀 5명 정식 오픈 전에 반드시 다뤄야 함
- [ ] 워드 저장(.docx) 다운로드가 실제 MS Word에서 정상 열리는지, 로고·표 서식·자간 실사용 확인
- [ ] `Ctrl+F5`로 캐시 무시 후 전체 탭(메인/담당자별/응대율/자료보관함/관리) 스모크 테스트

## 배포 경로 (본체와 동일 컨벤션, 허브 구조에서도 동일)

```
로컬 수정 → git commit → git push (main)
        → GitHub 저장소 갱신 → Vercel 웹훅 → 자동 Production 배포
```

신규 양식 추가 시 별도 Vercel 프로젝트를 만들지 않고, 이 허브(`forms/{slug}/`)에 폴더만 추가한다 — [docs/NEW-FORM-GUIDE.md](../../../docs/NEW-FORM-GUIDE.md) 참고.
