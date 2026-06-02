# 한글 타자연습 설계 검토 및 수정 제안

작성일: 2026-06-02

## 1. 검토 범위

- 기준 문서: `DESIGN.md`, `.design-live/DESIGN.md`
- 구현/프로토타입: `design/타자연습/index.html`, `app.jsx`, `jari.jsx`, `natmal.jsx`, `game-theme.css`, `tweaks-panel.jsx`
- 보조 산출물: `.design-live/*`, `view-design.sh`

현재 저장소는 완성 앱이 아니라 디자인 핸드오프 기반의 브라우저 프로토타입에 가깝다. 루트 `DESIGN.md`는 "Vite + React + Apps Script + Cloudflare Pages"를 전제로 하지만, 실제 파일은 React UMD와 Babel을 HTML에서 직접 로드하는 구조다. 따라서 가장 먼저 해야 할 일은 "디자인 프로토타입"과 "제품 구현"의 기준선을 분리하고, 그 다음 데이터 연동과 진행 규칙을 제품 코드로 옮기는 것이다.

## 2. 전체 판단

현재 구현된 것:

- 자리연습 화면의 핵심 인터랙션: 단계 선택, 두벌식 키 매핑, 가상 키보드, 손가락 가이드, 실시간 타수/정확도 표시.
- 낱말연습 화면의 핵심 인터랙션: 단계/기본/심화 선택, 단어 단위 진행, 현재 글자 강조, 가상 키보드 재사용.
- 메인 화면의 명예의 전당과 메뉴 레이아웃.
- 종이/게임 테마의 시각 디자인 대부분.

미구현 또는 설계와 다른 것:

- Vite/React 앱 구조가 없다.
- 사용자등록 모달과 `localStorage` 사용자 저장이 없다.
- Apps Script, Cloudflare Worker/Pages Function, API 클라이언트가 없다.
- 낱말 데이터가 구글시트가 아니라 하드코딩 배열이다.
- 기록 저장, 개인 최고기록, 홈 명예의 전당 실제 데이터 로딩이 없다.
- 자리연습 완료 후 낱말연습 연결, 낱말 기본 완료 후 심화 연결, 90% 통과 판정이 없다.
- 단문/장문은 placeholder인데, 명예의 전당은 단문/장문 더미 랭킹을 보여준다.
- 디자인 철학은 라이트 고정/게임 기본을 요구하지만, `design/타자연습`은 종이 기본/다크 토글을 포함한다.
- `.design-live`와 `design/타자연습`이 서로 달라 기준 산출물이 불명확하다.

## 3. 우선순위별 수정사항

### P0. 기준 소스와 실행 구조 확정

문제:

- `DESIGN.md`는 Vite + React 구조를 예정 폴더로 제시하지만, 실제 구현은 `index.html`에서 `react.development.js`, `react-dom.development.js`, `@babel/standalone`을 직접 로드한다.
- 이 방식은 Cloudflare Pages에 올릴 수는 있지만, 제품 코드로 유지하기 어렵다. 번들링, 테스트, 환경변수, API 프록시, 컴포넌트 분리가 모두 막힌다.
- `.design-live`와 `design/타자연습`이 동시에 존재하고 내용이 다르다. 특히 `.design-live/app.jsx`는 게임 테마 기본과 라이트 고정에 더 가깝고, `design/타자연습/app.jsx`는 종이 기본과 다크 토글을 노출한다.

권장 수정:

1. `design/타자연습`은 디자인 참조 원본으로 보존한다.
2. 실제 앱은 새로 `src/` 기반 Vite 프로젝트로 만든다.
3. `.design-live`는 임시 핸드오프 캐시로 취급하고 제품 소스에서 제외한다.
4. `.gitignore`가 없다면 `.design-live/`, `.design-url`, 임시 썸네일, 빌드 산출물을 제외한다.
5. Vite 전환 후 `TypingKit` 전역 객체 의존을 ES module export/import로 바꾼다.

권장 폴더:

