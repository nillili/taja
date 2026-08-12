import { useState, useEffect } from "react";
import { KB_ROWS, FINGER, KH, GAP, kw, ROW_WIDTH, KB_HEIGHT } from "./keyboard.js";

/* ── 키 센터 위치 맵 (unscaled keyboard 좌표) ───────────────────────── */
const KEY_CENTERS = (() => {
  const map = {};
  KB_ROWS.forEach((row, ri) => {
    let x = 0;
    row.forEach(key => {
      const w = kw(key.w);
      if (key.type !== "pad") map[key.c] = { x: x + w / 2, y: ri * (KH + GAP) + KH / 2 };
      x += w + GAP;
    });
  });
  return map;
})();

/* 손가락 기하 (왼손 기준 SVG 좌표, viewBox 0 0 240 220)
   base: 손가락 뿌리(손등 윗변), tip: 기본 자세의 손끝, bw/tw: 뿌리/끝 반폭 */
const FINGERS = {
  pinky:  { base: { x: 83,  y: 110 }, tip: { x: 83,  y: 30 }, bw: 13, tw: 10 },
  ring:   { base: { x: 114, y: 106 }, tip: { x: 119, y: 14 }, bw: 14, tw: 11 },
  middle: { base: { x: 146, y: 101 }, tip: { x: 149, y: 4  }, bw: 14, tw: 11 },
  index:  { base: { x: 178, y: 105 }, tip: { x: 185, y: 27 }, bw: 14, tw: 10 },
};

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/* 손 div 크기 및 SVG → keyboard 좌표 변환 상수 */
const HAND_DIV_W = Math.round(0.46 * ROW_WIDTH);
const HAND_DIV_H = KB_HEIGHT + 12;
const SVG_SC  = Math.min(HAND_DIV_W / 240, HAND_DIV_H / 220);
const SVG_DX  = (HAND_DIV_W - 240 * SVG_SC) / 2;
const SVG_DY  = (HAND_DIV_H - 220 * SVG_SC) / 2;
const ORG_L   = Math.round(0.02 * ROW_WIDTH);              // left:2% (왼손 div 왼쪽 끝)
const ORG_R   = ROW_WIDTH - ORG_L - HAND_DIV_W;           // right:2% (오른손 div 왼쪽 끝)
const ORG_TOP = -2;                                         // top:-2px

function getTipPos(finger, side) {
  const fin = FINGERS[finger];
  if (!fin) return null;
  const sx = side === "R" ? 240 - fin.tip.x : fin.tip.x; // 오른손은 SVG가 좌우 반전
  return {
    x: (side === "R" ? ORG_R : ORG_L) + SVG_DX + sx * SVG_SC,
    y: ORG_TOP + SVG_DY + fin.tip.y * SVG_SC,
  };
}

