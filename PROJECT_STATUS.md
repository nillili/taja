# 한글 타자연습 — 프로젝트 현황

> 마지막 업데이트: 2026-08-19 (단문연습 구현)

---

## 배포 현황

| 항목 | 값 |
|---|---|
| 서비스 URL | https://taja-cxm.pages.dev |
| GitHub | https://github.com/nillili/taja (private) |
| Cloudflare 프로젝트 | taja (계정: ds1lph@gmail.com) |
| D1 DB 이름 | taja-db |
| D1 DB ID | b92ae9c0-3d14-408f-aa38-24a3a6c07b18 |
| 관리자 PIN | Pages 환경변수 `ADMIN_PIN` (설정됨). 미설정 시 코드 기본값 사용 |

> 낱말·문장의 원본은 D1이다. 관리 화면(⚙ → PIN)에서 직접 고친다.
> 구글시트/Apps Script 연동은 제거했다(히스토리에는 남아 있다).

---

## 구현 완료된 기능

### 자리연습 (CH.02)
- 1~4단계 (기본자리 → 윗줄 → 아랫줄 → 전체+쌍자음)
- 4단계에 쌍자음 포함 (ㄲ ㄸ ㅃ ㅆ ㅉ ㅒ ㅖ) — Shift 키 강조 + 손가이드
- 두 바퀴 모두 무작위 순서 (Fisher-Yates)
- 가상 키보드 + 손가이드 (빨간 손가락 강조)

### 낱말연습 (CH.03)
- 1~4단계 × 기본/심화, 각 ~100개 단어
- 데이터 출처: D1 `words` 테이블 (설정 화면에서 수정). 실패 시 `src/data/wordSteps.js` 내장값
- 단어 10개 무작위 출현 (Fisher-Yates)
- 된소리(4단계) Shift 처리 — 자리연습과 동일한 방식

### 레벨 연결
- 90% 통과(원시값 기준, 표시값 아님) 시 자동 제안
- 자리 N → 낱말 N(기본) → 낱말 N(심화) → 종료
- `src/data/progress.js`에 규칙 중앙화

### 사용자등록
- 첫 진입 모달(학교+이름), localStorage 저장
- 빈 칸이면: 학교=우리초등학교, 이름=랜덤(초롱이, 하늘이 등 20종)
- `src/data/user.js` — `typing.user.v1` / `typing.best.v1`

### 기록 저장 / 명예의전당
- 연습 완료 시 자동저장 (프롬프트 없음) → D1 `today_records`
- 홈 명예의전당 탭 2개 (wpm 내림차순, 순위/이름·학교/최고타수/정확도)
  - **오늘** — 한국시간 기준 오늘 기록 전부 (동일인 복수 기록 모두 표시)
  - **이전** — 오늘을 뺀 최근 2주(`RECENT_DAYS=14`), 한 사람(이름+학교)당 최고 기록 한 줄, 상위 50
  - **단문** — `hall_of_fame(board='danmun')`. **한 사람(이름+학교)당 최고 기록 한 줄**, 상위 20명
    (동률은 정확도 → 먼저 세운 순. 저장·조회가 같은 정렬 계약을 쓴다)
- 단문 완료 시 오늘 기록과 전당에 **한 번의 요청으로 함께** 저장된다(부분 실패가 없다).
  저장에 실패하면 완료 화면에 "다시 저장" 버튼이 뜬다

### 내가 쓴 글 (입력칸)
- 글자 띠 아래에 지금까지 입력한 내용을 입력칸처럼 표시 — `src/kit/TypedBox.jsx`
- **한 단위를 성공하면 비워진다** — 자리연습은 자모 하나, 낱말연습은 낱말 하나
  (완성된 글자를 0.16초 번쩍 보여 준 뒤 지움. 다음 키를 치면 바로 교체)