```text
src/
  App.jsx
  main.jsx
  screens/
    HomeScreen.jsx
    JariScreen.jsx
    NatmalScreen.jsx
    PlaceholderScreen.jsx
  kit/
    hangul.js
    keyboard.js
    stats.js
    VirtualKeyboard.jsx
    StepList.jsx
    DoneOverlay.jsx
  components/
    RegisterModal.jsx
    StyleSwitch.jsx
  data/
    api.js
    records.js
    words.js
    progress.js
  styles/
    base.css
    game-theme.css
apps-script/
  Code.gs
functions/
  api/
    [[path]].js
```

### P0. 사용자등록과 기록 저장 플로우 구현

문제:

- `DESIGN.md`는 첫 진입 시 학교+이름 모달을 띄우고 `localStorage`에 저장한다고 한다.
- 현재 `app.jsx`에는 등록 모달, 사용자 상태, `localStorage` 접근이 없다.
- 기록 저장 트리거도 없다. 완료 오버레이는 "다시 시작"만 제공한다.

권장 수정:

- `UserProfile` 저장 키를 명확히 한다.

```js
const USER_KEY = "typing.user.v1";
const BEST_KEY = "typing.best.v1";
```

- 사용자 데이터:

```json
{
  "school": "OO초",
  "name": "홍길동",
  "createdAt": "2026-06-02T00:00:00.000Z"
}
```

- 최고기록 데이터는 연습 종류와 단계까지 보관하는 편이 안전하다.

```json
{
  "overall": { "wpm": 320, "acc": 96, "screen": "natmal", "step": 2, "mode": "basic", "updatedAt": "..." }
}
```

- 완료 시 공통 `onPracticeDone(result)` 콜백을 `JariScreen`, `NatmalScreen`에 전달한다.
- `result.wpm > best.overall.wpm`이면 확인 모달을 띄운 뒤 저장한다.
- 저장 실패는 토스트나 짧은 문구로 알려주되 연습 완료 상태는 유지한다.

### P0. 90% 통과 및 단계 연결 규칙 구현

문제:

- 현재 자리연습은 `phase === 'done'`이 되면 무조건 `DoneOverlay`만 표시한다.
- 낱말연습도 완료 후 다음 흐름 없이 `DoneOverlay`만 표시한다.
- `DESIGN.md`의 핵심 흐름인 `자리 N -> 낱말 N 기본 -> 낱말 N 심화`가 없다.

권장 수정:

- 진행 규칙을 화면 내부에 흩뿌리지 말고 `data/progress.js`에 둔다.

```js
export function getNextPractice(result) {
  if (result.acc < 90) return null;
  if (result.screen === "jari") {
    return { screen: "natmal", step: result.step, mode: "basic", label: "낱말연습으로 넘어갈까요?" };
  }
  if (result.screen === "natmal" && result.mode === "basic") {
    return { screen: "natmal", step: result.step, mode: "adv", label: "심화로 넘어갈까요?" };
  }
  return null;
}
```

- `DoneOverlay`는 `nextAction`을 받을 수 있게 확장한다.
- 정확도는 소수점 없이 반올림한 표시값과 판정값이 다르면 혼란이 생길 수 있다. 판정은 원시값 `correct / (correct + wrong) * 100`으로 하고, 화면 표시만 반올림한다.

### P0. 낱말 데이터 구글시트 연동

문제:

- `natmal.jsx`의 `WORD_STEPS`가 하드코딩이다.
- `DESIGN.md`는 시트 `낱말_1_기본` 탭의 8개 컬럼을 1~4단계 기본/심화로 파싱한다고 한다.
- 현재 기본 낱말 중 `괜찬다`는 맞춤법상 `괜찮다`가 맞다. 초등 학습용 콘텐츠라면 오탈자 검수가 필요하다.

권장 수정:

- 앱 시작 또는 낱말 화면 진입 시 `api.getWords()`를 호출하고 세션 캐시한다.
- API 실패 시에만 내장 fallback 단어를 사용한다.
- 빈 셀, 중복, 공백, 쉼표가 들어간 셀, 잘못된 타입을 정규화한다.
- 단어 셔플에는 `sort(() => Math.random() - 0.5)` 대신 Fisher-Yates를 사용한다. 현재 방식은 분포가 치우칠 수 있다.

