// Cloudflare Pages Function — D1 직접 쿼리 (Apps Script 제거)
// env.DB = D1 database binding (wrangler.toml 에서 설정)
//
// 공개:   GET  ?action=records|words
//         POST {action:"saveRecord"}
// 관리자: POST {action:"admin*", pin}  ← Origin 검증 + 시도 제한 + PIN 검증 통과 필요

const ADMIN_PIN_FALLBACK = "9956";
export const adminPin = (env) => (env && env.ADMIN_PIN) || ADMIN_PIN_FALLBACK;

export const ALLOWED_ORIGINS = [
  "https://taja-cxm.pages.dev",
  "http://localhost:8788", "http://127.0.0.1:8788",
  "http://localhost:5173", "http://127.0.0.1:5173",
];

export const ATTEMPT_WINDOW_MS = 10 * 60 * 1000; // 10분
export const ATTEMPT_MAX_FAILS = 5;              // 창 안에서 실패 5회면 잠금
const MAX_WORD_LEN = 50;
const INSERT_CHUNK = 30;                         // D1 바인딩 파라미터 한도(100) 대비 30행×3

export async function onRequest(context) {
  const { request, env } = context;
  const db = env.DB;

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors() });
  }

  try {
    const url = new URL(request.url);
    const action = url.searchParams.get("action");

    // 아래 핸들러는 반드시 await 한다 — 그래야 DB 오류가 이 try/catch에 잡혀
    // 500 JSON으로 나간다(그냥 반환하면 rejection이 밖으로 새어나간다).
    if (request.method === "GET") {
      if (action === "records") {
        return await handleGetRecords(db, url.searchParams.get("board") || "today");
      }
      if (action === "words") return await handleGetWords(db);
      if (action === "sentences") {
        return await handleGetSentences(db, url.searchParams.get("kind") || "danmun");
      }
      return jsonRes({ error: "unknown action" }, 400);
    }

    if (request.method === "POST") {
      const body = await request.json();
      if (body.action === "saveRecord") return await handleSaveRecord(db, body);
      if (typeof body.action === "string" && body.action.startsWith("admin")) {
        return await handleAdmin(db, env, request, body);
      }
      return jsonRes({ error: "unknown action" }, 400);
    }

    return jsonRes({ error: "method not allowed" }, 405);
  } catch (err) {
    return jsonRes({ error: err.message }, 500);
  }
}

export const RECENT_DAYS = 14; // "이전" 탭이 보여주는 기간

// 한국 시간 기준 날짜 문자열 "YYYY-MM-DD" (offset일 만큼 뒤로)
function kstDate(offsetDays = 0) {
  const d = new Date();
  d.setTime(d.getTime() + 9 * 60 * 60 * 1000 - offsetDays * 24 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10);
}

// ── 기록 읽기 ──────────────────────────────────────────────────────
async function handleGetRecords(db, board) {
  if (!db) return jsonRes([], 200); // D1 미연결 시 빈 배열

  let rows;
  if (board === "today") {
    // 한국 시간 기준 오늘(UTC+9): 날짜 비교를 ISO 문자열 prefix로 처리
    const datePrefix = kstDate();

    const { results } = await db.prepare(
      `SELECT recorded_at, name, school, wpm, accuracy
       FROM today_records
       WHERE recorded_at >= ? AND recorded_at < ?
       ORDER BY wpm DESC
       LIMIT 100`
    ).bind(datePrefix + "T00:00:00.000Z",
           datePrefix + "T23:59:59.999Z").all();
    rows = results;

  } else if (board === "recent") {
    // "이전": 오늘을 뺀 최근 2주. 한 사람(이름+학교)당 최고 타수 한 줄만 보여준다.
    // (SQLite는 MAX 집계와 같은 행의 다른 컬럼을 함께 돌려준다)
    const { results } = await db.prepare(
      `SELECT recorded_at, name, school, MAX(wpm) AS wpm, accuracy
       FROM today_records
       WHERE recorded_at >= ? AND recorded_at < ?
       GROUP BY name, school
       ORDER BY wpm DESC
       LIMIT 50`
    ).bind(kstDate(RECENT_DAYS) + "T00:00:00.000Z",
           kstDate() + "T00:00:00.000Z").all();
    rows = results;

  } else {
    // 전당은 (이름,학교)당 최고 기록 한 줄만 저장돼 있다(handleSaveRecord).
    // 동률 정렬 계약을 저장 쪽과 똑같이 맞춰야 순위가 흔들려 보이지 않는다.
    const { results } = await db.prepare(
      `SELECT recorded_at, name, school, wpm, accuracy
       FROM hall_of_fame
       WHERE board = ?
       ORDER BY wpm DESC, accuracy DESC, recorded_at ASC, id ASC
       LIMIT 20`
    ).bind(board).all();
    rows = results;
  }

  return jsonRes((rows || []).map(r => ({
    recorded_at: r.recorded_at,
    name: r.name,
    school: r.school,
    wpm: r.wpm,
    acc: r.accuracy,
  })));
}

