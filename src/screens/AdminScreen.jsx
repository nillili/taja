// AdminScreen.jsx — 설정(⚙) → PIN 게이트 → 데이터 관리(낱말 / 단문 / 장문).
// PIN은 sessionStorage에 두고, 마운트할 때마다 서버로 다시 검증한 뒤에만 패널을 연다.

import { useState, useEffect, useMemo, useRef } from "react";
import * as XLSX from "xlsx";
import { adminApi, invalidateWords, getWords } from "../data/api.js";
import { setWordSource } from "../data/wordSteps.js";

const PIN_KEY = "taja.admin.pin";
const STEPS = [1, 2, 3, 4];
const LEVELS = [1, 2, 3];
const MODES = [{ id: "basic", label: "기본" }, { id: "adv", label: "심화" }];
const modeLabel = (m) => (m === "adv" ? "심화" : "기본");

const TABS = [
  { id: "words",   label: "낱말관리" },
  { id: "danmun",  label: "단문연습" },
  { id: "jangmun", label: "장문연습" },
];

/* ── 엑셀 형식 ─────────────────────────────────────────────────────
   낱말   : 8칸 = 1단계_기본, 1단계_심화, … 4단계_심화 (구글시트와 동일)
   단문   : 3칸 = 1단계, 2단계, 3단계 (칸마다 문장 하나)
   장문   : 3칸 = 난이도, 제목, 문장 (같은 제목끼리 적은 순서가 곧 문장 순서)  */

const WORD_HEADER = STEPS.flatMap((s) => [`${s}단계_기본`, `${s}단계_심화`]);
const DANMUN_HEADER = LEVELS.map((l) => `${l}단계`);
const JANGMUN_HEADER = ["난이도", "제목", "문장"];

function parseWordSheet(rows) {
  const out = [], seen = new Set();
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r] || [];
    for (let c = 0; c < 8; c++) {
      const text = String(row[c] == null ? "" : row[c]).trim();
      if (!text) continue;
      const step = Math.floor(c / 2) + 1;
      const mode = c % 2 ? "adv" : "basic";
      const key = `${step}-${mode}-${text}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ step, mode, text });
    }
  }
  return out;
}

function parseDanmunSheet(rows) {
  const out = [], seen = new Set();
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r] || [];
    for (let c = 0; c < 3; c++) {
      const text = String(row[c] == null ? "" : row[c]).trim();
      if (!text) continue;
      const key = `${c + 1}|${text}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ level: c + 1, text });
    }
  }
  return out;
}

function parseJangmunSheet(rows) {
  const out = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r] || [];
    const level = Number(String(row[0] == null ? "" : row[0]).trim());
    const title = String(row[1] == null ? "" : row[1]).trim();
    const text = String(row[2] == null ? "" : row[2]).trim();
    if (!text) continue;
    out.push({ level, title, text });   // seq는 서버가 등장 순서대로 매긴다
  }
  return out;
}

/* 표(2차원 배열)를 xlsx로 내려받기 */
function downloadSheet(aoa, filename, sheetName) {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), sheetName);
  XLSX.writeFile(wb, filename);
}