권장 응답:

```json
{
  "steps": {
    "1": { "basic": ["가구"], "adv": ["토끼"] },
    "2": { "basic": [], "adv": [] },
    "3": { "basic": [], "adv": [] },
    "4": { "basic": [], "adv": [] }
  },
  "updatedAt": "2026-06-02T00:00:00.000Z"
}
```

### P0. 홈 명예의 전당 실제 데이터화

문제:

- `app.jsx`의 `RANKINGS`는 더미 데이터다.
- 화면은 단문/장문 탭을 보여주지만, 루트 `DESIGN.md`는 자리/낱말 구분 없이 "오늘" 랭킹 통합을 요구한다.
- 표에는 "평균 타수" 컬럼이 있는데, `DESIGN.md`는 평균타수 열 제외를 명시한다.
- `학교` 표시가 빠져 있다.

권장 수정:

- `HomeScreen`은 `GET ?action=records&board=오늘` 결과를 로드한다.
- 랭킹 탭은 단문/장문이 아니라 "오늘" 단일 보드로 단순화한다. 추후 확장 시에만 보드 탭을 복원한다.
- 컬럼은 `순위 / 학교·이름 / 최고 타수 / 정확도`로 바꾼다.
- 더미 데이터는 개발 fallback으로만 분리한다.

### P1. Apps Script와 Cloudflare 프록시 명세 보강

문제:

- `DESIGN.md`에는 API 형태는 있지만 실제 `apps-script/Code.gs`가 없다.
- 프록시가 "선택, 권장"으로 적혀 있어 구현자가 어느 경로를 먼저 만들어야 하는지 애매하다.
- Apps Script URL을 클라이언트에 직접 넣으면 URL 은닉 요구와 충돌한다.

권장 수정:

- 제품 기본 경로는 Cloudflare Pages Function 또는 Worker 프록시로 확정한다.
- 브라우저는 항상 같은 출처 `/api/words`, `/api/records`, `/api/records/save`만 호출한다.
- Worker/Function이 Apps Script URL을 환경변수 `APPS_SCRIPT_URL`로 갖는다.
- Apps Script는 CORS보다 데이터 읽기/쓰기와 검증에 집중한다.

권장 API:

```text
GET  /api/words
GET  /api/records?board=today
POST /api/records
```

`POST /api/records` body:

```json
{
  "board": "today",
  "school": "OO초",
  "name": "홍길동",
  "wpm": 320,
  "acc": 96,
  "screen": "natmal",
  "step": 2,
  "mode": "basic"
}
```

시트에는 기존 합의인 `학교,이름,최고타수,정확도` 단일 셀 저장도 가능하지만, 장기적으로는 컬럼 분리 저장이 낫다. 콤마가 들어간 학교명/이름, 후속 필드 추가, 정렬/필터링이 어려워지기 때문이다.

### P1. 디자인 철학과 실제 테마 옵션 정렬

문제:

- `.design-live/DESIGN.md`는 게임 테마 기본, Light 고정, 다크모드 없음이라고 한다.
- `design/타자연습/app.jsx`는 `themeStyle: "paper"`가 기본이고, UI에서 `Light/Dark` 토글을 제공한다.
- `game-theme.css`도 dark variant를 포함한다.

권장 수정:

- 제품에서는 `themeStyle`만 사용자에게 노출한다.
- `data-theme`는 항상 `"light"`로 고정한다.
- 다크 관련 CSS는 당장 삭제하지 않아도 되지만 제품 UI에서 접근하지 못하게 한다.
- 기본값은 `.design-live` 기준처럼 `"game"`으로 맞춘다.

### P1. 레이아웃 안정성 보강

문제:

- 연습 화면이 `height: calc(100vh - 70px)`에 의존한다.
- 디자인 철학 문서는 `100vh`를 신뢰하지 말고 `height:100%` 체인을 쓰라고 한다.
- 모바일/짧은 화면에서 키보드와 본문이 겹치거나 잘릴 위험이 있다.

권장 수정:

