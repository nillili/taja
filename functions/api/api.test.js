// api.test.js — 관리자 API 회귀 검사.
// D1 대신 실제 SQLite(node:sqlite)에 db/schema.sql을 적용해 CHECK·UNIQUE 제약까지 함께 검증한다.

import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { onRequest, ATTEMPT_MAX_FAILS, RECENT_DAYS } from "./[[path]].js";

// node:sqlite는 vite 번들러가 해석하지 못하므로 런타임에 직접 가져온다
const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite");

const SCHEMA = readFileSync(new URL("../../db/schema.sql", import.meta.url), "utf8");
const PIN = "9956";

/* ── D1 인터페이스를 흉내내는 SQLite 래퍼 ─────────────────────────── */
class Stmt {
  constructor(db, sql) { this.db = db; this.sql = sql; this.args = []; }
  bind(...args) { this.args = args; return this; }
  async all() { return { results: this.db.prepare(this.sql).all(...this.args) }; }
  async first() { const r = this.db.prepare(this.sql).all(...this.args); return r[0] ?? null; }
  async run() {
    const r = this.db.prepare(this.sql).run(...this.args);
    return { meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) } };
  }
}
class TestD1 {
  constructor() { this.db = new DatabaseSync(":memory:"); this.db.exec(SCHEMA); }
  prepare(sql) { return new Stmt(this.db, sql); }
  async batch(stmts) {                       // D1 batch = 단일 트랜잭션
    this.db.exec("BEGIN");
    try {
      const out = [];
      for (const s of stmts) out.push(await s.run());
      this.db.exec("COMMIT");
      return out;
    } catch (e) { this.db.exec("ROLLBACK"); throw e; }
  }
  rows(sql) { return this.db.prepare(sql).all(); }
  exec(sql) { this.db.exec(sql); }
}

let db;
let ipSeq = 0;
beforeEach(() => { db = new TestD1(); ipSeq++; });

const post = (body, { origin = "http://localhost:8788", ip } = {}) =>
  onRequest({
    env: { DB: db },
    request: new Request("http://localhost:8788/api", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(origin ? { Origin: origin } : {}),
        "CF-Connecting-IP": ip || `10.0.0.${ipSeq}`,
      },
      body: JSON.stringify(body),
    }),
  });

const get = (action) =>
  onRequest({
    env: { DB: db },
    request: new Request(`http://localhost:8788/api?action=${action}`),
  });

const json = async (resPromise) => {
  const res = await resPromise;
  return { status: res.status, body: await res.json() };
};

// 8개 (step, mode) 묶음을 모두 채운 유효한 교체 입력
const fullRows = (tag = "") => {
  const rows = [];
  for (const step of [1, 2, 3, 4])
    for (const mode of ["basic", "adv"])
      for (const n of [1, 2]) rows.push({ step, mode, text: `${tag}낱말${step}${mode}${n}` });
  return rows;
};
const seedWords = async () => (await json(post({ action: "adminWordsReplace", pin: PIN, rows: fullRows() }))).body;
const wordCount = () => db.rows("SELECT COUNT(*) AS n FROM words")[0].n;

