# COLLECT-CODEMAP.md — kkangbi-collect 코드 지도 (토큰 절감용)

> **목적:** 기능 수정 요청이 올 때 **해당 파일만** 열어서 고치고, 전체 프로젝트를 다시 읽지 않는다.
> **원칙:** `docs/kkangbi-calendar` 본체의 `CODEMAP.md`와 동일한 철학 — 한 작업 = 한 파일(도메인).
> **최종 갱신:** 2026-07-24

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
| 담당자/센터 기본값, 저장(localStorage), 공용 헬퍼 | `js/collect-state.js` | `DEFAULT_MEMBERS`, `DEFAULT_CENTERS`, `loadState/saveState` |
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
collect-dates.js → collect-state.js → collect-docword-rules.js → collect-logo-data.js
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
- `localStorage` 저장 방식을 다른 저장소로 바꾸는 것은 **배포 연동 작업**(§5)에서만 진행

---

## 5. 향후: 깡비서.kr 연동 시 변경 지점

현재는 프로토타입 단계로 `localStorage`(`STORE_KEY` in `collect-state.js`)에 저장한다.
실제 배포 시 아래처럼 교체한다 (본체 `SYSTEM.md` §6.1 규칙과 동일):

| 현재(프로토타입) | 배포 시 |
|---|---|
| `localStorage.getItem/setItem(STORE_KEY, ...)` | `/api/collect-storage`(신규, `api/storage.js`와 동일 패턴) 경유 `rpt_kv` |
| 팀원 각자 브라우저에 데이터 저장 | Supabase `rpt_kv`에 `ktis_v11__collect__{weekKey}` 형태 키로 저장, 팀원 전원 공유 |
| 관리자만 보는 로컬 앱 | 팀원용 개인 링크(토큰) + 관리자 발송 화면 추가 필요 |

이 표는 배포 작업 시작 시 다시 참고할 것 — `loadState()`/`saveState()`(`collect-state.js`)만 교체하면 되고, 나머지 UI 파일은 手 대지 않아도 된다.