/* ── 키캡 ─────────────────────────────────────────────────────────── */
function KeyCap({ data, isTarget, isPressed }) {
  const { main, top, type, w } = data;
  const width = kw(w);

  if (type === "pad") return <div style={{ width, flexShrink: 0 }} />;

  const isLetter = type === "letter";
  const isMod = type === "mod";
  const isSpace = type === "space";

  const bg = isTarget
    ? "var(--accent)"
    : isPressed
    ? "var(--paper-edge)"
    : isMod
    ? "color-mix(in oklab, var(--paper-edge) 50%, var(--paper-deep))"
    : "var(--paper-deep)";

  const borderColor = isTarget ? "var(--ink)" : "var(--rule)";
  const textColor = isTarget ? "#fff" : "var(--ink)";
  const shadow = isTarget ? "0 3px 0 var(--ink)" : isPressed ? "none" : "0 2.5px 0 var(--rule)";
  const translateY = isPressed ? "2px" : "0";

  const base = {
    position: "relative", display: "flex", flexShrink: 0,
    width, height: isSpace ? KH - 6 : KH,
    borderRadius: 8, border: `1.5px solid ${borderColor}`,
    background: bg, color: textColor,
    boxShadow: shadow, transform: `translateY(${translateY})`,
    transition: "background 0.08s, transform 0.06s, box-shadow 0.06s, border-color 0.08s",
    cursor: "default", userSelect: "none", overflow: "hidden",
    alignItems: "center", justifyContent: "center",
  };

  if (isSpace) return <div style={base} />;

  if (isMod) {
    return (
      <div style={base}>
        <span style={{ fontSize: main.length > 3 ? 11 : 12, fontFamily: '"IBM Plex Mono","Gowun Dodum",monospace', fontWeight: 500, letterSpacing: "-0.02em", textAlign: "center", lineHeight: 1.2, padding: "0 6px" }}>
          {main}
        </span>
      </div>
    );
  }

  if (isLetter) {
    const isHomeBump = data.c === "KeyF" || data.c === "KeyJ"; // ㄹ/ㅓ 기본자리 양각
    return (
      <div style={{ ...base, flexDirection: "column", alignItems: "stretch", justifyContent: "space-between", padding: "5px 7px" }}>
        <span style={{ fontSize: 22, fontFamily: '"Noto Serif KR","Jua",serif', fontWeight: isTarget ? 700 : 500, lineHeight: 1, color: isTarget ? "#fff" : "var(--ink)", alignSelf: "flex-start" }}>{top}</span>
        <span style={{ fontSize: 11, fontFamily: '"IBM Plex Mono",monospace', color: isTarget ? "rgba(255,255,255,0.7)" : "var(--ink-faint)", alignSelf: "flex-end", lineHeight: 1 }}>{main}</span>
        {isHomeBump && (
          <span style={{ position: "absolute", bottom: 4, left: "50%", transform: "translateX(-50%)", width: 16, height: 3, borderRadius: 2, background: isTarget ? "rgba(255,255,255,0.8)" : "var(--ink-faint)" }} />
        )}
      </div>
    );
  }

  // sym key
  return (
    <div style={{ ...base, flexDirection: "column", alignItems: "stretch", justifyContent: "space-between", padding: "5px 7px" }}>
      <span style={{ fontSize: 13, fontFamily: '"IBM Plex Mono",monospace', color: isTarget ? "rgba(255,255,255,0.7)" : "var(--ink-soft)", alignSelf: "flex-end", lineHeight: 1, fontWeight: 500 }}>{top}</span>
      <span style={{ fontSize: 16, fontFamily: '"IBM Plex Mono",monospace', fontWeight: 500, color: isTarget ? "#fff" : "var(--ink)", alignSelf: "flex-start", lineHeight: 1 }}>{main}</span>
    </div>
  );
}

/* ── 손 SVG (왼손 기준, 오른손은 좌우 반전) ───────────────────────── */

/* 손가락을 base에서 수직 위로 뻗은 캡슐로 그린다 (실제 방향·길이는 transform이 담당) */
function fingerPath({ base, tip, bw, tw }) {
  const len = Math.hypot(tip.x - base.x, tip.y - base.y);
  const ty = base.y - len;
  return `M ${base.x - bw} ${base.y} L ${base.x - tw} ${ty} Q ${base.x} ${ty - tw * 1.2} ${base.x + tw} ${ty} L ${base.x + bw} ${base.y} Z`;
}

/* delta(SVG 좌표)만큼 손끝을 옮기는 CSS transform — 뿌리는 고정, 회전+신축 */
function fingerTransform({ base, tip }, delta) {
  const tx = tip.x + (delta ? delta.x : 0);
  const ty = Math.min(tip.y + (delta ? delta.y : 0), base.y - 18); // 뿌리 아래로 접히지 않게
  const dx = tx - base.x, dy = ty - base.y;
  const len0 = Math.hypot(tip.x - base.x, tip.y - base.y);
  const ang = (Math.atan2(dx, -dy) * 180) / Math.PI;
  const s = Math.hypot(dx, dy) / len0;
  return `translate(${base.x}px, ${base.y}px) rotate(${ang}deg) scaleY(${s}) translate(${-base.x}px, ${-base.y}px)`;
}

/* 손가락 겹침 방지: 누르는 손가락이 새끼 쪽으로 기울면
   그쪽에 있는 손가락들을 손끝 간격(TIP_GAP)이 유지되도록 바깥으로 밀어낸다 */
