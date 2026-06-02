import { useState, useEffect } from "react";
import { KB_ROWS, FINGER, KH, GAP, kw, ROW_WIDTH, KB_HEIGHT } from "./keyboard.js";

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
  // 타겟 키 + (필요 시) Shift 키의 손가락을 양손에 합쳐 강조
  let leftFinger = null;
  let rightFinger = null;
  for (const code of [targetCode, shiftCode]) {
    const f = FINGER[code] || "";
    if (f.startsWith("L-")) leftFinger = f.slice(2);
    else if (f.startsWith("R-")) rightFinger = f.slice(2);
    else if (f === "thumb") { leftFinger = leftFinger || "thumb"; rightFinger = rightFinger || "thumb"; }
  }

  const handStyle = {
    position: "absolute", top: "-2px",
    width: "46%", height: "calc(100% + 12px)",
    pointerEvents: "none", transition: "opacity 0.15s",
  };

  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 5 }}>
      <div style={{ ...handStyle, left: "2%" }}>
        <HandSVG side="L" highlightFinger={leftFinger} />
      </div>
      <div style={{ ...handStyle, right: "2%" }}>
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
