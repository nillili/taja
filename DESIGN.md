# 한글 타자연습 (웹) — 설계 문서

> 화면 디자인 철학은 별도 문서 [.design-live/DESIGN.md](.design-live/DESIGN.md)(시험지가 아니라 놀이터 / 종이·게임 두 테마 / 스크롤 없는 한 화면)를 따른다.
> 이 문서는 그 디자인을 **실제 동작하는 웹 프로그램**으로 만들기 위한 기술 설계다.

## 1. 프로그램 개요

- **무엇:** 초등학생(주 5~6학년)을 위한 한글 두벌식 타자연습 웹앱.
- **해결 문제:** 자리연습 → 낱말연습으로 자연스럽게 이어지는 단계형 연습과, 친구들과 겨루는 명예의 전당(기록)을 별도 회원가입/DB 없이 제공.
- **핵심 기능 3:**
  1. 자리연습(기존 디자인 그대로) — 단계 완료 시 낱말연습으로 연결
  2. 낱말연습 — 구글시트의 낱말 데이터로, 단계×기본/심화, 90% 통과 시 자동 진행
  3. 기록 — 최고기록 달성 시 구글시트 "기록"탭에 저장, 홈 명예의 전당에 표시
- **연동:** Google 스프레드시트(낱말 데이터 + 기록 저장)를 Apps Script 웹앱을 통해 읽고 쓴다.

## 2. 요구사항

### 2.1 기능 요구사항
- **사용자등록(로그인 대체):** 첫 진입 시 모달로 **학교 + 이름** 입력 → `localStorage` 보관. 인증/비밀번호 없음. (캐릭터 선택은 이번 범위 제외 — 캐릭터 탭이 비어 있어 보류)
- **자리연습:** 기존 구현 동작 유지. 단계 N 완료 & 정확도 ≥ 90% → "낱말연습으로 넘어갈까요?" → 낱말 N(기본).
- **낱말연습:**
  - 데이터 출처 = 시트 `낱말_1_기본` 탭(컬럼 8개 = 1~4단계 × 기본/심화).
  - 단계 N 기본 ≥ 90% → "심화로 넘어갈까요?" → 낱말 N(심화).
  - 낱말 N 심화 완료 → 다음 연결 없음(완료 화면에서 다시하기).
- **통과 판정(중요):** 정확도는 **원시값** `correct / (correct + wrong) * 100` 으로 판정한다(89.9 실패 / 90.0 통과). 화면에 보이는 반올림 표시값으로 판정하지 않는다 — 표시와 판정이 어긋나면 혼란.
- **기록:**
  - 자리·낱말 구분 없이 **"오늘" 랭킹**으로 통합.
  - 저장 트리거: 이번 판 최고타수가 개인 최고기록(localStorage)을 넘으면 "저장할까요?" 확인 후 저장.
  - 저장 형식: `기록` 탭 "오늘" 컬럼에 한 행 `학교,이름,최고타수,정확도`(콤마 단일 셀, 합의안). *장기적으로는 컬럼 분리 저장이 정렬/필터/콤마 포함 이름에 안전 — 후속 개선 후보.*
  - 홈 명예의 전당: "오늘" 랭킹 표시(순위 / 학교·이름 / 최고타수 / 정확도). 최고타수 내림차순.
  - **개인 최고기록은 "전체 최고" 단일값**(사용자 합의)이되, 저장 데이터에 `screen/step/mode`를 함께 남겨 맥락을 보존한다. ⚠️ 전체 최고 기준이면 아이가 쉬운 단계에서만 기록을 갱신하는 쏠림이 생길 수 있음(추후 화면/단계별 최고로 분리 여지).
- **단문/장문연습:** 콘텐츠 없음 → placeholder 유지. "다음에 열릴 예정" 정도의 짧은 문구만 둔다(더미 랭킹과 혼동 금지).

### 2.2 비기능 요구사항
- 디자인 철학 100% 준수(종이/게임 2테마, 라이트 고정, 스크롤 없는 한 화면, 큰 글자, 즉각 피드백).
- 무회원: 어떤 사용자도 구글 로그인 없이 사용. 개인정보는 학교·이름만, 기록 저장 시에만 전송.
- 시트 쓰기 지연이 연습 흐름을 막지 않게(저장은 비동기, 실패해도 연습 진행).