const FINGER_ORDER = ["pinky", "ring", "middle", "index"]; // 왼손 SVG x 오름차순
const TIP_GAP = 30; // 이웃 손끝 최소 간격 (SVG px)

function fingerDeltas(highlightFinger, fingerDelta) {
  const deltas = {};
  if (!FINGERS[highlightFinger] || !fingerDelta) return deltas;
  deltas[highlightFinger] = fingerDelta;
  let edge = FINGERS[highlightFinger].tip.x + fingerDelta.x; // 누르는 손끝 위치
  for (let j = FINGER_ORDER.indexOf(highlightFinger) - 1; j >= 0; j--) {
    const f = FINGER_ORDER[j];
    const def = FINGERS[f].tip.x;
    const limit = edge - TIP_GAP;
    if (def > limit) deltas[f] = { x: limit - def, y: 0 };
    edge = Math.min(def, limit);
  }
  return deltas;
}

function HandSVG({ side, highlightFinger, fingerDelta }) {
  const flip = side === "R" ? -1 : 1;
  const baseColor = "rgba(120,118,138,0.32)";
  const strokeColor = "rgba(40,38,60,0.45)";
  const hotFill = "rgba(229,80,80,0.55)";
  const hotStroke = "rgba(180,40,40,0.85)";
  const fill = (f) => (highlightFinger === f ? hotFill : baseColor);
  const strk = (f) => (highlightFinger === f ? hotStroke : strokeColor);

  return (
    <svg viewBox="0 0 240 220" width="100%" height="100%" style={{ overflow: "visible" }}>
      <g transform={`translate(120 0) scale(${flip} 1) translate(-120 0)`}>
        <path d="M 60 200 Q 50 150 60 110 Q 65 95 80 95 L 175 95 Q 195 95 200 115 Q 210 165 195 200 Q 190 215 170 218 L 80 218 Q 65 215 60 200 Z" fill={baseColor} stroke={strokeColor} strokeWidth="1.5" />
        {(() => {
          const deltas = fingerDeltas(highlightFinger, fingerDelta);
          return Object.entries(FINGERS).map(([name, fin]) => (
            <path
              key={name}
              d={fingerPath(fin)}
              fill={fill(name)}
              stroke={strk(name)}
              strokeWidth="1.5"
              style={{
                transform: fingerTransform(fin, deltas[name] || null),
                transition: "transform 0.22s cubic-bezier(.22,.68,0,1.1)",
              }}
            />
          ));
        })()}
        <path d="M 200 145 Q 230 135 238 155 Q 240 180 218 195 Q 200 200 195 185 Q 192 165 200 145 Z" fill={fill("thumb")} stroke={strk("thumb")} strokeWidth="1.5" />
      </g>
    </svg>
  );
}

/* 기본자리: 검지 끝이 ㄹ(KeyF)/ㅓ(KeyJ) 양각 키 위에 오는 위치 */
const HOME_CODE = { L: "KeyF", R: "KeyJ" };
const REACH_X = 33, REACH_DOWN = 62;   // 손가락 단독으로 닿는 범위 (키보드 px)
const PALM_TOP_SVG = 95;               // SVG에서 손등 윗변 y
const PALM_TOP_MAX = 3 * (KH + GAP);   // 손등 윗변 위쪽 한계선: 아랫글쇠줄(ㅋㅌㅊ…) 윗변