- 낱말연습은 조합 과정이 그대로 보인다: `ㅎ → 하 → 하ㅁ → 하마` → 지워짐
- **타수는 이 성공 시점에만 계산·갱신**된다 (가만히 있어도 숫자가 떨어지지 않음)
- 단문/장문 구현 시: `<TypedBox align="left" width="100%" />` (한 문장이 들어가게 왼쪽 정렬)

### 디자인
- 종이/게임 두 테마 전환 (우하단 스위치), 라이트 고정
- 스크롤 없는 한 화면 레이아웃
- 개인 최고 갱신 시 DoneOverlay에 "🎉 개인 최고 기록!" 뱃지

### 설정(관리) 화면 — 데이터 관리
- 홈 푸터 `v 0.1` 오른쪽 ⚙ 버튼 → PIN(9956) → 탭 3개: **낱말관리 / 단문연습 / 장문연습**
- 공통 기능: 목록(단계별 필터) · 개별 등록 · 인라인 수정 · 삭제
  · 현재 내용을 업로드 형식 그대로 **xlsx 내려받기(샘플)** · 엑셀 업로드로 전체 교체 · 직전 교체 되돌리기
- 엑셀 형식 (첫 줄은 제목 행)

  | 탭 | 칸 |
  |---|---|
  | 낱말 | 8칸 = 1단계_기본, 1단계_심화, … 4단계_심화 (구글시트와 동일) |
  | 단문 | 3칸 = 1단계, 2단계, 3단계 (칸마다 문장 하나) |
  | 장문 | 3칸 = 난이도, 제목, 문장 (같은 제목끼리 적은 순서가 곧 문장 순서) |

- 서버 보호: Origin 검증 · PIN 시도 제한(10분 5회 → 429) · 교체 요청 전체 선검증 · batch 원자성
- `src/screens/AdminScreen.jsx`, `functions/api/[[path]].js`

### 단문연습 (CH.04)
- 1~3단계, 한 판에 **무작위 5문장** (직전 판에 나온 문장은 피해서 뽑는다)
- 출제 원본: D1 `sentences`(kind='danmun'). API 실패 시 `src/data/danmunSteps.js` 내장 18문장
- **입력 방식이 앞 두 화면과 다르다** — 실제 `<input>` + 한글 IME로 받는다
  (자리·낱말은 keydown을 preventDefault로 가로채 키 하나씩 판정. 단문 화면에서는 그 리스너를 걸면 안 된다)
- **화면에 들어가면 곧바로 타이핑 가능** (입력칸이 스스로 포커스를 가져온다. 어디에도 포커스가
  없는 상태에서 키를 치면 입력칸으로 데려오는 안전망도 있다)
- **1·2단계는 문장을 한 줄에 고정**한다 — 넘치면 글자 크기를 재서 줄인다(하한 15px).
  3단계는 문장이 길어 줄바꿈을 허용하되 **어절 단위로만** 끊는다
- 본보기 문장 아래 "내가 쓴 글" 칸에서 글자 단위 비교 → **틀린 글자·띄어쓰기 오류를 색 + 물결 밑줄로 표시**
  (색만으로 알리지 않는다. 초과 입력은 취소선, 조합 중인 글자는 판정 유예)
- **Enter로 문장 확정.** 조합 중 Enter·자동반복·연타는 무시. 빈 줄은 넘어가지 않는다
- 백스페이스로 고치면 감점 없음 (확정 시점의 최종 문자열로만 채점)
- 붙여넣기·드래그드롭 차단, 영문이 섞이면 "한/영 키를 눌러 주세요" 안내
- **화면 아래 키보드는 기본 숨김** (토글 버튼. 상태를 기억하지 않아 들어올 때마다 숨김)
- 90% 통과 시 다음 단계 제안(1→2→3), 왼쪽 목록에서 임의 단계 직접 선택도 가능
- 기록: `board='danmun'` 요청 **한 번**으로 서버가 `today_records` + `hall_of_fame`을 한 트랜잭션에 저장

