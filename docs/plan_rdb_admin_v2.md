# plan_rdb_admin_v2

> **상태: 구현·배포 완료 (2026-08-12).** 실제 구현은 이 문서와 두 곳이 다르다.
> ① `NatmalScreen`이 `getWords()`가 아니라 `genWords`를 직접 쓰고 있어, D1 데이터가
>    연습 화면까지 닿도록 `wordSteps.setWordSource()` + App 시작 시 주입을 추가했다.
> ② API 테스트는 FakeD1 대신 `node:sqlite`에 실제 `db/schema.sql`을 적용해,
>    CHECK·부분 고유 인덱스 같은 제약까지 함께 검증한다.
> 이후 단문/장문 관리 탭, 샘플 내려받기, 명예의전당 "이전" 탭, "내가 쓴 글" 입력칸이
> 추가로 들어갔다 — 현황은 `PROJECT_STATUS.md` 참고.

> 낱말 데이터를 스프레드시트(내장 fallback)에서 D1(RDB)로 옮기고, 홈 화면 설정(⚙) 버튼 + PIN(9956) 뒤에 단어 관리(수정/삭제/개별등록/엑셀 일괄등록) 화면을 만든다. 단문/장문용 `sentences` 테이블은 이번에 **설계·생성까지만** 하고 화면 구현은 다음 플랜으로 미룬다.
>
> 기준 커밋: `5ed2d79` (+ 손모양 오버레이 수정 작업트리) · 조사일: 2026-08-12
> v1 + Codex 검토(F-001~F-005) 통합본. 이전 버전(v1, v1_codex)은 삭제됨.

### v1 → v2 변경 내역

| 출처 | 내용 |
|---|---|
| F-001 (차단) | `sentences`의 `UNIQUE(kind,level,title,seq)` 제거 — 단문이 난이도별 1개만 저장되는 결함. → 장문 전용 부분 고유 인덱스 + 의미 CHECK로 교체 |
| F-002 (높음) | 관리 화면 재진입/새로고침 시 PIN state 소실 → PIN 자체를 sessionStorage에 저장, 마운트 시 서버 재검증 |
| F-003 (높음) | 불완전한 일괄 교체 요청이 단어 전체를 지울 수 있음 → 서버 전체 선검증(8묶음 각 ≥1행) + 원자적 `db.batch()` |
| F-004 (높음) | PIN 무제한 추측 가능 → D1 기반 시도 제한(10분/5회 실패 → 429) + Origin 제한 + PIN env 승격 |
| F-005 (중간) | 파괴적 API 자동 회귀 검사 없음 → FakeD1로 API 핸들러 vitest 추가 |
| 자체 개선 | ① 교체 직전 스냅샷 `words_backup` + "직전 교체 되돌리기" 버튼(운영자 실수 복구) ② 단문 중복 방지 부분 인덱스 ③ 엑셀 셀 숫자 자동 타입 방어(`String(v).trim()`) |

---

## 1. 제작자의 의도 (왜 만드는가)

### 배경과 고통

이 앱의 낱말연습(CH.03) 데이터는 원래 구글 스프레드시트 `낱말_1_기본` 탭이 원본이다.
그 시트를 CSV로 구워 `src/data/wordSteps.js`(약 800단어, 4단계 × 기본/심화)에 박아 넣었고,
Apps Script 연동(`apps-script/Code.gs`)은 만들어 두고도 현재 쓰지 않는다.
즉 **지금 단어를 하나 고치려면 시트를 고치고 → 다시 구워서 → 커밋/배포해야 한다.**
선생님(운영자)이 브라우저에서 직접 단어를 넣고 빼는 길이 없다.

한편 기록 저장은 이미 Cloudflare D1(`taja-db`)에 잘 붙어 있다
(`functions/api/[[path]].js` → `today_records`/`hall_of_fame`).
데이터의 절반(기록)은 RDB, 절반(단어)은 소스코드 안이라는 어정쩡한 상태다.
이번 수정의 개요가 "**스프레드시트 → RDB로 바꾼다**"인 이유다.

### 조사로 드러난 현실 (이미 있는 것 / 없는 것)