// ── 기록 저장 ──────────────────────────────────────────────────────
async function handleSaveRecord(db, data) {
  if (!db) return jsonRes({ ok: false, error: "DB not connected" });

  const { board, name, school, wpm, acc } = data;
  const now = new Date().toISOString(); // UTC 저장, 읽을 때 KST 변환

  if (!name || !school || !wpm) {
    return jsonRes({ ok: false, error: "missing required fields" }, 400);
  }
  const w = Number(wpm), a = Number(acc);

  if (board === "today") {
    // 자리·낱말연습: 오늘 기록만
    await db.prepare(
      `INSERT INTO today_records (recorded_at, name, school, wpm, accuracy)
       VALUES (?, ?, ?, ?, ?)`
    ).bind(now, name, school, w, a).run();

  } else if (board === "danmun" || board === "jangmun") {
    // 단문·장문: 오늘 기록 + 명예의전당을 한 번의 요청으로, 하나의 트랜잭션에서.
    // (요청을 두 번 보내면 한쪽만 성공하는 상태가 생긴다)
    // 전당은 (이름, 학교)당 최고 기록 한 줄만 남긴다 → 화면의 "상위 20인"과 뜻이 맞는다.
    await db.batch([
      db.prepare(
        `INSERT INTO today_records (recorded_at, name, school, wpm, accuracy)
         VALUES (?, ?, ?, ?, ?)`
      ).bind(now, name, school, w, a),

      // 이번 기록이 더 좋으면(또는 같으면) 이 사람의 옛 기록을 지운다
      db.prepare(
        `DELETE FROM hall_of_fame
          WHERE board = ? AND name = ? AND school = ?
            AND (wpm < ? OR (wpm = ? AND accuracy <= ?))`
      ).bind(board, name, school, w, w, a),

      // 더 좋은 기록이 남아 있지 않을 때만 새로 넣는다
      db.prepare(
        `INSERT INTO hall_of_fame (board, recorded_at, name, school, wpm, accuracy)
         SELECT ?, ?, ?, ?, ?, ?
          WHERE NOT EXISTS (
            SELECT 1 FROM hall_of_fame WHERE board = ? AND name = ? AND school = ?
          )`
      ).bind(board, now, name, school, w, a, board, name, school),

      // 상위 20명만 유지 (동률: 정확도 높은 순 → 먼저 세운 순 → id)
      db.prepare(
        `DELETE FROM hall_of_fame
          WHERE board = ? AND id NOT IN (
            SELECT id FROM hall_of_fame WHERE board = ?
             ORDER BY wpm DESC, accuracy DESC, recorded_at ASC, id ASC
             LIMIT 20
          )`
      ).bind(board, board),
    ]);
  } else {
    return jsonRes({ ok: false, error: "invalid board" }, 400);
  }

  return jsonRes({ ok: true });
}

// ── 낱말 읽기 (공개) ───────────────────────────────────────────────
// 행이 없으면 { steps: null } → 프런트가 내장 fallback(wordSteps.js)을 쓴다.
export async function handleGetWords(db) {
  if (!db) return jsonRes({ steps: null });

  const { results } = await db.prepare(
    "SELECT step, mode, text FROM words ORDER BY step, mode, id"
  ).all();
  if (!results || results.length === 0) return jsonRes({ steps: null });

  const steps = {};
  for (const r of results) {
    const s = String(r.step);
    if (!steps[s]) steps[s] = { basic: [], adv: [] };
    if (steps[s][r.mode]) steps[s][r.mode].push(r.text);
  }
  return jsonRes({ steps, updatedAt: new Date().toISOString() });
}

