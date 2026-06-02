import { calcCpm, displayAccuracy } from "./stats.js";
import { getBest } from "../data/user.js";

// 연습 완료 오버레이.
// isNewBest: 이번 판이 개인 최고를 갱신했으면 true (호출부에서 계산).
// nextAction = { label, onClick } 가 있으면 다음 단계 연결 버튼을 강조 표시한다.
export default function DoneOverlay({ correct, wrong, elapsed, onRestart, nextAction }) {
  const cpm = calcCpm(correct, elapsed);
  const acc = displayAccuracy(correct, wrong);
  // 현재 localStorage 최고기록과 비교해 뱃지 표시
  const best = getBest();
  const isNewBest = best && best.wpm === cpm && cpm > 0;
  return (
    <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.12)", backdropFilter: "blur(2px)", zIndex: 20 }}>
      <div style={{ background: "var(--paper)", border: "2.5px solid var(--ink)", padding: "36px 52px", boxShadow: "7px 7px 0 var(--ink)", textAlign: "center", minWidth: 280 }}>
        <div style={{ fontFamily: '"IBM Plex Mono",monospace', fontSize: 11, color: isNewBest ? "var(--stamp)" : "var(--accent)", letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: 10 }}>
          {isNewBest ? "🎉 개인 최고 기록!" : "연습 완료!"}
        </div>
        <div style={{ fontSize: 48, fontWeight: 700, fontFamily: '"Noto Serif KR",serif', lineHeight: 1, marginBottom: 16 }}>수고했어요</div>
        <div style={{ fontFamily: '"IBM Plex Mono",monospace', color: "var(--ink-soft)", fontSize: 15, marginBottom: 8 }}>{cpm} 타 &nbsp;·&nbsp; 정확도 {acc}%</div>
        <div style={{ fontFamily: '"IBM Plex Mono",monospace', color: "var(--ink-faint)", fontSize: 12, marginBottom: 28 }}>맞춤 {correct} · 틀림 {wrong}</div>

        {nextAction && (
          <div style={{ fontFamily: '"Noto Serif KR","Jua",serif', fontSize: 16, color: "var(--ink)", marginBottom: 16 }}>
            {nextAction.label}
          </div>
        )}

        <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
          <button
            onClick={onRestart}
            style={{
              padding: "11px 26px",
              border: "2px solid var(--ink)",
              background: nextAction ? "var(--paper-deep)" : "var(--ink)",
              color: nextAction ? "var(--ink)" : "var(--paper)",
              fontFamily: '"Noto Serif KR","Jua",serif', fontSize: 16, cursor: "pointer", borderRadius: 4,
            }}
          >
            다시 시작
          </button>
          {nextAction && (
            <button
              onClick={nextAction.onClick}
              style={{
                padding: "11px 26px",
                border: "2px solid var(--ink)",
                background: "var(--accent)",
                color: "#fff",
                fontFamily: '"Noto Serif KR","Jua",serif', fontSize: 16, cursor: "pointer", borderRadius: 4,
              }}
            >
              네, 넘어갈래요
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