/* ── 1. 인증 가드 ─────────────────────────────────────────────────── */
describe("관리자 인증", () => {
  const ACTIONS = [
    { action: "adminVerify" },
    { action: "adminWordList" },
    { action: "adminWordAdd", step: 1, mode: "basic", text: "몰래" },
    { action: "adminWordUpdate", id: 1, text: "몰래" },
    { action: "adminWordDelete", id: 1 },
    { action: "adminWordsReplace", rows: fullRows() },
    { action: "adminWordsRestore" },
  ];

  it("PIN이 없거나 틀리면 모든 관리자 액션이 403이고 데이터는 그대로다", async () => {
    await seedWords();
    const before = wordCount();
    for (const [i, a] of ACTIONS.entries()) {
      const ip = `192.0.2.${i}`; // 액션마다 다른 IP — 시도 제한과 섞이지 않게
      const noPin = await json(post(a, { ip }));
      expect(noPin.status, a.action).toBe(403);
      const badPin = await json(post({ ...a, pin: "1234" }, { ip }));
      expect(badPin.status, a.action).toBe(403);
    }
    expect(wordCount()).toBe(before);
  });

  it(`실패 ${ATTEMPT_MAX_FAILS}회 뒤에는 올바른 PIN도 429로 막힌다`, async () => {
    const ip = "203.0.113.7";
    for (let i = 0; i < ATTEMPT_MAX_FAILS; i++) {
      expect((await json(post({ action: "adminVerify", pin: "0000" }, { ip }))).status).toBe(403);
    }
    const res = await post({ action: "adminVerify", pin: PIN }, { ip });
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBeTruthy();
    // 다른 IP는 영향 없음
    expect((await json(post({ action: "adminVerify", pin: PIN }, { ip: "203.0.113.8" }))).status).toBe(200);
  });

  it("허용되지 않은 Origin은 PIN이 맞아도 거절한다", async () => {
    const res = await json(post({ action: "adminVerify", pin: PIN }, { origin: "https://evil.example" }));
    expect(res.status).toBe(403);
    expect(res.body.error).toBe("forbidden origin");
  });

  it("올바른 PIN + 허용 Origin이면 통과한다", async () => {
    expect((await json(post({ action: "adminVerify", pin: PIN }))).body).toEqual({ ok: true });
  });
});

/* ── 2. 단어 CRUD ─────────────────────────────────────────────────── */
describe("단어 CRUD", () => {
  beforeEach(async () => { await seedWords(); });

  it("등록 성공 / 중복은 409", async () => {
    expect((await json(post({ action: "adminWordAdd", pin: PIN, step: 2, mode: "adv", text: "구름사다리" }))).status).toBe(200);
    const dup = await json(post({ action: "adminWordAdd", pin: PIN, step: 2, mode: "adv", text: "구름사다리" }));
    expect(dup.status).toBe(409);
    expect(dup.body.error).toBe("duplicate");
  });

  it("잘못된 입력은 400", async () => {
    for (const bad of [
      { step: 9, mode: "basic", text: "가" },
      { step: 1, mode: "hard", text: "가" },
      { step: 1, mode: "basic", text: "   " },
    ]) {
      expect((await json(post({ action: "adminWordAdd", pin: PIN, ...bad }))).status).toBe(400);
    }
  });

  it("수정: 성공 / 없는 id는 404 / 중복은 409", async () => {
    const list = (await json(post({ action: "adminWordList", pin: PIN }))).body.rows;
    const [a, b] = list;
    expect((await json(post({ action: "adminWordUpdate", pin: PIN, id: a.id, text: "바뀐낱말" }))).status).toBe(200);
    expect(db.rows(`SELECT text FROM words WHERE id=${a.id}`)[0].text).toBe("바뀐낱말");

    expect((await json(post({ action: "adminWordUpdate", pin: PIN, id: 99999, text: "없음" }))).status).toBe(404);
    // 같은 (step, mode)의 다른 단어와 같은 텍스트로 바꾸면 UNIQUE 충돌
    expect((await json(post({ action: "adminWordUpdate", pin: PIN, id: b.id, text: "바뀐낱말" }))).status).toBe(409);
  });

  it("삭제: 성공 / 없는 id는 404", async () => {
    const id = (await json(post({ action: "adminWordList", pin: PIN }))).body.rows[0].id;
    const before = wordCount();
    expect((await json(post({ action: "adminWordDelete", pin: PIN, id }))).status).toBe(200);
    expect(wordCount()).toBe(before - 1);
    expect((await json(post({ action: "adminWordDelete", pin: PIN, id }))).status).toBe(404);
  });
});

