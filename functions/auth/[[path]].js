// Cloudflare Pages Function — neobus 로그인(SSO)
// 기준: NEOBUS_SSO/docs/SSO_설정방법.md §3-1 (Hono → Pages Function 으로 옮김)
//
//   GET  /auth/start    → neobus 인가 화면으로
//   GET  /auth/callback → 열쇠로 토큰 교환 → 세션 쿠키 → /
//   POST /auth/logout   → neobus 토큰 폐기 + 세션 삭제
//   GET  /auth/me       → { user: { name, school } | null }  (화면용)
//
// 브라우저에는 식별자만(로그인 시도 쿠키, 세션 쿠키). verifier·link_token 은 KV 에만 둔다.
// env: AUTH_KV, NEOBUS_ORIGIN, MERGE_CLIENT_ID, MERGE_CLIENT_SECRET, MERGE_REDIRECT_URI

const TX_TTL_S = 10 * 60;
// 세션 8시간 — link_token(12시간)보다 길게 잡지 않는다
const SESSION_TTL_S = 8 * 60 * 60;
// neobus 와 같은 호스트에서 시험할 때 쿠키 이름이 겹치지 않게 앱 고유 이름을 쓴다
const TX_COOKIE = "taja_login_tx";
const SID_COOKIE = "taja_sid";
const NO_STORE = { "Cache-Control": "private, no-store" };

// ── 도구 ───────────────────────────────────────────────
function b64url(bytes) {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
const randomB64 = (n) => b64url(crypto.getRandomValues(new Uint8Array(n)));
async function s256(v) {
  return b64url(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(v))));
}
function timingSafeEqual(a, b) {
  const ab = new TextEncoder().encode(a), bb = new TextEncoder().encode(b);
  let diff = ab.length ^ bb.length;
  for (let i = 0; i < Math.max(ab.length, bb.length); i++) diff |= (ab[i] ?? 0) ^ (bb[i] ?? 0);
  return diff === 0;
}
function readCookie(header, name) {
  for (const part of (header ?? "").split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return v.join("=") || null;
  }
  return null;
}
function cookie(name, value, maxAge, path, secure) {
  return [`${name}=${value}`, `Path=${path}`, "HttpOnly", "SameSite=Lax", `Max-Age=${maxAge}`, ...(secure ? ["Secure"] : [])].join("; ");
}
const isSecure = (url) => new URL(url).protocol === "https:";

// ── neobus 호출 ─────────────────────────────────────────
// 서버 간 호출. 10초 타임아웃. data 가 없는 성공(revoke)도 성공으로 본다.
async function callNeobus(env, path, init = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10_000);
  try {
    const res = await fetch(new URL(path, env.NEOBUS_ORIGIN), { ...init, signal: ctrl.signal });
    const body = await res.json().catch(() => null);
    if (!res.ok || !body?.success) return { ok: false, status: res.status, error: String(body?.error ?? "UPSTREAM_ERROR") };
    return { ok: true, data: body.data };
  } catch (e) {
    const aborted = e instanceof Error && e.name === "AbortError";
    return { ok: false, status: aborted ? 504 : 502, error: aborted ? "TIMEOUT" : "UNREACHABLE" };
  } finally {
    clearTimeout(timer);
  }
}

const callAsUser = (env, linkToken, path, init = {}) =>
  callNeobus(env, path, { ...init, headers: { ...(init.headers ?? {}), Authorization: `Bearer ${linkToken}` } });

const fetchMe = (env, linkToken) => callAsUser(env, linkToken, "/api/merge-auth/me");

