# CODEMAP.md — forms/weekly (주간보고 취합) 코드 지도

> **목적:** 기능 수정 요청이 올 때 **해당 파일만** 열어서 고치고, 전체 프로젝트를 다시 읽지 않는다.
> **원칙:** 허브 최상위 `docs/HUB-CODEMAP.md`에서 "주간보고"로 라우팅되면 이 문서만 보고,
> 이 폴더(`forms/weekly/`) 밖은 열 필요가 없다. `shared/` 파일을 고쳐야 하는 경우만 예외
> (그때는 `shared/docs/SHARED-CODEMAP.md` 참고, 다른 양식에 영향 없는지 반드시 확인).
> **최종 갱신:** 2026-07-26

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
| 담당자/센터 기본값, 저장(Supabase `rpt_kv` 경유), 공용 헬퍼 | `js/collect-state.js` | `DEFAULT_MEMBERS`, `DEFAULT_CENTERS`, `loadState`, `mutateSharedList/Object`, 저장키 접두어 `KP='ktis_v11__weekly'` |
| 워드 취합 규칙 엔진(가나다/○/※/괄호/소관센터 병합) | `js/collect-docword-rules.js` | `aggregateSection`, `tokenizeParens`, `docLinesToHtml` |
| DOCX 실제 생성(표 구조·색상·폰트·자간) | `js/collect-docx-export.js` | `buildDocxBlob`, `wHeaderCell`, `wParagraph` — `../../shared/logo-data.js`의 `KT_LOGO_DATAURI` 사용 |
| 메인 탭(취합 최종본·현황·주차이력) | `js/collect-main-panel.js` | `renderMainPanel`, `doAggregate`, `saveWordAndArchive` |
| 담당자 탭(개인 작성·히스토리, **AI 초안은 강성호(m1)만**) | `js/collect-member-panel.js` | `renderMemberPanel`, `saveMemberDraft`, `generateAiDraft`(m1 전용, `/api/ai-weekly-draft` 호출) |
| 응대율 탭(표·컬럼리사이즈·순서변경·담당자 필터·기본값 규칙) | `js/collect-rate-panel.js` | `renderRatePanel`, `startColResize`, `findRateDefault`/`effectiveRateValue`(기본값 규칙), `setRateMemberFilter` |
| **(신규)** AI 초안 서버 프록시 | `api/ai-weekly-draft.js` | 캘린더/일일보고/업무로그(mt_meetings 등)/직전주 작성분을 모아 Claude 호출 — 강성호 전용, 아래 §6 참고 |
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
| `aggregateSection(kind)` | 담당자 원문 → 가/나/다 구조로 취합(규칙 기반, AI 미사용). `perfNone`/`planNone` 체크박스로 표시했거나, 체크 없이 텍스트가 정확히 "없음"/"없습니다"류 한 마디뿐인 경우(`isNoneText`, `collect-state.js`) 취합에서 제외한다(2026-07-28 추가) |
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

**담당자/취합본/응대율처럼 여러 명이 동시에 각자 다른 항목을 저장하는 데이터는 항목별로 키를 쪼갠다**
— 안 그러면 A가 저장할 때 A의 브라우저가 들고 있던 B의 (오래됐을 수 있는) 데이터까지 같이 덮어써서,
A가 자기 것만 고쳤는데 B의 내용까지 바뀌어 보이는 사고가 난다(2026-07-25 실제 발생, `collect-state.js`/
`collect-member-panel.js`/`collect-main-panel.js`/`collect-rate-panel.js` 동시 수정으로 해결).
**이 원칙을 절대 되돌리지 말 것.**

**담당자 목록/센터 목록/응대율 컬럼폭/자료보관함 목록/응대율 기본값 규칙 — 이 5개는 여전히 배열(또는
객체) 전체가 키 하나에 들어있지만, 그렇다고 "통째로 덮어써도 되는 데이터"는 아니다.** 이 데이터는
`loadState()`가 최초 접속 시 딱 한 번만 서버에서 불러오고 그 뒤로는 새로고침 전까지 갱신되지 않는다.
그래서 예전에는 탭 전환처럼 아무것도 편집하지 않는 동작만으로도 `saveState()`(배열 전체를 로컬
스냅샷으로 덮어쓰기)가 호출되어, 브라우저를 오래 켜둔 사람이 그 사이 다른 사람이 추가/수정한 내용을
지워버리는 사고가 날 수 있었다(2026-07-27 실제 발생 및 수정). 지금은:

- 순수 화면 이동(탭 전환, 히스토리 월 이동 등)은 서버 저장을 아예 호출하지 않는다.
- 이 5개를 실제로 편집하는 모든 함수(`addMember`/`toggleMemberHide`/`deleteMember`/`saveMemberEdits`,
  `addCenter(Inline)`/`toggleCenterHide`/`deleteCenter(Inline)`/`updateCenterField`/`moveCenter`/
  `saveCenterEdits`, `startColResize`, `addRateDefault`/`deleteRateDefault`, `saveWordAndArchive`/
  `deleteArchive`)는 `collect-state.js`의 `mutateSharedList(key, localFallback, mutateFn)` /
  `mutateSharedObject(...)`를 통해 **쓰기 직전에 서버의 최신 값을 다시 읽어와 그 위에 의도한 변경
  하나만 적용**한 뒤 저장한다 — 로컬에 오래 남아있던 스냅샷 전체를 절대 그대로 밀어넣지 않는다.
  새로 이런 목록형 데이터를 추가/수정하는 함수를 만들 때도 반드시 이 패턴을 따를 것(브라우저가
  들고 있는 로컬 배열을 직접 push/filter해서 통째로 저장하는 옛 패턴으로 되돌아가지 않는다).
- `importAllJson`(백업 파일 복원)만 예외적으로 `flushStateToServer()`로 5개를 통째로 덮어쓴다 —
  사용자가 명시적으로 "이 백업 상태 그대로 되돌리기"를 선택한 경우라 의도된 동작이다.
- 두 사람이 완전히 같은 순간(네트워크 왕복 시간, 보통 수백ms 이내)에 이 5개 중 같은 것을 동시에
  편집하는 경우는 여전히 나중 저장이 이길 수 있지만, "브라우저를 오래 켜둔 채 방치"로 인한 사고는
  이 패턴으로 사실상 사라진다. 로컬 모의 서버로 "세션A가 오래된 스냅샷을 들고 있는 동안 세션B가
  직접 센터를 추가 → 세션A가 자기 센터를 추가"하는 시나리오를 재현해 두 항목 모두 살아남는 것까지
  확인함.

| 데이터 | 저장 키 | 저장 위치(누가/언제 쓰는가) |
|---|---|---|
| 담당자 목록 | `ktis_v11__weekly_members` | `collect-manage-panel.js`, `mutateSharedList` |
| 센터 목록 | `ktis_v11__weekly_centers` | `collect-manage-panel.js`/`collect-rate-panel.js`, `mutateSharedList` |
| 응대율 컬럼폭 | `ktis_v11__weekly_ratewidths` | `collect-rate-panel.js`, `mutateSharedObject` |
| 응대율 기본값 규칙(센터+기간+기본%) | `ktis_v11__weekly_ratedefaults` | `collect-rate-panel.js`의 `addRateDefault`/`deleteRateDefault`, `mutateSharedList` |
| 자료보관함 목록(메타데이터만, base64 없음) | `ktis_v11__weekly_archive_index` | `collect-main-panel.js`/`collect-archive-panel.js`, `mutateSharedList` |
| 자료보관함 실제 파일(base64, 항목별) | `ktis_v11__weekly_archive_item__{id}` | `collect-main-panel.js`의 `saveWordAndArchive` — 큰 값이라 `apiSet`이 필요하면 자동 청크 분할 |
| 담당자별 실적/계획 (주차 단위) | `ktis_v11__weekly__rpt__{weekKey}__{memberId}` | `collect-member-panel.js`의 `saveMemberDraft` — **이 담당자 몫만** 저장. 값 형태: `{perf, plan, perfNone, planNone, savedAt}` — `perfNone`/`planNone`은 "실적/계획 없음" 체크박스 상태(2026-07-28 추가). 체크된 쪽은 `perf`/`plan`을 항상 빈 문자열로 강제 저장한다. |
| 취합본 (주차 단위) | `ktis_v11__weekly__agg__{weekKey}` | `collect-main-panel.js`의 `flushFinalEditNow`/`doAggregate` |
| 응대율 (센터·월 단위) | `ktis_v11__weekly__rate__{monthKey}__{centerId}` | `collect-rate-panel.js`의 `onRateCellChange`/`saveRateMonth` — **이 센터 몫만** 저장 |
| (이 양식 것 아님) 화면 잠금 비밀번호 | `ktis_v11__hub_pw` — 허브 전체 공용, `shared/auth.js` 참고 |

