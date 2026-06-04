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

/* 손가락 끝점 SVG 좌표 (왼손 기준, viewBox 0 0 240 220) */
const FINGERTIP = {
  pinky:  { x: 83,  y: 30  },
  ring:   { x: 119, y: 14  },
  middle: { x: 149, y: 4   },
  index:  { x: 185, y: 27  },
  thumb:  { x: 237, y: 150 },
};

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
  const t = FINGERTIP[finger];
  if (!t) return null;
  const sx = side === "R" ? 240 - t.x : t.x; // 오른손은 SVG가 좌우 반전
  return {
    x: (side === "R" ? ORG_R : ORG_L) + SVG_DX + sx * SVG_SC,
    y: ORG_TOP + SVG_DY + t.y * SVG_SC,
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
    return (
      <div style={{ ...base, flexDirection: "column", alignItems: "stretch", justifyContent: "space-between", padding: "5px 7px" }}>
        <span style={{ fontSize: 22, fontFamily: '"Noto Serif KR","Jua",serif', fontWeight: isTarget ? 700 : 500, lineHeight: 1, color: isTarget ? "#fff" : "var(--ink)", alignSelf: "flex-start" }}>{top}</span>
        <span style={{ fontSize: 11, fontFamily: '"IBM Plex Mono",monospace', color: isTarget ? "rgba(255,255,255,0.7)" : "var(--ink-faint)", alignSelf: "flex-end", lineHeight: 1 }}>{main}</span>
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
function HandSVG({ side, highlightFinger }) {
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
        <path d="M 70 110 Q 64 60 76 35 Q 88 28 96 38 Q 102 60 96 110 Z" fill={fill("pinky")} stroke={strk("pinky")} strokeWidth="1.5" />
        <path d="M 100 105 Q 96 50 108 22 Q 122 14 130 26 Q 134 50 128 108 Z" fill={fill("ring")} stroke={strk("ring")} strokeWidth="1.5" />
        <path d="M 132 100 Q 130 35 144 8 Q 158 0 166 12 Q 170 38 160 102 Z" fill={fill("middle")} stroke={strk("middle")} strokeWidth="1.5" />
        <path d="M 164 102 Q 168 50 180 30 Q 194 24 200 36 Q 200 60 192 108 Z" fill={fill("index")} stroke={strk("index")} strokeWidth="1.5" />
        <path d="M 200 145 Q 230 135 238 155 Q 240 180 218 195 Q 200 200 195 185 Q 192 165 200 145 Z" fill={fill("thumb")} stroke={strk("thumb")} strokeWidth="1.5" />
      </g>
    </svg>
  );
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

  // 손가락 끝이 담당 키 위에 오도록 translate 계산
  const calcShift = (finger, side, code) => {
    if (!finger || !code) return { x: 0, y: 0 };
    const kc  = KEY_CENTERS[code];
    const tip = getTipPos(finger, side);
    if (!kc || !tip) return { x: 0, y: 0 };
    return { x: kc.x - tip.x, y: kc.y - tip.y };
  };

  const ls = calcShift(leftFinger,  "L", leftCode);
  const rs = calcShift(rightFinger, "R", rightCode);

  const base = {
    position: "absolute", top: "-2px",
    width: "46%", height: "calc(100% + 12px)",
    pointerEvents: "none",
    transition: "transform 0.22s cubic-bezier(.22,.68,0,1.1)",
  };

  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 5 }}>
      <div style={{ ...base, left: "2%", transform: `translate(${ls.x}px, ${ls.y}px)` }}>
        <HandSVG side="L" highlightFinger={leftFinger} />
      </div>
      <div style={{ ...base, right: "2%", transform: `translate(${rs.x}px, ${rs.y}px)` }}>
        <HandSVG side="R" highlightFinger={rightFinger} />
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