/* ── 3. 전체 교체 · 되돌리기 ──────────────────────────────────────── */
describe("전체 교체", () => {
  beforeEach(async () => { await seedWords(); });

  it("정상 입력은 전부 교체하고 묶음 수를 돌려준다", async () => {
    const rows = fullRows("새");
    const res = await json(post({ action: "adminWordsReplace", pin: PIN, rows }));
    expect(res.status).toBe(200);
    expect(res.body.inserted).toBe(rows.length);
    expect(res.body.buckets["1-basic"]).toBe(2);
    expect(wordCount()).toBe(rows.length);
    expect(db.rows("SELECT text FROM words ORDER BY id")[0].text).toBe("새낱말1basic1");
  });

  it("중복 행은 하나로 합쳐진다", async () => {
    const rows = [...fullRows("겹"), { step: 1, mode: "basic", text: "겹낱말1basic1" }];
    const res = await json(post({ action: "adminWordsReplace", pin: PIN, rows }));
    expect(res.body.inserted).toBe(rows.length - 1);
  });

  it("빈 배열·잘못된 행·빈 묶음은 400이고 기존 데이터가 그대로다", async () => {
    const before = db.rows("SELECT step, mode, text FROM words ORDER BY id");
    const cases = [
      { rows: [], expect: "empty rows" },
      { rows: null, expect: "empty rows" },
      { rows: [...fullRows(), { step: 7, mode: "basic", text: "잘못" }], expect: "invalid row" },
      { rows: fullRows().filter(r => !(r.step === 4 && r.mode === "adv")), expect: "empty bucket: 4-adv" },
    ];
    for (const c of cases) {
      const res = await json(post({ action: "adminWordsReplace", pin: PIN, rows: c.rows }));
      expect(res.status, c.expect).toBe(400);
      expect(res.body.error).toBe(c.expect);
      expect(db.rows("SELECT step, mode, text FROM words ORDER BY id")).toEqual(before);
    }
  });

  it("교체 중 오류가 나면 기존 데이터가 유지된다 (batch 원자성)", async () => {
    const before = db.rows("SELECT step, mode, text FROM words ORDER BY id");
    const broken = new TestD1();
    broken.db.exec(db.rows("SELECT step, mode, text FROM words").map(
      r => `INSERT INTO words (step,mode,text) VALUES (${r.step},'${r.mode}','${r.text}');`).join("\n"));
    broken.batch = async () => { throw new Error("D1_ERROR: forced"); };
    const saved = db; db = broken;
    const res = await post({ action: "adminWordsReplace", pin: PIN, rows: fullRows("x") });
    expect(res.status).toBe(500);
    expect(broken.rows("SELECT step, mode, text FROM words ORDER BY id")).toEqual(before);
    db = saved;
  });

  it("되돌리기: 교체 직전 상태로 복원된다", async () => {
    const before = db.rows("SELECT step, mode, text FROM words ORDER BY id");
    await json(post({ action: "adminWordsReplace", pin: PIN, rows: fullRows("새") }));
    expect(db.rows("SELECT step, mode, text FROM words ORDER BY id")).not.toEqual(before);

    const res = await json(post({ action: "adminWordsRestore", pin: PIN }));
    expect(res.status).toBe(200);
    expect(res.body.restored).toBe(before.length);
    expect(db.rows("SELECT step, mode, text FROM words ORDER BY id")).toEqual(before);
  });

  it("백업이 없으면 되돌리기는 404", async () => {
    db.exec("DELETE FROM words_backup");
    expect((await json(post({ action: "adminWordsRestore", pin: PIN }))).status).toBe(404);
  });
});

/* ── 4. 공개 words 응답 ───────────────────────────────────────────── */
describe("공개 words", () => {
  it("행이 없으면 steps: null (프런트가 내장 fallback을 쓴다)", async () => {
    expect((await json(get("words"))).body).toEqual({ steps: null });
  });

  it("행이 있으면 단계×모드 형태로 돌려준다", async () => {
    await seedWords();
    const { body } = await json(get("words"));
    expect(Object.keys(body.steps)).toEqual(["1", "2", "3", "4"]);
    expect(body.steps["1"].basic).toEqual(["낱말1basic1", "낱말1basic2"]);
    expect(body.steps["4"].adv).toHaveLength(2);
  });
});

