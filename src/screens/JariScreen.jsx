import { useState, useEffect, useRef, useCallback } from "react";
import { DUBEOL, charToKeys } from "../kit/hangul.js";
import { FINGER } from "../kit/keyboard.js";
import VirtualKeyboard from "../kit/VirtualKeyboard.jsx";
import StepList from "../kit/StepList.jsx";
import StatsInline from "../kit/StatsInline.jsx";
import DoneOverlay from "../kit/DoneOverlay.jsx";
import { calcCpm, displayAccuracy } from "../kit/stats.js";
import { JARI_STEPS, genJariSeq } from "../data/jariSteps.js";
import { getNextPractice } from "../data/progress.js";

/* ── CharTape : 좌우로 흐르는 자모, 가운데 글자 강조 ───────────────── */
function CharTape({ seq, idx, flash }) {
  const CELL = 90;
  return (
    <div style={{ position: "relative", height: 140, overflow: "hidden", width: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{
        position: "absolute", width: 104, height: 104, borderRadius: 16,
        border: flash === "wrong" ? "2.5px solid #ef4444" : "2.5px solid var(--accent)",
        background: flash === "wrong" ? "rgba(239,68,68,0.08)" : "var(--accent-soft)",
        transition: "border-color 0.12s, background 0.12s", pointerEvents: "none", zIndex: 0,
      }} />
      {seq.map((char, i) => {
        const dist = i - idx;
        if (Math.abs(dist) > 4) return null;
        const isCur = dist === 0;
        const isPast = dist < 0;
        const size = isCur ? 76 : Math.abs(dist) === 1 ? 38 : 24;
        const opacity = isCur ? 1 : isPast ? (Math.abs(dist) === 1 ? 0.35 : 0.15) : Math.abs(dist) === 1 ? 0.52 : 0.22;
        const color = flash === "wrong" && isCur ? "#ef4444" : flash === "right" && isCur ? "var(--accent)" : isPast ? "var(--ink-faint)" : "var(--ink)";
        return (
          <div key={i} style={{
            position: "absolute", left: "50%", top: "50%",
            transform: `translate(calc(-50% + ${dist * CELL}px), -50%)`,
            transition: "transform 0.2s cubic-bezier(.22,.68,0,1.15), font-size 0.2s, opacity 0.2s, color 0.12s",
            fontSize: size, opacity, color,
            fontFamily: '"Noto Serif KR","Jua",serif', fontWeight: isCur ? 700 : 400,
            lineHeight: 1, userSelect: "none", pointerEvents: "none", zIndex: isCur ? 2 : 1,
          }}>
            {char}
          </div>
        );
      })}
    </div>
  );
}

/* ── 자리연습 화면 ────────────────────────────────────────────────── */
export default function JariScreen({ showHands = true, onDone, onNext }) {
  const [step, setStep] = useState(1);
  const [seq, setSeq] = useState(() => genJariSeq(1));
  const [idx, setIdx] = useState(0);
  const [phase, setPhase] = useState("ready");
  const [flash, setFlash] = useState(null);
  const [pressedCode, setPressedCode] = useState(null);
  const [stats, setStats] = useState({ correct: 0, wrong: 0 });
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(null);
  const timerRef = useRef(null);
  const flashRef = useRef(null);

  useEffect(() => {
    if (phase === "playing") {
      timerRef.current = setInterval(() => setElapsed((Date.now() - startRef.current) / 1000), 500);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [phase]);

  // 현재 타겟 자모 → 키 입력(겹/쌍자모는 Shift 포함)
  const target = seq[idx];
  const ks = target ? charToKeys(target)[0] : null;
  const targetCode = ks ? ks.code : null;
  const needShift = !!(ks && ks.shift);
  // 왼손 키는 오른손 Shift로, 오른손 키는 왼손 Shift로 누른다
  const shiftCode = needShift
    ? (FINGER[targetCode] || "").startsWith("R") ? "ShiftLeft" : "ShiftRight"
    : null;

  // 완료 결과 + 다음 연습 계산
  const result = phase === "done" ? {
    screen: "jari", step, mode: null,
    wpm: calcCpm(stats.correct, elapsed),
    acc: displayAccuracy(stats.correct, stats.wrong),
    correct: stats.correct, wrong: stats.wrong,
  } : null;
  const nextPractice = result ? getNextPractice(result) : null;

  const doneFiredRef = useRef(false);
  useEffect(() => {
    if (phase === "done" && !doneFiredRef.current) {
      doneFiredRef.current = true;
      onDone?.(result);
    }
    if (phase !== "done") doneFiredRef.current = false;
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  const live = useRef({});
  live.current = { phase, ks, idx, seq };

  const handleKey = useCallback((e) => {
    const ignore = ["Tab", "Escape", "F1", "F2", "F3", "F4", "F5", "F6", "F7", "F8", "F9", "F10", "F11", "F12", "Alt", "Control", "Meta", "Shift", "CapsLock", "Enter", "Backspace"];
    if (ignore.includes(e.key)) return;
    if (!DUBEOL[e.code]) return; // 두벌식 글자 키만
    e.preventDefault();
    if (e.repeat) return;
    const { phase, ks, idx, seq } = live.current;
    if (phase === "done" || !ks) return;
    if (phase === "ready") { startRef.current = Date.now(); setPhase("playing"); }
    setPressedCode(e.code);
    clearTimeout(flashRef.current);
    flashRef.current = setTimeout(() => setPressedCode(null), 110);
    const ok = e.code === ks.code && (!ks.shift || e.shiftKey);
    if (ok) {
      setFlash("right"); setTimeout(() => setFlash(null), 150);
      setStats((s) => ({ ...s, correct: s.correct + 1 }));
      const next = idx + 1;
      if (next >= seq.length) setPhase("done");
      else setIdx(next);
    } else {
      setFlash("wrong"); setTimeout(() => setFlash(null), 280);
      setStats((s) => ({ ...s, wrong: s.wrong + 1 }));
    }
  }, []);

  useEffect(() => {
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [handleKey]);

  const reset = (newSeq) => {
    setSeq(newSeq); setIdx(0); setPhase("ready"); setFlash(null); setPressedCode(null);
    setStats({ correct: 0, wrong: 0 }); setElapsed(0); startRef.current = null;
  };
  const restart = () => reset(genJariSeq(step));
  const selectStep = (id) => { setStep(id); reset(genJariSeq(id)); };

  return (
    <div data-screen-label="02 자리연습" style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden", position: "relative" }}>
      <div style={{ padding: "12px 40px 0", maxWidth: 1180, margin: "0 auto", width: "100%", boxSizing: "border-box" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <span style={{ fontFamily: '"IBM Plex Mono",monospace', fontSize: 11, color: "var(--accent)", letterSpacing: "0.18em", textTransform: "uppercase" }}>CH. 02</span>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, fontFamily: '"Noto Serif KR","Jua",serif' }}>자리연습</h1>
          <div style={{ flex: 1 }} />
          <StatsInline correct={stats.correct} wrong={stats.wrong} elapsed={elapsed} total={seq.length} idx={idx} />
        </div>
      </div>

      <div style={{ flex: 1, display: "flex", alignItems: "flex-start", minHeight: 0, maxWidth: 1180, margin: "0 auto", width: "100%", boxSizing: "border-box", overflow: "hidden", gap: 24, padding: "14px 40px 0px" }}>
        <StepList value={step} onChange={selectStep} steps={JARI_STEPS} />
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", minWidth: 0, alignSelf: "stretch" }}>
          <CharTape seq={seq} idx={idx} flash={flash} />
        </div>
        <div style={{ width: 172, flexShrink: 0 }} aria-hidden="true" />
      </div>

      <div style={{ padding: "0 0 14px", display: "flex", flexDirection: "column", alignItems: "center", gap: 6, flexShrink: 0 }}>
        <div style={{ fontFamily: '"IBM Plex Mono",monospace', fontSize: 10, letterSpacing: "0.16em", color: needShift ? "var(--stamp)" : "var(--ink-faint)", textTransform: "uppercase", fontWeight: needShift ? 700 : 400 }}>
          {needShift ? "⇧ Shift를 함께 누르세요" : "두벌식 자판 · 강조된 손가락으로 누르세요"}
        </div>
        <VirtualKeyboard targetCode={targetCode} shiftCode={shiftCode} pressedCode={pressedCode} showHands={showHands} />
      </div>

      {phase === "done" && (
        <DoneOverlay
          correct={stats.correct} wrong={stats.wrong} elapsed={elapsed}
          onRestart={restart}
          nextAction={nextPractice && onNext ? { label: nextPractice.label, onClick: () => onNext(nextPractice) } : null}
        />
      )}
    </div>
  );
}
