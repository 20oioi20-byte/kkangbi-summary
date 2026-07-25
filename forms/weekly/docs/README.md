# forms/weekly 문서 인덱스

깡비서 취합 허브의 1호 양식(주간보고) 문서.

| 문서 | 설명 | 언제 보는가 |
|---|---|---|
| [CODEMAP.md](./CODEMAP.md) | **도메인→파일 지도 (토큰 절감)** | 이 양식 기능/버그 수정 시 최우선 |
| [DEPLOY-CHECKLIST.md](./DEPLOY-CHECKLIST.md) | 배포 기록·남은 과제 | 배포 상태 확인할 때 |
| [../../../docs/NEW-FORM-GUIDE.md](../../../docs/NEW-FORM-GUIDE.md) | 신규 양식 개발 시작 가이드(허브 공통) | 다른 양식 새로 만들 때 |
| [../../../docs/HUB-CODEMAP.md](../../../docs/HUB-CODEMAP.md) | 허브 전체 라우팅 지도 | 어느 양식/파일을 봐야 할지 모를 때 |

## 이 폴더 구조

```
forms/weekly/
├── index.html               # 화면 뼈대 (script 로드 순서 주석 포함)
├── css/
│   └── weekly.css           # 이 양식 전용 스타일(공통 토큰은 shared/base.css)
├── js/
│   ├── collect-dates.js         # 주차/기간 계산
│   ├── collect-state.js         # 담당자·센터 기본값, 저장(Supabase 경유), 공용 헬퍼
│   ├── collect-docword-rules.js # 워드 취합 규칙 엔진 (가나다/○/※/괄호/병합)
│   ├── collect-docx-export.js   # DOCX 실제 생성(OOXML) — shared/logo-data.js 사용
│   ├── collect-main-panel.js    # 메인 탭
│   ├── collect-member-panel.js  # 담당자 탭
│   ├── collect-rate-panel.js    # 응대율 탭
│   ├── collect-archive-panel.js # 자료보관함 탭
│   ├── collect-manage-panel.js  # 관리 탭
│   └── collect-app.js           # 탭 전환·전체 렌더·초기화 (항상 마지막 로드)
└── docs/                     # 이 문서들
```

로고(`shared/logo-data.js`), 화면 잠금(`shared/auth.js`), 서버 저장 클라이언트(`shared/kv-client.js`), 서버 프록시(`api/storage.js`)는 허브 공용이라 이 폴더 밖에 있다.

## 지금 상태

- Supabase(`rpt_kv`) 연동 완료 — 팀원 전원 데이터 공유됨 (`CODEMAP.md` §5 참고). Vercel 환경변수 `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` 설정 필요
- 허브 진입 시 공용 비밀번호(기본 `000000`, 관리 탭에서 변경 가능) 요구 — 다만 API 자체 인증은 아직 없음
- 완성 기능: 담당자별 실적/계획 작성 · 규칙기반 자동 취합 · 워드 작성규칙 반영 DOCX 다운로드(로고 포함) ·
  응대율 표(컬럼 드래그 리사이즈·순서변경) · 엑셀 다운로드 · 주차별 저장 이력 · 담당자/센터 관리 · 모바일 빠른 입력 최적화