/* ── 5. 단문/장문 관리 API ────────────────────────────────────────── */
describe("단문/장문 API", () => {
  const danmun = (n) => Array.from({ length: n }, (_, i) => ({ level: (i % 3) + 1, text: `단문 문장 ${i + 1}.` }));
  const jangmun = [
    { level: 1, title: "봄날", text: "첫 문장." },
    { level: 1, title: "봄날", text: "둘째 문장." },
    { level: 2, title: "여름밤", text: "다른 글의 첫 문장." },
  ];

  it("단문 등록·조회·수정·삭제", async () => {
    expect((await json(post({ action: "adminSentenceAdd", pin: PIN, kind: "danmun", level: 1, text: "하늘이 맑다." }))).status).toBe(200);
    const list = await json(post({ action: "adminSentenceList", pin: PIN, kind: "danmun" }));
    expect(list.body.rows).toHaveLength(1);
    const row = list.body.rows[0];
    expect(row).toMatchObject({ kind: "danmun", level: 1, title: "", seq: 1 });

    expect((await json(post({ action: "adminSentenceUpdate", pin: PIN, id: row.id, text: "하늘이 흐리다." }))).status).toBe(200);
    expect((await json(post({ action: "adminSentenceDelete", pin: PIN, id: row.id }))).status).toBe(200);
    expect((await json(post({ action: "adminSentenceList", pin: PIN, kind: "danmun" }))).body.rows).toHaveLength(0);
  });

  it("장문 등록은 같은 (난이도, 제목) 뒤에 순서대로 붙는다", async () => {
    for (const t of ["첫 문장.", "둘째 문장.", "셋째 문장."]) {
      await json(post({ action: "adminSentenceAdd", pin: PIN, kind: "jangmun", level: 1, title: "가을", text: t }));
    }
    const rows = (await json(post({ action: "adminSentenceList", pin: PIN, kind: "jangmun" }))).body.rows;
    expect(rows.map((r) => r.seq)).toEqual([1, 2, 3]);
    expect(rows.map((r) => r.text)).toEqual(["첫 문장.", "둘째 문장.", "셋째 문장."]);
  });

  it("잘못된 입력은 400 (제목 규칙·난이도·150자)", async () => {
    const bad = [
      { kind: "danmun", level: 1, title: "제목있음", text: "단문엔 제목이 없어야 한다" },
      { kind: "jangmun", level: 1, title: "", text: "장문엔 제목이 있어야 한다" },
      { kind: "danmun", level: 9, text: "난이도 범위 밖" },
      { kind: "danmun", level: 1, text: "가".repeat(151) },
      { kind: "novel", level: 1, text: "없는 종류" },
    ];
    for (const b of bad) {
      expect((await json(post({ action: "adminSentenceAdd", pin: PIN, ...b }))).status).toBe(400);
    }
  });

  it("전체 교체: 해당 종류만 바꾸고 다른 종류는 그대로", async () => {
    await json(post({ action: "adminSentencesReplace", pin: PIN, kind: "danmun", rows: danmun(6) }));
    await json(post({ action: "adminSentencesReplace", pin: PIN, kind: "jangmun", rows: jangmun }));
    expect(db.rows("SELECT COUNT(*) AS n FROM sentences WHERE kind='danmun'")[0].n).toBe(6);

    const res = await json(post({ action: "adminSentencesReplace", pin: PIN, kind: "danmun", rows: danmun(3) }));
    expect(res.body.inserted).toBe(3);
    expect(db.rows("SELECT COUNT(*) AS n FROM sentences WHERE kind='danmun'")[0].n).toBe(3);
    expect(db.rows("SELECT COUNT(*) AS n FROM sentences WHERE kind='jangmun'")[0].n).toBe(3); // 무영향
  });

  it("장문 교체 시 seq는 (난이도, 제목)별 등장 순서로 다시 매겨진다", async () => {
    await json(post({ action: "adminSentencesReplace", pin: PIN, kind: "jangmun", rows: jangmun }));
    const rows = db.rows("SELECT level, title, seq, text FROM sentences WHERE kind='jangmun' ORDER BY level, title, seq");
    expect(rows.map((r) => [r.title, r.seq])).toEqual([["봄날", 1], ["봄날", 2], ["여름밤", 1]]);
  });

  it("빈 배열·잘못된 행은 400이고 기존 데이터가 그대로다", async () => {
    await json(post({ action: "adminSentencesReplace", pin: PIN, kind: "danmun", rows: danmun(4) }));
    const before = db.rows("SELECT text FROM sentences WHERE kind='danmun' ORDER BY id");
    for (const rows of [[], null, [...danmun(2), { level: 5, text: "잘못" }]]) {
      expect((await json(post({ action: "adminSentencesReplace", pin: PIN, kind: "danmun", rows }))).status).toBe(400);
      expect(db.rows("SELECT text FROM sentences WHERE kind='danmun' ORDER BY id")).toEqual(before);
    }
  });

  it("되돌리기: 교체 직전 상태로 복원", async () => {
    // 복원은 내용이 같으면 되고 행 순서(id)는 새로 매겨진다 → 내용 기준으로 비교
    const content = () => db.rows("SELECT level, title, seq, text FROM sentences WHERE kind='danmun' ORDER BY level, text");
    await json(post({ action: "adminSentencesReplace", pin: PIN, kind: "danmun", rows: danmun(6) }));
    const before = content();
    await json(post({ action: "adminSentencesReplace", pin: PIN, kind: "danmun", rows: danmun(2) }));
    const res = await json(post({ action: "adminSentencesRestore", pin: PIN, kind: "danmun" }));
    expect(res.body.restored).toBe(6);
    expect(content()).toEqual(before);
  });

  it("백업이 없으면 되돌리기는 404", async () => {
    expect((await json(post({ action: "adminSentencesRestore", pin: PIN, kind: "jangmun" }))).status).toBe(404);
  });
});