/* 손등 이동(shift)과 손가락 잔여 이동(fingerDelta)을 나눠 계산 */
function calcHand(side, finger, code) {
  const homeKey = KEY_CENTERS[HOME_CODE[side]];
  const homeTip = getTipPos("index", side);
  const home = { x: homeKey.x - homeTip.x, y: homeKey.y - homeTip.y };

  let palm = { x: 0, y: 0 }, fingerDelta = null;
  const fin = finger && FINGERS[finger];
  const kc = code && KEY_CENTERS[code];
  if (fin && kc) {
    const tip = getTipPos(finger, side);
    const dx = kc.x - (tip.x + home.x), dy = kc.y - (tip.y + home.y);
    // 가로는 REACH 초과분만 손등이 이동. 세로는 위로 뻗을 땐 손등이 따라 올라가고(한계선까지),
    // 아래로는 손등을 두고 손가락만 굽힌다
    palm = { x: dx - clamp(dx, -REACH_X, REACH_X), y: dy - clamp(dy, 0, REACH_DOWN) };
    // 손등 세로 제한: 위로는 한계선(max), 아래로는 기본자리(min)
    const palmTopHome = ORG_TOP + SVG_DY + PALM_TOP_SVG * SVG_SC + home.y;
    palm.y = clamp(palm.y, PALM_TOP_MAX - palmTopHome, 0);
    const fx = (dx - palm.x) / SVG_SC, fy = (dy - palm.y) / SVG_SC;
    fingerDelta = { x: side === "R" ? -fx : fx, y: fy }; // 오른손은 SVG x 반전
  }
  return { shift: { x: home.x + palm.x, y: home.y + palm.y }, fingerDelta };
}

function HandsOverlay({ targetCode, shiftCode }) {
  // 각 손의 담당 손가락 + 담당 키코드 파악
  let leftFinger = null, leftCode = null;
  let rightFinger = null, rightCode = null;
  for (const code of [targetCode, shiftCode].filter(Boolean)) {
    const f = FINGER[code] || "";
    if (f.startsWith("L-")) {
      if (!leftFinger) { leftFinger = f.slice(2); leftCode = code; }
    } else if (f.startsWith("R-")) {
      if (!rightFinger) { rightFinger = f.slice(2); rightCode = code; }
    } else if (f === "thumb") {
      if (!leftFinger)  { leftFinger  = "thumb"; leftCode  = code; }
      if (!rightFinger) { rightFinger = "thumb"; rightCode = code; }
    }
  }

  const L = calcHand("L", leftFinger, leftCode);
  const R = calcHand("R", rightFinger, rightCode);

  const base = {
    position: "absolute", top: "-2px",
    width: "46%", height: "calc(100% + 12px)",
    pointerEvents: "none",
    transition: "transform 0.22s cubic-bezier(.22,.68,0,1.1)",
  };

  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 5 }}>
      <div style={{ ...base, left: "2%", transform: `translate(${L.shift.x}px, ${L.shift.y}px)` }}>
        <HandSVG side="L" highlightFinger={leftFinger} fingerDelta={L.fingerDelta} />
      </div>
      <div style={{ ...base, right: "2%", transform: `translate(${R.shift.x}px, ${R.shift.y}px)` }}>
        <HandSVG side="R" highlightFinger={rightFinger} fingerDelta={R.fingerDelta} />
      </div>
    </div>
  );
}

/* ── 가상 키보드 (가로·세로 둘 다 고려해 자동 스케일) ──────────────── */
export default function VirtualKeyboard({ targetCode, shiftCode, pressedCode, showHands }) {
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const compute = () => {
      const widthScale = Math.min(window.innerWidth * 0.92, 1100) / ROW_WIDTH;
      const heightScale = (window.innerHeight * 0.42) / KB_HEIGHT;
      setScale(Math.max(0.5, Math.min(1, widthScale, heightScale)));
    };
    compute();
    window.addEventListener("resize", compute);
    return () => window.removeEventListener("resize", compute);
  }, []);

  return (
    <div style={{ width: ROW_WIDTH * scale, height: KB_HEIGHT * scale, position: "relative" }}>
      <div style={{ position: "absolute", top: 0, left: 0, width: ROW_WIDTH, transform: `scale(${scale})`, transformOrigin: "top left" }}>
        <div style={{ position: "relative", width: ROW_WIDTH }}>
          <div style={{ display: "flex", flexDirection: "column", gap: GAP, alignItems: "flex-start" }}>
            {KB_ROWS.map((row, ri) => (
              <div key={ri} style={{ display: "flex", gap: GAP }}>
                {row.map((k) => (
                  <KeyCap key={k.c} data={k} isTarget={k.c === targetCode || k.c === shiftCode} isPressed={k.c === pressedCode} />
                ))}
              </div>
            ))}
          </div>
          {showHands && <HandsOverlay targetCode={targetCode} shiftCode={shiftCode} />}
        </div>
      </div>
    </div>
  );
}