| 항목 | 상태 |
|---|---|
| D1 바인딩 (`wrangler.toml`, DB id `b92ae9c0…`) | ✅ 있음 |
| Pages Function `/api` (records, saveRecord) | ✅ 있음 — 확장만 하면 됨 |
| **프런트 `getWords()`가 `action=words` 호출** | ✅ 이미 구현됨 (`src/data/api.js:24-29`) |
| **서버 `words` 액션** | ❌ 없음 — 그래서 지금은 항상 fallback 사용 |
| 단어 원본 데이터 | `src/data/wordSteps.js` — `{ "1".."4": { basic:[], adv:[] } }` |
| 시트 컬럼 규약 | 8컬럼 = 1단계_기본 … 4단계_심화 (`apps-script/Code.gs:41-58`) |
| 관리 화면 / 인증 | ❌ 전혀 없음 |
| words / sentences 테이블 | ❌ 없음 (`db/schema.sql`엔 기록 테이블 2개뿐) |

핵심: **프런트의 절반은 이미 준비되어 있다.** 서버에 `words` 액션을 만들고 D1에 words
테이블을 채우는 순간, `getWords()`는 코드 수정 없이 D1 데이터를 쓰기 시작한다
(실패 시 fallback 유지 — "연습은 항상 동작" 원칙도 그대로).

### 사용자가 확정한 방향 (고정 조건)

1. **설정 버튼**: 홈 푸터의 `v 0.1` 바로 오른쪽에 바퀴(⚙) 아이콘.
2. **PIN 게이트**: 클릭 → 비밀번호 `9956` 입력해야 진입.
3. **단어 관리**: 등록된 단어가 보이고, 단어별 수정/삭제, 하나씩 등록, **엑셀 업로드로 일괄 등록**.
4. **기본값(default)**: 현재 스프레드시트 값(= `wordSteps.js` 내용)을 D1에 시드해서 시작.
5. **단문연습 DB**: 단문 1개 = 150자 이내 문장, 난이도 1·2·3단계. **지금은 DB 설계만.**
   단문은 난이도별로 **여러 문장**을 저장할 수 있어야 한다(F-001의 교훈 — 랜덤 출제 전제).
6. **장문연습 DB**: 단문과 **테이블 구조가 똑같다**. "단문의 모음이 장문" — 간단한 수필
   몇 편을 문장 단위로 쪼개 저장할 계획.

### 설계를 가르는 한 줄 원칙

**"단어의 원본은 이제 D1이다. 시트도, 소스코드도 아니다."**
`wordSteps.js`는 삭제하지 않고 오프라인/장애 시 fallback으로만 남긴다(초기 시드의 원천이기도 하다).

그리고 v2에서 추가된 안전 원칙: **파괴적 액션(전체 교체·삭제)은 ① 서버 선검증 ② 원자적 실행
③ 직전 스냅샷 백업 ④ 시도 제한, 네 겹을 통과해야 한다.**

---

## 2. 개발 방법 (이것만 보고 구현 가능하게)

### 2.0 변경 요약

| 영역 | 내용 | 마이그레이션 |
|---|---|---|
| DB | `words`, `words_backup`, `sentences`, `admin_attempts` 테이블 + 인덱스 | `db/schema.sql` 갱신 → local/remote 적용 |
| DB 시드 | `wordSteps.js` → `db/seed_words.sql` 생성 스크립트 | local/remote 1회 실행 |
| API | `words`(공개 GET) + 관리자 7액션(PIN·시도제한·Origin 검증) | 없음 |
| 프런트 | 홈 푸터 ⚙ 버튼, `AdminScreen`(PIN 게이트 + 단어 CRUD + 엑셀 업로드 + 되돌리기) | 없음 |
| 테스트 | FakeD1 기반 API 자동 테스트 (`functions/api/api.test.js`) | 없음 |
| 의존성 | `xlsx`(SheetJS) 추가 — 엑셀 파싱은 브라우저에서 | `npm i xlsx` |

### 2.1 데이터 모델 (`db/schema.sql`에 추가)