`collect-state.js`의 `loadState()`는 `ktis_v11__weekly__` 전체를 `apiList`로 한 번에 읽어서 접두어
(`rpt`/`agg`/`rate`)로 구분해 `state.reports`/`state.aggregates`/`state.monthRates`에 나눠 담는다.
새로 이런 "여러 명이 동시에 각자 다른 항목을 쓰는" 데이터를 추가할 때는 반드시 항목별 키로 설계할 것 —
"주차/월 전체를 하나의 키로" 패턴으로 되돌아가지 않는다.

**자료보관함은 2026-07-26에 "배열 전체를 한 키에" 저장하던 걸 항목별 키로 분리했다** —
워드 파일(base64)이 최대 30개까지 쌓이는 배열을 통째로 저장하는 건 회사망 payload 크기 차단의
직접 원인이 되는 패턴이었다(`~/dev-standards/network-resilient-storage.md` 참고, `shared/docs/SHARED-CODEMAP.md`
§저장 관련 원칙에도 동일 원칙 명시). 새 필드를 자료보관함에 추가할 때도 이 분리를 유지할 것.
저장/조회는 `shared/kv-client.js`가 필요하면 자동으로 청크 분할하므로 이 파일에서 크기를 신경 쓸 필요는 없다.

화면 전용 상태(현재 탭, 자료보관함 페이지)는 서버로 보내지 않고 브라우저 `localStorage`(`kkangbi_weekly_ui_v1`)에만 둔다 — 팀원마다 다를 수 있는 값이라 공유할 필요가 없음.

**아직 미구현 — 다음 세션에서 다룰 것:** `api/storage.js`는 지금 요청 인증이 전혀 없다(URL만 알면 누구나 읽고 쓸 수 있음). 허브 진입 시 공용 비밀번호(`shared/auth.js`)를 넣긴 했지만 이건 "아무나 화면을 못 열게" 하는 정도의 가벼운 게이트일 뿐, API 자체를 보호하진 않는다. 팀원별 개인 토큰 기반 접근 제어(`/collect/{요청ID}-{개인토큰}`)는 별도 설계가 필요하다.

---

## 6. AI 초안("깡비서 초안") — 강성호(m1) 전용 (2026-07-26 추가, 07-27 실제 스키마로 재검증)

- **위치/명칭**: 담당자 탭 중 강성호(m1) 탭에서만, 실적 입력란 라벨 오른쪽 위에 "🤖 깡비서 초안" 버튼. 클릭하면 실적+계획을 한 번에 채운다(자동 저장 안 함 — 확인 후 「이번 주차 저장」을 눌러야 반영).
- **다른 담당자에는 절대 넣지 않는다** — 깡비서.kr에 본인 데이터가 있는 건 강성호뿐이라는 게 전제. `renderMemberPanel`에서 `memberId==='m1'` 조건으로 버튼 자체를 렌더링 안 하고, `generateAiDraft`도 첫 줄에서 `memberId!=='m1'`이면 즉시 return.
- **자료 출처** (`api/ai-weekly-draft.js`가 서버에서 조회, 클라이언트는 기간만 넘김) — `C:\Users\user\kkangbi-calendar`의 실제 운영 코드(`js/storage.js`, `js/worklog.js`, `js/calendar-helpers.js`)로 스키마 확인·검증 완료:
  - 캘린더 일정: `ktis_v11__events__{YYYY-MM}` (**월 단위** 키, 연도 단위 아님 — `evMonthKey()` 기준). 이벤트 필드: `title/date/time/memo` 등
  - 일일보고: `ktis_v11__reports`의 `dailyReports` 배열 (`{id,date,content,createdAt}`)
  - 업무로그: `ktis_v11__worklogs`(구 통합키) + `ktis_v11__worklog__{id}`(신 항목별 키)를 id로 병합, **항목별 키가 우선**(깡비서 본체 `storage.js`와 동일한 병합 규칙) — rpt_kv이지 별도 Postgres 테이블 아님. 필드: `date/type/center/title/oneLiner/aiSummary/followUp/nextMeeting`
  - 이 시스템 자체의 직전 주 강성호 작성분: `ktis_v11__weekly__rpt__{prevWeekKey}__m1`
  - 위 세 rpt_kv 키 모두 **깡비서 본체와 동일한 청크 분할 방식**(`{key}__chunk__{i}` + `{__chunked:true,n,len}` 매니페스트)으로 저장돼 있을 수 있어, `sbGetKV`/`listResolvedKV`가 이를 그대로 재조립한다 — 이 재조립 로직 없이 값을 그냥 읽으면 큰 항목(업무로그 통합본 등)이 매니페스트 객체만 읽혀서 내용이 빈 것처럼 보이니 절대 빼지 말 것.
