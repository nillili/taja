// api.js — 브라우저 → /api (Cloudflare Pages Function) → D1
// API 실패 시 fallback 데이터로 조용히 대체 (연습은 항상 동작).

import { WORD_STEPS } from "./wordSteps.js";
import { DANMUN_LEVELS, normalizeDanmunLevels } from "./danmunSteps.js";

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

// ── 낱말 데이터 (D1이 원본, 실패 시 내장 fallback) ─────────────────
let _wordsCache = null;
export async function getWords() {
  if (_wordsCache) return _wordsCache;
  const data = await apiFetch("words");
  _wordsCache = (data && data.steps) ? data.steps : WORD_STEPS;
  return _wordsCache;
}

// 관리 화면에서 단어를 바꾼 뒤 호출 → 다음 getWords()가 서버를 다시 읽는다
export function invalidateWords() { _wordsCache = null; }

// ── 단문 데이터 (D1이 원본, 실패 시 내장 fallback) ─────────────────
// 반환: { levels, source: "server" | "fallback", updatedAt }
// 응답을 그대로 믿지 않고 normalizeDanmunLevels로 걸러서 캐시한다.
// 서버가 특정 단계를 비워 보낸 것은 관리자의 뜻이므로 fallback으로 덮지 않는다.
let _sentCache = null;
export async function getSentences() {
  if (_sentCache) return _sentCache;
  const data = await apiFetch("sentences", { kind: "danmun" });
  const levels = data ? normalizeDanmunLevels(data.levels) : null;
  _sentCache = levels
    ? { levels, source: "server", updatedAt: data.updatedAt || null }
    : { levels: DANMUN_LEVELS, source: "fallback", updatedAt: null };
  return _sentCache;
}

// 관리 화면에서 문장을 바꾼 뒤 호출 → 다음 getSentences()가 서버를 다시 읽는다
export function invalidateSentences() { _sentCache = null; }

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

// ── 관리자 API (PIN 동봉 POST) ─────────────────────────────────────
// 상태코드와 무관하게 JSON 본문을 그대로 돌려준다 → UI가 error 메시지를 쓸 수 있다.
export async function adminApi(action, params = {}) {
  try {
    const url = new URL("/api", window.location.origin);
    const res = await fetch(url.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...params }),
    });
    const ct = res.headers.get("content-type") || "";
    if (!ct.includes("application/json")) {
      return { ok: false, error: "api unavailable", status: res.status };
    }
    const body = await res.json();
    return { ...body, status: res.status };
  } catch {
    return { ok: false, error: "network" };
  }
}
