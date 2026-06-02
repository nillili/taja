// 우측 하단 종이/게임 전환 스위치 (밝기는 라이트 고정, 스타일만 전환)
const OPTS = [
  { id: "paper", label: "종이" },
  { id: "game", label: "게임" },
];

export default function StyleSwitch({ value, onChange }) {
  return (
    <div
      style={{
        position: "fixed",
        right: 20,
        bottom: 20,
        zIndex: 50,
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "7px 9px 7px 14px",
        background: "var(--paper-deep)",
        border: "1.5px solid var(--ink)",
        borderRadius: 999,
        boxShadow: "0 4px 14px rgba(0,0,0,0.16)",
        fontFamily: '"Noto Serif KR","Jua",serif',
      }}
    >
      <span
        style={{
          fontFamily: '"IBM Plex Mono",monospace',
          fontSize: 9,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          color: "var(--ink-faint)",
        }}
      >
        화면
      </span>
      <div
        style={{
          display: "flex",
          background: "color-mix(in oklab, var(--ink) 12%, transparent)",
          borderRadius: 999,
          padding: 2,
          gap: 2,
        }}
      >
        {OPTS.map((o) => {
          const on = o.id === value;
          return (
            <button
              key={o.id}
              onClick={() => onChange(o.id)}
              aria-pressed={on}
              style={{
                cursor: "pointer",
                border: 0,
                borderRadius: 999,
                padding: "6px 16px",
                fontFamily: '"Noto Serif KR","Jua",serif',
                fontSize: 14,
                fontWeight: 700,
                color: on ? "#fff" : "var(--ink-soft)",
                background: on ? "var(--accent)" : "transparent",
                transition: "background .14s, color .14s",
              }}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
