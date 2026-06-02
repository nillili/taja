// api.js — 브라우저 → /api (Cloudflare Pages Function) → D1
// API 실패 시 fallback 데이터로 조용히 대체 (연습은 항상 동작).

import { WORD_STEPS } from "./wordSteps.js";

async function apiFetch(action, params = {}, init = {}) {
  try {
    const url = new URL("/api", window.location.origin);
    url.searchParams.set("action", action);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    const res = await fetch(url.toString(), init);
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") || "";
    // Vite SPA fallback이 HTML을 200으로 반환하는 경우 무시
    if (!ct.includes("application/json")) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// ── 낱말 데이터 (내장 fallback 사용, API 없이도 동작) ──────────────
let _wordsCache = null;
export async function getWords() {
  if (_wordsCache) return _wordsCache;
  const data = await apiFetch("words");
  _wordsCache = (data && data.steps) ? data.steps : WORD_STEPS;
  return _wordsCache;
}

// ── 기록 읽기 ──────────────────────────────────────────────────────
// board: "today" | "danmun" | "jangmun"
// 반환: [{ recorded_at, name, school, wpm, acc }, ...] 또는 []
export async function fetchRecords(board = "today") {
  const data = await apiFetch("records", { board });
  return Array.isArray(data) ? data : [];
}

// ── 기록 저장 (비동기, 실패해도 조용히 무시) ───────────────────────
// data: { board, name, school, wpm, acc, screen?, step?, mode? }
export async function saveRecord(data) {
  try {
    const url = new URL("/api", window.location.origin);
    const res = await fetch(url.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "saveRecord", ...data }),
    });
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") || "";
    if (!ct.includes("application/json")) return null;
    return await res.json();
  } catch {
    return null;
  }
}