- 위 자료 중 일부가 없거나 조회 실패해도 전체를 실패시키지 않는다 — 있는 자료만으로 초안을 만들고, AI에게 "근거 없으면 (확인 필요)로 표시"하도록 지시해뒀다.
- AI 응답은 `===실적===`/`===계획===` 마커로 나눠서 파싱한다 — 이 마커 문구를 시스템 프롬프트에서 임의로 바꾸면 파싱이 깨지니 같이 맞출 것.
- Anthropic 응답은 `res.json()` 대신 버퍼를 UTF-8로 직접 디코드해서 파싱한다(깡비서 본체 `api/chat.js`에서 한글 응답이 간헐적으로 깨지는 문제 실측 확인, 동일 대응). `temperature` 파라미터도 일부러 안 보낸다(최신 모델에서 오류 유발 확인됨).
- **AI 호출 방식**: 깡비서 본체 `api/chat.js`와 동일하게 서강대 API Gateway 우선 시도 → 실패 시에만 Anthropic 직접호출로 자동 폴백(월 제공 크레딧 절약). `GATEWAY_KEY`(`SOGANG_GATEWAY_KEY` 또는 `SOGANG_GATEWAY_API_KEY`)가 설정돼 있으면 `callGatewayClaude()`(OpenAI 호환 `/chat/completions` 형식, 모델 기본값 `claude-sonnet-4-6`)를 먼저 시도하고, 게이트웨이가 에러를 던지면 콘솔에 사유를 남기고 `callClaudeDirect()`로 넘어간다. 게이트웨이 키가 아예 없으면 바로 직접호출.
- **필요 환경변수**: `ANTHROPIC_API_KEY`(필수, Vercel에 추가 필요 — 깡비서 본체(kkangbi-calendar) Vercel 프로젝트에 이미 있어도 이 프로젝트(kkangbi-summary)는 별도 Vercel 프로젝트라 따로 등록해야 함), `CLAUDE_MODEL`(선택, 기본값 `claude-sonnet-4-6`), `SOGANG_GATEWAY_KEY`(선택 — 설정 시에만 게이트웨이 우선 경로 활성화, 깡비서 본체 Vercel 프로젝트에 이미 등록된 값을 그대로 복사해서 이 프로젝트에도 등록), `SOGANG_GATEWAY_BASE`/`SOGANG_GATEWAY_MODEL`(선택, 각각 기본값 `https://factchat-cloud.mindlogic.ai/v1/gateway`/`claude-sonnet-4-6`). `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY`는 `api/storage.js`와 동일한 것 재사용(깡비서 캘린더 앱과 같은 Supabase 프로젝트 공유 확인됨).
- 위 스키마 전체를 가짜 Supabase/Anthropic 응답으로 로컬 검증 완료(월 경계를 넘는 이벤트 병합, 청크 재조립, 구/신 업무로그 병합 우선순위, 마커 파싱까지) — 스크래치패드 `test-ai-draft.mjs` 패턴 참고. 게이트웨이 성공/실패-폴백/미설정(직접호출) 세 경로 모두 스크래치패드 `test-ai-draft-gateway.mjs`로 검증 완료. 실제 배포 후 남은 건 실사용 확인뿐.
