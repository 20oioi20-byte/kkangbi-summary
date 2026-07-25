# SHARED-CODEMAP.md — shared/ 공용 파일 코드맵

> **주의:** 이 폴더는 허브의 모든 양식이 함께 쓴다. 다른 폴더(`forms/*`)와 반대로,
> 여기를 고칠 때는 **영향받는 양식 전체를 확인**해야 한다 (한 양식만 보고 판단하지 말 것).

| 파일 | 역할 | 함수/내용 |
|---|---|---|
| `kv-client.js` | `/api/storage` 호출 래퍼 | `apiGet(key)`, `apiSet(key, value)`, `apiList(prefix)`, `apiDelete(key)` |
| `auth.js` | 허브 공용 화면 잠금(비밀번호) | `tryUnlock()`, `changeHubPw(newPw)` — 비밀번호는 `ktis_v11__hub_pw` 키, 기본/예비값 `000000` |
| `logo-data.js` | kt is 로고 base64 | 전역 `KT_LOGO_DATAURI` — 로고 교체 외엔 절대 열지 않음 |
| `base.css` | 버튼 기본 모양, 카드, 배지, 토스트, 잠금화면 스타일 | **색상 변형은 넣지 않는다** — `.btn-primary` 등 색은 각 양식 CSS에 |

## 이 파일들을 열어야 하는 경우

- 로고 이미지 자체를 바꿔달라는 요청 → `logo-data.js`
- "비밀번호 규칙을 바꿔달라"(예: 마스터 비번 제거, 자릿수 제한 등) → `auth.js`
- 저장 API 엔드포인트/키 검증 로직을 바꿔달라 → `kv-client.js` + `api/storage.js` (둘 다 짝으로 확인)
- "모든 양식 버튼 모서리를 더 둥글게" 같은 진짜 전역 스타일 요청 → `base.css`

## 이 파일들을 열면 안 되는 경우

- 특정 양식 하나의 색상/레이아웃만 바꿔달라는 요청 → 그 양식의 `forms/{slug}/css/*.css`에서 오버라이드로 처리 (여기 손대지 않는다)