// ── 문장 읽기 (공개) ───────────────────────────────────────────────
// 단문: { levels: { "1": [문장…], "2": […], "3": […] }, updatedAt }
// 행이 없으면 { levels: null } → 프런트가 내장 fallback(danmunSteps.js)을 쓴다.
// 무작위 출제는 여기서 하지 않는다 — 프런트가 통째로 받아 캐시해 두고 판마다 뽑는다.
// (장문은 title·seq 묶음이라 응답 모양이 달라 다음 작업에서 kind='jangmun' 분기를 더한다)
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
    if (!levels[k]) levels[k] = [];
    levels[k].push(r.text);
  }
  return jsonRes({ levels, updatedAt: new Date().toISOString() });
}

// ── 관리자 ─────────────────────────────────────────────────────────
export async function handleAdmin(db, env, request, body) {
  if (!db) return jsonRes({ ok: false, error: "DB not connected" }, 500);

  // 1) Origin 검증 — 헤더가 있으면 허용 목록에 있어야 한다
  const origin = request.headers.get("Origin");
  if (origin && !ALLOWED_ORIGINS.includes(origin)) {
    return jsonRes({ ok: false, error: "forbidden origin" }, 403, adminCors(origin));
  }
  const headers = adminCors(origin);

  // 2) 시도 제한 — 최근 창 안에서 실패가 누적되면 올바른 PIN도 막는다
  const ip = request.headers.get("CF-Connecting-IP") || "local";
  const since = new Date(Date.now() - ATTEMPT_WINDOW_MS).toISOString();
  const fails = await db.prepare(
    "SELECT COUNT(*) AS n FROM admin_attempts WHERE ip = ? AND at >= ? AND ok = 0"
  ).bind(ip, since).first();
  if (Number(fails && fails.n) >= ATTEMPT_MAX_FAILS) {
    return jsonRes({ ok: false, error: "too many attempts" }, 429,
      { ...headers, "Retry-After": String(Math.round(ATTEMPT_WINDOW_MS / 1000)) });
  }

  // 3) PIN 검증
  const now = new Date().toISOString();
  if (String(body.pin == null ? "" : body.pin) !== adminPin(env)) {
    await db.prepare("INSERT INTO admin_attempts (ip, at, ok) VALUES (?, ?, 0)")
      .bind(ip, now).run();
    return jsonRes({ ok: false, error: "bad pin" }, 403, headers);
  }
  await db.prepare("INSERT INTO admin_attempts (ip, at, ok) VALUES (?, ?, 1)")
    .bind(ip, now).run();
  await db.prepare("DELETE FROM admin_attempts WHERE at < ?")
    .bind(new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()).run();

  switch (body.action) {
    case "adminVerify":       return jsonRes({ ok: true }, 200, headers);
    case "adminWordList":     return adminWordList(db, headers);
    case "adminWordAdd":      return adminWordAdd(db, body, headers);
    case "adminWordUpdate":   return adminWordUpdate(db, body, headers);
    case "adminWordDelete":   return adminWordDelete(db, body, headers);
    case "adminWordsReplace": return adminWordsReplace(db, body, headers);
    case "adminWordsRestore": return adminWordsRestore(db, headers);
    case "adminSentenceList":     return adminSentenceList(db, body, headers);
    case "adminSentenceAdd":      return adminSentenceAdd(db, body, headers);
    case "adminSentenceUpdate":   return adminSentenceUpdate(db, body, headers);
    case "adminSentenceDelete":   return adminSentenceDelete(db, body, headers);
    case "adminSentencesReplace": return adminSentencesReplace(db, body, headers);
    case "adminSentencesRestore": return adminSentencesRestore(db, body, headers);
    default: return jsonRes({ ok: false, error: "unknown action" }, 400, headers);
  }
}

async function adminWordList(db, headers) {
  const { results } = await db.prepare(
    "SELECT id, step, mode, text FROM words ORDER BY step, mode, id"
  ).all();
  return jsonRes({ ok: true, rows: results || [] }, 200, headers);
}

async function adminWordAdd(db, body, headers) {
  const v = cleanRow(body);
  if (!v) return jsonRes({ ok: false, error: "invalid input" }, 400, headers);
  const res = await db.prepare(
    "INSERT OR IGNORE INTO words (step, mode, text) VALUES (?, ?, ?)"
  ).bind(v.step, v.mode, v.text).run();
  if (!changesOf(res)) return jsonRes({ ok: false, error: "duplicate" }, 409, headers);
  return jsonRes({ ok: true }, 200, headers);
}