```sql
-- 낱말연습 단어 (이제 D1이 원본, wordSteps.js는 fallback)
CREATE TABLE IF NOT EXISTS words (
  id     INTEGER PRIMARY KEY AUTOINCREMENT,
  step   INTEGER NOT NULL CHECK(step BETWEEN 1 AND 4),
  mode   TEXT    NOT NULL CHECK(mode IN ('basic','adv')),  -- 기본/심화
  text   TEXT    NOT NULL CHECK(length(text) > 0),
  UNIQUE(step, mode, text)          -- 같은 칸 중복 등록 방지
);
CREATE INDEX IF NOT EXISTS idx_words_step_mode ON words(step, mode);

-- 일괄 교체 직전 스냅샷 1회분 (관리 화면 "직전 교체 되돌리기"용)
CREATE TABLE IF NOT EXISTS words_backup (
  id INTEGER, step INTEGER, mode TEXT, text TEXT,
  backed_up_at TEXT NOT NULL
);

-- 단문/장문 공용 문장 테이블 (이번엔 생성까지만, 화면은 다음 플랜)
-- · 단문: kind='danmun', title='', seq=1  → 행 하나가 연습문제 1개 (난이도별 여러 개 저장 가능)
-- · 장문: kind='jangmun', 같은 (level,title) 행들을 seq 순으로 이으면 수필 한 편
--   ("단문의 모음이 장문" — 구조는 단문과 동일, 묶음 열쇠만 title/seq)
CREATE TABLE IF NOT EXISTS sentences (
  id     INTEGER PRIMARY KEY AUTOINCREMENT,
  kind   TEXT    NOT NULL CHECK(kind IN ('danmun','jangmun')),
  level  INTEGER NOT NULL CHECK(level BETWEEN 1 AND 3),    -- 난이도 1·2·3
  title  TEXT    NOT NULL DEFAULT '',                      -- 장문(수필) 제목
  seq    INTEGER NOT NULL DEFAULT 1,                       -- 장문 내 문장 순서
  text   TEXT    NOT NULL CHECK(length(text) BETWEEN 1 AND 150), -- 150자 이내(문자 수 기준)
  -- 의미 제약: 단문/장문 필드 조합이 흐트러지지 않게 (F-001)
  CHECK(
    (kind = 'danmun'  AND title =  '' AND seq  = 1) OR
    (kind = 'jangmun' AND title <> '' AND seq >= 1)
  )
);
-- 장문: 같은 수필 안에서 문장 순서(seq) 중복 금지 — 부분 고유 인덱스 (F-001)
CREATE UNIQUE INDEX IF NOT EXISTS uq_sentences_jangmun_seq
  ON sentences(level, title, seq) WHERE kind = 'jangmun';
-- 단문: 같은 난이도에 같은 문장 중복 금지
CREATE UNIQUE INDEX IF NOT EXISTS uq_sentences_danmun_text
  ON sentences(level, text) WHERE kind = 'danmun';
CREATE INDEX IF NOT EXISTS idx_sentences_pick ON sentences(kind, level, title, seq);

-- 관리자 PIN 시도 기록 (시도 제한용, F-004)
CREATE TABLE IF NOT EXISTS admin_attempts (
  ip TEXT NOT NULL,
  at TEXT NOT NULL,        -- ISO8601
  ok INTEGER NOT NULL      -- 1 성공 / 0 실패
);
CREATE INDEX IF NOT EXISTS idx_admin_attempts ON admin_attempts(ip, at);
```

- 기존 `today_records`/`hall_of_fame`은 **변경 없음**.
- F-001 검증 기준: 같은 level의 단문 2행 삽입 **성공**, 같은 `(level,title,seq)` 장문 2행 **실패**,
  빈 제목 장문·`seq≠1` 단문 **실패** (§3.2-G 참고).
- 남은 위험(수용): 장문 제목 변경 = 식별자 변경. 이번 범위의 고정 선택(별도 essays 테이블 없음)과 양립.

### 2.2 시드 생성 스크립트 — `scripts/gen-word-seed.mjs` (신규)

`wordSteps.js`를 import해 `db/seed_words.sql`을 생성한다 (커밋해서 재현 가능하게).

```js
// scripts/gen-word-seed.mjs — node scripts/gen-word-seed.mjs
import { writeFileSync } from "node:fs";
import { WORD_STEPS } from "../src/data/wordSteps.js";

const esc = (s) => s.replace(/'/g, "''");
let sql = "-- wordSteps.js에서 생성됨. 재생성: node scripts/gen-word-seed.mjs\n";
for (const [step, modes] of Object.entries(WORD_STEPS))
  for (const [mode, list] of Object.entries(modes))
    for (const text of list)
      sql += `INSERT OR IGNORE INTO words (step, mode, text) VALUES (${step}, '${mode}', '${esc(text)}');\n`;
writeFileSync(new URL("../db/seed_words.sql", import.meta.url), sql);
```

주의: `wordSteps.js`가 `../kit/shuffle.js`를 import하므로 스크립트는 반드시 ESM(`.mjs`)로,
프로젝트 루트에서 실행한다. 약 800행 INSERT — D1 파일 실행으로 문제없는 크기.
시드 직후 **8개 `(step,mode)` 묶음별 개수와 총 개수를 기록**해 두고 운영 배포 후 대조한다(§3.3).