export default function AdminScreen({ onSentencesChanged }) {
  const [pin, setPin] = useState("");
  const [authed, setAuthed] = useState(false);
  const [checking, setChecking] = useState(true);
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState("");
  const [tab, setTab] = useState("words");

  useEffect(() => {
    let alive = true;
    (async () => {
      const saved = sessionStorage.getItem(PIN_KEY);
      if (!saved) { if (alive) setChecking(false); return; }
      const res = await adminApi("adminVerify", { pin: saved });
      if (!alive) return;
      if (res.ok) { setPin(saved); setAuthed(true); }
      else { sessionStorage.removeItem(PIN_KEY); setPin(""); }
      setChecking(false);
    })();
    return () => { alive = false; };
  }, []);

  const submitPin = async (e) => {
    e.preventDefault();
    const value = pinInput.trim();
    if (!value) return;
    const res = await adminApi("adminVerify", { pin: value });
    if (res.ok) {
      sessionStorage.setItem(PIN_KEY, value);
      setPin(value); setAuthed(true); setPinError("");
    } else if (res.status === 429) {
      setPinError("잠시 후 다시 시도해 주세요. (여러 번 틀렸어요)");
    } else if (res.error === "api unavailable") {
      setPinError("서버에 연결할 수 없어요. npm run dev:full (8788)로 실행했는지 확인하세요.");
    } else {
      setPinError("비밀번호가 달라요.");
    }
    setPinInput("");
  };

  const lockOut = () => {
    sessionStorage.removeItem(PIN_KEY);
    setPin(""); setAuthed(false); setPinError("다시 로그인해 주세요.");
  };

  return (
    <div data-screen-label="설정" style={{ flex: 1, minHeight: 0, overflow: "auto" }}>
      <div style={{ maxWidth: 1180, margin: "0 auto", width: "100%", boxSizing: "border-box", padding: "16px 40px 40px" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 14, marginBottom: 16 }}>
          <span style={{ fontFamily: '"IBM Plex Mono",monospace', fontSize: 11, color: "var(--accent)", letterSpacing: "0.18em" }}>SETTINGS</span>
          <h2 style={{ margin: 0, fontSize: 24 }}>데이터 관리</h2>
        </div>

        {checking ? <p style={{ color: "var(--ink-faint)" }}>확인하는 중…</p>
          : !authed ? (
            <form onSubmit={submitPin} style={{ maxWidth: 320 }}>
              <p style={{ color: "var(--ink-soft)", marginTop: 0 }}>비밀번호를 입력하세요.</p>
              <input
                type="password" inputMode="numeric" autoFocus
                value={pinInput} onChange={(e) => setPinInput(e.target.value)}
                placeholder="••••" style={{ ...input, width: "100%", letterSpacing: "0.4em" }}
              />
              {pinError && <p style={{ color: "var(--accent)", fontSize: 13 }}>{pinError}</p>}
              <button type="submit" style={{ ...btn.primary, width: "100%", marginTop: 10 }}>들어가기</button>
            </form>
          ) : (
            <>
              <div style={{ display: "flex", gap: 6, marginBottom: 16, borderBottom: "1px solid var(--rule)" }}>
                {TABS.map((t) => (
                  <button key={t.id} onClick={() => setTab(t.id)}
                    style={t.id === tab ? btn.navOn : btn.nav}>{t.label}</button>
                ))}
              </div>
              {tab === "words"
                ? <WordPanel pin={pin} onLockOut={lockOut} />
                : <SentencePanel key={tab} kind={tab} pin={pin} onLockOut={lockOut}
                                 onChanged={onSentencesChanged} />}
            </>
          )}
      </div>
    </div>
  );
}

/* ── 공통: 관리자 호출 + 메시지 ───────────────────────────────────── */
function useAdmin(pin, onLockOut) {
  return async (action, params) => {
    const res = await adminApi(action, { pin, ...params });
    if (res.status === 403) onLockOut();
    return res;
  };
}

