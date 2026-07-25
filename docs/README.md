# kkangbi-collect 문서 인덱스

깡비서 취합 모듈(1호: 주간보고) 문서 허브.

| 문서 | 설명 | 언제 보는가 |
|---|---|---|
| [COLLECT-CODEMAP.md](./COLLECT-CODEMAP.md) | **도메인→파일 지도 (토큰 절감)** | 이 프로젝트 기능/버그 수정 시 최우선 |
| [NEW-FORM-GUIDE.md](./NEW-FORM-GUIDE.md) | 신규 양식(하반기 Makeup, 센터장평가 등) 개발 시작 가이드 | **새 대화창에서 다른 양식 만들 때 첨부** |
| [COLLECT-DEPLOY-CHECKLIST.md](./COLLECT-DEPLOY-CHECKLIST.md) | 배포 절차·Supabase 연동 체크 | 실배포 진행할 때 |

## 프로젝트 구조

```
kkangbi-collect/
├── index.html              # 화면 뼈대 (script 로드 순서 주석 포함)
├── css/
│   └── collect.css         # 디자인 토큰 · 전체 스타일
├── api/
│   └── collect-storage.js  # Supabase(rpt_kv) 프록시 — service_role 키는 Vercel 환경변수
├── js/
│   ├── collect-dates.js         # 주차/기간 계산
│   ├── collect-state.js         # 담당자·센터 기본값, 저장(Supabase 경유), 공용 헬퍼
│   ├── collect-auth.js          # 화면 잠금(팀 공용 비밀번호, 기본 000000)
│   ├── collect-docword-rules.js # 워드 취합 규칙 엔진 (가나다/○/※/괄호/병합)
│   ├── collect-logo-data.js     # kt is 로고 base64 (용량 큼 — 로고 교체 외엔 열지 않음)
│   ├── collect-docx-export.js   # DOCX 실제 생성(OOXML)
│   ├── collect-main-panel.js    # 메인 탭
│   ├── collect-member-panel.js  # 담당자 탭
│   ├── collect-rate-panel.js    # 응대율 탭
│   ├── collect-archive-panel.js # 자료보관함 탭
│   ├── collect-manage-panel.js  # 관리 탭
│   └── collect-app.js           # 탭 전환·전체 렌더·초기화 (항상 마지막 로드)
└── docs/                   # 이 문서들
```

## 지금 상태

- Supabase(`rpt_kv`) 연동 완료 — 팀원 전원 데이터 공유됨 (`COLLECT-CODEMAP.md` §5 참고). Vercel 환경변수 `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` 설정 필요
- 화면 진입 시 팀 공용 비밀번호(기본 `000000`, 관리 탭에서 변경 가능) 요구 — 다만 API 자체 인증은 아직 없음(§5 참고)
- 완성 기능: 담당자별 실적/계획 작성 · 규칙기반 자동 취합 · 워드 작성규칙 반영 DOCX 다운로드(로고 포함) ·
  응대율 표(컬럼 드래그 리사이즈·순서변경) · 엑셀 다운로드 · 주차별 저장 이력 · 담당자/센터 관리 · 모바일 빠른 입력 최적화