/* ── 6. 명예의전당 (오늘 / 이전) ──────────────────────────────────── */
describe("명예의전당", () => {
  // 한국시간 기준 날짜에 맞춰 기록을 넣는다 (서버가 KST 날짜로 구간을 자른다)
  const kstDay = (back) => {
    const d = new Date(Date.now() + 9 * 3600 * 1000 - back * 24 * 3600 * 1000);
    return d.toISOString().slice(0, 10);
  };
  const add = (daysAgo, name, wpm, acc = 95, hour = "05") =>
    db.exec(`INSERT INTO today_records (recorded_at, name, school, wpm, accuracy)
             VALUES ('${kstDay(daysAgo)}T${hour}:00:00.000Z', '${name}', '우리초등학교', ${wpm}, ${acc})`);

  const board = async (b) => (await json(get(`records&board=${b}`))).body;

  it("오늘 탭은 오늘 기록만, 이전 탭은 오늘을 뺀 최근 2주", async () => {
    add(0, "오늘이", 300);
    add(1, "어제", 250);
    add(RECENT_DAYS - 1, "경계안", 200);
    add(RECENT_DAYS + 1, "너무예전", 999);

    expect((await board("today")).map((r) => r.name)).toEqual(["오늘이"]);
    expect((await board("recent")).map((r) => r.name)).toEqual(["어제", "경계안"]);
  });

  it("이전 탭은 한 사람당 최고 기록 한 줄만 보여준다", async () => {
    add(2, "라라", 100, 90);
    add(3, "라라", 320, 97);
    add(4, "라라", 200, 93);
    add(2, "미미", 280, 99);

    const rows = await board("recent");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ name: "라라", wpm: 320, acc: 97 }); // 최고 기록의 정확도
    expect(rows[1]).toMatchObject({ name: "미미", wpm: 280 });
  });

  it("같은 이름이라도 학교가 다르면 다른 사람으로 센다", async () => {
    add(2, "라라", 100);
    db.exec(`INSERT INTO today_records (recorded_at, name, school, wpm, accuracy)
             VALUES ('${kstDay(2)}T05:00:00.000Z', '라라', '다른초등학교', 150, 95)`);
    expect(await board("recent")).toHaveLength(2);
  });

  it("기록이 없으면 빈 배열", async () => {
    expect(await board("recent")).toEqual([]);
  });
});

