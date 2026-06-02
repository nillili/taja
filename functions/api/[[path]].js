// Cloudflare Pages Function — D1 직접 쿼리 (Apps Script 제거)
// env.DB = D1 database binding (wrangler.toml 에서 설정)

export async function onRequest(context) {
  const { request, env } = context;
  const db = env.DB;

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors() });
  }

  try {
    const url = new URL(request.url);
    const action = url.searchParams.get("action");

    if (request.method === "GET") {
      if (action === "records") {
        return handleGetRecords(db, url.searchParams.get("board") || "today");
      }
      return jsonRes({ error: "unknown action" }, 400);
    }

    if (request.method === "POST") {
      const body = await request.json();
      if (body.action === "saveRecord") return handleSaveRecord(db, body);
      return jsonRes({ error: "unknown action" }, 400);
    }

    return jsonRes({ error: "method not allowed" }, 405);
  } catch (err) {
    return jsonRes({ error: err.message }, 500);
  }
}

// ── 기록 읽기 ──────────────────────────────────────────────────────
async function handleGetRecords(db, board) {
  if (!db) return jsonRes([], 200); // D1 미연결 시 빈 배열

  let rows;
  if (board === "today") {
    // 한국 시간 기준 오늘(UTC+9): 날짜 비교를 ISO 문자열 prefix로 처리
    const today = new Date();
    today.setTime(today.getTime() + 9 * 60 * 60 * 1000); // UTC → KST
    const datePrefix = today.toISOString().slice(0, 10); // "YYYY-MM-DD"

    const { results } = await db.prepare(
      `SELECT recorded_at, name, school, wpm, accuracy
       FROM today_records
       WHERE recorded_at >= ? AND recorded_at < ?
       ORDER BY wpm DESC
       LIMIT 100`
    ).bind(datePrefix + "T00:00:00.000Z",
           datePrefix + "T23:59:59.999Z").all();
    rows = results;
  } else {
    const { results } = await db.prepare(
      `SELECT recorded_at, name, school, wpm, accuracy
       FROM hall_of_fame
       WHERE board = ?
       ORDER BY wpm DESC
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

  if (board === "today") {
    await db.prepare(
      `INSERT INTO today_records (recorded_at, name, school, wpm, accuracy)
       VALUES (?, ?, ?, ?, ?)`
    ).bind(now, name, school, Number(wpm), Number(acc)).run();

  } else if (board === "danmun" || board === "jangmun") {
    // 명예의전당: insert 후 해당 board에서 하위 기록 정리(상위 20인 유지)
    await db.prepare(
      `INSERT INTO hall_of_fame (board, recorded_at, name, school, wpm, accuracy)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).bind(board, now, name, school, Number(wpm), Number(acc)).run();

    await db.prepare(
      `DELETE FROM hall_of_fame
       WHERE board = ? AND id NOT IN (
         SELECT id FROM hall_of_fame WHERE board = ? ORDER BY wpm DESC LIMIT 20
       )`
    ).bind(board, board).run();
  } else {
    return jsonRes({ ok: false, error: "invalid board" }, 400);
  }

  return jsonRes({ ok: true });
}

// ── 유틸 ───────────────────────────────────────────────────────────
function jsonRes(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...cors() },
  });
}

function cors() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}
