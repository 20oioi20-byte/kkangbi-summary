# CODEMAP.md — forms/weekly (주간보고 취합) 코드 지도

> **목적:** 기능 수정 요청이 올 때 **해당 파일만** 열어서 고치고, 전체 프로젝트를 다시 읽지 않는다.
> **원칙:** 허브 최상위 `docs/HUB-CODEMAP.md`에서 "주간보고"로 라우팅되면 이 문서만 보고,
> 이 폴더(`forms/weekly/`) 밖은 열 필요가 없다. `shared/` 파일을 고쳐야 하는 경우만 예외
> (그때는 `shared/docs/SHARED-CODEMAP.md` 참고, 다른 양식에 영향 없는지 반드시 확인).
> **최종 갱신:** 2026-07-25

---

## 0. 작업 전 필수

1. 이 표에서 **해당 도메인 파일 1~2개만** 연다. 전체 `js/*.js`를 다 읽지 않는다.
2. `../../shared/logo-data.js`는 로고 이미지를 바꿀 때만 연다 (base64 6.4만자 — 평소엔 절대 열지 않음, 다른 양식도 같이 씀).
3. `js/collect-docx-export.js`는 워드 파일의 **서식(색상/폰트/표 구조/자간)**을 바꿀 때만 연다.
4. `js/collect-docword-rules.js`는 **취합 규칙(가/나/다, ○/※, 괄호 위첨자, 소관센터 병합)**을 바꿀 때만 연다.
5. 화면 UI(탭 내용·버튼 위치 등)만 바꿀 때는 해당 패널 파일만 열면 된다 — docx/규칙 파일은 열 필요 없음.
6. 화면 잠금 비밀번호, kt is 로고, 서버 저장 클라이언트는 이 폴더 밖 `shared/`에 있다 (아래 §1 참고).

---

## 1. 파일 지도

| 작업 주제 | 파일 | 비고 |
|---|---|---|
| 주차 계산(1주=1일~그주 일요일, 이후 월~일) | `js/collect-dates.js` | `getWeeksOfMonth`, `weekMetaFromDate` |
| 담당자/센터 기본값, 저장(Supabase `rpt_kv` 경유), 공용 헬퍼 | `js/collect-state.js` | `DEFAULT_MEMBERS`, `DEFAULT_CENTERS`, `loadState/saveState`, 저장키 접두어 `KP='ktis_v11__weekly'` |
| 워드 취합 규칙 엔진(가나다/○/※/괄호/소관센터 병합) | `js/collect-docword-rules.js` | `aggregateSection`, `tokenizeParens`, `docLinesToHtml` |
| DOCX 실제 생성(표 구조·색상·폰트·자간) | `js/collect-docx-export.js` | `buildDocxBlob`, `wHeaderCell`, `wParagraph` — `../../shared/logo-data.js`의 `KT_LOGO_DATAURI` 사용 |
| 메인 탭(취합 최종본·현황·주차이력) | `js/collect-main-panel.js` | `renderMainPanel`, `doAggregate`, `saveWordAndArchive` |
| 담당자 탭(개인 작성·히스토리) | `js/collect-member-panel.js` | `renderMemberPanel`, `saveMemberDraft` |
| 응대율 탭(표·컬럼리사이즈·순서변경) | `js/collect-rate-panel.js` | `renderRatePanel`, `startColResize` |
| 자료보관함 탭 | `js/collect-archive-panel.js` | `renderArchivePanel` |
| 관리 탭(담당자/센터 CRUD, 허브 비밀번호 변경) | `js/collect-manage-panel.js` | `renderManagePanel`, `changeLockPw`(→`shared/auth.js`의 `changeHubPw` 호출) |
| 탭 전환·전체 렌더링·초기화 | `js/collect-app.js` | `switchTab`, `renderAll`, 최하단 `init()` |
| 이 양식 전용 CSS(공통 토큰 제외) | `css/weekly.css` | 공통 버튼/카드/배지/잠금화면은 `shared/base.css` |
| 화면 뼈대 HTML | `index.html` | script 로드 순서 주석 참고 |
| **(이 폴더 밖, shared)** 화면 잠금 | `../../shared/auth.js` | 허브 전체 공용 — 이 폴더에서 고치지 말 것 |
| **(이 폴더 밖, shared)** 서버 저장 클라이언트 | `../../shared/kv-client.js` | `apiGet/apiSet/apiList/apiDelete`, 허브 전체 공용 |
| **(이 폴더 밖, shared)** kt is 로고 | `../../shared/logo-data.js` | 허브 전체 공용 |

---

## 2. 스크립트 로드 순서 (index.html에 이미 반영됨 — 임의 변경 금지)

```
shared/kv-client.js → shared/auth.js → collect-dates.js → collect-state.js → shared/logo-data.js
→ collect-docword-rules.js → collect-docx-export.js → collect-main-panel.js → collect-member-panel.js
→ collect-rate-panel.js → collect-archive-panel.js → collect-manage-panel.js → collect-app.js
```

`collect-app.js` 맨 끝의 `(function init(){...})()`가 최초 진입점이므로 **항상 마지막에 로드**되어야 한다.

---

## 3. 도메인별 힌트 (파일 내부 함수)

### collect-dates.js
| 함수 | 역할 |
|---|---|
| `getWeeksOfMonth(year, month)` | 그 달의 주차 목록 계산 (1주=1일~그 주 일요일 규칙) |
| `weekMetaFromDate(d)` | 특정 날짜가 속한 주차 메타 정보(실적/계획 기간 등) |
| `nextWeekEntry` / `prevWeekEntry` | 월 경계를 자동으로 넘기는 주차 이동 |