#### 단문 문장 데이터
- 단계별 **100문장**씩 총 300문장 (D1 `sentences`, kind='danmun')
- 2026-08-19에 난이도를 한 칸씩 낮췄다
  - 1단계 = 두 어절짜리 "주어 + 동사" (6~12자). Shift가 필요한 글자(ㄲㄸㅃㅆㅉㅒㅖ)는
    8문장에만 남겼다 — 아예 없으면 나중에 처음 만났을 때 더 당황한다
  - 2단계 = 이전 1단계 (7~23자) · 3단계 = 이전 2단계 (24~41자)
  - 이전 3단계 100문장(42~71자)은 이번 판에서 빠졌다. `docs/단문_샘플_100.xlsx`에 남아 있으니
    장문연습이나 4단계를 만들 때 되살릴 수 있다
- 업로드 파일: `docs/단문_100제_v2.xlsx` (관리 화면 → 단문연습 → 엑셀 업로드)
- 재생성: `node scripts/gen-danmun-sheet.mjs` — 개수·중복·길이·Shift 비율을 스스로 검사한다

### 장문연습
- 연습 화면 미구현 (다음 범위)
- DB·관리 화면은 준비 완료: `sentences` kind='jangmun', 샘플 2편 12문장
- 단문의 `compare.js` · `SentenceInput.jsx` · 키보드 토글 · 저장 경로를 그대로 재사용하면 된다

---

## 미구현 / 다음 할 일

- [ ] **장문연습** (CH.05)
  - `kind='jangmun' AND level=? AND title=?`를 seq 순으로 이어 붙이면 수필 한 편
  - 단문 화면(`DanmunScreen.jsx`)을 본떠 만들고 `compare.js`·`SentenceInput.jsx`를 그대로 쓴다
  - 공개 API는 `?action=sentences&kind=jangmun` 분기만 추가하면 된다(지금은 400을 돌려준다)
  - 저장은 `board='jangmun'` — 서버는 이미 단문과 같은 경로로 처리한다
- [ ] **장문 명예의전당 탭** — 홈 `RANK_TABS`에 한 줄 추가 (`hall_of_fame` 테이블·API 모두 준비됨)
- [ ] **캐릭터 선택** — 콘텐츠가 없어서 보류
- [ ] 낱말 데이터도 단문처럼 App 상태로 소유하도록 정리 (지금은 `wordSteps.js` 모듈 전역이라
      관리 화면에서 바꿔도 이미 열린 화면은 모른다. 장문 작업 때 함께 정리하는 편이 안전)

---

## 기술 스택

```
Frontend   Vite + React 18, 빌드 없는 인라인 CSS-in-JS
Hosting    Cloudflare Pages (taja-cxm.pages.dev)
API/DB     Cloudflare Pages Function + D1 (SQLite)
           functions/api/[[path]].js → db/schema.sql
낱말데이터  D1 words 테이블이 원본 (관리 화면에서 수정)
           API 실패 시 src/data/wordSteps.js 내장 데이터로 fallback
           시드: node scripts/gen-word-seed.mjs → db/seed_words.sql (787개)
문장데이터  D1 sentences 테이블 (단문/장문 공용) — db/seed_sentences.sql
           단문은 App이 levels를 상태로 들고 화면에 내려준다(관리 화면 변경이 즉시 반영)
           API 실패 시 src/data/danmunSteps.js 내장 18문장으로 fallback
기록저장   D1 직접
테스트     Vitest (105개: 한글분해·정확도·레벨연결·비교채점·출제 59 + API·스키마 46)
           API 테스트는 node:sqlite에 db/schema.sql을 적용해 제약까지 검증
```

---

## 로컬 개발 방법

```bash
cd /home/hong-notebook/works/taja

# 의존성 설치 (최초 1회)
npm install

# 개발 서버 (vite build --watch + Wrangler D1)
npm run dev:full
# → 브라우저: http://localhost:8788  ← 반드시 이 포트 사용
# 코드를 고치면 자동으로 다시 빌드된다(1~3초). 브라우저는 직접 새로고침.

# 빌드 + 배포
npm run deploy

# GitHub push
git add -A && git commit -m "..." && git push

# 테스트
npm test
```