async function adminWordUpdate(db, body, headers) {
  const id = Number(body.id);
  const text = String(body.text == null ? "" : body.text).trim();
  if (!Number.isInteger(id) || id <= 0 || !text || text.length > MAX_WORD_LEN) {
    return jsonRes({ ok: false, error: "invalid input" }, 400, headers);
  }
  let res;
  try {
    res = await db.prepare("UPDATE words SET text = ? WHERE id = ?").bind(text, id).run();
  } catch {
    return jsonRes({ ok: false, error: "duplicate" }, 409, headers); // UNIQUE 충돌
  }
  if (!changesOf(res)) return jsonRes({ ok: false, error: "not found" }, 404, headers);
  return jsonRes({ ok: true }, 200, headers);
}

async function adminWordDelete(db, body, headers) {
  const id = Number(body.id);
  if (!Number.isInteger(id) || id <= 0) {
    return jsonRes({ ok: false, error: "invalid input" }, 400, headers);
  }
  const res = await db.prepare("DELETE FROM words WHERE id = ?").bind(id).run();
  if (!changesOf(res)) return jsonRes({ ok: false, error: "not found" }, 404, headers);
  return jsonRes({ ok: true }, 200, headers);
}

// 전체 교체: 요청 전체를 먼저 검증하고(행을 버리지 않는다), 통과했을 때만
// 백업 → 삭제 → 삽입을 하나의 batch(단일 트랜잭션)로 실행한다.
async function adminWordsReplace(db, body, headers) {
  const check = validateReplaceRows(body.rows);
  if (check.error) return jsonRes({ ok: false, error: check.error }, 400, headers);
  const { rows, buckets } = check;

  const now = new Date().toISOString();
  const stmts = [
    db.prepare("DELETE FROM words_backup"),
    db.prepare(
      "INSERT INTO words_backup (id, step, mode, text, backed_up_at) SELECT id, step, mode, text, ? FROM words"
    ).bind(now),
    db.prepare("DELETE FROM words"),
  ];
  for (let i = 0; i < rows.length; i += INSERT_CHUNK) {
    const chunk = rows.slice(i, i + INSERT_CHUNK);
    const values = chunk.map(() => "(?, ?, ?)").join(", ");
    const binds = [];
    for (const r of chunk) binds.push(r.step, r.mode, r.text);
    stmts.push(db.prepare(`INSERT INTO words (step, mode, text) VALUES ${values}`).bind(...binds));
  }
  await db.batch(stmts);

  const cnt = await db.prepare("SELECT COUNT(*) AS n FROM words").first();
  if (Number(cnt && cnt.n) !== rows.length) {
    return jsonRes({ ok: false, error: "count mismatch" }, 500, headers);
  }
  return jsonRes({ ok: true, inserted: rows.length, buckets }, 200, headers);
}

async function adminWordsRestore(db, headers) {
  const b = await db.prepare("SELECT COUNT(*) AS n FROM words_backup").first();
  if (!Number(b && b.n)) return jsonRes({ ok: false, error: "no backup" }, 404, headers);

  await db.batch([
    db.prepare("DELETE FROM words"),
    db.prepare("INSERT INTO words (step, mode, text) SELECT step, mode, text FROM words_backup"),
  ]);
  const cnt = await db.prepare("SELECT COUNT(*) AS n FROM words").first();
  return jsonRes({ ok: true, restored: Number(cnt && cnt.n) }, 200, headers);
}

// ── 단문/장문 (sentences) ──────────────────────────────────────────
// 단문: title='', seq=1 / 장문: 같은 (level,title)을 seq 순으로 이으면 한 편
const isKind = (k) => k === "danmun" || k === "jangmun";

async function adminSentenceList(db, body, headers) {
  if (!isKind(body.kind)) return jsonRes({ ok: false, error: "invalid input" }, 400, headers);
  const { results } = await db.prepare(
    "SELECT id, kind, level, title, seq, text FROM sentences WHERE kind = ? ORDER BY level, title, seq, id"
  ).bind(body.kind).all();
  return jsonRes({ ok: true, rows: results || [] }, 200, headers);
}

