// StepList — 단계 단일 선택. 선택된 단계 안에 기본/심화 세그먼트가 같은 줄에 들어간다.
// 접근성: role="button" span 대신 실제 <button>. 중첩 button을 피하려고
// 단계 선택 버튼과 모드 토글 버튼을 형제로 배치한다.
const stepBtnReset = {
  font: "inherit", color: "inherit", background: "none", border: 0,
  margin: 0, padding: 0, cursor: "pointer", textAlign: "left",
};

export default function StepList({ value, onChange, steps, mode, onMode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5, width: 172 }}>
      <div style={{ fontFamily: '"IBM Plex Mono",monospace', fontSize: 9, letterSpacing: "0.16em", color: "var(--ink-faint)", textTransform: "uppercase", marginBottom: 1 }}>
        단계 선택
      </div>
      {steps.map((s) => {
        const active = s.id === value;
        const hasModes = !!s.modes && active;
        return (
          <div
            key={s.id}
            style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "6px 10px",
              border: active ? "2px solid var(--ink)" : "1.5px solid var(--rule)",
              background: active ? "var(--accent)" : "var(--paper-deep)",
              color: active ? "#fff" : "var(--ink)",
              borderRadius: 7,
              boxShadow: active ? "0 2px 0 var(--ink)" : "none",
              transition: "background 0.1s, border-color 0.1s, box-shadow 0.1s",
              fontFamily: '"Noto Serif KR","Jua",serif',
            }}
          >
            <button
              type="button"
              onClick={() => onChange(s.id)}
              aria-pressed={active}
              style={{ ...stepBtnReset, display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}
            >
              <span style={{
                width: 13, height: 13, borderRadius: "50%", flexShrink: 0,
                border: active ? "2px solid #fff" : "2px solid var(--ink-faint)",
                background: active ? "#fff" : "transparent",
                boxShadow: active ? "inset 0 0 0 2.5px var(--accent)" : "none",
              }} />
              <span style={{ display: "flex", flexDirection: "column", lineHeight: 1.1, minWidth: 0, flex: 1 }}>
                <span style={{ fontSize: 14, fontWeight: 700, whiteSpace: "nowrap" }}>{s.name}</span>
                {!hasModes && (
                  <span style={{ fontSize: 10, opacity: active ? 0.85 : 0.6, fontFamily: '"IBM Plex Mono","Gowun Dodum",monospace', whiteSpace: "nowrap" }}>{s.sub}</span>
                )}
              </span>
            </button>

            {hasModes && (
              <span style={{ display: "flex", flexShrink: 0, background: "rgba(0,0,0,0.18)", borderRadius: 6, padding: 2, gap: 2 }}>
                {s.modes.map((m) => {
                  const on = m.id === mode;
                  return (
                    <button
                      type="button"
                      key={m.id}
                      onClick={(e) => { e.stopPropagation(); onMode && onMode(m.id); }}
                      aria-pressed={on}
                      style={{
                        ...stepBtnReset, textAlign: "center",
                        padding: "3px 7px", borderRadius: 4,
                        fontFamily: '"Noto Serif KR","Jua",serif', fontSize: 11, fontWeight: 700,
                        background: on ? "var(--paper-deep)" : "transparent",
                        color: on ? "var(--ink)" : "rgba(255,255,255,0.78)",
                        border: on ? "1.5px solid var(--ink)" : "1.5px solid transparent",
                        transition: "background .1s, color .1s, border-color .1s",
                      }}
                    >
                      {m.label}
                    </button>
                  );
                })}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