### 2.3 제약 조건
- 프론트엔드: **Vite + React**. 디자인 프로토타입(브라우저 Babel)을 픽셀 기준으로 재현하되 구조는 모듈화.
- **호스팅: Cloudflare** (정적 빌드는 **Cloudflare Pages**). 시트 읽기/쓰기는 **Google Apps Script 웹앱**(소유자 ds1lph@gmail.com이 직접 배포).
- **제품 기본 경로 = Cloudflare Pages Function / Worker 프록시**(선택이 아니라 기본). 브라우저는 항상 같은 출처 `/api/*`만 호출 → CORS 제거 + Apps Script URL 은닉. Apps Script URL은 함수의 환경변수 `APPS_SCRIPT_URL`로 주입.
- 캐릭터 탭 비어 있음 → 캐릭터 기능 보류.

### 2.4 기준 소스 정리 (혼선 방지)
- `design/타자연습/` = **디자인 참조 원본으로 보존** (수정 안 함).
- `.design-live/` = 핸드오프 임시 캐시. **제품 소스에서 제외**(빌드/깃 추적 대상 아님).
- 실제 앱은 **새 `src/` 기반 Vite 프로젝트**가 단일 기준 소스.
- `.gitignore`에 `.design-live/`, `.design-url`, `*.thumbnail`/`.thumbnail`, 빌드 산출물(`dist/`, `node_modules/`) 제외.
- ⚠️ 두 프로토타입이 다름: `.design-live/app.jsx`는 **게임 기본 + 라이트 고정**(디자인 철학과 일치), `design/타자연습/app.jsx`는 종이 기본 + 다크 토글. → 제품은 **`.design-live` 쪽(게임 기본/라이트 고정)** 을 기준으로 한다.

## 3. 아키텍처

### 3.1 시스템 구조
```
[브라우저: Vite+React SPA]  ──(Cloudflare Pages에서 정적 호스팅)
   │  fetch (JSON)
   ▼
[Cloudflare Worker / Pages Function 프록시]  (선택, 권장 — CORS·URL 은닉)
   │
   ▼
[Google Apps Script 웹앱]  doGet / doPost  (나로 실행 / 누구나 접근)
   │  SpreadsheetApp.openById
   ▼
[구글 스프레드시트]  낱말_1_기본 · 기록(오늘/장문/단문) · 캐릭터(보류)
```
> 프록시를 안 쓰면 브라우저가 Apps Script를 직접 호출(단순요청 text/plain). 쓰면 `/api/*` 한 도메인으로 통일되고 CORS가 사라진다.

폴더(예정):
```
src/
  main.jsx  App.jsx          화면 라우팅(home/jari/natmal/danmun/jangmun)
  kit/                       공용 타이핑 키트(프로토타입 TypingKit를 ES module로 분리)
    hangul.js                charToKeys · decomposeWord · 두벌식 매핑
    keyboard.js              키 레이아웃 · 손가락 매핑
    stats.js                 calcCpm · calcAccuracy · isPassed
    VirtualKeyboard.jsx  StepList.jsx  StatsInline.jsx  DoneOverlay.jsx
    *.test.js                한글 분해·정확도 경계 단위 테스트
  screens/  HomeScreen  JariScreen  NatmalScreen  PlaceholderScreen(단문/장문)
  components/  RegisterModal  StyleSwitch  TweaksPanel
  data/  api.js(같은 출처 /api 호출)  words.js  records.js  progress.js(90% 통과·단계 연결)
  styles/  base.css  game-theme.css   (라이트 고정, themeStyle만 노출)
apps-script/  Code.gs                  (시트 읽기/쓰기 — 배포용 소스)
functions/api/[[path]].js              (Cloudflare Pages Function 프록시 → APPS_SCRIPT_URL)
```
> 전역 `window.TypingKit` 의존을 제거하고 `import/export`로 바꾼다. 한글 분해·통계·키 매핑은 UI에서 분리해 단위 테스트가 가능하게 한다.

### 3.2 기술 스택 & 이유
- **Vite + React**: 빠른 개발/번들, 컴포넌트 모듈화. (사용자 선택)
- **Apps Script 웹앱**: 정적 클라이언트가 시트에 쓰기 위한 최소 비용 다리. 별도 서버·DB·로그인 불필요.
- **localStorage**: 사용자등록 정보와 개인 최고기록 보관.