function errorPage(message, status, clearTx) {
  const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>로그인 실패</title></head><body style="font-family:system-ui;max-width:30rem;margin:15vh auto;padding:0 1.5rem">
<h1>로그인하지 못했습니다</h1><p>${message}</p><p><a href="/auth/start">다시 로그인하기</a> · <a href="/">처음으로</a></p></body></html>`;
  return new Response(html, { status, headers: { "Content-Type": "text/html; charset=utf-8", "Set-Cookie": clearTx, ...NO_STORE } });
}

// ── 경로 ───────────────────────────────────────────────
async function start(request, env) {
  const txId = randomB64(16);
  const state = randomB64(24);
  const verifier = randomB64(48); // 64자. neobus 검사: 43~128자
  await env.AUTH_KV.put(`tx:${txId}`, JSON.stringify({ state, verifier }), { expirationTtl: TX_TTL_S });

  const u = new URL("/merge/authorize", env.NEOBUS_ORIGIN);
  u.searchParams.set("client_id", env.MERGE_CLIENT_ID);
  u.searchParams.set("redirect_uri", env.MERGE_REDIRECT_URI);
  u.searchParams.set("state", state);
  u.searchParams.set("code_challenge", await s256(verifier));
  u.searchParams.set("code_challenge_method", "S256");
  return new Response(null, {
    status: 302,
    headers: { Location: u.toString(), "Set-Cookie": cookie(TX_COOKIE, txId, TX_TTL_S, "/auth", isSecure(request.url)), ...NO_STORE },
  });
}

async function callback(request, env) {
  const sec = isSecure(request.url);
  const clearTx = cookie(TX_COOKIE, "", 0, "/auth", sec);
  const q = new URL(request.url).searchParams;
  const code = q.get("code") ?? "";
  const state = q.get("state") ?? "";
  const txId = readCookie(request.headers.get("Cookie"), TX_COOKIE);
  if (!txId || !code || !state) return errorPage("로그인 요청이 올바르지 않습니다.", 400, clearTx);

  // 꺼내면서 지운다 — 같은 콜백이 두 번 와도 두 번째는 실패한다
  const tx = await env.AUTH_KV.get(`tx:${txId}`, "json");
  await env.AUTH_KV.delete(`tx:${txId}`);
  if (!tx || !timingSafeEqual(tx.state, state)) return errorPage("로그인 요청이 만료되었거나 올바르지 않습니다.", 400, clearTx);

  const ex = await callNeobus(env, "/api/merge-auth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: env.MERGE_CLIENT_ID,
      client_secret: env.MERGE_CLIENT_SECRET,
      redirect_uri: env.MERGE_REDIRECT_URI,
      code,
      code_verifier: tx.verifier,
    }),
  });
  if (!ex.ok) {
    console.log("token exchange failed", ex.status, ex.error); // invalid_client = 열쇠·client_id 확인
    return errorPage("네오버스와 연결하지 못했습니다.", 502, clearTx);
  }
  const me = await fetchMe(env, ex.data.link_token);
  if (!me.ok) return errorPage("계정 정보를 확인하지 못했습니다.", 502, clearTx);

  const sid = randomB64(32);
  const ttl = Math.min(SESSION_TTL_S, Math.max(60, ex.data.expires_in - 60));
  await env.AUTH_KV.put(`sess:${sid}`, JSON.stringify({ linkToken: ex.data.link_token, user: me.data }), { expirationTtl: ttl });

  const h = new Headers({ Location: "/", ...NO_STORE });
  h.append("Set-Cookie", clearTx);
  h.append("Set-Cookie", cookie(SID_COOKIE, sid, ttl, "/", sec));
  return new Response(null, { status: 302, headers: h });
}

async function logout(request, env) {
  const sid = readCookie(request.headers.get("Cookie"), SID_COOKIE);
  if (sid) {
    const s = await env.AUTH_KV.get(`sess:${sid}`, "json");
    if (s) await callAsUser(env, s.linkToken, "/api/merge-auth/revoke", { method: "POST" });
    await env.AUTH_KV.delete(`sess:${sid}`);
  }
  return new Response(null, {
    status: 303,
    headers: { Location: "/", "Set-Cookie": cookie(SID_COOKIE, "", 0, "/", isSecure(request.url)), ...NO_STORE },
  });
}

// 화면용 — 이름과 클래스명(학교 칸에 표시)만 내보낸다. 토큰은 내보내지 않는다.
async function me(request, env) {
  const sid = readCookie(request.headers.get("Cookie"), SID_COOKIE);
  const s = sid ? await env.AUTH_KV.get(`sess:${sid}`, "json") : null;
  const user = s ? { name: s.user.name, school: s.user.class?.name ?? "" } : null;
  return new Response(JSON.stringify({ user }), {
    headers: { "Content-Type": "application/json; charset=utf-8", ...NO_STORE },
  });
}

// 쓰기 요청(POST 등)은 내 사이트에서 온 것만 받는다
function sameOrigin(request) {
  const origin = request.headers.get("Origin");
  if (origin === new URL(request.url).origin) return true;
  return !origin && !request.headers.get("Sec-Fetch-Site"); // 브라우저가 아닌 호출(curl·시험 스크립트)
}

export async function onRequest({ request, env, params }) {
  const route = [].concat(params.path ?? []).join("/");
  const m = request.method;
  if (m === "GET" && route === "start") return start(request, env);
  if (m === "GET" && route === "callback") return callback(request, env);
  if (m === "GET" && route === "me") return me(request, env);
  if (m === "POST" && route === "logout") {
    if (!sameOrigin(request)) return new Response(JSON.stringify({ success: false, error: "FORBIDDEN_ORIGIN" }), { status: 403 });
    return logout(request, env);
  }
  return new Response("Not Found", { status: 404 });
}
