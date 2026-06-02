# 한글 타자연습 — 프로젝트 현황

> 마지막 업데이트: 2026-06-02

---

## 배포 현황

| 항목 | 값 |
|---|---|
| 서비스 URL | https://taja-cxm.pages.dev |
| GitHub | https://github.com/nillili/taja (private) |
| Cloudflare 프로젝트 | taja (계정: ds1lph@gmail.com) |
| D1 DB 이름 | taja-db |
| D1 DB ID | b92ae9c0-3d14-408f-aa38-24a3a6c07b18 |
| Apps Script URL | https://script.google.com/macros/s/AKfycbxAcGy7vdtqLRmPVtRAJgYgzVxAnnUPnLAmxOBK2M-NH13MtOWyDBIvomwhE9sd8KKDhQ/exec |
| 구글시트 ID | 1Z4KvYs0VSUDWGNaELbIN5aTgA2iXuslOSNsxAu7K7uA |

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
- 오늘 기록 (한국시간 기준) — 동일인 복수 기록 모두 저장
- 홈 명예의전당: wpm 내림차순, 순위/이름·학교/최고타수/정확도
- `hall_of_fame` 테이블(단문/장문용) — 상위 20인, 미사용(단문/장문 미구현)

### 디자인
- 종이/게임 두 테마 전환 (우하단 스위치), 라이트 고정
- 스크롤 없는 한 화면 레이아웃
- 개인 최고 갱신 시 DoneOverlay에 "🎉 개인 최고 기록!" 뱃지

### 단문/장문
- Placeholder 상태 (콘텐츠 없음, 다음 범위)

---

## 미구현 / 다음 할 일

- [ ] **단문연습** (CH.04)
  - 구글시트에 `단문_1~4단계` 탭 추가 (낱말과 같은 구조)
  - 완성 후 단문 기록은 `hall_of_fame` (board='danmun')에 저장
- [ ] **장문연습** (CH.05) — 단문 이후
- [ ] **캐릭터 선택** — 구글시트 캐릭터 탭 비어있어서 보류
- [ ] **단문/장문 명예의전당** — 홈 랭킹 탭 추가

---

## 기술 스택

```
Frontend   Vite + React 18, 빌드 없는 인라인 CSS-in-JS
Hosting    Cloudflare Pages (taja-cxm.pages.dev)
API/DB     Cloudflare Pages Function + D1 (SQLite)
           functions/api/[[path]].js → db/schema.sql
낱말데이터  구글시트 CSV → src/data/wordSteps.js (내장 fallback)
기록저장   D1 직접 (Apps Script는 낱말데이터용으로만 사용 가능, 현재 미사용)
테스트     Vitest (22개: 한글분해·정확도·레벨연결)
```

---

## 로컬 개발 방법

```bash
cd /home/hong-notebook/works/taja

# 의존성 설치 (최초 1회)
npm install

# 개발 서버 (Vite + Wrangler D1 통합)
npm run dev:full
# → 브라우저: http://localhost:8788  ← 반드시 이 포트 사용

# 빌드 + 배포
npm run deploy

# GitHub push
git add -A && git commit -m "..." && git push

# 테스트
npm test
```

> ⚠️ `npm run dev`(5173 포트)로 접속하면 `/api`가 HTML을 반환해 기록 저장이 안 됨.
> 반드시 `npm run dev:full` → `localhost:8788` 사용.

---

## D1 스키마 관리

```bash
# 로컬 스키마 적용
npx wrangler d1 execute taja-db --local --file=db/schema.sql

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
    StatsInline.jsx        진행/타수/정확도 인라인 표시
    DoneOverlay.jsx        완료 오버레이 (다음단계 연결 버튼 포함)
  data/
    wordSteps.js           낱말 데이터 (시트 기반 내장 fallback)
    jariSteps.js           자리연습 단계 정의
    progress.js            레벨 연결 규칙 (90% → 다음 연습)
    api.js                 /api 호출 래퍼 (D1)
    user.js                localStorage 사용자/최고기록
  screens/
    JariScreen.jsx / NatmalScreen.jsx / HomeScreen.jsx / PlaceholderScreen.jsx
  styles/
    base.css               종이 테마 토큰
    game-theme.css         게임 테마 오버라이드
functions/api/[[path]].js  Cloudflare Pages Function (D1 쿼리)
db/schema.sql              D1 테이블 정의
apps-script/Code.gs        구글시트 읽기/쓰기 (현재 미사용)
```