- `html, body, #root, .page`를 `height: 100%`로 연결한다.
- `.page`를 flex column으로 만들고, header 아래 화면을 `flex: 1; min-height: 0`으로 배치한다.
- `JariScreen`, `NatmalScreen`은 `height: 100%`를 받도록 바꾼다.
- 실제 검증은 1366x768, 1280x720, 390x844, 360x740에서 해야 한다.

### P1. 공통 타이핑 키트 분리와 테스트

문제:

- `jari.jsx`가 `TypingKit`을 전역으로 만들고 `natmal.jsx`가 `window.TypingKit`에 의존한다.
- 한글 분해, 키 매핑, 통계 계산, 키보드 UI가 한 파일에 섞여 있다.
- 단위 테스트 대상인 `decomposeWord`, `charToKeys`, `StatsBar` 계산 로직을 독립적으로 검증하기 어렵다.

권장 수정:

- `kit/hangul.js`: `charToKeys`, `decomposeWord`, 두벌식 매핑.
- `kit/stats.js`: `calcCpm`, `calcAccuracy`, `isPassed`.
- `kit/keyboard.js`: 키 레이아웃과 손가락 매핑.
- `kit/*.test.js`: 받침/쌍자음/복합모음/겹받침 테스트.

필수 테스트 케이스:

- `넓적다리`: ㄴ + ㅓ + ㄹ + ㅂ 분해 확인.
- `외갓집`: ㅗ+ㅣ, ㄳ, ㅈ+ㅣ+ㅂ 확인.
- `괜찮다`: ㅗ+ㅐ, ㄶ, Shift 필요 여부 확인.
- 쌍자음: `까`, `뚜`, `찌`, `쌍`.
- 정확도 경계: 89.9는 실패, 90.0은 통과.

### P1. 콘텐츠와 사용자 경험 정합성

문제:

- 메인 배너에 코인 `2,480`이 하드코딩되어 있다. 실제 기능과 연결되지 않은 게임 재화처럼 보인다.
- 디자인 철학은 "채우기용 콘텐츠 금지"를 명시한다.
- 홈 문구는 "최고 기록을 깨면..."이라고 하지만 현재 저장 기능이 없다.

권장 수정:

- 코인은 실제 보상 시스템을 만들 계획이 없다면 제거한다.
- 기록 저장이 구현되기 전까지는 명예의 전당 영역에 "기록을 불러오는 중", "아직 기록이 없어요" 상태를 넣는다.
- 저장 기능 구현 후 문구를 유지한다.

### P2. 단문/장문 범위 명확화

문제:

- `DESIGN.md`는 단문/장문 placeholder 유지라고 한다.
- 하지만 홈 랭킹은 단문/장문 탭과 더미 데이터를 보여준다.
- 사용자 입장에서는 단문/장문 기록이 이미 있는 기능처럼 보인다.

권장 수정:

- 이번 범위에서는 랭킹을 "오늘" 단일 보드로 바꾼다.
- 단문/장문 메뉴는 placeholder로 유지하되 "다음에 열릴 예정" 정도의 짧은 문구만 둔다.
- 단문/장문 기록 탭은 해당 기능을 구현하는 시점에 다시 추가한다.

### P2. 접근성 및 입력 예외 처리

문제:

- 키보드 입력 중심 앱이지만 포커스 이동, 모달, 버튼 aria 상태가 아직 제품 수준은 아니다.
- `keydown`에서 일부 키는 ignore 후 `preventDefault`를 하지 않아 브라우저 기본 동작이 남을 수 있다.
- IME 상태, 영문 자판 상태, 모바일 키보드 사용 여부에 대한 정책이 없다.

권장 수정:

- RegisterModal은 `role="dialog"`, focus trap, Enter 저장, Esc 정책을 갖는다.
- 연습 화면 진입 시 "한글 두벌식 입력 상태" 안내를 짧게 제공한다.
- 모바일은 실제 하드웨어 키보드가 없는 환경에서 사용성이 낮으므로, 최소 지원 범위를 문서에 명시한다.
- 버튼형 `StepList`는 실제 `<button>` 요소로 바꾸는 편이 접근성/키보드 조작에 낫다.