### 3.3 데이터 흐름
- 앱 시작 → `localStorage`에 사용자 없으면 RegisterModal → 저장.
- 낱말 화면 진입 → `GET /api/words` 1회 세션 캐시 → 단계×기본/심화로 분류. **실패 시에만 내장 fallback 단어** 사용.
- 연습 완료 → 공통 `onPracticeDone(result)` 콜백으로 결과(타수/정확도/screen/step/mode) 상위 전달 → 통과(≥90%)면 다음 단계 연결 제안.
- 개인 최고(`result.wpm > best.wpm`) 갱신 시 → "저장할까요?" → `POST /api/records` → "오늘" append. 실패해도 완료 상태 유지(짧은 안내).
- 홈 진입 → `GET /api/records?board=today` → 명예의 전당 렌더(불러오는 중 / 아직 기록 없음 상태 포함).

## 4. API / 인터페이스

브라우저는 **항상 같은 출처 `/api/*`** 만 호출한다(Cloudflare Pages Function 프록시 → Apps Script). 프록시는 `APPS_SCRIPT_URL` 환경변수를 갖고, Apps Script는 데이터 읽기/쓰기·검증에 집중한다.

- `GET /api/words`
  → `{ steps: { "1":{basic:[...],adv:[...]}, "2":{...}, "3":{...}, "4":{...} }, updatedAt }`  (낱말_1_기본 파싱·정규화)
- `GET /api/records?board=today`
  → `[ {school, name, wpm, acc}, ... ]`  (최고타수 내림차순)
- `POST /api/records`  body:
  ```json
  { "board":"today", "school":"OO초", "name":"홍길동",
    "wpm":320, "acc":96, "screen":"natmal", "step":2, "mode":"basic" }
  ```
  → 기록 탭 "오늘" 컬럼에 `"학교,이름,최고타수,정확도"` 한 셀 append → `{ ok:true, rank:n }`
  - 프록시 미사용 시(직접 호출) CORS 회피용 `Content-Type: text/plain` 단순요청 + `ContentService` JSON 응답.

### 데이터 정규화 (시트 읽기)
- 빈 셀·중복·앞뒤 공백·셀 안 콤마·잘못된 타입을 정리한 뒤 제공.
- 단어 셔플은 `sort(() => Math.random()-0.5)`(분포 치우침) 대신 **Fisher-Yates**.

### 데이터 모델
- **User**(localStorage `typing.user.v1`): `{ school, name, createdAt }`
- **Best**(localStorage `typing.best.v1`): `{ wpm, acc, screen, step, mode, updatedAt }`
- **WordSteps**: `{ [stepId]: { basic:string[], adv:string[] } }`
- **PracticeResult**(완료 콜백): `{ screen, step, mode, wpm, acc, correct, wrong }`
- **Record(cell 문자열)**: `학교,이름,최고타수,정확도` — 읽을 때 콤마 split.

## 5. 품질·정합성 보강 (DESIGN_R 반영)

### 5.1 테마 정렬
- 제품 UI는 **`themeStyle`(종이/게임)만 노출**, `data-theme`는 항상 `"light"` 고정. 기본값 **game**.
- 다크 관련 CSS는 당장 삭제하지 않아도 되나 **제품 UI에서 접근 불가**하게 한다.

### 5.2 레이아웃 안정성
- `100vh` 의존 금지. `html, body, #root, .page` 를 `height:100%` 체인으로, header 아래 화면은 `flex:1; min-height:0`.
- JariScreen/NatmalScreen은 `height:100%` 를 받아 키보드/본문이 겹치거나 잘리지 않게.

### 5.3 콘텐츠 정합성
- 메인 배너의 **코인 `2,480` 제거**(실제 보상 시스템 계획 없음, "채우기용 콘텐츠 금지" 위반).
- 기록 로딩 전/없을 때 명예의 전당에 **"불러오는 중" / "아직 기록이 없어요"** 빈 상태 제공.
- 낱말 콘텐츠 오탈자 검수(예: `괜찬다` → `괜찮다`). 초등 학습용.

### 5.4 접근성·입력
- RegisterModal: `role="dialog"`, focus trap, Enter 저장, Esc 정책.
- StepList 항목은 실제 `<button>` 로(키보드 조작·접근성).
- `keydown` 무시 키 처리 일관화(필요 시 preventDefault). IME/영문자판/모바일 입력 정책 명시.
- 모바일은 하드웨어 키보드 없는 환경 사용성 낮음 → **최소 지원 범위 문서화**.

### 5.5 개인정보
- 학교/이름은 **브라우저(localStorage)와 기록 저장 시트에만** 저장. 그 외 수집 없음.
- 삭제 요청은 시트 관리자(소유자)에게 문의로 처리.