> ⚠️ `npm run dev`(5173 포트)로 접속하면 `/api`가 HTML을 반환해 기록 저장이 안 됨.
> 반드시 `npm run dev:full` → `localhost:8788` 사용.
>
> ⚠️ 8788은 `wrangler.toml`의 `pages_build_output_dir` 때문에 **`dist/`를 서빙**한다.
> 그래서 dev:full은 `vite build --watch`로 dist를 계속 다시 굽는다(HMR 아님).
> 저장 후 빌드가 끝날 때까지 1~3초 기다렸다가 새로고침할 것.

---

## D1 스키마 관리

```bash
# 로컬 스키마 + 시드 적용 (최초 1회)
npx wrangler d1 execute taja-db --local --file=db/schema.sql
npx wrangler d1 execute taja-db --local --file=db/seed_words.sql
npx wrangler d1 execute taja-db --local --file=db/seed_sentences.sql

# 원격(실서버) 스키마 + 시드 적용
#  · 전부 IF NOT EXISTS / INSERT OR IGNORE라 기존 데이터는 그대로다
npx wrangler d1 execute taja-db --remote --file=db/schema.sql
npx wrangler d1 execute taja-db --remote --file=db/seed_words.sql
npx wrangler d1 execute taja-db --remote --file=db/seed_sentences.sql

# 원격 데이터 확인
npx wrangler d1 execute taja-db --remote --command "SELECT * FROM today_records LIMIT 10;"
```

---

## 주요 파일 구조

```
src/
  App.jsx                  라우팅 + 사용자등록 + 기록저장 흐름
  kit/
    hangul.js              두벌식 분해 (순수함수, 테스트 있음)
    keyboard.js            자판 레이아웃 + 손가락 매핑
    stats.js               타수/정확도/통과판정 (원시값 90% 기준)
    VirtualKeyboard.jsx    가상키보드 + 손가이드 + Shift 강조
    StepList.jsx           단계 선택 (기본/심화 내장)
    StatsInline.jsx        진행/타수/정확도 인라인 표시 (타수는 화면에서 받아 씀)
    TypedBox.jsx           "내가 쓴 글" 표시칸 — 자리·낱말용 (입력은 안 받는다)
    SentenceInput.jsx      "내가 쓴 글" 입력칸 — 단문·장문용 (실제 input + IME + 색칠 오버레이)
    compare.js             본보기 vs 입력 비교·채점 (순수함수, 테스트 있음)
    DoneOverlay.jsx        완료 오버레이 (다음단계 연결 + 저장 실패 시 재시도)
  data/
    wordSteps.js           낱말 fallback + 출제 함수(genWords). D1 데이터로 교체됨
    jariSteps.js           자리연습 단계 정의
    danmunSteps.js         단문 fallback + 정규화 + 무작위 출제(genDanmun)
    progress.js            레벨 연결 규칙 (90% → 다음 연습)
    api.js                 /api 호출 래퍼 (공개 + 관리자)
    user.js                localStorage 사용자/최고기록
  screens/
    JariScreen.jsx / NatmalScreen.jsx / DanmunScreen.jsx / HomeScreen.jsx
    AdminScreen.jsx        설정(PIN) → 낱말·단문·장문 관리
    PlaceholderScreen.jsx
  styles/
    base.css               종이 테마 토큰
    game-theme.css         게임 테마 오버라이드
functions/api/[[path]].js  Cloudflare Pages Function (D1 쿼리 + 관리자 API)
functions/api/api.test.js  관리자 API·스키마 회귀 검사 (node:sqlite)
db/schema.sql              D1 테이블 정의
db/seed_words.sql          낱말 시드 (scripts/gen-word-seed.mjs로 생성)
db/seed_sentences.sql      단문·장문 샘플
docs/plan_rdb_admin_v2.md  스프레드시트→RDB 전환 설계 문서
docs/plan_danmun_v2.md     단문연습 설계 문서 (구현 완료)
```
