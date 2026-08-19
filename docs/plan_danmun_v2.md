# plan_danmun_v2 — 단문연습 화면 (최종)

> 등록된 단문을 **단계별로 무작위로** 한 줄씩 제시하고, 그 아래에서 실제로 받아 쳐 보게 하는
> 연습 화면(CH.04)을 만든다.
> 기준 커밋 `b2e576b` · 조사일 2026-08-19 · 아직 구현 없음(현재 `PlaceholderScreen`).
> **이 문서가 단문연습의 유일한 플랜이다.** v1과 v1 검토서(codex)는 이 문서에 흡수하고 삭제했다.

---

## 0. v1 → v2에서 달라진 것

검토서(codex) 지적 8건 + 추가 요구 2건 + 환경 조사 결과를 반영했다.
**그대로 수용 6건, 더 나은 방법으로 바꿔 수용 2건**이다.

| 번호 | 지적 | 판단 | v2의 처리 |
|---|---|---|---|
| F-001 | 비동기 문장 로딩·관리자 변경이 이미 만들어진 연습판에 반영되지 않음 | **수용** | 문장 원본을 `App` 상태로 소유하고 `levels`·`loading`을 prop으로 내린다. 진행 중인 판은 지키고, 재시작·단계 변경부터 새 원본 (2-3, 2-7) |
| F-002 | `scoreLine()`이 **오타 글자**의 타수로 감점 → 쉬운 글자로 틀릴수록 정확도가 부풀려짐 | **수용** | 비교 cell에 `want`/`got`을 모두 남기고, 정답 자리는 **정답 글자 타수**로, `extra`만 입력 글자 타수로 센다 (2-5) |
| F-003 | IME 종료 직후 Enter·연타·자동반복이 옛 상태를 제출 | **수용(+강화)** | ref 스냅샷 + `committing` 잠금 + `e.repeat`·`keyCode 229` 차단. 다만 **빈 입력 Enter는 제출하지 않고 무시**한다 — 아래 0-1 참고 (2-6, 2-7) |
| F-004 | 강제 재포커스가 단계·토글·완료 버튼 조작을 막고 접근성이 없음 | **수용** | `onBlur` 강제 복귀 제거, 진입·문장 전환·토글 후에만 포커스. `<label>`·`aria-live`·완료 시 `disabled`. 색 외에 **물결 밑줄**을 함께 쓴다 (2-6) |
| F-005 | 기록 2회 저장의 부분 실패가 사용자에게 숨겨짐 | **변형 수용** | UI로 부분 실패를 알리는 대신 **요청을 1회로 줄이고 서버에서 원자 처리**한다. `board='danmun'` 한 번이면 서버가 `today_records`+`hall_of_fame`을 `db.batch()`로 함께 쓴다 → 부분 실패 자체가 없어진다 (2-2) |
| F-006 | "상위 20인"과 서버의 "상위 20개 기록"이 다름 | **수용** | `(name, school)`당 **최고 1줄**만 남기고 상위 20명. 동률은 `accuracy DESC → recorded_at ASC → id ASC` (2-2) |
| F-007 | 150자 문장 + 가상 키보드를 한 화면에 넣는 가정이 미검증 | **수용** | 픽셀 가정 대신 `clamp()` 글꼴 + 중앙 영역만 `overflow:auto` + 좁은 화면에서 손 그림 우선 축소 (2-11) |
| F-008 | API 응답·출제 데이터의 유효성 계약이 느슨함 | **수용** | `normalizeDanmunLevels()` 순수 함수로 검증·정규화하고 표 기반 테스트 (2-3) |
| N-001 | 데이터 버전 표시 | 부록 A로 이관 (선택) | 관리 화면에만 `updatedAt` 표시 |
| N-002 | 관리 화면에서 긴 문장 안내 | **수용(작게)** | 차단하지 않고 안내만. 학생 화면 폭을 알 수 없으므로 더 유효 (2-10) |
| OUT-001~003 | 요청ID 멱등성 / 사용자 고유ID / 이전 문장 수정 | **범위 밖 동의** | 부록 B |
| 추가 요구 ① | **DB 단문을 단계별로 무작위 출제** | 신규 반영 | `genDanmun(level, exclude)` — 매 판 셔플 + 직전 판 회피 (2-3) |
| 추가 요구 ② | **웹 배포 / Windows / 초등학생 사용** | 신규 반영 | 1-3 절 신설 + 붙여넣기 차단·한영 안내·큰 글씨·물결 밑줄·크기 무전제 레이아웃 |

### 0-1. 검토서와 다르게 정한 두 가지 (근거)

**(가) 빈 입력 Enter는 제출하지 않는다.**
검토서는 "빈 입력 Enter도 미완성 제출로 처리하되 그때 타이머를 시작"하자고 했다.
규칙으로는 일관되지만 **쓰는 사람이 초등학생**이다. Enter를 톡톡 두드리는 습관 하나로
5문장이 0점으로 끝나 버리고, 아이는 무슨 일이 일어났는지 모른다.
→ **`value`가 비어 있으면 Enter를 무시**하고 입력칸 아래에 "한 글자라도 써 보세요"를 띄운다.
한 글자만 쳐도 넘어가므로 "덜 쳐도 넘어간다"는 원칙은 유지되고,
검토서가 지적한 `startRef.current === null` 문제도 함께 사라진다(첫 글자에서 타이머가 시작하므로).

**(나) 이중 저장의 부분 실패는 UI가 아니라 서버에서 없앤다.**
검토서는 `Promise.allSettled` + "일부 저장 실패 — 다시 저장" 버튼을 제안했다.
맞는 진단이지만, **애초에 요청을 두 번 보내니까 생기는 문제**다.
`board='danmun'` 한 번을 보내고 서버가 `today_records` insert와 전당 갱신을 **하나의 `db.batch()`**
로 처리하면 부분 실패가 존재할 수 없다(D1 batch = 단일 트랜잭션 — 관리 화면 교체에서 이미 쓰는 방식).
완료 화면에는 실패/성공 한 가지 상태와 재시도 버튼 하나만 두면 된다.

---

## 1. 제작자의 의도 (왜 만드는가)

### 1-1. 지금의 상태 — 반쪽만 서 있는 계단

이 앱의 학습 계단은 **자리연습(02) → 낱말연습(03) → 단문연습(04) → 장문연습(05)** 이다.
그런데 실제로 밟을 수 있는 계단은 두 칸뿐이다. 낱말연습에서 "혜성특급", "회원혜택"까지 치고 나면
학생은 더 갈 데가 없다. 홈 메뉴에 `04 단문연습` 카드가 버젓이 있는데 눌러 보면 "준비 중"이 뜬다.
계단이 끊겨 있다는 걸 아이가 먼저 안다.

더 답답한 건 **뒷단이 이미 다 지어져 있다**는 점이다. 지난 작업에서:

- `sentences` 테이블(단문/장문 공용)이 D1에 만들어졌고 (`db/schema.sql`)
- 난이도별 단문 6개씩 18개가 시드로 들어가 있고 (`db/seed_sentences.sql`)
- 관리 화면(⚙ → PIN)에 **단문연습 탭**이 있어 엑셀 업로드·개별 등록·수정·삭제·되돌리기가
  전부 동작하고 (`src/screens/AdminScreen.jsx`, `functions/api/[[path]].js`)
- 단문 명예의전당용 `hall_of_fame(board='danmun')` 테이블과 저장·조회 API까지 이미 있다.

즉 **선생님은 문장을 등록할 수 있는데 학생은 그 문장을 칠 수가 없다.**
이번 작업은 없는 걸 새로 짓는 일이 아니라, 이미 지어 둔 뒷단에 학생용 화면 하나를 붙여 계단을 잇는 일이다.

### 1-2. 사용자가 말한 시나리오 (그대로 살려서)

- 단문연습으로 **등록된 문자열을 한 줄씩** 보여준다. 한 화면에 한 문장.
- **DB에 저장된 단문을 단계별로 무작위로 보여준다.** 같은 단계를 여러 번 해도 매번 다른 문장이
  나와야 아이가 문장을 외워서 치는 일이 없다. (외워서 치면 타자 연습이 아니라 암기 시험이 된다)
- **문장 아래에 똑같이 입력받는다.** 위에 본보기, 아래에 내가 쓴 줄 — 받아쓰기 공책의 모양.
- **글자가 틀렸거나 띄어쓰기가 틀려도 색상으로 틀렸음을 보여준다.**
  글자가 다른 것뿐 아니라 **띄어쓰기(공백)를 빠뜨리거나 더 넣은 것도** 눈에 보여야 한다.
  아이가 "어디가 틀렸지?"를 묻지 않고 스스로 알아야 한다.