async function adminSentenceAdd(db, body, headers) {
  const v = cleanSentence(body);
  if (!v) return jsonRes({ ok: false, error: "invalid input" }, 400, headers);

  // 장문은 같은 (난이도, 제목) 안에서 맨 뒤에 붙인다
  if (v.kind === "jangmun") {
    const last = await db.prepare(
      "SELECT MAX(seq) AS m FROM sentences WHERE kind='jangmun' AND level=? AND title=?"
    ).bind(v.level, v.title).first();
    v.seq = Number((last && last.m) || 0) + 1;
  }
  try {
    const res = await db.prepare(
      "INSERT OR IGNORE INTO sentences (kind, level, title, seq, text) VALUES (?, ?, ?, ?, ?)"
    ).bind(v.kind, v.level, v.title, v.seq, v.text).run();
    if (!changesOf(res)) return jsonRes({ ok: false, error: "duplicate" }, 409, headers);
  } catch {
    return jsonRes({ ok: false, error: "duplicate" }, 409, headers);
  }
  return jsonRes({ ok: true }, 200, headers);
}

async function adminSentenceUpdate(db, body, headers) {
  const id = Number(body.id);
  const text = String(body.text == null ? "" : body.text).trim();
  if (!Number.isInteger(id) || id <= 0 || !text || text.length > 150) {
    return jsonRes({ ok: false, error: "invalid input" }, 400, headers);
  }
  let res;
  try {
    res = await db.prepare("UPDATE sentences SET text = ? WHERE id = ?").bind(text, id).run();
  } catch {
    return jsonRes({ ok: false, error: "duplicate" }, 409, headers);
  }
  if (!changesOf(res)) return jsonRes({ ok: false, error: "not found" }, 404, headers);
  return jsonRes({ ok: true }, 200, headers);
}

async function adminSentenceDelete(db, body, headers) {
  const id = Number(body.id);
  if (!Number.isInteger(id) || id <= 0) {
    return jsonRes({ ok: false, error: "invalid input" }, 400, headers);
  }
  const res = await db.prepare("DELETE FROM sentences WHERE id = ?").bind(id).run();
  if (!changesOf(res)) return jsonRes({ ok: false, error: "not found" }, 404, headers);
  return jsonRes({ ok: true }, 200, headers);
}

// 해당 kind만 통째로 교체 (다른 kind는 건드리지 않는다)
async function adminSentencesReplace(db, body, headers) {
  if (!isKind(body.kind)) return jsonRes({ ok: false, error: "invalid input" }, 400, headers);
  const check = validateReplaceSentences(body.kind, body.rows);
  if (check.error) return jsonRes({ ok: false, error: check.error }, 400, headers);
  const { rows } = check;

  const now = new Date().toISOString();
  const stmts = [
    db.prepare("DELETE FROM sentences_backup WHERE kind = ?").bind(body.kind),
    db.prepare(
      "INSERT INTO sentences_backup (id, kind, level, title, seq, text, backed_up_at) SELECT id, kind, level, title, seq, text, ? FROM sentences WHERE kind = ?"
    ).bind(now, body.kind),
    db.prepare("DELETE FROM sentences WHERE kind = ?").bind(body.kind),
  ];
  const CHUNK = 20; // 20행 × 5칸 = 100 바인딩
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const values = chunk.map(() => "(?, ?, ?, ?, ?)").join(", ");
    const binds = [];
    for (const r of chunk) binds.push(r.kind, r.level, r.title, r.seq, r.text);
    stmts.push(db.prepare(`INSERT INTO sentences (kind, level, title, seq, text) VALUES ${values}`).bind(...binds));
  }
  await db.batch(stmts);

  const cnt = await db.prepare("SELECT COUNT(*) AS n FROM sentences WHERE kind = ?").bind(body.kind).first();
  if (Number(cnt && cnt.n) !== rows.length) {
    return jsonRes({ ok: false, error: "count mismatch" }, 500, headers);
  }
  return jsonRes({ ok: true, inserted: rows.length }, 200, headers);
}

async function adminSentencesRestore(db, body, headers) {
  if (!isKind(body.kind)) return jsonRes({ ok: false, error: "invalid input" }, 400, headers);
  const b = await db.prepare("SELECT COUNT(*) AS n FROM sentences_backup WHERE kind = ?")
    .bind(body.kind).first();
  if (!Number(b && b.n)) return jsonRes({ ok: false, error: "no backup" }, 404, headers);

  await db.batch([
    db.prepare("DELETE FROM sentences WHERE kind = ?").bind(body.kind),
    db.prepare(
      "INSERT INTO sentences (kind, level, title, seq, text) SELECT kind, level, title, seq, text FROM sentences_backup WHERE kind = ?"
    ).bind(body.kind),
  ]);
  const cnt = await db.prepare("SELECT COUNT(*) AS n FROM sentences WHERE kind = ?").bind(body.kind).first();
  return jsonRes({ ok: true, restored: Number(cnt && cnt.n) }, 200, headers);
}

