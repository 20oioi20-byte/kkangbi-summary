# kkangbi-summary — 깡비서 자료취합 허브

AICC사업2단 사업5팀에서 반복적으로 수작업 취합하던 자료들을 양식별 웹폼으로 자동화하는 허브.

- 새로 작업을 시작하기 전에 [docs/HUB-CODEMAP.md](./docs/HUB-CODEMAP.md)부터 확인 — 어느 양식의 어느 폴더를 봐야 하는지 알려준다.
- 새 양식을 만들 때는 [docs/NEW-FORM-GUIDE.md](./docs/NEW-FORM-GUIDE.md)를 새 대화창에 첨부.

## 현재 배포된 양식

| 양식 | 경로 |
|---|---|
| 주간보고 취합 | [forms/weekly/](./forms/weekly/) |
| Make up 계획 관리 | [forms/makeup/](./forms/makeup/) |

## 구조

```
kkangbi-summary/
├── index.html          # 허브 홈(양식 카드 목록)
├── hub.css
├── shared/              # 모든 양식이 공용으로 쓰는 것만 (로고, 화면잠금, 저장 클라이언트, 공통 CSS 토큰)
├── api/storage.js       # Supabase(rpt_kv) 프록시 — 허브 전체 공용
├── forms/
│   ├── weekly/           # 주간보고 취합
│   └── makeup/           # Make up 계획 관리
└── docs/                 # 허브 공통 문서
```