/* ── 7. sentences 스키마 제약 (단문/장문) ─────────────────────────── */
describe("sentences 제약", () => {
  const ins = (kind, level, title, seq, text) =>
    db.exec(`INSERT INTO sentences (kind, level, title, seq, text) VALUES ('${kind}', ${level}, '${title}', ${seq}, '${text}')`);

  it("같은 난이도에 단문을 여러 개 저장할 수 있다", () => {
    ins("danmun", 1, "", 1, "하늘이 참 맑다.");
    ins("danmun", 1, "", 1, "바람이 붑니다.");
    expect(db.rows("SELECT COUNT(*) AS n FROM sentences")[0].n).toBe(2);
  });

  it("같은 난이도에 같은 단문은 중복 저장되지 않는다", () => {
    ins("danmun", 2, "", 1, "같은 문장");
    expect(() => ins("danmun", 2, "", 1, "같은 문장")).toThrow();
  });

  it("장문은 (난이도, 제목, 순서)가 중복될 수 없다", () => {
    ins("jangmun", 1, "봄날", 1, "첫 문장");
    ins("jangmun", 1, "봄날", 2, "둘째 문장");   // 순서가 다르면 OK
    expect(() => ins("jangmun", 1, "봄날", 2, "다른 둘째")).toThrow();
  });

  it("단문/장문 필드 조합과 150자 제한을 지킨다", () => {
    expect(() => ins("jangmun", 1, "", 1, "제목 없는 장문")).toThrow();
    expect(() => ins("danmun", 1, "", 2, "seq가 1이 아닌 단문")).toThrow();
    expect(() => ins("danmun", 1, "", 1, "가".repeat(151))).toThrow();
    ins("danmun", 1, "", 1, "가".repeat(150));  // 150자는 통과
  });
});

/* ── 문장 읽기 (공개 GET) ─────────────────────────────────────────── */
const seedDanmun = () => db.exec(`
  INSERT INTO sentences (kind, level, title, seq, text) VALUES
  ('danmun', 1, '', 1, '하늘이 맑다.'),
  ('danmun', 1, '', 1, '오늘도 좋은 날이다.'),
  ('danmun', 2, '', 1, '학교 가는 길에 노란 은행잎이 쌓였다.'),
  ('danmun', 3, '', 1, '아침 일찍 일어나 창문을 열었더니 눈이 내려 있었다.'),
  ('jangmun', 1, '가을', 1, '장문은 섞이면 안 된다.');
`);

describe("GET ?action=sentences", () => {
  it("단문을 난이도별 배열로 돌려준다 (장문은 섞이지 않는다)", async () => {
    seedDanmun();
    const { status, body } = await json(get("sentences&kind=danmun"));
    expect(status).toBe(200);
    expect(body.levels).toEqual({
      "1": ["하늘이 맑다.", "오늘도 좋은 날이다."],
      "2": ["학교 가는 길에 노란 은행잎이 쌓였다."],
      "3": ["아침 일찍 일어나 창문을 열었더니 눈이 내려 있었다."],
    });
    expect(body.updatedAt).toBeTruthy();
  });

  it("kind를 생략하면 단문으로 본다", async () => {
    seedDanmun();
    const { body } = await json(get("sentences"));
    expect(Object.keys(body.levels)).toEqual(["1", "2", "3"]);
  });

  it("등록된 단문이 없으면 levels: null (프런트가 내장값을 쓴다)", async () => {
    const { status, body } = await json(get("sentences&kind=danmun"));
    expect(status).toBe(200);
    expect(body.levels).toBeNull();
  });

  it("DB가 없으면 levels: null", async () => {
    const res = await onRequest({
      env: {},
      request: new Request("http://localhost:8788/api?action=sentences&kind=danmun"),
    });
    expect(await res.json()).toEqual({ levels: null });
  });

  it("아직 지원하지 않는 kind는 400", async () => {
    seedDanmun();
    const { status, body } = await json(get("sentences&kind=jangmun"));
    expect(status).toBe(400);
    expect(body.error).toBe("unsupported kind");
  });

  it("같은 난이도 안에서는 등록 순서(id)를 지킨다", async () => {
    db.exec(`INSERT INTO sentences (kind, level, title, seq, text) VALUES
      ('danmun', 1, '', 1, '나중'), ('danmun', 1, '', 1, '먼저');`);
    const { body } = await json(get("sentences&kind=danmun"));
    expect(body.levels["1"]).toEqual(["나중", "먼저"]);
  });
});