### 2.3 API — `functions/api/[[path]].js` 확장

기존 라우팅 구조(GET `action` 쿼리 / POST `body.action`)를 그대로 따른다.
Pages Function은 파일 하나가 전 `/api`를 받으므로 **새 파일을 만들지 않는다**.

**상수·환경** (파일 상단):
```js
const ADMIN_PIN_FALLBACK = "9956";
const adminPin = (env) => env.ADMIN_PIN || ADMIN_PIN_FALLBACK; // Pages 환경변수 우선 (F-004)
const ALLOWED_ORIGINS = [
  "https://taja-cxm.pages.dev",
  "http://localhost:8788", "http://localhost:5173",
];
```

**공개 GET `?action=words`** — `handleGetWords(db)`:
```js
const { results } = await db.prepare(
  "SELECT step, mode, text FROM words ORDER BY step, mode, id").all();
// → { steps: { "1": {basic:[], adv:[]}, ... "4": {...} }, updatedAt }
```
- 행이 0개면 `{ steps: null }` 반환 → 프런트 `getWords()`가 falsy로 판단해 fallback 사용
  (이미 구현된 로직 그대로, `src/data/api.js:27`). 응답 형태는 Apps Script `getWords()`와 동일 — 프런트 무수정.

**관리자 공통 가드** — 모든 `admin*` 액션은 본문 처리 전에 순서대로:

1. **Origin 검증** (F-004): `Origin` 헤더가 **있으면** `ALLOWED_ORIGINS`에 포함돼야 한다.
   아니면 403. (헤더가 없는 curl 등은 2번 시도 제한이 방어선.)
   관리자 응답의 CORS 헤더는 `*` 대신 해당 origin만 반사. 공개 액션(words/records)은 기존 `*` 유지.
2. **시도 제한** (F-004): `ip = request.headers.get("CF-Connecting-IP") || "local"`.
   ```js
   // 최근 10분 실패 5회 이상 → 429 + Retry-After: 600 (올바른 PIN이어도 차단)
   const windowStart = new Date(Date.now() - 10 * 60 * 1000).toISOString();
   const row = await db.prepare(
     "SELECT COUNT(*) AS fails FROM admin_attempts WHERE ip=? AND at>=? AND ok=0"
   ).bind(ip, windowStart).first();
   if (row.fails >= 5) return jsonRes({ ok: false, error: "too many attempts" }, 429 /* Retry-After: 600 */);
   ```
3. **PIN 비교**: `body.pin !== adminPin(env)` → 실패 기록(`ok=0`) 후 403. 성공 시 `ok=1` 기록.
   성공 기록 시 하루 지난 시도 기록을 겸사겸사 청소:
   `DELETE FROM admin_attempts WHERE at < ?(now-24h)`.

**관리자 POST 액션** (가드 통과 후):

| action | 본문 | 동작 / SQL |
|---|---|---|
| `adminVerify` | `{pin}` | PIN·제한만 확인 → `{ok:true}` |
| `adminWordList` | `{pin}` | `SELECT id, step, mode, text FROM words ORDER BY step, mode, id` → `{ok, rows}` |
| `adminWordAdd` | `{pin, step, mode, text}` | 검증(step 1~4, mode basic/adv, trim 후 비어있지 않음) → `INSERT OR IGNORE` → 변경 0행이면 `{ok:false, error:"duplicate"}` |
| `adminWordUpdate` | `{pin, id, text}` | `UPDATE words SET text=? WHERE id=?` (UNIQUE 충돌 시 duplicate 에러, 없는 id면 `{ok:false, error:"not found"}`) |
| `adminWordDelete` | `{pin, id}` | `DELETE FROM words WHERE id=?` |
| `adminWordsReplace` | `{pin, rows:[{step,mode,text}…]}` | **전체 교체** — 아래 상세 |
| `adminWordsRestore` | `{pin}` | `words_backup`이 비어있지 않으면 batch로 `[DELETE FROM words, INSERT INTO words(step,mode,text) SELECT step,mode,text FROM words_backup]` → `{ok, restored}` |

**`adminWordsReplace` 상세** (F-003 — 서버 입력 계약):