- **화면 아래 키보드는 보였다 안 보였다 할 수 있고, 안 보이는 것이 기본 화면이다.**
  자리·낱말연습에서는 자판과 손 그림이 늘 떠 있었지만, 단문 단계쯤이면 자판을 보지 않고 치는
  연습(터치 타이핑)이 목적이다. 그래서 기본은 감춰 두고, 헤맬 때만 펼쳐 본다.
- **1단계가 끝나면 2, 3단계로 순차적으로 넘어갈 수 있다.**
- **임의로 선택해서 2, 3단계로 바로 갈 수도 있다.** (순차 진행과 자유 선택 둘 다)
- **점수(타수·정확도)를 계산해 명예의 전당에 기록한다.**

### 1-3. 실행 환경 — 웹 배포 · Windows · 초등학생 ★

이번에 확정된 전제다. 설계에 실제로 영향을 준다.

| 사실 | 설계에 미치는 영향 |
|---|---|
| **웹으로 배포**된다 (Cloudflare Pages, https://taja-cxm.pages.dev) | 설치가 없으니 학생은 브라우저만 연다. 첫 화면에서 바로 칠 수 있어야 하고, 실패해도 새로고침 한 번으로 복구돼야 한다 |
| 사용자는 **거의 전부 Windows** (학교 PC / 가정 PC) | 브라우저는 사실상 **Edge(Chromium) 또는 Chrome**. 둘 다 같은 엔진이라 IME 동작이 같다. macOS·모바일은 이번 검증 범위 밖(부록 B) |
| **Windows 한글 IME(MS IME)** 를 쓴다 | 한/영 전환은 **오른쪽 Alt 또는 한/영 키**. 학생이 영문 상태로 치기 시작하는 사고가 가장 잦다 → 영문이 들어오는 즉시 크게 안내한다 |
| Windows 키보드에는 **한자 키(오른쪽 Ctrl)** 가 한/영 키 옆에 있다 | 잘못 누르면 한자 후보창이 뜬다. 웹에서 막을 수 없으므로 **"한자 키를 눌렀으면 Esc를 누르세요"** 안내로 처리한다 |
| PC는 **구형이 많고, 화면 크기·확대율을 알 수 없다** (교실마다 다르고 접근성 확대가 켜진 것도 있다) | **어떤 픽셀 크기도 전제하지 않는다.** 글꼴은 `clamp()`로 늘고 줄며, 공간이 모자라면 여백 → 손 그림 → 본문 스크롤 순으로 양보한다 (2-11) |
| 사용자가 **초등학생** | ① 글씨가 커야 한다 ② 안내 문구는 쉬운 우리말로 짧게 ③ 색맹·색약 아이를 위해 **색만으로 오답을 알리지 않고 물결 밑줄을 함께** 쓴다 ④ 실수(Enter 연타·붙여넣기)에 관대하되 점수는 지켜준다 |
| 장난으로 **Ctrl+V 붙여넣기**를 할 수 있다 | 붙여넣기·드래그드롭을 막는다. 안 막으면 명예의전당이 무의미해진다 (2-6) |

### 1-4. 이번에 확정한 방향

| 갈림길 | 결정 | 이유 |
|---|---|---|
| 입력을 어떻게 받나 | **실제 입력칸(`<input>`) + 한글 IME 조합** | 띄어쓰기 오류까지 색으로 보이려면 "학생이 실제로 친 글자"를 알아야 한다. 백스페이스로 고칠 수 있고 실전 타자연습과 같다 |
| 문장 넘김 | **Enter로 확정** (틀린 채로도, 덜 친 채로도 넘어간다. 단 **빈 줄은 넘어가지 않는다**) | 실제 타자연습과 같은 호흡. 막혀서 답답한 일이 없다 |
| 기록 저장 | **`board='danmun'` 요청 1회 → 서버가 `today_records`+`hall_of_fame` 원자 저장**, 홈에 "단문" 탭 추가 | 두 곳에 남기되 부분 실패가 생길 여지를 없앤다 |
| 출제 | **단계별 무작위 5문장, 직전 판 문장은 피한다** | 외워서 치는 걸 막고, 연속으로 같은 문장이 나오는 지루함도 막는다 |

**설계를 가르는 한 줄 원칙:**
> **자리·낱말연습은 "키 하나"가 판정 단위였지만, 단문연습은 "문장 한 줄"이 판정 단위다.**
> 그래서 키를 가로채지 않고 진짜 입력칸에 받아, 줄 단위로 비교하고 줄 단위로 채점한다.

### 1-5. 이 결정이 데려오는 것 — 기존 화면과 달라지는 점

자리·낱말연습은 `window.addEventListener("keydown")`으로 키를 **가로채서**(`e.preventDefault()`)
`e.code`로 판정한다. 그래서 한/영 상태와 무관하게 동작하고, 대신 백스페이스가 없고
"내가 쓴 글"은 정답 문자열을 잘라 보여 주는 흉내였다.

단문연습은 반대로 **IME가 만들어 준 진짜 글자**를 받는다. 그래서:

- 백스페이스로 고칠 수 있다. **고쳐서 맞히면 감점 없다** — 색으로 알려 주는 목적이 "고치라"는 것이므로.
- 실제로 친 글자가 손에 잡히므로 본보기와 **글자 단위로 비교**할 수 있다.
- 대신 **한/영이 영문 상태면 한글이 안 쳐진다.** → 영문이 섞이는 즉시 크게 안내한다(1-3).
- 조합 중인 글자(`ㅈ → 조 → 좋`)는 **아직 틀렸다고 칠하지 않는다.** 조합이 끝나야 판정한다.
  안 그러면 "좋다"를 치는 내내 빨간 글씨가 번쩍여 아이를 겁준다.

---

## 2. 개발 방법

### 2-0. 무엇을 건드리나 (요약)

| 파일 | 신규/수정 | 내용 | 마이그레이션 |
|---|---|---|---|
| `functions/api/[[path]].js` | 수정 | 공개 GET `?action=sentences` 추가 · `handleSaveRecord`를 batch 원자 저장 + 1인 1줄로 교체 | 없음 |
| `functions/api/api.test.js` | 수정 | 위 두 가지 테스트 추가 | — |
| `src/data/api.js` | 수정 | `getSentences()` / `invalidateSentences()` | — |
| `src/data/danmunSteps.js` | **신규** | fallback 18문장 · `normalizeDanmunLevels()` · `genDanmun()` | — |
| `src/data/danmunSteps.test.js` | **신규** | 정규화·무작위 출제 테스트 | — |
| `src/kit/hangul.js` | 수정 | 문장부호(`. , ? ! ' " -`) 키 매핑 | — |
| `src/kit/compare.js` | **신규** | 줄 비교·채점 순수 함수 (want/got 분리) | — |
| `src/kit/compare.test.js` | **신규** | 위 함수 테스트 | — |
| `src/kit/SentenceInput.jsx` | **신규** | 투명 input + 색칠 오버레이 + IME/붙여넣기/접근성 | — |
| `src/kit/DoneOverlay.jsx` | 수정 | 선택 prop `saveState` / `onRetrySave` (기존 화면 영향 없음) | — |
| `src/screens/DanmunScreen.jsx` | **신규** | 단문연습 화면 본체 | — |
| `src/data/progress.js` | 수정 | 단문 1→2→3 순차 연결 규칙 | — |
| `src/data/progress.test.js` | 수정 | 위 규칙 테스트 | — |
| `src/App.jsx` | 수정 | 문장 원본 상태 소유 · 라우팅 · `practiceNav.screen` · 기록 저장 | — |
| `src/screens/HomeScreen.jsx` | 수정 | 명예의전당 "단문" 탭 | — |
| `src/screens/AdminScreen.jsx` | 수정 | 단문 변경 후 원본 갱신 콜백 · 긴 문장 안내 | — |
| `src/styles/base.css` | 수정 | 오답 물결 밑줄 · 좁은 화면 규칙 | — |
| `PROJECT_STATUS.md` | 수정 | 단문연습을 "구현 완료"로 이동 | — |

### 2-1. 데이터 모델 — **변경 없음**

새 테이블도 새 컬럼도 만들지 않는다. 이미 있는 것으로 전부 된다:

```sql
-- db/schema.sql (로컬·원격 모두 적용 완료)
sentences(id, kind, level, title, seq, text)
  · 단문 = kind='danmun', title='', seq=1, level 1~3, text 1~150자
  · 부분 고유 인덱스 uq_sentences_danmun_text 로 (난이도, 문장) 중복 방지
hall_of_fame(id, board, recorded_at, name, school, wpm, accuracy)
today_records(id, recorded_at, name, school, wpm, accuracy)
```

**따라서 `wrangler d1 execute`로 새로 돌릴 마이그레이션이 이번엔 없다.**
(`hall_of_fame` 저장 규칙은 바뀌지만 SQL만 바뀔 뿐 스키마는 그대로다.)

### 2-2. 서버 (`functions/api/[[path]].js`)

#### (a) 공개 GET — 문장 읽기

GET 분기(현재 `records`, `words`만 있음)에 한 줄 추가한다.
**핸들러는 반드시 `await` 한다** — 이 파일 주석에 적힌 프로젝트 함정(그냥 반환하면 DB 오류가
try/catch를 빠져나가 500 JSON이 안 된다)이 그대로 적용된다.

```js
if (action === "words") return await handleGetWords(db);
if (action === "sentences") {
  return await handleGetSentences(db, url.searchParams.get("kind") || "danmun");
}
```

```js
// ── 문장 읽기 (공개) ───────────────────────────────────────────────
// 단문: { levels: { "1": [문장…], "2": […], "3": […] }, updatedAt }
// 행이 없으면 { levels: null } → 프런트가 내장 fallback을 쓴다.
// (장문은 title·seq 묶음이라 응답 모양이 다르다 — 다음 작업에서 kind='jangmun' 분기 추가)
export async function handleGetSentences(db, kind) {
  if (kind !== "danmun") return jsonRes({ error: "unsupported kind" }, 400);
  if (!db) return jsonRes({ levels: null });

  const { results } = await db.prepare(
    "SELECT level, text FROM sentences WHERE kind = 'danmun' ORDER BY level, id"
  ).all();
  if (!results || results.length === 0) return jsonRes({ levels: null });

  const levels = {};
  for (const r of results) {
    const k = String(r.level);
    (levels[k] || (levels[k] = [])).push(r.text);
  }
  return jsonRes({ levels, updatedAt: new Date().toISOString() });
}
```

- 인증 불필요(공개). CORS는 기존 `cors()` 와일드카드 그대로.
- **정렬 계약**: `ORDER BY level, id` — 무작위는 서버가 아니라 **프런트에서** 한다.
  (`ORDER BY RANDOM()`을 쓰면 캐시가 무의미해지고 매 판마다 네트워크를 타야 한다.
  문장 18개~수백 개 규모라 통째로 받아 두고 클라이언트에서 뽑는 게 빠르고 오프라인에도 강하다.)
- 엣지케이스: DB 미연결 / 행 없음 → `{ levels: null }`. **특정 단계만 비어 있는 경우는
  그 단계를 아예 키에서 빼서** 보낸다 → 프런트가 "등록된 문장 없음" 안내로 처리한다(2-3).

#### (b) 기록 저장 — 요청 1회 · 원자 저장 · 1인 1줄 (F-005 · F-006)

현재 `handleSaveRecord`는 ① today와 danmun을 각각 다른 요청으로 받고 ② `hall_of_fame`에
insert 후 **상위 20개 row**만 남긴다(같은 학생이 여러 줄 차지 가능) ③ insert와 정리가 별도 await다.
세 가지를 한 번에 고친다.

```js
async function handleSaveRecord(db, data) {
  if (!db) return jsonRes({ ok: false, error: "DB not connected" });
  const { board, name, school, wpm, acc } = data;
  const now = new Date().toISOString();
  if (!name || !school || !wpm) {
    return jsonRes({ ok: false, error: "missing required fields" }, 400);
  }
  const w = Number(wpm), a = Number(acc);

  if (board === "today") {
    // 자리·낱말연습: 오늘 기록만 (기존 동작 그대로)
    await db.prepare(
      `INSERT INTO today_records (recorded_at, name, school, wpm, accuracy) VALUES (?,?,?,?,?)`
    ).bind(now, name, school, w, a).run();

  } else if (board === "danmun" || board === "jangmun") {
    // 단문·장문: 오늘 기록 + 명예의전당을 하나의 트랜잭션으로.
    // 전당은 (이름, 학교)당 최고 기록 한 줄만 남긴다 → 화면의 "상위 20인"과 뜻이 맞는다.
    await db.batch([
      db.prepare(
        `INSERT INTO today_records (recorded_at, name, school, wpm, accuracy) VALUES (?,?,?,?,?)`
      ).bind(now, name, school, w, a),

      // 이번 기록이 더 좋으면(또는 같으면) 이 사람의 옛 기록을 지운다
      db.prepare(
        `DELETE FROM hall_of_fame
          WHERE board=? AND name=? AND school=?
            AND (wpm < ? OR (wpm = ? AND accuracy <= ?))`
      ).bind(board, name, school, w, w, a),

      // 더 좋은 기록이 남아 있지 않을 때만 새로 넣는다 (SQLite는 FROM 없는 SELECT+WHERE 허용)
      db.prepare(
        `INSERT INTO hall_of_fame (board, recorded_at, name, school, wpm, accuracy)
         SELECT ?,?,?,?,?,?
          WHERE NOT EXISTS (
            SELECT 1 FROM hall_of_fame WHERE board=? AND name=? AND school=?
          )`
      ).bind(board, now, name, school, w, a, board, name, school),

      // 상위 20명만 유지 (동률: 정확도 높은 순 → 먼저 세운 순 → id)
      db.prepare(
        `DELETE FROM hall_of_fame
          WHERE board=? AND id NOT IN (
            SELECT id FROM hall_of_fame WHERE board=?
             ORDER BY wpm DESC, accuracy DESC, recorded_at ASC, id ASC LIMIT 20)`
      ).bind(board, board),
    ]);
  } else {
    return jsonRes({ ok: false, error: "invalid board" }, 400);
  }
  return jsonRes({ ok: true });
}
```

- **조회 쪽 정렬도 같은 계약으로 맞춘다**: `handleGetRecords`의 전당 분기를
  `ORDER BY wpm DESC, accuracy DESC, recorded_at ASC, id ASC`로 바꾼다(현재는 `wpm DESC`만).
  안 맞추면 동률일 때 순위가 흔들려 보인다.
- 남는 한계(검토서 OUT-002 동의): 사용자 식별자가 `name + school`뿐이라 **동명이인·같은 학교면
  한 사람으로 합쳐진다.** 현재 사용자 모델(`src/data/user.js`, localStorage)에 고유 ID가 없어서
  이번 범위에서는 받아들인다.
- `?action=records&board=danmun` 조회 경로는 **이미 있다**(`handleGetRecords` else 분기).

### 2-3. 프런트 데이터 계층

#### (a) `src/data/danmunSteps.js` (신규)

```js
import { shuffle } from "../kit/shuffle.js";

// db/seed_sentences.sql의 단문 18개를 그대로 구워 넣는다 (API 실패·오프라인 대비)
export const DANMUN_LEVELS = {
  "1": ["하늘이 맑다.", "오늘도 좋은 날이다.", /* … seed 1단계 6개 */],
  "2": [/* seed 2단계 6개 */],
  "3": [/* seed 3단계 6개 */],
};

export const DANMUN_STEPS = [
  { id: 1, name: "1단계", sub: "짧은 문장" },
  { id: 2, name: "2단계", sub: "조금 긴 문장" },
  { id: 3, name: "3단계", sub: "길고 복잡한 문장" },
];

export const LINES_PER_ROUND = 5;      // 한 판에 치는 문장 수
const MAX_LEN = 150;                   // 스키마 CHECK와 같은 값

/**
 * 서버 응답을 믿지 않고 정규화한다 (F-008).
 * - null/비객체/빈 객체 → null (호출부가 fallback 전체를 쓴다)
 * - 유효한 단계만 남긴다: 키 "1"|"2"|"3", 값은 문자열 배열, 각 항목 1~MAX_LEN자
 * - 서버가 어떤 단계를 비워 보냈다면 그 단계는 빈 배열로 유지한다(관리자 의도 보존)
 * - 걸러낸 개수는 dev에서만 console.warn
 */
export function normalizeDanmunLevels(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const out = {};
  let dropped = 0, kept = 0;
  for (const k of ["1", "2", "3"]) {
    if (!(k in raw)) continue;                 // 아예 안 온 단계는 만들지 않는다
    const list = Array.isArray(raw[k]) ? raw[k] : (dropped++, []);
    out[k] = list.filter((s) => {
      const ok = typeof s === "string" && s.trim().length > 0 && s.length <= MAX_LEN;
      if (!ok) dropped++;
      return ok;
    }).map((s) => s.trim());
    kept += out[k].length;
  }
  if (Object.keys(out).length === 0) return null;
  if (dropped && import.meta.env?.DEV) {
    console.warn(`[danmun] 형식이 맞지 않아 제외한 문장 ${dropped}개 (사용 ${kept}개)`);
  }
  return out;
}

/**
 * ★ 단계별 무작위 출제.
 * - 매 판 Fisher-Yates로 섞어 LINES_PER_ROUND개를 뽑는다 → 같은 단계를 다시 해도 매번 다르다
 * - exclude(직전 판 문장)는 되도록 피한다. 남는 문장이 모자라면 제외 규칙을 푼다
 *   (문장이 6개뿐인 단계에서 5개를 제외하면 뽑을 게 없으므로)
 * - 등록된 문장이 없으면 빈 배열 → 화면이 "문장 없음" 안내를 띄운다
 */
export function genDanmun(levels, level, exclude = []) {
  const all = (levels && levels[String(level)]) || [];
  if (all.length === 0) return [];
  const ex = new Set(exclude);
  let pool = all.filter((s) => !ex.has(s));
  if (pool.length < Math.min(LINES_PER_ROUND, all.length)) pool = all;
  return shuffle(pool).slice(0, LINES_PER_ROUND);
}
```

> **왜 모듈 전역(`ACTIVE`)을 두지 않는가 (F-001)**
> `wordSteps.js`는 `setWordSource()`로 모듈 변수를 갈아끼운다. 이 방식은 이미 마운트된 화면이
> 모른 채 지나가서, "관리자가 바꿨는데 연습 화면은 옛 문장"이 된다. 단문은 `levels`를
> **`App`의 상태로 소유하고 prop으로 내린다.** `genDanmun`도 `levels`를 인자로 받는 순수 함수라
> 테스트가 쉽다. (낱말 쪽은 이번에 건드리지 않는다 — 범위 밖)

#### (b) `src/data/api.js`

```js
import { DANMUN_LEVELS, normalizeDanmunLevels } from "./danmunSteps.js";

let _sentCache = null;
// 반환: { levels, source: "server" | "fallback", updatedAt }
export async function getSentences() {
  if (_sentCache) return _sentCache;
  const data = await apiFetch("sentences", { kind: "danmun" });
  const norm = data ? normalizeDanmunLevels(data.levels) : null;
  _sentCache = norm
    ? { levels: norm, source: "server", updatedAt: data.updatedAt || null }
    : { levels: DANMUN_LEVELS, source: "fallback", updatedAt: null };
  return _sentCache;
}
export function invalidateSentences() { _sentCache = null; }
```

- **API 전체 실패(`data === null`)나 `levels === null`일 때만 fallback 전체**를 쓴다.
- 서버가 일부 단계만 보냈으면 그대로 존중한다(빈 단계는 빈 단계로).

#### (c) `src/App.jsx` — 문장 원본을 상태로 소유 (F-001)

```js
const [danmun, setDanmun] = useState({ levels: null, loading: true });

useEffect(() => {
  let alive = true;
  getSentences().then((r) => alive && setDanmun({ levels: r.levels, loading: false }));
  return () => { alive = false; };
}, []);

// 관리 화면이 문장을 바꾸면 이 콜백으로 원본을 새로 올린다
const reloadDanmun = async () => {
  invalidateSentences();
  const r = await getSentences();
  setDanmun({ levels: r.levels, loading: false });
};
```

낱말은 지금처럼 `getWords().then(setWordSource)`를 유지한다(이번 범위 밖).

### 2-4. `src/kit/hangul.js` — 문장부호 타수 보정 (작지만 필수)

현재 `charToKeys()`는 한글 음절·자모·공백만 처리하고 **나머지는 `[]`를 돌려준다.**
시드 문장에는 마침표 30개, 쉼표 1개가 있어 이대로면 마침표가 **0타로 계산**되고
가상 키보드도 마침표에서 강조할 키를 못 찾는다. 자판 레이아웃(`keyboard.js`)에
`Period`·`Comma`·`Slash`·`Quote`·`Minus`·`Digit1` 키와 손가락 매핑이 이미 있으므로 매핑만 더한다.

```js
const PUNCT = {
  ".": { code: "Period", shift: false },
  ",": { code: "Comma",  shift: false },
  "?": { code: "Slash",  shift: true  },
  "!": { code: "Digit1", shift: true  },
  "'": { code: "Quote",  shift: false },
  '"': { code: "Quote",  shift: true  },
  "-": { code: "Minus",  shift: false },
};
// charToKeys() 안, 공백 처리 옆에
if (PUNCT[ch]) return [{ ...PUNCT[ch], jamo: ch }];
```

- 기존 `hangul.test.js`는 한글만 다루므로 영향 없다.
- 여전히 매핑에 없는 글자(괄호·영문 등)는 `[]` → 채점에서 **최소 1타로 세는 보정**을 둔다(2-5).

### 2-5. `src/kit/compare.js` (신규) — 비교·채점 (F-002 반영)

```js
import { charToKeys } from "./hangul.js";

// 글자 하나의 타수 (문장부호·미매핑 글자도 최소 1타)
export const countKeys = (ch) => Math.max(1, charToKeys(ch).length);
export const countLineKeys = (text) => [...text].reduce((n, ch) => n + countKeys(ch), 0);

/**
 * 본보기(target)와 입력(typed)을 앞에서부터 같은 자리끼리 비교한다.
 * 정렬 보정(LCS)은 하지 않는다 — 한 글자를 빠뜨리면 뒤가 모두 어긋나 보이지만,
 * 초등 학습자에게는 "지우고 다시"가 오히려 명확하다.
 * composing=true면 입력의 마지막 글자는 조합 중이라 판정을 미룬다.
 *
 * 반환: [{ want, got, ch, state }]
 *   want  이 자리의 정답 글자 (초과 입력이면 undefined)  ← 채점은 언제나 want 기준
 *   got   이 자리에 실제로 친 글자 (안 쳤으면 undefined)
 *   ch    화면에 그릴 글자 (got ?? want)
 *   state pending | correct | wrong | extra | composing
 */
export function compareLine(target, typed, composing = false) {
  const t = [...target], u = [...typed];
  const cells = [];
  for (let i = 0; i < Math.max(t.length, u.length); i++) {
    const want = t[i], got = u[i];
    let state;
    if (got === undefined)       state = "pending";
    else if (want === undefined) state = "extra";
    else if (composing && i === u.length - 1) state = "composing";
    else state = got === want ? "correct" : "wrong";
    cells.push({ want, got, ch: got ?? want, state });
  }
  return cells;
}

/**
 * 문장 확정(Enter) 시의 채점. 자모(타) 단위.
 * ★ F-002: 정답 자리(correct/wrong/pending)는 **정답 글자(want)의 타수**로 센다.
 *   그래야 "값"을 "가"로 틀리든 "값"으로 맞히든 그 자리의 무게가 같다.
 *   초과 입력(extra)만 실제로 더 친 글자(got)의 타수를 더한다.
 * 안 친 자리(pending)도 틀린 것으로 센다 — 덜 치고 넘어가면 그만큼 감점.
 */
export function scoreLine(target, typed) {
  let correct = 0, wrong = 0;
  for (const c of compareLine(target, typed, false)) {
    if (c.state === "extra") { wrong += countKeys(c.got); continue; }
    const n = countKeys(c.want);
    if (c.state === "correct") correct += n; else wrong += n;
  }
  return { correct, wrong };
}
```

**왜 자모(타) 단위인가:** 자리·낱말연습의 `stats.correct/wrong`도 "키 입력 1회 = 1"이다.
같은 단위를 써야 `calcCpm()`·`displayAccuracy()`(`src/kit/stats.js`)를 그대로 재사용하고
명예의전당 타수가 다른 연습과 같은 잣대가 된다. **`stats.js`는 손대지 않는다.**

### 2-6. `src/kit/SentenceInput.jsx` (신규) — "내가 쓴 글" 입력칸

`TypedBox.jsx`는 표시 전용이라 그대로 못 쓴다. 대신 **생김새(높이 46, 2px 테두리,
`var(--paper)` 바탕, `Noto Serif KR`, 라벨 "내가 쓴 글")를 그대로 따라 해** 이질감을 없앤다.

구조: **보이지 않는 진짜 `<input>` 위에 색칠한 글자들을 겹쳐 그린다.**

```jsx
<div className="sent-input-wrap" onPointerDown={focusInput}>
  <label htmlFor="danmun-input" className="typed-label">내가 쓴 글</label>
  <input
    id="danmun-input" ref={inputRef} type="text"
    value={value}
    disabled={disabled}                       /* 완료·빈 단계에서 잠근다 (F-004) */
    onChange={(e) => onChange(e.target.value)}
    onCompositionStart={() => { composingRef.current = true; setComposing(true); }}
    onCompositionEnd={(e) => {                /* ★ 값까지 함께 동기화 (F-003) */
      composingRef.current = false; setComposing(false); onChange(e.currentTarget.value);
    }}
    onKeyDown={onKeyDown}
    onPaste={(e) => e.preventDefault()}       /* ★ 붙여넣기 차단 (1-3) */
    onDrop={(e) => e.preventDefault()}
    onCopy={(e) => e.preventDefault()}
    spellCheck={false} autoComplete="off" autoCorrect="off" autoCapitalize="off"
    aria-describedby="danmun-hint"
    style={{ position:"absolute", inset:0, width:"100%", height:"100%",
             opacity:0, border:0, background:"transparent", font:"inherit",
             caretColor:"transparent" }}      /* 안 보이지만 진짜 입력칸 */
  />
  <div className="sent-input-view" aria-hidden="true">
    {cells.map(...)/* state별 색·밑줄 */}
    <span className="typed-caret" />          {/* 기존 CSS 커서 재사용 */}
  </div>
  <div id="danmun-hint" role="status" aria-live="polite">{hint}</div>
</div>
```

표시 규칙 — **색과 형태를 함께 쓴다**(색약 아동 배려, F-004):

| state | 표시 |
|---|---|
| `correct` | `var(--ink)` |
| `wrong` | `#ef4444` + 배경 `rgba(239,68,68,0.14)` + **빨간 물결 밑줄**(`text-decoration: underline wavy`). **공백이면 글자가 없으므로 폭 0.5em짜리 빨간 블록**을 그려 띄어쓰기 오류가 눈에 보이게 한다 |
| `extra` | `#ef4444` + 취소선 (본보기보다 길게 친 부분) |
| `composing` | `var(--ink)` + 점선 밑줄 (판정 유예 중이라는 표시) |
| `pending` | 렌더하지 않음 (입력칸에는 친 것만 보인다. 남은 글자는 위 본보기 줄에 옅게 있다) |

- 정렬 왼쪽, 폭 100%. 길어지면 `scrollLeft = scrollWidth`로 끝이 보이게(TypedBox와 동일).
- **포커스 정책 (F-004)** — 무조건 되돌리지 않는다:
  - 최초 진입, 문장 전환 직후, **입력 표시 영역을 포인터로 눌렀을 때**, 키보드 토글을 누른 뒤에만 focus.
  - `onBlur` 강제 복귀는 **넣지 않는다.** 넣으면 Tab으로 단계 버튼·토글·완료 버튼에 갈 수 없다.
  - `phase === "done"` 이거나 문장이 없으면 `disabled`, 완료 오버레이의 첫 버튼으로 포커스를 옮긴다.
    (`DoneOverlay`의 `autoFocus`는 **단문에서만** 켠다 — 자리·낱말은 지금 동작 그대로 두어야 한다.
    거기서 켜면 완료 후 Enter가 "다시 시작"을 눌러 버린다.)
  - **커서는 언제나 문장 끝에 둔다.** 마우스로 가운데를 눌러 커서가 안쪽에 놓이면 실제 입력 위치와
    화면에 그린 캐럿이 어긋나 학생이 혼란스럽다. 단 **조합 중에는 절대 건드리지 않는다**(조합이 깨진다).
- **프로젝트 함정:** 자리·낱말연습은 `window` keydown을 `preventDefault()`로 가로챈다.
  **단문 화면에서는 그 리스너를 절대 걸지 않는다.** (걸면 IME 입력이 전부 막힌다.)
  눌린 키 표시용 keydown은 `preventDefault` 없이 **읽기만** 한다(2-7).

### 2-7. `src/screens/DanmunScreen.jsx` (신규) — 화면 본체

레이아웃 골격은 `NatmalScreen.jsx`를 따른다(최대폭 1180, 좌측 `StepList`).

```
┌───────────────────────────────────────────────────────────┐
│ CH. 04  단문연습            [진행 2/5 문장] [타수 214] [정확도 96%] │
├──────────┬────────────────────────────────────────────────┤
│ 단계 선택 │            (본보기 문장 — 크게, 한두 줄)           │
│ ● 1단계  │        오늘도 좋은 날이다.                        │
│   2단계  │        ‾‾‾‾ 친 데까지 옅게, 지금 칠 글자에 밑줄     │
│   3단계  │                                                │
│          │  내가 쓴 글                                     │
│          │ ┌────────────────────────────────────────────┐ │
│          │ │ 오늘도 조은 날이다▏   ← 틀린 글자 빨강+물결      │ │
│          │ └────────────────────────────────────────────┘ │
│          │  Enter를 누르면 다음 문장                         │
├──────────┴────────────────────────────────────────────────┤
│                   [ ⌨ 키보드 보기 ]   ← 기본 접힘            │
└───────────────────────────────────────────────────────────┘
```

#### props / 상태

```js
export default function DanmunScreen({ levels, loading, initialStep = 1, onDone, onNext })

const [step, setStep]   = useState(initialStep);
const [lines, setLines] = useState([]);     // 이 판의 문장 5개 (스냅샷)
const [idx, setIdx]     = useState(0);
const [value, setValue] = useState("");
const [composing, setComposing] = useState(false);
const [phase, setPhase] = useState("ready");   // ready → playing → done
const [stats, setStats] = useState({ correct: 0, wrong: 0 });  // 자모 단위 누적
const [elapsed, setElapsed] = useState(0);
const [cpm, setCpm] = useState(0);
const [showKeyboard, setShowKeyboard] = useState(false);   // ★ 기본 숨김
const startRef = useRef(null);
const committingRef = useRef(false);
// F-003: 제출 함수는 state가 아니라 ref 스냅샷만 읽는다
const live = useRef({}); live.current = { value, idx, lines, stats, phase, composing };
```

#### 원본 로딩과 판 만들기 (F-001)

```js
// levels가 준비되면(또는 단계가 바뀌면) 판을 만든다. 진행 중인 판은 건드리지 않는다.
useEffect(() => {
  if (loading || !levels) return;
  if (phase === "playing") return;             // 치는 중이면 스냅샷 유지
  setLines(genDanmun(levels, step));           // ready 판은 새 원본으로 다시 만든다
  setIdx(0); setValue("");
}, [levels, loading, step]);   // eslint-disable-line react-hooks/exhaustive-deps
```

- `loading`이면 본보기 자리에 "문장을 가져오는 중이에요…" — **fallback 판이 먼저 시작되지 않는다.**
- 관리자가 문장을 바꿔 `levels`가 새로 내려오면: **치는 중이면 그대로 두고**,
  아직 시작 전이거나 다시 시작·단계 변경을 하면 새 문장으로 만든다.
- `restart()`는 `genDanmun(levels, step, lines)` — **직전 판 문장을 피해** 새로 뽑는다(무작위 출제).

#### 진행 흐름

1. **첫 글자 입력** → `phase==="ready"`면 `startRef.current = Date.now(); setPhase("playing")`.
   (`playing`일 때만 0.5초 타이머로 `elapsed` 갱신 — 기존 두 화면과 같은 패턴)
2. **입력 중** → `compareLine(lines[idx], value, composing)`로 색칠. 백스페이스 자유.
3. **Enter** → 문장 확정:

```js
const onKeyDown = (e) => {
  if (e.key !== "Enter") return;
  // ★ F-003: 조합 중 Enter는 IME 확정용 — 절대 제출하지 않는다 (Windows MS IME 필수)
  if (e.nativeEvent.isComposing || e.keyCode === 229 || live.current.composing) return;
  if (e.repeat) return;                         // Enter 길게 누르기(자동 반복) 차단
  e.preventDefault();
  if (committingRef.current) return;            // 연타 재진입 차단
  if (!live.current.value) { setHint("한 글자라도 써 보세요"); return; }  // ★ 빈 줄은 안 넘어감
  committingRef.current = true;
  commitLine();
  requestAnimationFrame(() => { committingRef.current = false; });
};
```

```js
function commitLine() {
  const { value, idx, lines, stats } = live.current;
  const { correct, wrong } = scoreLine(lines[idx], value);
  const sec = (Date.now() - startRef.current) / 1000;
  const total = { correct: stats.correct + correct, wrong: stats.wrong + wrong };
  setStats(total); setElapsed(sec);
  setCpm(calcCpm(total.correct, sec));   // 확정 시점에만 갱신 (가만히 있어도 안 떨어짐)
  setValue("");
  if (idx + 1 >= lines.length) setPhase("done"); else setIdx(idx + 1);
}
```

4. **완료** → `NatmalScreen`과 같은 `doneFiredRef` 패턴으로 `onDone(result)` 1회 호출 + `DoneOverlay`.
   `result = { screen:"danmun", step, mode:null, wpm, acc, correct, wrong }`.

#### 본보기 문장

```jsx
<div className="danmun-target">      /* clamp() 글꼴, flexWrap, overflow-wrap:anywhere */
  {[...lines[idx]].map((ch, i) => (
    <span key={i} className={
      i <  value.length ? "is-done" :
      i === value.length ? "is-now"  : ""}>{ch === " " ? " " : ch}</span>
  ))}
</div>
```
지나온 글자는 옅게, 지금 칠 글자에 밑줄. 150자까지 오므로 두 줄까지 자연스럽게 접힌다(2-11).

#### 단계 선택 — 순차 + 임의 둘 다

- **임의 선택:** 좌측 `StepList`(기존 컴포넌트, `modes` 없이) → `selectStep(id)`가 판을 새로 만든다.
- **순차 진행:** 완료 시 원시 정확도 90% 이상이면 `DoneOverlay`에 "2단계로 넘어갈까요?".
  규칙은 화면이 아니라 `src/data/progress.js`에 둔다(기존 방침):

```js
if (result.screen === "danmun" && result.step < 3) {
  return { screen: "danmun", step: result.step + 1, mode: null,
           label: `${result.step + 1}단계로 넘어갈까요?` };
}
```

#### 키보드 토글 (기본 숨김)

```jsx
<button type="button" className="kb-toggle" aria-expanded={showKeyboard}
        onClick={() => { setShowKeyboard(v => !v); focusInput(); }}>
  {showKeyboard ? "⌨ 키보드 숨기기" : "⌨ 키보드 보기"}
</button>
{showKeyboard && (
  <VirtualKeyboard targetCode={targetCode} shiftCode={shiftCode}
                   pressedCode={pressedCode} showHands={roomForHands} />
)}
```

- 접었을 때 높이 0 — 본문이 `flex:1`로 흡수한다. 펼치면 본보기 영역이 줄어든다.
- **토글 상태는 저장하지 않는다** → 들어올 때마다 항상 숨김이 기본(요구사항 그대로).
- 토글 직후 입력칸으로 포커스를 되돌려 곧바로 이어 칠 수 있게 한다.
- 다음에 눌러야 할 키(펼쳤을 때만 의미 있음):
  ```js
  const flat = useMemo(() => decomposeWord(lines[idx] || "").flat, [lines, idx]);
  const target = flat[countLineKeys(value)] || null;   // 지금까지 친 타수(근사)
  const targetCode = target?.code ?? null;
  const shiftCode = target?.shift
    ? ((FINGER[targetCode] || "").startsWith("R") ? "ShiftLeft" : "ShiftRight") : null;
  ```
  틀리게 치는 동안엔 어긋날 수 있으나 보조 안내이므로 근사로 충분하다.
- 눌린 키 표시는 `window` keydown을 **읽기만** 한다(`preventDefault` 없음):
  ```js
  useEffect(() => {
    if (!showKeyboard) return;                 // 펼쳤을 때만 듣는다
    const on = (e) => { setPressedCode(e.code); clearTimeout(ref.current);
                        ref.current = setTimeout(() => setPressedCode(null), 110); };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, [showKeyboard]);
  ```
  (Windows IME 조합 중에도 `e.code`는 정상적으로 온다. `e.keyCode`는 229라 쓰면 안 된다.)

#### 안내 문구 (Windows·초등 대응, 1-3)

| 조건 | 문구 | 표시 |
|---|---|---|
| 입력에 영문이 섞임 `/[A-Za-z]/` | **"한/영 키를 눌러 한글로 바꿔 주세요"** (키보드 오른쪽 아래 `한/영` 또는 오른쪽 `Alt`) | 입력칸 아래, `var(--stamp)` 색, 큰 글씨. `aria-live="polite"` |
| 빈 줄에서 Enter | "한 글자라도 써 보세요" | 같은 자리, 2초 후 사라짐 |
| 그 단계에 문장이 없음 | "이 단계에는 아직 문장이 없어요. 선생님께 말씀드려 주세요." | 본보기 자리, 입력칸 `disabled` |
| 로딩 중 | "문장을 가져오는 중이에요…" | 본보기 자리 |
| 한자 후보창이 뜬 것으로 보일 때(판단 불가) | 화면 하단 상시 도움말에 **"한자 키를 눌렀으면 Esc를 누르세요"** 한 줄 | 작은 글씨 상시 |

### 2-8. `src/App.jsx`

```jsx
// 1) 화면 연결 (PlaceholderScreen에서 떼어낸다)
if (screen === "danmun") return (
  <DanmunScreen
    key={practiceNav?.screen === "danmun" ? `danmun-${practiceNav.step}` : "danmun"}
    initialStep={practiceNav?.screen === "danmun" ? practiceNav.step : 1}
    levels={danmun.levels} loading={danmun.loading}
    onDone={handleDone} onNext={handleNext}
  />
);
```

```js
// 2) 기록 저장 — 단문은 board="danmun" 한 번이면 서버가 today까지 함께 쓴다 (2-2)
const [saveState, setSaveState] = useState(null);   // null | "saving" | "saved" | "failed"
const lastPayload = useRef(null);

const handleDone = (result) => {
  if (!result || result.wpm === 0) return;
  updateBestIfHigher(result);
  if (!user) return;
  const payload = {
    board: result.screen === "danmun" ? "danmun" : "today",
    name: user.name, school: user.school,
    wpm: result.wpm, acc: result.acc,
    screen: result.screen, step: result.step, mode: result.mode ?? null,
  };
  lastPayload.current = payload;
  setSaveState("saving");
  saveRecord(payload).then((r) => setSaveState(r && r.ok ? "saved" : "failed"));
};
const retrySave = () => {
  if (!lastPayload.current) return;
  setSaveState("saving");
  saveRecord(lastPayload.current).then((r) => setSaveState(r && r.ok ? "saved" : "failed"));
};
```

`DoneOverlay`에는 **선택 prop**으로 넘긴다(`saveState`, `onRetrySave`) — 없으면 아무것도 안 그리므로
자리·낱말 화면은 지금 그대로다. 실패했을 때만 작게 "기록을 저장하지 못했어요 [다시 저장]".

```js
// 3) 다음 단계 이동
if (next.screen === "danmun") {
  setPracticeNav({ screen: "danmun", step: next.step, mode: null });
  setScreen("danmun");
}
```

> ⚠ 지금 `practiceNav`는 낱말 전용이라 `{step, mode}`만 담는다. 단문이 끼면 화면 구분이 필요하니
> **`practiceNav`에 `screen`을 함께 담고**, `natmal`의 `key`/`initialStep` 계산도
> `practiceNav?.screen === "natmal"` 조건으로 바꾼다. (안 바꾸면 단문 2단계로 넘어간 뒤
> 낱말 화면의 key가 엉킨다.)

### 2-9. `src/screens/HomeScreen.jsx` — 명예의전당 "단문" 탭

`RANK_TABS`에 한 줄 추가. 조회 API(`fetchRecords("danmun")` → `hall_of_fame`)는 이미 동작한다.

```js
{ id: "danmun", label: "단문", aside: "단문 명예의 전당 (한 사람당 최고 기록)",
  empty: "아직 단문연습 기록이 없어요. 첫 주인공이 되어 보세요!" },
```

- 탭이 3개가 되므로 `.rank-tabs` 언더라인 CSS(활성 탭에만 `margin-bottom:-2px`)가
  3개에서도 어긋나지 않는지 확인한다.

### 2-10. `src/screens/AdminScreen.jsx`

- 단문 추가·수정·삭제·전체 교체·되돌리기가 **성공한 뒤** `props.onSentencesChanged?.()`
  (= `App`의 `reloadDanmun`)을 호출한다. 낱말 쪽 `invalidateWords()+setWordSource()` 자리
  (`AdminScreen.jsx:202-203`)와 같은 위치·같은 방식이다.
- **긴 문장 안내(N-002):** 저장을 막지는 않되, 60자를 넘으면 목록에 옅은 안내를 붙인다 —
  "학생 화면에서 두 줄로 보일 수 있어요". 학생 PC의 화면 폭을 알 수 없다는 근거를 주석에 남긴다.

### 2-11. 좁은 화면·확대 대응 (F-007)

기준 환경: **구형 Windows PC. 화면 크기도 확대율도 알 수 없다고 본다** — 특정 해상도를 겨냥해
픽셀을 맞추는 대신, 좁아지면 순서대로 양보하도록 짠다.

- 본보기·입력 글꼴은 고정 px 대신 `clamp()`:
  `font-size: clamp(20px, 2.4vw + 8px, 34px)` / 입력칸 `clamp(16px, 1.8vw + 6px, 22px)`
- 본보기 문단에 `overflow-wrap: anywhere; word-break: keep-all;` (한국어 줄바꿈이 어절 단위로)
- **중앙 연습 영역에만** `overflow-y: auto`를 허용한다. 페이지 전체(`.page`)는 지금처럼
  스크롤이 없다. 극단적 확대에서 "잘려서 안 보임"보다 "안쪽에서 조금 스크롤"이 낫다.
- ⚠ **함정:** 중앙 영역(`.danmun-main`)에 `min-height: 0`을 반드시 준다. flex 자식은 기본이
  `min-height:auto`라 콘텐츠보다 작아지지 않아서, 이게 없으면 키보드를 펼쳤을 때 본문이 안 줄고
  자판 아래가 화면 밖으로 잘린다. (실제로 구현 중 이 증상을 확인하고 넣었다)
- 키보드를 펼쳤을 때 세로 여유가 모자라면 **손 그림을 먼저 숨긴다**(`showHands={roomForHands}`,
  `roomForHands = 가용높이 > 임계값`). 자판만 남아도 목적(키 위치 찾기)은 달성된다.
- 새 미디어쿼리는 `base.css` 맨 아래에 모아 둔다(현재 이 프로젝트에는 `@media`가 하나도 없다 —
  처음 들어가는 것이므로 위치를 한곳으로 정해 둔다).

### 2-12. 변경 파일 체크리스트

- [ ] `functions/api/[[path]].js` — `action=sentences` 분기 + `handleGetSentences` + `handleSaveRecord` 재작성 + 전당 조회 정렬
- [ ] `functions/api/api.test.js` — 위 항목 테스트
- [ ] `src/data/danmunSteps.js` / `src/data/danmunSteps.test.js` — 신규
- [ ] `src/data/api.js` — `getSentences` / `invalidateSentences`
- [ ] `src/kit/hangul.js` — `PUNCT` 매핑
- [ ] `src/kit/compare.js` / `src/kit/compare.test.js` — 신규
- [ ] `src/kit/SentenceInput.jsx` — 신규
- [ ] `src/kit/DoneOverlay.jsx` — `saveState`/`onRetrySave` 선택 prop
- [ ] `src/screens/DanmunScreen.jsx` — 신규
- [ ] `src/data/progress.js` / `progress.test.js` — 단문 순차 규칙
- [ ] `src/App.jsx` — 문장 원본 상태 · 라우팅 · `practiceNav.screen` · 저장 상태
- [ ] `src/screens/HomeScreen.jsx` — "단문" 랭킹 탭
- [ ] `src/screens/AdminScreen.jsx` — 변경 콜백 · 긴 문장 안내
- [ ] `src/styles/base.css` — 물결 밑줄 · `clamp()` · 좁은 화면 규칙
- [ ] `PROJECT_STATUS.md` — 단문연습을 "구현 완료"로 이동

---

## 3. 테스트 방법

### 3-1. 로컬 준비

```bash
cd /home/hong-notebook/works/taja
npm install                      # 최초 1회

# 로컬 D1에 스키마·시드가 없다면 (이미 했다면 건너뜀)
npx wrangler d1 execute taja-db --local --file=db/schema.sql
npx wrangler d1 execute taja-db --local --file=db/seed_sentences.sql

npm run dev:full                 # → http://localhost:8788  ← 반드시 8788
```

> ⚠ `npm run dev`(5173)로 열면 `/api`가 HTML을 돌려줘 문장 로딩·기록 저장이 안 된다.
> ⚠ 8788은 `dist/`를 서빙한다. 코드를 고치면 `vite build --watch`가 1~3초 뒤 다시 굽는다 —
> **빌드가 끝난 뒤 브라우저를 직접 새로고침**해야 반영된다(HMR 아님).
> ⚠ **최종 확인은 반드시 Windows + Edge 또는 Chrome + 한글 IME**로 한다(실제 사용 환경).
>   개발 중 리눅스 브라우저로 보는 것은 레이아웃 확인까지만 유효하다.

### 3-2. 자동 테스트 (`npm test` — 기존 54개 + 아래)

| 파일 | 케이스 |
|---|---|
| `compare.test.js` | 완전 일치 → 전부 `correct` · 치환 오타 → 그 자리만 `wrong` · **공백 누락/추가** · 덜 침 → `pending` · 더 침 → `extra` · `composing=true`면 마지막 글자는 `composing` |
| 〃 (F-002 핵심) | 같은 자리를 `가`/`.`/`값`으로 각각 틀려도 그 자리의 `wrong` 증가분이 **정답 글자 타수로 동일**. `extra`만 입력 글자 타수 |
| 〃 | `countKeys(".") === 1`(문장부호 보정), `countKeys(" ") === 1`, 완전 정답이면 `wrong === 0` |
| 〃 | 89.9% 실패 / 90.0% 통과 경계가 `isPassed`와 맞물려 재현된다 |
| `danmunSteps.test.js` (F-008) | `normalizeDanmunLevels`: `null` · `{}` · 배열 아님 · `{"1":"문자열"}` · 빈 문자열 · 151자 · 모르는 키 · 일부 단계만 → 각각 fallback / 빈 단계 / 정상 배열 |
| 〃 (무작위 출제) | `genDanmun`이 원본의 부분집합이고 중복이 없다 · 개수는 `min(5, 전체)` · **exclude를 피한다** · 후보가 모자라면 exclude를 풀고도 개수를 채운다 · 빈 단계는 `[]` |
| `progress.test.js` | 단문 1단계 90% → `{screen:"danmun", step:2}` · 3단계 → `null` · 89.9% → `null` · 낱말 규칙 회귀 |
| `api.test.js` | `handleGetSentences`: 정상 3단계 · 빈 테이블 → `{levels:null}` · DB 미연결 · `kind='jangmun'` → 400 · `ORDER BY level, id` 안정 |
| 〃 (F-005) | `board='danmun'` 저장 1회로 `today_records`와 `hall_of_fame`에 **모두** 들어간다 · batch 중 하나를 실패시키면 **둘 다 남지 않는다** |
| 〃 (F-006) | 같은 이름·학교로 3번 저장 → 전당에 **1줄, 최고 기록** · 서로 다른 21명 → 정확히 20명 · 동률 정렬이 반복 실행에도 같다 |

컴포넌트 레벨(IME)은 자동화가 까다로우므로 **3-3 D 항목의 수동 시나리오를 필수 게이트**로 삼는다.

### 3-3. 수동 시나리오 (★는 Windows 실기에서 반드시)

**A. 기본 흐름**
1. 홈 → `04 단문연습` → 1단계 문장 5개로 시작한다.
2. **화면 아래에 키보드가 보이지 않는다** (기본 숨김).
3. 첫 글자를 치면 진행·타수가 움직인다.
4. 본보기와 똑같이 치고 Enter → 다음 문장, 입력칸이 비워진다.
5. 5문장을 끝내면 완료 오버레이에 타수·정확도가 뜬다.

**B. 색상 표시 (핵심 요구)**
6. 한 글자를 틀리게 친다 → **그 글자만 빨강 + 물결 밑줄**.
7. 백스페이스로 고친다 → **색이 정상으로 돌아온다**(감점 없음).
8. **띄어쓰기를 빠뜨린다**("오늘도좋은") → 어긋난 자리부터 빨갛게.
9. **띄어쓰기를 더 넣는다**("오늘도  좋은") → 여분 공백이 **빨간 블록**으로 보인다.
10. 본보기보다 길게 친다 → 넘친 부분이 빨간 취소선.
11. "좋다"의 `ㅈ→조→좋` 조합 중 **빨갛게 번쩍이지 않는다**.

**C. 무작위 출제 ★신규**
12. 1단계를 마치고 "다시 시작" → **직전 판과 다른 문장**이 나온다.
13. 다시 시작을 5번 반복 → 매번 순서·조합이 달라지고, 같은 판 안에 **중복 문장이 없다**.
14. 관리 화면에서 1단계 문장을 3개만 남긴다 → 그 단계는 **3문장 판**으로 정상 동작한다.

**D. Windows IME 경계 ★필수**
15. 마지막 글자를 조합하는 중 Enter → **글자만 확정되고 문장은 안 넘어간다.** 한 번 더 Enter → 넘어간다.
16. Enter를 **꾹 눌러 자동 반복** → 문장이 한 칸만 넘어간다(두 칸 이상 안 넘어감).
17. Enter를 **빠르게 연타** → `idx`가 2 이상 뛰지 않는다.
18. **아무것도 안 친 채 Enter** → 넘어가지 않고 "한 글자라도 써 보세요"가 뜬다.
19. **한/영을 영문으로 두고 친다** → "한/영 키를 눌러 한글로 바꿔 주세요"가 크게 뜬다.
20. 한자 키(오른쪽 Ctrl)를 눌러 후보창이 떠도 **Esc 후 이어서 칠 수 있다**.
21. **Ctrl+V로 정답을 붙여넣기** → 아무것도 들어가지 않는다.

**E. 키보드 토글**
22. `⌨ 키보드 보기` → 자판·손 그림이 펼쳐지고 **다음에 누를 키가 강조**된다.
23. 펼쳤다 접어도 **페이지 전체 스크롤이 생기지 않는다**.
24. 토글을 누른 뒤 곧바로 이어서 타이핑된다(포커스 복귀).
25. 홈에 나갔다 다시 들어오면 **또 숨김 상태로 시작**한다.

**F. 단계 이동**
26. 1단계 90% 이상 완료 → "2단계로 넘어갈까요?" → 2단계로 이동, 통계 초기화.
27. 3단계 완료 → 다음 제안 없음. 89%대 → 제안 없음.
28. 좌측에서 **3단계를 바로 선택** → 즉시 3단계 문장(임의 선택).

**G. 접근성 (F-004)**
29. **Tab / Shift+Tab만으로** 단계 3개·키보드 토글·완료 버튼을 모두 조작할 수 있다.
30. 포커스가 예고 없이 입력칸으로 되돌아가지 않는다.
31. 완료 오버레이가 뜨면 입력칸이 잠기고 첫 버튼에 포커스가 간다.
32. 색을 흑백으로 보아도(스크린샷 흑백 변환) 오답을 **물결 밑줄로 구분**할 수 있다.

**H. 데이터·기록**
33. 연습 후 홈 → **"오늘"** 탭에 기록이 보인다. → **"단문"** 탭에도 보인다.
34. 같은 이름·학교로 3번 하면 단문 탭에는 **최고 기록 1줄**만 보인다(F-006).
35. 개인 최고를 깨면 완료 오버레이에 "🎉 개인 최고 기록!" 뱃지.
36. (DevTools 오프라인) 저장 실패 → "기록을 저장하지 못했어요 [다시 저장]" → 온라인 복구 후 성공.

**I. 로딩·관리자 연동 (F-001)**
37. DevTools 네트워크를 Slow 3G로 두고 CH.04 진입 → **fallback 판이 먼저 시작되지 않고**
    "문장을 가져오는 중" 후 D1 문장으로 시작한다.
38. 연습 중(치는 도중)에 다른 탭에서 관리자가 문장을 바꿔도 **진행 중인 판은 유지**된다.
    다시 시작하거나 단계를 바꾸면 새 문장이 나온다.
39. 관리 화면에서 2단계를 통째로 비움 → 2단계 선택 시 "문장이 없어요" + 입력칸 잠김.
40. 엑셀로 단문 전체 교체 → 교체된 문장이 나온다. "직전 교체 되돌리기"도 정상.

**J. 좁은 화면 (F-007)** — 특정 해상도가 아니라 "줄여 가며" 확인한다
41. 창을 세로로 줄여 간다 → 여백이 먼저 줄고, 더 줄이면 손 그림이 접히고, 그래도 모자라면
    중앙 영역만 스크롤된다. **문장·입력칸·토글에는 언제나 접근할 수 있다.**
42. 브라우저 확대를 키운다(125% → 200%) → 잘려서 사라지는 요소가 없다.
43. 150자짜리 긴 문장 + 키보드 펼침 상태에서도 같은 조건이 유지된다.
44. 넉넉한 창에서는 페이지 전체 스크롤이 생기지 않는다.

**K. 회귀** — 자리·낱말연습은 지금 잘 돌고 있다. 건드리지 않았음을 확인한다
45. 자리연습·낱말연습이 예전 그대로(특히 keydown 가로채기, 완료 화면 동작).
46. 자리 → 낱말 → 심화 연결 제안이 예전 그대로.
47. 홈 "오늘"·"이전" 탭이 예전 그대로(단문 기록이 오늘 탭에도 섞여 보인다).

### 3-4. 배포 및 운영

```bash
npm test && npm run build      # 테스트 + 프로덕션 빌드 통과 확인
npm run deploy                 # vite build → wrangler pages deploy dist
```

- **마이그레이션 없음.** `sentences`·`hall_of_fame`은 원격에 이미 있다.
- 배포 전 원격 데이터 상태만 **읽기 전용으로** 확인한다:

```bash
npx wrangler d1 execute taja-db --remote \
  --command "SELECT level, COUNT(*) FROM sentences WHERE kind='danmun' GROUP BY level;"
```

> ⚠ 시드 재적용(`--file=db/seed_sentences.sql`)은 **비어 있을 때만** 운영 판단으로 실행한다.
> 선생님이 이미 문장을 등록해 둔 환경에 무조건 실행하지 않는다.

- 배포 후 실서비스(https://taja-cxm.pages.dev)에서 **Windows + Edge/Chrome + 한글 IME**로
  시나리오 A·B·C·D·H를 다시 확인한다.
- 롤백은 Cloudflare Pages의 이전 배포로 되돌리면 된다. **DB 롤백은 필요 없다**(스키마 무변경).

---

## 부록 A — 열린 결정 (기본값으로 정했지만 바꿀 수 있는 것)

| 항목 | 이번 기본값 | 바꾸려면 |
|---|---|---|
| 한 판 문장 수 | **5문장** (낱말 10개보다 짧게 — 문장이 길어 체감 분량은 비슷) | `danmunSteps.js`의 `LINES_PER_ROUND` |
| 무작위 범위 | **판 단위로 셔플 + 직전 판 회피** | 더 오래 기억하려면 최근 N판을 `localStorage`에 두고 exclude를 넓힌다 |
| 단계 수 | **3단계** (`sentences.level` CHECK가 1~3) | 스키마 CHECK까지 바꿔야 한다 |
| 낱말 4단계 심화 → 단문 1단계 연결 | **연결하지 않음** (요구에 없었음) | `progress.js`에 한 줄 추가하면 계단이 끝까지 이어진다 |
| 키보드 토글 기억 | **기억하지 않음** (항상 숨김으로 시작 — 요구사항 그대로) | localStorage 키 하나면 된다 |
| 오타 정렬 보정 | **하지 않음**(같은 자리끼리 비교) | 글자 하나를 빠뜨려도 뒤를 맞다고 보려면 LCS 정렬 — 초등 대상엔 과하다 |
| 확정 후 되돌리기 | **없음** | 부록 B(OUT-003) |
| 관리 화면 데이터 버전 표시(N-001) | **넣지 않음** | 넣는다면 관리 화면에만 `updatedAt` 한 줄. 학생 화면에는 노출하지 않는다 |
| 가상 키보드에 "한/영" 키 라벨 | **넣지 않음** (안내 문구로 대체) | `keyboard.js`의 `AltRight` 키캡에 "한/영" 표기를 더하면 더 친절해진다 |
| 장문연습(CH.05) | 이번 범위 아님 | `kind='jangmun'`을 `(level,title)`별 `seq` 순으로 이어 붙인다. **`compare.js`·`SentenceInput.jsx`·키보드 토글·저장 경로를 그대로 재사용**하고 문장 목록만 한 편에서 뽑으면 된다 |

## 부록 B — 이번 범위 밖 (근거와 함께 남긴다)

- **OUT-001 요청 ID 기반 저장 멱등성** — 응답 유실 후 재시도로 인한 중복까지 막으려면 새 컬럼과
  UNIQUE 제약이 필요하다. "데이터 모델 변경 없음" 경계를 넘는다.
  (요청을 1회로 줄여 부분 실패는 이미 제거했으므로 남는 위험은 "응답만 유실된 재시도" 뿐이다.)
- **OUT-002 사용자 고유 ID 기반 순위** — 동명이인·같은 학교를 구분하려면 등록 사용자에게 영구 ID를
  주고 기록에 저장해야 한다. 사용자 모델과 개인정보 범위가 바뀐다.
- **OUT-003 확정한 이전 문장 수정** — 세션 이력과 타이머 재계산이 필요하고,
  "Enter 확정 후 되돌리기 없음"이라는 결정과 충돌한다.
- **모바일·태블릿·macOS** — 사용자는 Windows PC가 거의 전부다(1-3). 화면은 반응형으로 깨지지 않게
  하되, **터치 키보드 환경의 IME 동작은 이번 검증 대상이 아니다.**
- **낱말연습의 데이터 로딩 방식 개선** — `wordSteps.js`의 모듈 전역 방식에도 F-001과 같은 약점이
  있지만, 이번엔 단문만 새 방식으로 만든다. 장문 구현 때 함께 정리하는 편이 안전하다.