## 6. 검증 계획
- **단위 테스트**(kit): `decomposeWord`/`charToKeys`/통계.
  - `넓적다리`(ㄴ+ㅓ+ㄹ+ㅂ…), `외갓집`(ㅗ+ㅣ, ㄳ, ㅈ+ㅣ+ㅂ), `괜찮다`(ㅗ+ㅐ, ㄶ, Shift 여부), 쌍자음(`까`/`뚜`/`찌`/`쌍`).
  - 정확도 경계: **89.9 실패 / 90.0 통과**.
- 단계 연결 시나리오: 자리N→낱말N(기본)→심화→종료 수동 플레이.
- API: `/api/words`·`/api/records` 읽기, `POST /api/records` 쓰기 각각 브라우저 fetch 왕복(프록시/CORS 포함).
- 레이아웃: **1366×768, 1280×720, 390×844, 360×740** 에서 연습 화면 세로 스크롤 없음.
- 종이/게임 전환 시 구조 유지.
- 화면 스모크: 주요 화면 Playwright 스모크 테스트.

## 7. 위험 요소 및 주의사항
- **Apps Script CORS**: doPost 프리플라이트 이슈 → Cloudflare 프록시로 `/api/*` 동일 출처화(제품 기본), 또는 `text/plain` 단순요청 + `ContentService` JSON 응답으로 우회. 배포는 "새 배포 → 웹앱 → 누구나" 필수.
- **Cloudflare 배포**: 정적 빌드는 Pages, API 프록시는 Pages Function/Worker. 환경변수 `APPS_SCRIPT_URL`로 주입(클라이언트에 노출 안 함).
- **시트 스키마 불일치**: 기록 탭에 낱말 전용 컬럼 없음 → "오늘" 통합으로 합의됨. 평균타수 열은 디자인에서 제외.
- **개인 최고 쏠림**: "전체 최고" 트리거 특성상 쉬운 단계에서만 갱신될 수 있음 → 저장에 screen/step/mode 동반, 추후 단계별 최고 분리 여지.
- **쓰기 지연·실패**: 저장은 비동기, 실패 시 조용히 무시하고 연습은 계속(재시도 안내 고려).
- **낱말 데이터 변동**: 시트가 바뀌면 앱도 자동 반영(요청 시 최신). 빈 셀/중복/공백/콤마 정규화 필수.
- **캐릭터 보류**: 사용자등록 UI는 캐릭터 자리만 비워 확장 여지 유지.

## 8. 권장 구현 순서
1. Vite 프로젝트 골격 생성, 기준 소스 정리(`.design-live`/`design/타자연습` 역할 확정, `.gitignore`).
2. 공용 로직 분리: `kit/hangul.js`·`kit/stats.js`·`kit/keyboard.js`(+ 테스트).
3. 자리연습 이식 + 타수/정확도 실측 정리.
4. 사용자등록 모달 + `localStorage` 저장.
5. 완료 결과를 공통 `onPracticeDone(PracticeResult)` 콜백으로 상위 전달.
6. 90% 통과·다음 연습 연결 규칙(`progress.js`).
7. 낱말 데이터 API 클라이언트 + fallback 단어.
8. 홈 명예의 전당 실제 API 데이터화("오늘" 단일 보드, 코인 제거, 빈 상태).
9. 기록 저장 API + 개인 최고 갱신 + 저장 확인 모달.
10. Apps Script `Code.gs` + Cloudflare Pages Function 프록시.
11. 단위 테스트 + 주요 화면 스모크 테스트.
12. Cloudflare Pages 배포 설정·환경변수 문서화.

## 9. 완료 기준 (MVP)
- 첫 접속 시 학교/이름 등록 후 사용 가능.
- 자리연습 1~4단계 동작, 정확도 ≥ 90% 완료 시 같은 단계 낱말 기본 이동 제안.
- 낱말 기본 완료 후 ≥ 90%면 심화 이동 제안.
- 낱말 데이터는 구글시트 또는 fallback에서 로드.
- 최고기록 갱신 시 저장 확인 후 "오늘" 랭킹 반영.
- 홈 명예의 전당은 더미가 아닌 실제 기록 표시.
- 제품 UI는 게임/종이 전환만, 라이트 고정.
- 단문/장문은 placeholder(더미 랭킹과 혼동 없음).
- 1366×768·1280×720·390×844 에서 연습 화면 세로 스크롤 없음.
- 한글 분해·90% 판정 단위 테스트 통과.