```
① 선검증(전체 요청 단위 — 행을 버리지 않는다):
   - rows가 배열이고 비어 있지 않다.
   - 모든 행: step ∈ 1..4, mode ∈ {basic, adv}, String(text).trim() 길이 1~50.
   - (step, mode, trim(text)) 기준 중복 제거 후, 8개 (step, mode) 묶음 각각에 최소 1행.
   - 하나라도 어긋나면 400 + 어떤 조건이 깨졌는지 메시지 → DB 무변경.
② 원자 실행: db.batch([                       // D1 batch = 단일 트랜잭션
     "DELETE FROM words_backup",
     "INSERT INTO words_backup SELECT id, step, mode, text, ?now FROM words",  // 직전 스냅샷
     "DELETE FROM words",
     ...유효 행 INSERT문들
   ])
③ 사후 확인: SELECT COUNT(*) FROM words 가 ①의 고유 행 수와 같을 때만
   {ok:true, inserted, buckets:{"1-basic":103, …}} 반환. 다르면 500 (batch 특성상 발생하면 버그).
```
- 수용한 비용: 의도적으로 한 묶음(예: 4단계 심화)을 비우는 교체는 불가 — 개별 삭제로 수행한다.
  빈 묶음이 실제 요구가 되면 별도의 명시적 확인값을 가진 요청으로만 허용(다음 플랜).

### 2.4 프런트 — API 래퍼 (`src/data/api.js`에 추가)

```js
// 관리자 API (모두 POST, pin 동봉). 실패 시 {ok:false, error} 반환해 UI에서 메시지 처리.
export async function adminApi(action, params = {}) { /* saveRecord와 같은 POST 패턴 */ }
export function invalidateWords() { _wordsCache = null; }  // 단어 변경 후 낱말연습 반영용
```

### 2.5 프런트 — 홈 푸터 ⚙ 버튼 (`src/screens/HomeScreen.jsx:108-111`)

```jsx
<div className="footer-hint">
  <span>왼쪽 위 〈타자연습〉을 누르면 언제든 여기로 돌아옵니다</span>
  <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
    v 0.1
    <button className="gear-btn" aria-label="설정" onClick={() => goTab("admin")}>⚙</button>
  </span>
</div>
```
- `HomeScreen`은 이미 `goTab` prop을 받는다(`App.jsx:68`). 아이콘은 이모지 ⚙(추가 에셋 불필요),
  `.gear-btn`은 배경 없는 버튼으로 `base.css`에 소소하게 추가.

### 2.6 프런트 — 라우팅 (`src/App.jsx`)

`renderScreen()`에 분기 추가 (`screen === "jari"` 분기들 옆, `App.jsx:68-82`):
```jsx
if (screen === "admin") return <AdminScreen />;
```
- `TABS`에는 넣지 않는다(메뉴 카드/헤더 탭에 노출 안 함). Header는 TABS 기반이라 admin
  화면에선 어떤 탭도 활성 표시되지 않을 뿐 동작엔 문제없음(확인: Header는 `screen` id 비교만 함).

### 2.7 프런트 — `src/screens/AdminScreen.jsx` (신규, 이번 플랜의 중심 파일)

**인증 상태 모델 (F-002)** — "성공 마커"와 PIN을 따로 두지 않는다:
- `sessionStorage["taja.admin.pin"]`에 **PIN 자체**를 저장한다 (성공 마커 없음).
- 마운트 시 저장된 PIN이 있으면 `adminApi("adminVerify", {pin})`로 **서버 재검증** →
  성공해야만 관리 패널을 연다. 실패(403/429)면 저장값을 지우고 PIN 입력 화면으로.
- 모든 관리자 요청은 이 검증된 PIN을 동봉. 요청이 403을 돌려주면(서버 PIN 변경 등)
  저장값을 지우고 입력 화면으로 복귀.
- 수용한 위험: PIN이 탭 세션 저장소에 평문으로 남는다(XSS 전제 시 노출). 장기적으로는
  서버 발급 세션이 더 안전하나, 이번 범위는 단순 PIN 게이트 유지.

**(a) PIN 게이트**: 숫자 4자리 input + 확인 버튼 → `adminVerify` → 실패 시 "비밀번호가 달라요",
429면 "잠시 후 다시 시도하세요". 상단에 "← 홈으로" 버튼(기존 화면들과 같은 스타일).

**(b) 단어 관리 패널** — `adminWordList`로 전체 로드 후:
- **필터 바**: 단계(1~4) × 모드(기본/심화) 토글 → 클라이언트 필터링(전체 ~800행이라 충분).
- **표**: `단어 | 수정 | 삭제` — 수정은 인라인 input 전환 → `adminWordUpdate`,
  삭제는 confirm 후 `adminWordDelete`. 행 수 카운트 표시("1단계 기본 · 103개").
