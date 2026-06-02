import { calcCpm, displayAccuracy } from "./stats.js";

// 제목 줄 우측에 들어가는 진행 / 타수 / 정확도 (인라인)
export default function StatsInline({ correct, wrong, elapsed, total, idx, unit = "자" }) {
  const cpm = calcCpm(correct, elapsed);
  const acc = displayAccuracy(correct, wrong);
  const pct = total > 0 ? Math.round((idx / total) * 100) : 0;
  return (
    <div style={{ display: "flex", gap: 22, alignItems: "center" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 4, width: 200 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <span style={{ fontFamily: '"IBM Plex Mono",monospace', fontSize: 10, color: "var(--ink-faint)", letterSpacing: "0.12em", textTransform: "uppercase" }}>진행</span>
          <span style={{ fontFamily: '"IBM Plex Mono",monospace', fontSize: 11, color: "var(--ink-soft)" }}>{idx} / {total} {unit}</span>
        </div>
        <div style={{ height: 6, background: "var(--paper-edge)", borderRadius: 3, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${pct}%`, background: "var(--accent)", borderRadius: 3, transition: "width 0.25s" }} />
        </div>
      </div>
      {[["타수", `${cpm}`], ["정확도", `${acc}%`]].map(([lbl, val]) => (
        <div key={lbl} style={{ textAlign: "right", minWidth: 54 }}>
          <div style={{ fontFamily: '"IBM Plex Mono",monospace', fontSize: 22, fontWeight: 500, color: "var(--ink)", lineHeight: 1 }}>{val}</div>
          <div style={{ fontFamily: '"IBM Plex Mono",monospace', fontSize: 9, color: "var(--ink-faint)", letterSpacing: "0.14em", textTransform: "uppercase", marginTop: 3 }}>{lbl}</div>
        </div>
      ))}
    </div>
  );
}
