# CODEMAP.md — forms/makeup (Make up 계획 관리) 코드 지도

> **목적:** 기능 수정 요청이 올 때 **이 폴더만** 열어서 고치고, 다른 양식 폴더는 열지 않는다.
> 허브 최상위 `docs/HUB-CODEMAP.md`에서 "Make up"으로 라우팅되면 이 문서만 보면 된다.
> **최종 갱신:** 2026-07-25 (허브 통합)

---

## 0. 이 양식은 주간보고와 다르게 파일이 적다

탭이 여러 개로 나뉘는 주간보고와 달리 Make up은 **월별 스냅샷 표 하나**가 전부라, 로직을 여러 파일로
쪼개지 않고 `js/makeup-app.js` 한 파일에 담았다 (이것도 "한 작업 = 한 파일" 원칙의 적용 — 도메인이
실제로 하나면 파일도 하나면 된다).

## 1. 파일 지도

| 작업 주제 | 파일 | 비고 |
|---|---|---|
| 화면 뼈대(표 구조, 상단 컨트롤) | `index.html` | 로드 순서: kv-client → auth → ExcelJS → makeup-app.js |
| 이 양식 전용 스타일(노랑=입력, 주황=자동계산 컬럼 등) | `css/makeup.css` | 공통 잠금화면 스타일은 `shared/base.css` |
| 월 전환·행 CRUD·자동계산·엑셀 내보내기 전체 로직 | `js/makeup-app.js` | `loadState/persistState`, `renderRows`, `exportStyledExcel` |
| **(이 폴더 밖, shared)** 화면 잠금 | `../../shared/auth.js` | 허브 전체 공용 |
| **(이 폴더 밖, shared)** 서버 저장 클라이언트 | `../../shared/kv-client.js` | `apiGet/apiSet`, 허브 전체 공용 |

## 2. 저장 방식

전체 상태(월 목록 + 월별 스냅샷 + 컬럼폭)를 **키 하나**(`ktis_v11__makeup_state`)에 통째로 저장한다
(주간보고처럼 주차별로 키를 쪼개지 않음 — Make up은 데이터량이 훨씬 작고, 원래 로직이 "전체 blob
읽기/쓰기" 구조로 이미 잘 동작해서 그대로 유지했다). `js/makeup-app.js`의 `loadState()`/`persistState()`가
`shared/kv-client.js`의 `apiGet`/`apiSet`을 호출한다.

## 3. 절대 하지 말 것

- 노랑(`col-write`)/주황(`col-auto`) 헤더 배경색을 임의로 통일하지 말 것 — "직접 입력 칸"과 "자동계산 칸"을
  구분하는 실제 의미가 있는 색이다 (디자인 취향이 아님)
- 저장을 주차별/월별 여러 키로 쪼개는 리팩터링 (요청 없이 임의로 하지 말 것 — 지금 구조로 충분히 동작함)
- `shared/` 파일을 이 폴더 전용으로 고치기 (다른 양식도 같이 씀)

## 4. 아직 미구현

- 팀원별 개인 토큰 인증 없음 (허브 공용 비밀번호만 있음) — 주간보고와 동일한 미해결 과제