// ── 검증 유틸 ──────────────────────────────────────────────────────
// 한 행을 정규화. 형식이 어긋나면 null.
export function cleanRow(r) {
  if (!r || typeof r !== "object") return null;
  const step = Number(r.step);
  const mode = r.mode;
  const text = String(r.text == null ? "" : r.text).trim();
  if (!Number.isInteger(step) || step < 1 || step > 4) return null;
  if (mode !== "basic" && mode !== "adv") return null;
  if (!text || text.length > MAX_WORD_LEN) return null;
  return { step, mode, text };
}

// 전체 교체 입력 계약: 비어있지 않고, 모든 행이 유효하고,
// 중복 제거 후 8개 (step, mode) 묶음에 각각 최소 1행이 있어야 한다.
export function validateReplaceRows(input) {
  if (!Array.isArray(input) || input.length === 0) return { error: "empty rows" };
  if (input.length > 20000) return { error: "too many rows" };

  const seen = new Set();
  const rows = [];
  const buckets = {};
  for (const raw of input) {
    const v = cleanRow(raw);
    if (!v) return { error: "invalid row" }; // 유효하지 않은 행이 하나라도 있으면 전체 거절
    const key = `${v.step}-${v.mode}-${v.text}`;
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push(v);
    const bk = `${v.step}-${v.mode}`;
    buckets[bk] = (buckets[bk] || 0) + 1;
  }
  for (const step of [1, 2, 3, 4]) {
    for (const mode of ["basic", "adv"]) {
      if (!buckets[`${step}-${mode}`]) return { error: `empty bucket: ${step}-${mode}` };
    }
  }
  return { rows, buckets };
}

// 문장 한 줄 정규화. 어긋나면 null.
export function cleanSentence(r) {
  if (!r || typeof r !== "object") return null;
  const kind = r.kind;
  const level = Number(r.level);
  const title = String(r.title == null ? "" : r.title).trim();
  const text = String(r.text == null ? "" : r.text).trim();
  if (!isKind(kind)) return null;
  if (!Number.isInteger(level) || level < 1 || level > 3) return null;
  if (!text || text.length > 150) return null;

  if (kind === "danmun") {
    if (title) return null;                       // 단문에는 제목이 없다
    return { kind, level, title: "", seq: 1, text };
  }
  if (!title || title.length > 60) return null;   // 장문은 제목이 있어야 한다
  const seq = Number(r.seq);
  return { kind, level, title, seq: Number.isInteger(seq) && seq >= 1 ? seq : 1, text };
}

// 문장 전체 교체 입력 계약: 비어있지 않고 모든 행이 유효해야 한다.
// 낱말과 달리 "모든 난이도를 채워라"는 요구는 없다 — 콘텐츠를 차츰 쌓는 단계라서.
// 장문 seq는 클라이언트 값을 믿지 않고 (난이도, 제목)별 등장 순서로 다시 매긴다.
export function validateReplaceSentences(kind, input) {
  if (!isKind(kind)) return { error: "invalid input" };
  if (!Array.isArray(input) || input.length === 0) return { error: "empty rows" };
  if (input.length > 20000) return { error: "too many rows" };

  const rows = [];
  const seen = new Set();
  const seqOf = new Map();
  for (const raw of input) {
    const v = cleanSentence({ ...raw, kind });
    if (!v) return { error: "invalid row" };
    if (kind === "danmun") {
      const key = `${v.level}|${v.text}`;         // (난이도, 문장) 중복 제거
      if (seen.has(key)) continue;
      seen.add(key);
    } else {
      const gk = `${v.level}|${v.title}`;
      const next = (seqOf.get(gk) || 0) + 1;
      seqOf.set(gk, next);
      v.seq = next;
    }
    rows.push(v);
  }
  return { rows };
}

// ── 유틸 ───────────────────────────────────────────────────────────
const changesOf = (res) => Number((res && res.meta && res.meta.changes) || 0);

function jsonRes(data, status = 200, headers) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...(headers || cors()) },
  });
}

function cors() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

// 관리자 응답은 와일드카드 대신 요청 origin만 반사한다.
function adminCors(origin) {
  return {
    "Access-Control-Allow-Origin": origin || "null",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}
