import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { DUBEOL, decomposeWord } from "../kit/hangul.js";
import { FINGER } from "../kit/keyboard.js";
import VirtualKeyboard from "../kit/VirtualKeyboard.jsx";
import StepList from "../kit/StepList.jsx";
import StatsInline from "../kit/StatsInline.jsx";
import DoneOverlay from "../kit/DoneOverlay.jsx";
import { calcCpm, displayAccuracy } from "../kit/stats.js";
import { genWords } from "../data/wordSteps.js";
import { getNextPractice } from "../data/progress.js";

const MODES = [{ id: "basic", label: "기본" }, { id: "adv", label: "심화" }];
const NATMAL_STEPS = [
  { id: 1, name: "1단계", sub: "기본 낱말", modes: MODES },
  { id: 2, name: "2단계", sub: "받침 낱말", modes: MODES },
  { id: 3, name: "3단계", sub: "긴 낱말", modes: MODES },
  { id: 4, name: "4단계", sub: "된소리·섞기", modes: MODES },
];

/* ── WordTape : 슬라이딩 낱말 + 현재 글자 강조 ───────────────────── */
function WordTape({ seq, idx, curCharIndex, flash }) {
  const prev = idx > 0 ? seq[idx - 1] : null;
  const next = idx < seq.length - 1 ? seq[idx + 1] : null;
  return (
    <div style={{ position: "relative", height: 150, width: "100%", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
      {prev && (
        <div style={{ position: "absolute", left: "4%", top: "50%", transform: "translateY(-50%)", fontSize: 32, opacity: 0.22, color: "var(--ink-faint)", fontFamily: '"Noto Serif KR","Jua",serif', userSelect: "none" }}>
          {prev}
        </div>
      )}
      <div style={{ display: "inline-flex", gap: 6 }}>
        {[...seq[idx]].map((ch, ci) => {
          const done = ci < curCharIndex;
          const isCur = ci === curCharIndex;
          return (
            <span key={ci} style={{
              position: "relative",
              fontSize: 72, lineHeight: 1,
              fontFamily: '"Noto Serif KR","Jua",serif', fontWeight: 700,
              padding: "8px 6px", borderRadius: 14,
              color: flash === "wrong" && isCur ? "#ef4444" : done ? "var(--accent)" : isCur ? "var(--ink)" : "var(--ink-faint)",
              background: isCur ? (flash === "wrong" ? "rgba(239,68,68,0.10)" : "var(--accent-soft)") : "transparent",
              border: isCur ? (flash === "wrong" ? "2.5px solid #ef4444" : "2.5px solid var(--accent)") : "2.5px solid transparent",
              opacity: done ? 0.55 : 1,
              transition: "color .12s, background .12s, border-color .12s, opacity .15s",
              userSelect: "none",
            }}>
              {ch}
            </span>
          );
        })}
      </div>
      {next && (
        <div style={{ position: "absolute", right: "4%", top: "50%", transform: "translateY(-50%)", fontSize: 32, opacity: 0.3, color: "var(--ink-soft)", fontFamily: '"Noto Serif KR","Jua",serif', userSelect: "none" }}>
          {next}
        </div>
      )}
    </div>
  );
}

/* ── 낱말연습 화면 ────────────────────────────────────────────────── */
export default function NatmalScreen({ showHands = true, initialStep = 1, initialMode = "basic", onDone, onNext }) {
  const [step, setStep] = useState(initialStep);
  const [mode, setMode] = useState(initialMode);
  const [seq, setSeq] = useState(() => genWords(initialStep, initialMode));
  const [idx, setIdx] = useState(0);
  const [keyIndex, setKeyIndex] = useState(0);
  const [phase, setPhase] = useState("ready");
  const [flash, setFlash] = useState(null);
  const [pressedCode, setPressedCode] = useState(null);
  const [stats, setStats] = useState({ correct: 0, wrong: 0 });
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(null);
  const timerRef = useRef(null);
  const flashRef = useRef(null);

  const decomposed = useMemo(() => decomposeWord(seq[idx] || ""), [seq, idx]);
  const keys = decomposed.flat;
  const target = keys[keyIndex];
  const targetCode = target ? target.code : null;
  const needShift = !!(target && target.shift);
  const shiftCode = needShift
    ? (FINGER[targetCode] || "").startsWith("R") ? "ShiftLeft" : "ShiftRight"
    : null;
  const curCharIndex = target ? target.charIndex : decomposed.chars.length;

  useEffect(() => {
    if (phase === "playing") {
      timerRef.current = setInterval(() => setElapsed((Date.now() - startRef.current) / 1000), 500);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [phase]);

  // 완료 결과 + 다음 연습 계산
  const result = phase === "done" ? {
    screen: "natmal", step, mode,
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
  live.current = { phase, target, keyIndex, keys, idx, seq };

  const handleKey = useCallback((e) => {
    const ignore = ["Tab", "Escape", "F1", "F2", "F3", "F4", "F5", "F6", "F7", "F8", "F9", "F10", "F11", "F12", "Alt", "Control", "Meta", "Shift", "CapsLock", "Enter", "Backspace"];
    if (ignore.includes(e.key)) return;
    const typed = DUBEOL[e.code];
    if (!typed && e.code !== "Space") return;
    e.preventDefault();
    if (e.repeat) return;
    const { phase, target, keyIndex, keys, idx, seq } = live.current;
    if (phase === "done" || !target) return;
    if (phase === "ready") { startRef.current = Date.now(); setPhase("playing"); }
    setPressedCode(e.code);
    clearTimeout(flashRef.current);
    flashRef.current = setTimeout(() => setPressedCode(null), 110);
    const ok = e.code === target.code && (!target.shift || e.shiftKey);
    if (ok) {
      setFlash("right"); setTimeout(() => setFlash(null), 130);
      setStats((s) => ({ ...s, correct: s.correct + 1 }));
      const nextKey = keyIndex + 1;
      if (nextKey >= keys.length) {
        const nextWord = idx + 1;
        if (nextWord >= seq.length) setPhase("done");
        else { setIdx(nextWord); setKeyIndex(0); }
      } else {
        setKeyIndex(nextKey);
      }
    } else {
      setFlash("wrong"); setTimeout(() => setFlash(null), 260);
      setStats((s) => ({ ...s, wrong: s.wrong + 1 }));
    }
  }, []);

  useEffect(() => {
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [handleKey]);

  const reset = (newSeq) => {
    setSeq(newSeq); setIdx(0); setKeyIndex(0); setPhase("ready");
    setFlash(null); setPressedCode(null);
    setStats({ correct: 0, wrong: 0 }); setElapsed(0); startRef.current = null;
  };
  const restart = () => reset(genWords(step, mode));
  const selectStep = (id) => { setStep(id); setMode("basic"); reset(genWords(id, "basic")); };
  const selectMode = (m) => { setMode(m); reset(genWords(step, m)); };

  return (
    <div data-screen-label="03 낱말연습" style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden", position: "relative" }}>
      <div style={{ padding: "12px 40px 0", maxWidth: 1180, margin: "0 auto", width: "100%", boxSizing: "border-box" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <span style={{ fontFamily: '"IBM Plex Mono",monospace', fontSize: 11, color: "var(--accent)", letterSpacing: "0.18em", textTransform: "uppercase" }}>CH. 03</span>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, fontFamily: '"Noto Serif KR","Jua",serif' }}>낱말연습</h1>
          <div style={{ flex: 1 }} />
          <StatsInline correct={stats.correct} wrong={stats.wrong} elapsed={elapsed} total={seq.length} idx={idx} unit="낱말" />
        </div>
      </div>

      <div style={{ flex: 1, display: "flex", alignItems: "flex-start", minHeight: 0, maxWidth: 1180, margin: "0 auto", width: "100%", boxSizing: "border-box", padding: "14px 40px 0", gap: 24, overflow: "hidden" }}>
        <StepList value={step} onChange={selectStep} steps={NATMAL_STEPS} mode={mode} onMode={selectMode} />
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", minWidth: 0, alignSelf: "stretch" }}>
          <WordTape seq={seq} idx={idx} curCharIndex={curCharIndex} flash={flash} />
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