- **개별 등록 폼**: 단계 select + 모드 select + 텍스트 input + [등록] → `adminWordAdd`.
- **엑셀 일괄 등록**:
  - `<input type="file" accept=".xlsx,.xls,.csv">` → `xlsx` 라이브러리로 첫 시트 파싱
    (`XLSX.read(await file.arrayBuffer())` → `sheet_to_json({header:1})`).
  - **컬럼 규약 = 기존 구글시트와 동일**: 8컬럼 = `1단계_기본, 1단계_심화, … 4단계_심화`
    (Code.gs:41과 같은 매핑: `step = Math.floor(c/2)+1`, `mode = c%2 ? "adv" : "basic"`).
    첫 행은 헤더로 간주하고 버림. 셀 값은 `String(v).trim()`으로 강제(숫자 자동 타입 방어),
    빈 셀 스킵, 중복 제거.
    → 사용자는 지금 쓰는 구글시트를 **파일 > 다운로드 > .xlsx** 받아 그대로 올리면 된다.
  - 파싱 결과 미리보기("총 812개 단어를 읽었어요: 1단계 기본 103, …") + 8묶음 중 빈 묶음이
    있으면 업로드 버튼 비활성 + 이유 표시(서버 계약 §2.3과 동일 규칙을 클라이언트에서 선반영).
  - **[전체 교체하기]** 버튼 + "기존 단어를 모두 지우고 이 파일로 바꿉니다" confirm →
    `adminWordsReplace`. 성공 시 목록 다시 로드 + `invalidateWords()`.
- **되돌리기**: 업로드 구역 아래 작은 [직전 교체 되돌리기] 버튼 → confirm →
  `adminWordsRestore` → 목록 재로드. (교체 이력이 없으면 서버가 `{ok:false}` — 버튼은 항상 표시하되 실패 메시지로 안내.)
- 스타일: 기존 인라인 스타일 관례(JariScreen 등)를 따르고 클래스 최소 추가.

### 2.8 자동 테스트 (F-005) — `functions/api/api.test.js` (신규, vitest)

- `[[path]].js`에서 핸들러/검증 함수를 **named export**로 노출한다(Pages Functions는 추가
  export 허용). 테스트는 `onRequest`를 직접 호출하되 `env.DB`에 **FakeD1**(메모리 구현:
  `prepare().bind().all()/first()/run()`, `batch()` — batch는 전체 성공/전체 실패 시뮬레이션)을 주입.
- 최소 케이스:
  1. PIN 없이/틀리게 각 admin 액션 호출 → 403, DB 무변경.
  2. 실패 5회 후 올바른 PIN → 429 (+ 시간 창 밖에서는 다시 허용).
  3. 허용되지 않은 `Origin` 헤더의 admin 요청 → PIN이 맞아도 403.
  4. `adminWordAdd` 성공 / 중복 → duplicate / `adminWordUpdate` 없는 id → not found.
  5. `adminWordsReplace`: 빈 배열·잘못된 행 1개 포함·한 묶음 빈 입력 → 400 + 무손상.
     정상 입력 → inserted = 고유 행 수, words_backup에 직전 데이터.
  6. `adminWordsRestore`: 교체 후 되돌리기 → 원본 복원.
  7. 공개 `words`: 행 있음 → `{steps:{…}}` 형태, 0행 → `{steps:null}`.
- UI(F-002 재마운트/새로고침 복원)는 테스팅 라이브러리 미도입 상태라 **수동 시나리오로 유지**
  (§3.2-C). 도입 여부는 열린 결정.
- 기존 22개 테스트는 그대로 통과해야 한다.

### 2.9 부수 변경

- `package.json`: `"xlsx"` dependency 추가 (SheetJS CE, 브라우저 파싱용 — 서버 불필요).
- `db/seed_words.sql`: 생성물이지만 **커밋한다**(remote 시드 재현용).
- Cloudflare Pages 대시보드: 환경변수 `ADMIN_PIN=9956` 설정(코드 fallback과 동일 값이지만
  저장소·응답 노출 범위를 줄이는 목적, F-004).
- `PROJECT_STATUS.md`: 완료 후 데이터 흐름("낱말데이터: D1 words 테이블, wordSteps.js는 fallback") 갱신.