### collect-docword-rules.js
| 함수 | 역할 |
|---|---|
| `aggregateSection(kind)` | 담당자 원문 → 가/나/다 구조로 취합(규칙 기반, AI 미사용) |
| `tokenizeParens` | 괄호 위첨자 규칙(센터코드 괄호는 제외) |
| `docLinesToHtml` / `domToDocLines` | 구조 ↔ 화면 표시 상호 변환 |

### collect-docx-export.js
| 함수 | 역할 |
|---|---|
| `buildDocxBlob(meta, linesPerf, linesPlan)` | 실제 .docx 바이너리 생성 |
| `wHeaderCell` / `wTeamCell` / `wContentCell` | 표 행 단위 XML 생성 (색상: 1행 D9D9D9, 2/4행 EFEFEF) |
| `wParagraph` / `wRunsFromText` | 문단·런 단위 XML — 자간벌어짐 방지 설정(`autoSpaceDE/DN`, `snapToGrid`) 위치 |
| `makeDocFileName` | 파일명 규칙: `AICC본부주간자료_AICC사업5팀_(저장일자)` |

### collect-rate-panel.js
| 함수 | 역할 |
|---|---|
| `renderRatePanel` | 응대율 표 렌더링 (colgroup 기반 컬럼폭) |
| `startColResize` | 마우스 드래그로 컬럼 폭 조절 |
| `moveCenter` | 센터 순서 변경(▲▼) |

---

## 4. 절대 하지 말 것

- 여러 도메인을 한 번에 리팩터링 (요청 범위 밖 수정 금지)
- `shared/logo-data.js`를 이 폴더 안으로 다시 옮기거나 다른 파일과 합치기 (다른 양식도 같이 쓰는 공용 파일)
- 스크립트 로드 순서 임의 변경
- `api/storage.js`가 아닌 다른 이름/테이블(`app_storage` 등)로 저장소를 바꾸는 것
- 저장 키 접두어(`KP='ktis_v11__weekly'`)를 다른 양식과 겹치게 바꾸는 것

---

## 5. 저장 키 (Supabase `rpt_kv`, `api/storage.js` 경유)

**목록류(관리자 한 명이 주로 손대는 데이터)는 통째로 하나의 키**, **담당자/취합본/응대율처럼 여러 명이
동시에 각자 다른 항목을 저장하는 데이터는 항목별로 키를 쪼갠다** — 안 그러면 A가 저장할 때 A의
브라우저가 들고 있던 B의 (오래됐을 수 있는) 데이터까지 같이 덮어써서, A가 자기 것만 고쳤는데 B의
내용까지 바뀌어 보이는 사고가 난다(2026-07-25 실제 발생, `collect-state.js`/`collect-member-panel.js`/
`collect-main-panel.js`/`collect-rate-panel.js` 동시 수정으로 해결). **이 원칙을 절대 되돌리지 말 것.**

| 데이터 | 저장 키 | 저장 위치(누가/언제 쓰는가) |
|---|---|---|
| 담당자 목록 | `ktis_v11__weekly_members` | `collect-manage-panel.js`, 통째로 저장 |
| 센터 목록 | `ktis_v11__weekly_centers` | `collect-manage-panel.js`/`collect-rate-panel.js`, 통째로 저장 |
| 응대율 컬럼폭 | `ktis_v11__weekly_ratewidths` | `collect-rate-panel.js`, 통째로 저장 |
| 자료보관함(워드 저장본) | `ktis_v11__weekly_archive` | `collect-main-panel.js`, 통째로 저장 |
| 담당자별 실적/계획 (주차 단위) | `ktis_v11__weekly__rpt__{weekKey}__{memberId}` | `collect-member-panel.js`의 `saveMemberDraft` — **이 담당자 몫만** 저장 |
| 취합본 (주차 단위) | `ktis_v11__weekly__agg__{weekKey}` | `collect-main-panel.js`의 `flushFinalEditNow`/`doAggregate` |
| 응대율 (센터·월 단위) | `ktis_v11__weekly__rate__{monthKey}__{centerId}` | `collect-rate-panel.js`의 `onRateCellChange`/`saveRateMonth` — **이 센터 몫만** 저장 |
| (이 양식 것 아님) 화면 잠금 비밀번호 | `ktis_v11__hub_pw` — 허브 전체 공용, `shared/auth.js` 참고 |

`collect-state.js`의 `loadState()`는 `ktis_v11__weekly__` 전체를 `apiList`로 한 번에 읽어서 접두어
(`rpt`/`agg`/`rate`)로 구분해 `state.reports`/`state.aggregates`/`state.monthRates`에 나눠 담는다.
새로 이런 "여러 명이 동시에 각자 다른 항목을 쓰는" 데이터를 추가할 때는 반드시 항목별 키로 설계할 것 —
"주차/월 전체를 하나의 키로" 패턴으로 되돌아가지 않는다.

화면 전용 상태(현재 탭, 자료보관함 페이지)는 서버로 보내지 않고 브라우저 `localStorage`(`kkangbi_weekly_ui_v1`)에만 둔다 — 팀원마다 다를 수 있는 값이라 공유할 필요가 없음.

**아직 미구현 — 다음 세션에서 다룰 것:** `api/storage.js`는 지금 요청 인증이 전혀 없다(URL만 알면 누구나 읽고 쓸 수 있음). 허브 진입 시 공용 비밀번호(`shared/auth.js`)를 넣긴 했지만 이건 "아무나 화면을 못 열게" 하는 정도의 가벼운 게이트일 뿐, API 자체를 보호하진 않는다. 팀원별 개인 토큰 기반 접근 제어(`/collect/{요청ID}-{개인토큰}`)는 별도 설계가 필요하다.
