# HUB-CODEMAP.md — 깡비서 자료취합 허브 라우팅 지도

> **이 문서는 "어디로 가야 하는지"만 알려준다. 각 양식의 내부 함수/로직은 절대 여기 적지 않는다.**
> 요청받은 작업이 특정 양식에 관한 것이면, 아래 표에서 폴더를 찾아 그 폴더의 `docs/CODEMAP.md`만 열고
> 이 저장소의 다른 `forms/*` 폴더는 열지 않는다. 새 양식을 추가했으면 이 표에 한 줄 추가할 것.
> **최종 갱신:** 2026-07-25

---

## 1. 양식 라우팅 표

| 양식 | 폴더 | 코드맵 | 주기 | 상태 |
|---|---|---|---|---|
| 주간보고 취합 | `forms/weekly/` | [CODEMAP.md](../forms/weekly/docs/CODEMAP.md) | 매주 | 배포됨 |
| Make up 계획 관리 | `forms/makeup/` | [CODEMAP.md](../forms/makeup/docs/CODEMAP.md) | 매월 | 배포됨 |
| 하반기 Makeup 보고 | `forms/?` | — | 반기 | 미착수 |
| 중장기전략 보고 | `forms/?` | — | ? | 미착수 |
| 분기별 센터장 평가 | `forms/?` | — | 분기 | 미착수 |
| 해외연수 대상자 선별 | `forms/?` | — | 비정기 | 미착수 |
| 각종 교육 대상자 선별 | `forms/?` | — | 비정기 | 미착수 |
| 분기별 자금계획 | `forms/?` | — | 분기 | 미착수 |
| 컴플라이언스 자료 취합 | `forms/?` | — | ? | 미착수 |

## 2. 허브 공용(shared/) — 라우팅표

| 파일 | 역할 | 고칠 때 주의 |
|---|---|---|
| `shared/kv-client.js` | 서버 저장 통신(`apiGet/apiSet/apiList/apiDelete`) | 모든 양식이 씀 — 여기 고치면 전 양식 영향, 신중히 |
| `shared/auth.js` | 허브 공용 비밀번호 화면잠금 | 모든 양식이 씀 |
| `shared/logo-data.js` | kt is 로고 base64 | 로고 자체가 바뀔 때만 |
| `shared/base.css` | 버튼/카드/배지/잠금화면 등 최소 공통 모양(색상 아님) | 색상은 넣지 않는다 — 자세한 건 `shared/docs/SHARED-CODEMAP.md` |
| `api/storage.js` | Supabase(`rpt_kv`) 프록시, service_role 전용 | 모든 양식 공용 API — 새 양식마다 API 새로 만들지 않는다 |

## 3. 루트 파일

| 파일 | 역할 |
|---|---|
| `index.html` | 허브 홈(양식 카드 목록) — 새 양식 추가 시 `HUB_FORMS` 배열에 한 줄 추가 |
| `hub.css` | 허브 홈 전용 레이아웃 |
| `docs/NEW-FORM-GUIDE.md` | 새 양식을 새 대화창에서 만들 때 첨부하는 가이드 |

## 4. 새 양식을 추가했다면

1. `forms/{slug}/` 폴더 생성 (`index.html`, `css/`, `js/`, `docs/CODEMAP.md`, `docs/README.md`)
2. 저장 키는 `ktis_v11__{slug}_*`로, 다른 양식과 절대 겹치지 않게
3. 루트 `index.html`의 `HUB_FORMS` 배열에 카드 추가
4. 이 문서(§1 표)에 한 줄 추가, 상태를 "배포됨"으로 변경