### 2.10 프로젝트 고유 함정 (개발 중 반드시 기억)

1. **`npm run dev`(5173)에서는 `/api`가 Vite HTML fallback을 반환**한다. API 작업 확인은
   반드시 `npm run dev:full` → **localhost:8788** (PROJECT_STATUS.md:108-109).
2. 스키마/시드는 `--local`과 `--remote` **두 번** 적용해야 한다. local만 하고 배포하면
   운영에서 words가 비어 fallback으로 조용히 돌아가 "적용 안 된 것처럼" 보인다.
3. `wordSteps.js`는 지우면 안 된다 — fallback + 시드 원천.
4. Pages Function은 파일 하나(`[[path]].js`)가 전 `/api`를 받는다 — 새 파일 만들지 말 것.
5. **스키마는 처음부터 F-001 반영본으로 적용**한다. 잘못된 제약으로 운영 스키마를 만든 뒤
   고치는 경로(테이블 재생성)는 피한다.

### 2.11 변경 파일 체크리스트

- [ ] `db/schema.sql` — words, words_backup, sentences(부분 인덱스+CHECK), admin_attempts
- [ ] `scripts/gen-word-seed.mjs` — 신규
- [ ] `db/seed_words.sql` — 생성 + 커밋
- [ ] `functions/api/[[path]].js` — words + admin 7액션 + 가드(Origin/시도제한/PIN) + named export
- [ ] `functions/api/api.test.js` — FakeD1 자동 테스트 (신규)
- [ ] `src/data/api.js` — `adminApi()`, `invalidateWords()` 추가
- [ ] `src/screens/AdminScreen.jsx` — 신규 (PIN 게이트 + 단어 관리 + 엑셀 업로드 + 되돌리기)
- [ ] `src/App.jsx` — admin 라우팅 분기
- [ ] `src/screens/HomeScreen.jsx` — ⚙ 버튼
- [ ] `src/styles/base.css` — `.gear-btn` 등 소소한 스타일
- [ ] `package.json` — xlsx 추가
- [ ] Cloudflare Pages 환경변수 `ADMIN_PIN` 설정
- [ ] `PROJECT_STATUS.md` — 현황 갱신 (마지막에)

---

## 3. 테스트 방법

### 3.1 로컬 준비

```bash
cd /home/hong-notebook/works/taja
npm install                                                # xlsx 설치 포함
node scripts/gen-word-seed.mjs                             # db/seed_words.sql 생성
npx wrangler d1 execute taja-db --local --file=db/schema.sql
npx wrangler d1 execute taja-db --local --file=db/seed_words.sql
# 시드 검증: 묶음별 개수 기록해 두기 (배포 후 대조용)
npx wrangler d1 execute taja-db --local --command \
  "SELECT step, mode, COUNT(*) FROM words GROUP BY step, mode"
npm run dev:full                                           # → http://localhost:8788 (5173 금지!)
```

### 3.2 시나리오

**A. words가 D1에서 나오는지**
1. 8788 접속 → 낱말연습 진입 → Network에서 `/api?action=words`가 JSON `{steps:{…}}` 반환 확인.
2. D1에서 단어 하나 수정(`--local --command "UPDATE words SET text='테스트' WHERE id=1"`) →
   새로고침 → 낱말연습 1단계 기본에 '테스트' 등장 = D1이 원본이라는 증거.

**B. fallback 회귀**
3. `npm run dev`(5173)로 접속(의도적) → API가 HTML이라 무시됨 → 낱말연습이 내장 wordSteps로 여전히 동작.

**C. 설정 진입 + 인증 수명주기 (F-002)**
4. 홈 푸터 ⚙ → PIN 화면. `1234` → 거부. `9956` → 관리 패널.
5. **관리 패널 → 홈 → 다시 ⚙**: PIN 재입력 없이(저장 PIN 서버 재검증 후) 목록 로드 성공.
6. **새로고침** 후 재진입: 마찬가지로 목록 로드 성공.
7. sessionStorage의 PIN을 개발자도구에서 틀린 값으로 바꾼 뒤 재진입 → PIN 입력 화면으로 복귀.
8. 새 탭에서 진입 → PIN 재요구(sessionStorage 범위).

**D. 시도 제한 + Origin (F-004)**
9. curl로 틀린 PIN 5회 → 6회째부터 429 + Retry-After. 그 상태에서 올바른 PIN도 429.
10. `curl -H 'Origin: https://evil.example'`로 올바른 PIN 전송 → 403.
11. 일반 `?action=words`·기록 조회는 위 상태에서도 정상.