/* ── 낱말 관리 ────────────────────────────────────────────────────── */
function WordPanel({ pin, onLockOut }) {
  const call = useAdmin(pin, onLockOut);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState(1);
  const [mode, setMode] = useState("basic");
  const [msg, setMsg] = useState("");
  const [editId, setEditId] = useState(null);
  const [editText, setEditText] = useState("");
  const [newText, setNewText] = useState("");
  const [upload, setUpload] = useState(null);
  const fileRef = useRef(null);

  const load = async () => {
    setLoading(true);
    const res = await call("adminWordList");
    if (res.ok) setRows(res.rows || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const after = async (res, okMsg) => {
    if (res.ok) {
      setMsg(okMsg);
      await load();
      invalidateWords();
      setWordSource(await getWords());   // 낱말연습에도 즉시 반영
    } else setMsg(errorText(res));
    return res.ok;
  };

  const visible = useMemo(() => rows.filter((r) => r.step === step && r.mode === mode), [rows, step, mode]);
  const buckets = useMemo(() => {
    const b = {};
    for (const r of rows) b[`${r.step}-${r.mode}`] = (b[`${r.step}-${r.mode}`] || 0) + 1;
    return b;
  }, [rows]);

  // 현재 등록된 낱말을 업로드와 같은 8칸 형식으로 내려받기
  const downloadSample = () => {
    const cols = WORD_HEADER.map((_, c) =>
      rows.filter((r) => r.step === Math.floor(c / 2) + 1 && r.mode === (c % 2 ? "adv" : "basic")).map((r) => r.text));
    const height = Math.max(1, ...cols.map((c) => c.length));
    const aoa = [WORD_HEADER];
    for (let i = 0; i < height; i++) aoa.push(cols.map((c) => c[i] || ""));
    downloadSheet(aoa, "낱말_샘플.xlsx", "낱말");
  };

  const addWord = async (e) => {
    e.preventDefault();
    const text = newText.trim();
    if (!text) return;
    if (await after(await call("adminWordAdd", { step, mode, text }), `"${text}" 등록했어요.`)) setNewText("");
  };
  const saveEdit = async (id) => {
    const text = editText.trim();
    if (!text) return;
    if (await after(await call("adminWordUpdate", { id, text }), "고쳤어요.")) setEditId(null);
  };
  const removeWord = async (row) => {
    if (!confirm(`"${row.text}"을(를) 지울까요?`)) return;
    await after(await call("adminWordDelete", { id: row.id }), "지웠어요.");
  };

  const pickFile = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setMsg("");
    try {
      const parsed = parseWordSheet(await readSheet(file));
      const bk = {};
      for (const r of parsed) bk[`${r.step}-${r.mode}`] = (bk[`${r.step}-${r.mode}`] || 0) + 1;
      const missing = [];
      for (const s of STEPS) for (const m of ["basic", "adv"])
        if (!bk[`${s}-${m}`]) missing.push(`${s}단계 ${modeLabel(m)}`);
      setUpload({ rows: parsed, buckets: bk, missing, name: file.name });
    } catch {
      setUpload(null);
      setMsg("엑셀을 읽지 못했어요. 8칸(1단계_기본 … 4단계_심화) 형식인지 확인해 주세요.");
    }
  };

  const doReplace = async () => {
    if (!upload || upload.missing.length) return;
    if (!confirm(`기존 낱말을 모두 지우고 ${upload.rows.length}개로 바꿉니다. 계속할까요?`)) return;
    const res = await call("adminWordsReplace", { rows: upload.rows });
    if (await after(res, `${res.inserted}개로 바꿨어요.`)) {
      setUpload(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  };
  const doRestore = async () => {
    if (!confirm("직전 교체 전 상태로 되돌릴까요?")) return;
    const res = await call("adminWordsRestore");
    await after(res, `${res.restored}개로 되돌렸어요.`);
  };

  return (
    <div>
      <div style={filterBar}>
        {STEPS.map((s) => (
          <button key={s} onClick={() => { setStep(s); setEditId(null); }} style={s === step ? btn.tabOn : btn.tab}>{s}단계</button>
        ))}
        <span style={{ width: 12 }} />
        {MODES.map((m) => (
          <button key={m.id} onClick={() => { setMode(m.id); setEditId(null); }} style={m.id === mode ? btn.tabOn : btn.tab}>{m.label}</button>
        ))}
        <span style={countText}>
          {step}단계 {modeLabel(mode)} · {visible.length}개 &nbsp;/&nbsp; 전체 {rows.length}개
        </span>
      </div>

      {msg && <p style={msgText}>{msg}</p>}

      <div style={twoCol}>
        <div>
          <form onSubmit={addWord} style={{ display: "flex", gap: 8, marginBottom: 10 }}>
            <input value={newText} onChange={(e) => setNewText(e.target.value)}
              placeholder={`${step}단계 ${modeLabel(mode)}에 낱말 추가`} style={{ ...input, flex: 1 }} />
            <button type="submit" style={btn.primary}>등록</button>
          </form>

          {loading ? <p style={{ color: "var(--ink-faint)" }}>불러오는 중…</p> : (
            <div style={listBox}>
              {visible.length === 0 && <p style={emptyText}>낱말이 없어요.</p>}
              {visible.map((r) => (
                <ItemRow key={r.id} row={r} editing={editId === r.id}
                  editText={editText} setEditText={setEditText}
                  onEdit={() => { setEditId(r.id); setEditText(r.text); }}
                  onSave={() => saveEdit(r.id)} onCancel={() => setEditId(null)}
                  onDelete={() => removeWord(r)} />
              ))}
            </div>
          )}
        </div>

        <UploadBox
          title="엑셀로 한꺼번에 등록"
          guide={<>구글시트를 <b>파일 → 다운로드 → .xlsx</b>로 받아 그대로 올리세요.<br />8칸 순서: 1단계_기본, 1단계_심화, … 4단계_심화 (첫 줄은 제목)</>}
          fileRef={fileRef} onPick={pickFile} onDownload={downloadSample}
          downloadLabel="현재 낱말 내려받기 (샘플)"
          upload={upload}
          summary={upload && (
            <div style={bucketGrid}>
              {STEPS.map((s) => MODES.map((m) => (
                <span key={`${s}-${m.id}`}>{s}단계 {m.label}: {upload.buckets[`${s}-${m.id}`] || 0}개</span>
              )))}
            </div>
          )}
          blocked={upload && upload.missing.length > 0}
          blockedText={upload && upload.missing.length > 0
            ? `비어 있는 칸이 있어요: ${upload.missing.join(", ")} — 8칸 모두 채워야 바꿀 수 있어요.` : ""}
          onReplace={doReplace} onRestore={doRestore}
        />
      </div>

      <p style={footNote}>전체 낱말 {rows.length}개 · 8칸 {Object.keys(buckets).length}/8 채움</p>
    </div>
  );
}

/* ── 단문 / 장문 관리 ─────────────────────────────────────────────── */
function SentencePanel({ kind, pin, onLockOut, onChanged }) {
  const call = useAdmin(pin, onLockOut);
  const isJang = kind === "jangmun";
  const name = isJang ? "장문" : "단문";

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [level, setLevel] = useState(1);
  const [msg, setMsg] = useState("");
  const [editId, setEditId] = useState(null);
  const [editText, setEditText] = useState("");
  const [newText, setNewText] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [upload, setUpload] = useState(null);
  const fileRef = useRef(null);

  const load = async () => {
    setLoading(true);
    const res = await call("adminSentenceList", { kind });
    if (res.ok) setRows(res.rows || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const after = async (res, okMsg) => {
    if (res.ok) {
      setMsg(okMsg);
      await load();
      await onChanged?.();   // 단문연습 화면에도 즉시 반영
    } else setMsg(errorText(res));
    return res.ok;
  };

  const visible = useMemo(() => rows.filter((r) => r.level === level), [rows, level]);
  const titles = useMemo(
    () => [...new Set(rows.filter((r) => r.level === level).map((r) => r.title))].filter(Boolean),
    [rows, level]
  );

  // 현재 등록된 문장을 업로드와 같은 형식으로 내려받기 (비어 있으면 예시 한 줄)
  const downloadSample = () => {
    if (isJang) {
      const aoa = [JANGMUN_HEADER];
      for (const r of rows) aoa.push([r.level, r.title, r.text]);
      if (rows.length === 0) aoa.push([1, "가을 운동장", "가을이 되면 우리 학교 운동장은 조금 달라진다."]);
      downloadSheet(aoa, "장문_샘플.xlsx", "장문");
    } else {
      const cols = LEVELS.map((l) => rows.filter((r) => r.level === l).map((r) => r.text));
      const height = Math.max(1, ...cols.map((c) => c.length));
      const aoa = [DANMUN_HEADER];
      for (let i = 0; i < height; i++) aoa.push(cols.map((c) => c[i] || ""));
      if (rows.length === 0) aoa[1] = ["하늘이 맑다.", "학교 가는 길에 노란 은행잎이 쌓였다.", "아침에 창문을 열었더니 눈이 온 마을을 덮고 있었다."];
      downloadSheet(aoa, "단문_샘플.xlsx", "단문");
    }
  };

  const addSentence = async (e) => {
    e.preventDefault();
    const text = newText.trim();
    if (!text) return;
    if (isJang && !newTitle.trim()) { setMsg("장문은 제목이 필요해요."); return; }
    const res = await call("adminSentenceAdd", { kind, level, title: isJang ? newTitle.trim() : "", text });
    if (await after(res, "등록했어요.")) setNewText("");
  };
  const saveEdit = async (id) => {
    const text = editText.trim();
    if (!text) return;
    if (await after(await call("adminSentenceUpdate", { id, text }), "고쳤어요.")) setEditId(null);
  };
  const removeSentence = async (row) => {
    if (!confirm(`"${row.text.slice(0, 20)}…"을(를) 지울까요?`)) return;
    await after(await call("adminSentenceDelete", { id: row.id }), "지웠어요.");
  };

  const pickFile = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setMsg("");
    try {
      const sheet = await readSheet(file);
      const parsed = isJang ? parseJangmunSheet(sheet) : parseDanmunSheet(sheet);
      const bad = parsed.filter((r) => !(r.level >= 1 && r.level <= 3) || (isJang && !r.title) || r.text.length > 150);
      setUpload({ rows: parsed, name: file.name, bad: bad.length });
    } catch {
      setUpload(null);
      setMsg("엑셀을 읽지 못했어요. 형식을 확인해 주세요.");
    }
  };

  const doReplace = async () => {
    if (!upload || upload.bad || upload.rows.length === 0) return;
    if (!confirm(`기존 ${name}을 모두 지우고 ${upload.rows.length}개로 바꿉니다. 계속할까요?`)) return;
    const res = await call("adminSentencesReplace", { kind, rows: upload.rows });
    if (await after(res, `${res.inserted}개로 바꿨어요.`)) {
      setUpload(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  };
  const doRestore = async () => {
    if (!confirm("직전 교체 전 상태로 되돌릴까요?")) return;
    await after(await call("adminSentencesRestore", { kind }), "되돌렸어요.");
  };

  return (
    <div>
      <div style={filterBar}>
        {LEVELS.map((l) => (
          <button key={l} onClick={() => { setLevel(l); setEditId(null); }} style={l === level ? btn.tabOn : btn.tab}>{l}단계</button>
        ))}
        <span style={countText}>
          {level}단계 · {visible.length}개 {isJang && `· ${titles.length}편`} &nbsp;/&nbsp; 전체 {rows.length}개
        </span>
      </div>

      {msg && <p style={msgText}>{msg}</p>}

      <div style={twoCol}>
        <div>
          <form onSubmit={addSentence} style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
            {isJang && (
              <input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} list="jangmun-titles"
                placeholder="제목 (수필 이름)" style={{ ...input, width: 160 }} />
            )}
            {isJang && <datalist id="jangmun-titles">{titles.map((t) => <option key={t} value={t} />)}</datalist>}
            <input value={newText} onChange={(e) => setNewText(e.target.value)} maxLength={150}
              placeholder={`${level}단계에 ${name} 추가 (150자 이내)`} style={{ ...input, flex: 1, minWidth: 200 }} />
            <button type="submit" style={btn.primary}>등록</button>
          </form>

          {loading ? <p style={{ color: "var(--ink-faint)" }}>불러오는 중…</p> : (
            <div style={listBox}>
              {visible.length === 0 && <p style={emptyText}>{name}이 없어요. 엑셀로 올리거나 위에서 추가하세요.</p>}
              {visible.map((r, i) => (
                <div key={r.id}>
                  {isJang && (i === 0 || visible[i - 1].title !== r.title) && (
                    <div style={titleBar}>📄 {r.title}</div>
                  )}
                  <ItemRow row={r} editing={editId === r.id} prefix={isJang ? `${r.seq}.` : null} warnLong
                    editText={editText} setEditText={setEditText}
                    onEdit={() => { setEditId(r.id); setEditText(r.text); }}
                    onSave={() => saveEdit(r.id)} onCancel={() => setEditId(null)}
                    onDelete={() => removeSentence(r)} />
                </div>
              ))}
            </div>
          )}
        </div>

        <UploadBox
          title="엑셀로 한꺼번에 등록"
          guide={isJang
            ? <>3칸 순서: <b>난이도, 제목, 문장</b> (첫 줄은 제목 행)<br />같은 제목끼리 적은 순서가 곧 문장 순서가 됩니다.</>
            : <>3칸 순서: <b>1단계, 2단계, 3단계</b> (첫 줄은 제목 행)<br />칸마다 문장 하나씩, 150자 이내로 적으세요.</>}
          fileRef={fileRef} onPick={pickFile} onDownload={downloadSample}
          downloadLabel={`현재 ${name} 내려받기 (샘플)`}
          upload={upload}
          summary={upload && <p style={{ margin: "6px 0 0", color: "var(--ink-soft)", fontSize: 12 }}>
            {isJang
              ? `${new Set(upload.rows.map((r) => `${r.level}|${r.title}`)).size}편 / 문장 ${upload.rows.length}개`
              : LEVELS.map((l) => `${l}단계 ${upload.rows.filter((r) => r.level === l).length}개`).join(" · ")}
          </p>}
          blocked={upload && (upload.bad > 0 || upload.rows.length === 0)}
          blockedText={upload && upload.bad > 0
            ? `잘못된 줄이 ${upload.bad}개 있어요 (난이도 1~3${isJang ? ", 제목 필수" : ""}, 150자 이내).`
            : upload && upload.rows.length === 0 ? "읽어 들인 문장이 없어요." : ""}
          onReplace={doReplace} onRestore={doRestore}
        />
      </div>

      <p style={footNote}>
        전체 {name} {rows.length}개
        {isJang && ` · ${new Set(rows.map((r) => `${r.level}|${r.title}`)).size}편`}
      </p>
    </div>
  );
}

/* ── 공통 조각 ────────────────────────────────────────────────────── */
function ItemRow({ row, editing, prefix, editText, setEditText, onEdit, onSave, onCancel, onDelete, warnLong = false }) {
  return (
    <div style={itemRow}>
      {prefix && <span style={seqBadge}>{prefix}</span>}
      {editing ? (
        <>
          <input value={editText} autoFocus maxLength={150} onChange={(e) => setEditText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") onSave(); if (e.key === "Escape") onCancel(); }}
            style={{ ...input, flex: 1 }} />
          <button onClick={onSave} style={btn.small}>저장</button>
          <button onClick={onCancel} style={btn.small}>취소</button>
        </>
      ) : (
        <>
          <span style={{ flex: 1 }}>{row.text}</span>
          {warnLong && row.text.length > 60 && (
            // 막지는 않는다. 다만 학생 PC의 화면 폭을 알 수 없어 두 줄로 보일 수 있다는 것만 알려 준다.
            <span
              title="학생 화면에서 두 줄로 보일 수 있어요"
              style={{ fontSize: 11, color: "var(--ink-faint)", border: "1px solid var(--rule)", borderRadius: 4, padding: "1px 6px", whiteSpace: "nowrap" }}
            >
              긴 문장 {row.text.length}자
            </span>
          )}
          <button onClick={onEdit} style={btn.small}>수정</button>
          <button onClick={onDelete} style={btn.small}>삭제</button>
        </>
      )}
    </div>
  );
}

function UploadBox({ title, guide, fileRef, onPick, onDownload, downloadLabel, upload, summary, blocked, blockedText, onReplace, onRestore }) {
  return (
    <div style={uploadBox}>
      <h3 style={{ margin: "0 0 6px", fontSize: 16 }}>{title}</h3>
      <p style={{ margin: "0 0 10px", fontSize: 12, color: "var(--ink-soft)", lineHeight: 1.6 }}>{guide}</p>

      <button onClick={onDownload} style={{ ...btn.ghost, width: "100%", marginBottom: 10 }}>⬇ {downloadLabel}</button>
      <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={onPick} style={{ fontSize: 13 }} />

      {upload && (
        <div style={{ marginTop: 12, fontSize: 13 }}>
          <p style={{ margin: "0 0 6px" }}><b>{upload.name}</b> — 총 {upload.rows.length}개</p>
          {summary}
          {blocked && <p style={{ color: "var(--accent)", marginTop: 8 }}>{blockedText}</p>}
          <button onClick={onReplace} disabled={!!blocked}
            style={{ ...btn.primary, marginTop: 10, width: "100%", opacity: blocked ? 0.4 : 1 }}>
            전체 교체하기
          </button>
        </div>
      )}

      <hr style={{ border: 0, borderTop: "1px dashed var(--rule)", margin: "16px 0 12px" }} />
      <button onClick={onRestore} style={{ ...btn.ghost, width: "100%" }}>직전 교체 되돌리기</button>
      <p style={{ margin: "6px 0 0", fontSize: 11, color: "var(--ink-faint)" }}>
        엑셀로 교체하기 직전 상태 1회분을 되살립니다.
      </p>
    </div>
  );
}

async function readSheet(file) {
  const wb = XLSX.read(await file.arrayBuffer());
  return XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 });
}

function errorText(res) {
  switch (res.error) {
    case "duplicate":         return "이미 있는 내용이에요.";
    case "not found":         return "찾지 못했어요.";
    case "invalid input":     return "입력이 올바르지 않아요.";
    case "invalid row":       return "파일에 잘못된 줄이 있어요.";
    case "empty rows":        return "등록할 내용이 없어요.";
    case "no backup":         return "되돌릴 기록이 없어요.";
    case "too many attempts": return "잠시 후 다시 시도해 주세요.";
    case "api unavailable":   return "서버에 연결할 수 없어요. (npm run dev:full → 8788)";
    default:
      if (String(res.error || "").startsWith("empty bucket")) return "8칸 중 비어 있는 칸이 있어요.";
      return "실패했어요. 다시 시도해 주세요.";
  }
}

/* ── 스타일 ───────────────────────────────────────────────────────── */
const input = {
  padding: "8px 10px", borderRadius: 8, border: "1.5px solid var(--rule)",
  background: "var(--paper)", color: "var(--ink)", fontSize: 14, fontFamily: "inherit",
};
const btnBase = {
  padding: "8px 14px", borderRadius: 8, border: "1.5px solid var(--rule)",
  background: "var(--paper-deep)", color: "var(--ink)", cursor: "pointer",
  fontSize: 14, fontFamily: "inherit",
};
const btn = {
  primary: { ...btnBase, background: "var(--accent)", color: "#fff", borderColor: "var(--ink)" },
  ghost:   { ...btnBase, background: "transparent" },
  tab:     { ...btnBase, padding: "6px 12px", fontSize: 13 },
  tabOn:   { ...btnBase, padding: "6px 12px", fontSize: 13, background: "var(--accent)", color: "#fff", borderColor: "var(--ink)" },
  small:   { ...btnBase, padding: "4px 10px", fontSize: 12 },
  nav:     { ...btnBase, border: 0, borderBottom: "3px solid transparent", borderRadius: "8px 8px 0 0",
             background: "transparent", color: "var(--ink-soft)", fontSize: 15, padding: "8px 16px" },
  navOn:   { ...btnBase, border: 0, borderBottom: "3px solid var(--accent)", borderRadius: "8px 8px 0 0",
             background: "transparent", color: "var(--accent)", fontWeight: 700, fontSize: 15, padding: "8px 16px" },
};
const filterBar = { display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 12 };
const countText = { marginLeft: "auto", fontSize: 13, color: "var(--ink-soft)" };
const msgText = { margin: "0 0 10px", color: "var(--accent)", fontSize: 13 };
const twoCol = { display: "grid", gridTemplateColumns: "minmax(0,1.3fr) minmax(0,1fr)", gap: 24, alignItems: "start" };
const listBox = { maxHeight: 420, overflow: "auto", border: "1px solid var(--rule)", borderRadius: 10 };
const itemRow = { display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", borderBottom: "1px solid var(--rule)" };
const seqBadge = { minWidth: 22, fontSize: 12, color: "var(--ink-faint)", fontFamily: '"IBM Plex Mono",monospace' };
const titleBar = { padding: "8px 10px", background: "var(--paper-deep)", fontSize: 13, fontWeight: 700, borderBottom: "1px solid var(--rule)" };
const emptyText = { padding: 14, margin: 0, color: "var(--ink-faint)" };
const uploadBox = { border: "1px solid var(--rule)", borderRadius: 10, padding: 16 };
const bucketGrid = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2px 10px", color: "var(--ink-soft)", fontSize: 12 };
const footNote = { marginTop: 14, fontSize: 12, color: "var(--ink-faint)" };
