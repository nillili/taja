# 한글 타자연습 — 프로젝트 현황

> 마지막 업데이트: 2026-08-12 (배포 완료)

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

> 구글시트/Apps Script는 더 이상 쓰지 않는다. 낱말·문장의 원본은 D1이고,
> 관리 화면(⚙ → PIN)에서 직접 고친다. `apps-script/`는 참고용 흔적이라 지워도 된다.

---

## 구현 완료된 기능

### 자리연습 (CH.02)
- 1~4단계 (기본자리 → 윗줄 → 아랫줄 → 전체+쌍자음)
- 4단계에 쌍자음 포함 (ㄲ ㄸ ㅃ ㅆ ㅉ ㅒ ㅖ) — Shift 키 강조 + 손가이드
- 두 바퀴 모두 무작위 순서 (Fisher-Yates)
- 가상 키보드 + 손가이드 (빨간 손가락 강조)

### 낱말연습 (CH.03)
- 1~4단계 × 기본/심화, 각 ~100개 단어
- 데이터 출처: 구글시트 `낱말_1_기본` 탭 → `src/data/wordSteps.js`에 내장
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
- `hall_of_fame` 테이블(단문/장문용) — 상위 20인, 미사용(단문/장문 화면 미구현)

### 내가 쓴 글 (입력칸)
- 글자 띠 아래에 지금까지 입력한 내용을 입력칸처럼 표시 — `src/kit/TypedBox.jsx`
- **한 단위를 성공하면 비워진다** — 자리연습은 자모 하나, 낱말연습은 낱말 하나
  (완성된 글자를 0.45초 보여 준 뒤 지움. 다음 키를 치면 바로 교체)
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

### 단문/장문
- 연습 화면은 아직 Placeholder (다음 범위)
- DB는 준비 완료: `sentences` 테이블 + 샘플 데이터(`db/seed_sentences.sql`)
  단문 18개(난이도별 6개), 장문 2편 12문장 — 관리 화면에서 바로 편집 가능

---

## 미구현 / 다음 할 일

> DB·관리 화면·샘플 데이터는 이미 준비돼 있다. 남은 건 **연습 화면**뿐이다.

- [ ] **단문연습** (CH.04) — 연습 화면만 만들면 됨
  - 출제: `SELECT ... FROM sentences WHERE kind='danmun' AND level=? ORDER BY RANDOM()`
  - 입력칸은 `<TypedBox align="left" width="100%" />` (한 문장이 들어가게 왼쪽 정렬)
  - 완료 기록은 `hall_of_fame` (board='danmun')에 저장
- [ ] **장문연습** (CH.05) — 단문 이후
  - 같은 `sentences` 테이블에서 `kind='jangmun' AND level=? AND title=?`를 seq 순으로 이어 붙이면 수필 한 편
- [ ] **단문/장문 명예의전당** — 홈 랭킹 탭 추가 (`hall_of_fame` 테이블은 이미 있음)
- [ ] **캐릭터 선택** — 콘텐츠가 없어서 보류

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
기록저장   D1 직접 (Apps Script는 사용 안 함)
테스트     Vitest (50개: 한글분해·정확도·레벨연결 22 + 관리자 API·스키마 28)
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

# 원격(실서버) 스키마 적용
npx wrangler d1 execute taja-db --remote --file=db/schema.sql

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
    TypedBox.jsx           "내가 쓴 글" 입력칸 (align center/left)
    DoneOverlay.jsx        완료 오버레이 (다음단계 연결 버튼 포함)
  data/
    wordSteps.js           낱말 fallback + 출제 함수(genWords). D1 데이터로 교체됨
    jariSteps.js           자리연습 단계 정의
    progress.js            레벨 연결 규칙 (90% → 다음 연습)
    api.js                 /api 호출 래퍼 (공개 + 관리자)
    user.js                localStorage 사용자/최고기록
  screens/
    JariScreen.jsx / NatmalScreen.jsx / HomeScreen.jsx
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
docs/plan_rdb_admin_v2.md  이번 작업(스프레드시트→RDB) 설계 문서
apps-script/               구글시트 연동 흔적 — 더 이상 안 씀
```