**E. 단어 CRUD**
12. 개별 등록: 2단계·심화에 "구름사다리" → 목록·카운트 갱신 → 중복 재등록 → "이미 있어요".
13. 인라인 수정 → 새로고침 후 유지. 삭제 → confirm → 사라짐.
14. 변경 후 낱말연습 이동 → 반영 확인(`invalidateWords()` 경로).

**F. 엑셀 일괄 교체 + 되돌리기 (F-003)**
15. 구글시트를 .xlsx로 다운로드해 업로드 → 미리보기 카운트 = 시트와 일치 → [전체 교체하기] → 재로드 확인.
16. 8컬럼 미만/빈 파일 → 업로드 버튼 비활성(클라이언트), curl로 같은 페이로드 직접 전송 → 400 + DB 무손상(서버).
17. 한 묶음(예: 4단계 심화)이 빈 파일 → 클라이언트 비활성 + 서버 400.
18. 교체 후 [직전 교체 되돌리기] → 교체 전 데이터로 복원.

**G. sentences 설계 검증 (F-001)**
19. 같은 level 단문 2행 INSERT → **성공**:
    `INSERT INTO sentences (kind,level,text) VALUES ('danmun',1,'하늘이 참 맑다.'), ('danmun',1,'바람이 붑니다.')`
20. 같은 `(level,title,seq)` 장문 2행 → **실패**(uq_sentences_jangmun_seq).
21. 빈 제목 장문 / `seq=2`인 단문 / 151자 문장 → CHECK 위반으로 **실패**.
22. 같은 level에 같은 단문 텍스트 → **실패**(uq_sentences_danmun_text).

**H. 자동 테스트 + 회귀**
23. `npm test` — 기존 22개 + 신규 API 테스트(§2.8) 전부 통과.
24. (교차 확인) 인증 가드·교체 선검증·배치 원자성 코드 중 하나를 일부러 주석 처리하면
    대응 테스트가 실패하는지 1회 확인 후 원복.
25. 자리연습·기록저장·명예의전당 정상 동작(기존 테이블 무변경 확인).

### 3.3 배포 절차

```bash
npx wrangler d1 execute taja-db --remote --file=db/schema.sql      # 1) 스키마 (F-001 반영본!)
npx wrangler d1 execute taja-db --remote --file=db/seed_words.sql  # 2) 시드 (1회)
npx wrangler d1 execute taja-db --remote --command \
  "SELECT step, mode, COUNT(*) FROM words GROUP BY step, mode"     # 3) §3.1 기록과 대조
# 4) Cloudflare Pages 대시보드에서 ADMIN_PIN=9956 환경변수 확인
npm run deploy                                                     # 5) 빌드+배포
# 6) https://taja-cxm.pages.dev 에서 시나리오 A·C·D·E 축약 재확인
```

---

## 부록 — 열린 결정 (기본값 채택, 바꾸려면 말해 주세요)

| 결정 | 채택한 기본값 | 대안 |
|---|---|---|
| 시도 제한 정책 (F-004) | 10분 창 실패 5회 → 429(Retry-After 600), 저장소는 D1 `admin_attempts`(새 인프라 불필요) | Cloudflare KV/Rate Limiting 제품 사용 |
| 교체 시 빈 묶음 (F-003) | 8묶음 각 ≥1행 필수 — 빈 묶음 교체는 거절(개별 삭제로 대응) | 명시적 확인값 동봉 시 허용 |
| 엑셀 업로드 시 기존 데이터 | **전체 교체** + 직전 스냅샷 자동 백업/되돌리기 | 병합(추가만) 모드 병행 |
| 엑셀 컬럼 형식 | 기존 구글시트 8컬럼 규약 그대로 | 별도 템플릿(단계/모드/단어 3컬럼) |
| 인라인 수정 범위 | 단어 텍스트만 (단계 이동은 삭제+재등록) | step/mode도 수정 가능하게 |
| UI 자동 테스트 (F-005 일부) | 미도입 — F-002는 수동 시나리오 + API 테스트로 커버 | @testing-library/react 도입 |
| 장문 묶음 키 | `sentences.title` 텍스트 (장문 전용 부분 고유 인덱스) | 별도 `essays` 부모 테이블 + FK |
| 관리 화면에서 단문/장문 관리 | 이번 범위 제외 (테이블만 생성) | 다음 플랜에서 words와 같은 UI 추가 |
