# COLLECT-CODEMAP.md — kkangbi-collect 코드 지도 (토큰 절감용)

> **목적:** 기능 수정 요청이 올 때 **해당 파일만** 열어서 고치고, 전체 프로젝트를 다시 읽지 않는다.
> **원칙:** `docs/kkangbi-calendar` 본체의 `CODEMAP.md`와 동일한 철학 — 한 작업 = 한 파일(도메인).
> **최종 갱신:** 2026-07-25

---

## 0. 작업 전 필수

1. 이 표에서 **해당 도메인 파일 1~2개만** 연다. 전체 `js/*.js`를 다 읽지 않는다.
2. `collect-logo-data.js`는 로고 이미지를 바꿀 때만 연다 (base64 6.4만자 — 평소엔 절대 열지 않음).
3. `collect-docx-export.js`는 워드 파일의 **서식(색상/폰트/표 구조/자간)**을 바꿀 때만 연다.
4. `collect-docword-rules.js`는 **취합 규칙(가/나/다, ○/※, 괄호 위첨자, 소관센터 병합)**을 바꿀 때만 연다.
5. 화면 UI(탭 내용·버튼 위치 등)만 바꿀 때는 해당 패널 파일만 열면 된다 — docx/규칙 파일은 열 필요 없음.

---

## 1. 파일 지도

| 작업 주제 | 파일 | 비고 |
|---|---|---|
| 주차 계산(1주=1일~그주 일요일, 이후 월~일) | `js/collect-dates.js` | `getWeeksOfMonth`, `weekMetaFromDate` |
| 담당자/센터 기본값, 저장(Supabase `rpt_kv` 경유), 공용 헬퍼 | `js/collect-state.js` | `DEFAULT_MEMBERS`, `DEFAULT_CENTERS`, `loadState/saveState`, `apiGet/apiSet/apiList/apiDelete` |
| 화면 잠금(팀 공용 비밀번호, 기본 000000) | `js/collect-auth.js` | `tryUnlock`, 비밀번호 값은 `${KP}_pw` 키에 저장 |
| 서버 저장 프록시(Supabase `rpt_kv`, service_role) | `api/collect-storage.js` | `GET ?action=get/list`, `POST {action:set/delete}` |
| 워드 취합 규칙 엔진(가나다/○/※/괄호/소관센터 병합) | `js/collect-docword-rules.js` | `aggregateSection`, `tokenizeParens`, `docLinesToHtml` |
| kt is 로고 base64 데이터 | `js/collect-logo-data.js` | **로고 교체 외에는 열지 않음** |
| DOCX 실제 생성(표 구조·색상·폰트·자간) | `js/collect-docx-export.js` | `buildDocxBlob`, `wHeaderCell`, `wParagraph` |
| 메인 탭(취합 최종본·현황·주차이력) | `js/collect-main-panel.js` | `renderMainPanel`, `doAggregate`, `saveWordAndArchive` |
| 담당자 탭(개인 작성·히스토리) | `js/collect-member-panel.js` | `renderMemberPanel`, `saveMemberDraft` |
| 응대율 탭(표·컬럼리사이즈·순서변경) | `js/collect-rate-panel.js` | `renderRatePanel`, `startColResize` |
| 자료보관함 탭 | `js/collect-archive-panel.js` | `renderArchivePanel` |
| 관리 탭(담당자/센터 CRUD) | `js/collect-manage-panel.js` | `renderManagePanel` |
| 탭 전환·전체 렌더링·초기화 | `js/collect-app.js` | `switchTab`, `renderAll`, 최하단 `init()` |
| 디자인 토큰·레이아웃 CSS | `css/collect.css` | 원본 문서 톤(화이트) 유지 |
| 화면 뼈대 HTML | `index.html` | script 로드 순서 주석 참고 |

---

## 2. 스크립트 로드 순서 (index.html에 이미 반영됨 — 임의 변경 금지)

```
collect-dates.js → collect-state.js → collect-auth.js → collect-docword-rules.js → collect-logo-data.js
→ collect-docx-export.js → collect-main-panel.js → collect-member-panel.js
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
- `collect-logo-data.js`를 다른 파일과 합치기 (토큰 낭비 방지 목적으로 분리한 것)
- 스크립트 로드 순서 임의 변경
- `api/collect-storage.js`가 아닌 다른 이름/테이블(`app_storage` 등)로 저장소를 바꾸는 것

---

## 5. Supabase 연동 (2026-07-25 완료)

`localStorage` 프로토타입에서 `api/collect-storage.js`(service_role 경유 `rpt_kv`)로 전환 완료.

| 데이터 | 저장 키 |
|---|---|
| 담당자 목록 | `ktis_v11__collect_members` |
| 센터 목록 | `ktis_v11__collect_centers` |
| 응대율 컬럼폭 | `ktis_v11__collect_ratewidths` |
| 자료보관함(워드 저장본) | `ktis_v11__collect_archive` |
| 화면 잠금 비밀번호 | `ktis_v11__collect_pw` |
| 주차별 실적/계획/취합본 | `ktis_v11__collect__{weekKey}` (예: `ktis_v11__collect__2026-07-W4`) |

화면 전용 상태(현재 탭, 자료보관함 페이지)는 서버로 보내지 않고 브라우저 `localStorage`(`kkangbi_collect_ui_v1`)에만 둔다 — 팀원마다 다를 수 있는 값이라 공유할 필요가 없음.

**아직 미구현 — 다음 세션에서 다룰 것:** `api/collect-storage.js`는 지금 요청 인증이 전혀 없다(URL만 알면 누구나 읽고 쓸 수 있음). 화면 진입 시 팀 공용 비밀번호(§는 `collect-auth.js`)를 넣긴 했지만 이건 "아무나 화면을 못 열게" 하는 정도의 가벼운 게이트일 뿐, API 자체를 보호하진 않는다. 팀원별 개인 토큰 기반 접근 제어(`/collect/{요청ID}-{개인토큰}`)는 별도 설계가 필요하다.