## 4. 설계 문서 자체 수정 제안

`DESIGN.md`는 좋은 방향을 잡고 있지만 몇 군데는 구현자가 헷갈릴 수 있다.

수정 권장:

- "프록시 선택, 권장"을 "제품 기본은 Cloudflare Pages Function/Worker 프록시"로 확정한다.
- "기록 탭 오늘 컬럼에 한 행을 한 셀로 append"는 단기 호환안으로 낮추고, 컬럼 분리 저장안을 권장안으로 추가한다.
- "자리·낱말 구분 없이 오늘 랭킹 통합"과 `.design-live/DESIGN.md`의 "단문/장문 종류별 탭"이 충돌한다. 이번 제품 범위는 "오늘 통합 랭킹"으로 정리한다.
- `User.best`는 단일 최고기록인지, 화면별/단계별 최고기록인지 명확히 한다. 저장 트리거가 "전체 최고"라면 아이가 낮은 단계에서만 기록을 올리는 현상이 생긴다.
- "정확도 ≥ 90%" 판정이 반올림 표시값인지 원시 계산값인지 명시한다. 권장: 원시값 기준.
- 개인정보 최소화와 보관 정책을 추가한다. 예: 학교/이름은 브라우저와 기록 저장 시트에만 저장, 삭제 요청은 시트 관리자에게 문의.

## 5. 권장 구현 순서

1. Vite 프로젝트 골격 생성, 기존 프로토타입을 `src/`로 이식.
2. `.design-live`와 `design/타자연습` 역할 정리, 제품 기준 소스 확정.
3. `kit/hangul.js`, `kit/stats.js`, `kit/keyboard.js`로 공통 로직 분리.
4. 사용자등록 모달과 `localStorage` 저장 구현.
5. 자리/낱말 완료 결과를 공통 `PracticeResult`로 올리는 콜백 구조 추가.
6. 90% 통과와 다음 연습 연결 규칙 구현.
7. 낱말 데이터 API 클라이언트와 fallback 단어 로딩 구현.
8. 홈 명예의 전당을 실제 API 데이터로 변경.
9. 기록 저장 API, 개인 최고기록 갱신, 저장 확인 모달 구현.
10. Apps Script `Code.gs`와 Cloudflare 프록시 구현.
11. 단위 테스트와 주요 화면 Playwright 스모크 테스트 추가.
12. Cloudflare Pages 배포 설정과 환경변수 문서화.

## 6. 완료 기준

MVP 완료 기준:

- 첫 접속 시 학교/이름 등록 후 앱 사용 가능.
- 자리연습 1~4단계가 동작하고, 정확도 90% 이상 완료 시 같은 단계 낱말 기본으로 이동 제안.
- 낱말 기본 완료 후 정확도 90% 이상이면 심화 이동 제안.
- 낱말 데이터는 구글시트 또는 API fallback에서 로드.
- 최고기록 갱신 시 저장 확인 후 "오늘" 랭킹에 반영.
- 홈 명예의 전당은 더미가 아닌 실제 기록을 표시.
- 제품 UI는 게임/종이 스타일 전환만 제공하고 라이트 고정.
- 단문/장문은 placeholder로 남되 랭킹 더미와 혼동되지 않음.
- 1366x768, 1280x720, 390x844에서 연습 화면이 세로 스크롤 없이 보임.
- 한글 분해와 90% 판정 단위 테스트 통과.

## 7. 결론

현재 파일은 시각/상호작용 프로토타입으로는 충분히 유용하지만, `DESIGN.md`가 목표로 하는 실제 웹앱과는 아직 거리가 있다. 가장 큰 미비점은 데이터 연동보다 먼저 "제품 소스 구조가 없다"는 점이다. Vite 전환과 기준 소스 정리를 먼저 끝내야 사용자등록, 기록 저장, 구글시트 연동, 90% 진행 규칙을 안정적으로 얹을 수 있다.

당장 제품화를 시작한다면 P0 항목인 기준 소스 확정, Vite 이식, 사용자등록, 진행 규칙, 실제 랭킹/낱말 API부터 처리하는 것이 맞다.