/* ── 기록 저장 (단문: 오늘 기록 + 명예의전당 원자 저장) ──────────── */
const save = (over = {}) =>
  json(post({
    action: "saveRecord", board: "danmun",
    name: "김하늘", school: "우리초", wpm: 100, acc: 95, ...over,
  }));
const hof = () => db.rows("SELECT name, school, wpm, accuracy FROM hall_of_fame WHERE board='danmun' ORDER BY wpm DESC, accuracy DESC, recorded_at ASC, id ASC");
const today = () => db.rows("SELECT name, wpm FROM today_records");

describe("saveRecord — 단문", () => {
  it("한 번의 요청으로 오늘 기록과 명예의전당에 모두 남는다", async () => {
    const { status, body } = await save();
    expect(status).toBe(200);
    expect(body.ok).toBe(true);
    expect(today()).toHaveLength(1);
    expect(hof()).toEqual([{ name: "김하늘", school: "우리초", wpm: 100, accuracy: 95 }]);
  });

  it("전당은 같은 사람(이름+학교)당 최고 기록 한 줄만 남긴다", async () => {
    await save({ wpm: 100 });
    await save({ wpm: 150 });
    await save({ wpm: 120 });
    expect(today()).toHaveLength(3);          // 오늘 기록은 친 만큼 다 남는다
    expect(hof()).toEqual([{ name: "김하늘", school: "우리초", wpm: 150, accuracy: 95 }]);
  });

  it("타수가 같으면 정확도가 더 높은 기록으로 갱신된다", async () => {
    await save({ wpm: 100, acc: 90 });
    await save({ wpm: 100, acc: 97 });
    expect(hof()).toEqual([{ name: "김하늘", school: "우리초", wpm: 100, accuracy: 97 }]);
  });

  it("같은 이름이라도 학교가 다르면 다른 사람이다", async () => {
    await save({ school: "우리초", wpm: 100 });
    await save({ school: "이웃초", wpm: 90 });
    expect(hof()).toHaveLength(2);
  });

  it("21명이 기록해도 상위 20명만 남는다", async () => {
    for (let i = 1; i <= 21; i++) await save({ name: `학생${i}`, wpm: 100 + i });
    const rows = hof();
    expect(rows).toHaveLength(20);
    expect(rows[0].wpm).toBe(121);
    expect(rows.map(r => r.name)).not.toContain("학생1"); // 가장 낮은 기록이 밀려난다
  });

  it("동률 정렬은 정확도 → 먼저 세운 순", async () => {
    await save({ name: "가", wpm: 100, acc: 90 });
    await save({ name: "나", wpm: 100, acc: 99 });
    expect(hof().map(r => r.name)).toEqual(["나", "가"]);
  });

  it("전당 저장이 실패하면 오늘 기록도 남지 않는다 (한 트랜잭션)", async () => {
    const orig = db.batch.bind(db);
    db.batch = (stmts) => orig([...stmts, db.prepare("INSERT INTO 없는테이블 VALUES (1)")]);
    const { status } = await save();
    expect(status).toBe(500);
    expect(today()).toHaveLength(0);
    expect(hof()).toHaveLength(0);
  });

  it("자리·낱말연습(board=today)은 예전처럼 오늘 기록에만 남는다", async () => {
    const { body } = await json(post({
      action: "saveRecord", board: "today",
      name: "김하늘", school: "우리초", wpm: 80, acc: 90,
    }));
    expect(body.ok).toBe(true);
    expect(today()).toHaveLength(1);
    expect(db.rows("SELECT * FROM hall_of_fame")).toHaveLength(0);
  });
});
