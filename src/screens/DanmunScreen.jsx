import { useState, useEffect, useLayoutEffect, useRef, useMemo } from "react";
import { decomposeWord } from "../kit/hangul.js";
import { FINGER } from "../kit/keyboard.js";
import VirtualKeyboard from "../kit/VirtualKeyboard.jsx";
import StepList from "../kit/StepList.jsx";
import StatsInline from "../kit/StatsInline.jsx";
import SentenceInput from "../kit/SentenceInput.jsx";
import DoneOverlay from "../kit/DoneOverlay.jsx";
import { calcCpm, displayAccuracy } from "../kit/stats.js";
import { compareLine, scoreLine, countLineKeys } from "../kit/compare.js";
import { DANMUN_STEPS, genDanmun } from "../data/danmunSteps.js";
import { getNextPractice } from "../data/progress.js";

const HINT_DEFAULT = "다 썼으면 Enter를 누르세요";
// 자판을 펼쳤을 때 손 그림까지 넣으려면 세로 여유가 꽤 필요하다.
// 학교 PC는 화면 크기를 알 수 없으므로(구형·저해상도·확대 설정이 섞인다)
// 창 높이를 실제로 재서 여유가 없으면 손 그림부터 접는다 — 자판만 남아도 목적은 이룬다.
const HANDS_MIN_H = 760;

/* ── 본보기 문장 : 지나온 글자는 옅게, 지금 칠 글자에 밑줄 ────────── */
const MIN_TARGET_FONT = 15;   // 이보다 작아지면 초등학생이 읽기 힘들다

// 문장을 어절 단위로 나눈다. 뒤따르는 공백은 앞 어절에 붙여 둔다
// (공백만 다음 줄로 넘어가 줄 첫머리가 밀려 보이는 일을 막는다)
function splitWords(text) {
  const words = [];
  let cur = [];
  [...text].forEach((ch, i) => {
    cur.push({ ch, i });
    if (ch === " ") { words.push(cur); cur = []; }
  });
  if (cur.length) words.push(cur);
  return words;
}

function TargetLine({ text, typedLen, oneLine }) {
  const wrapRef = useRef(null);   // 쓸 수 있는 폭 (화면에 고정)
  const lineRef = useRef(null);   // 문장이 실제로 차지하는 폭 (내용만큼 늘어남)
  const [wrapped, setWrapped] = useState(false);   // 하한까지 줄여도 안 들어갈 때만 true

  // oneLine이면 한 줄에 다 넣는다. 넘치면 글자를 줄여서 맞춘다.
  // (짧은 문장이 두 줄로 끊기면 눈이 따라가기 어렵다)
  //
  // 재는 법이 중요하다: 가운데 정렬된 채로 넘치면 왼쪽으로 삐져나간 만큼은
  // scrollWidth에 잡히지 않아 "안 넘친다"고 잘못 읽는다.
  // 그래서 바깥(가용 폭)과 안쪽(내용 폭)을 나눠 두고 둘을 비교한다.
  useLayoutEffect(() => {
    const box = wrapRef.current;
    const el = lineRef.current;
    if (!box || !el) return;

    const fit = () => {
      el.style.fontSize = "";          // clamp()가 정한 기본 크기로 되돌리고 시작
      if (!oneLine) { setWrapped(false); return; }
      // 넘치는 비율만큼 한 번에 줄이고, 소수 오차를 두어 번 더 다듬는다
      for (let i = 0; i < 3; i++) {
        const avail = box.clientWidth;
        const need = el.offsetWidth;
        if (!avail || !need || need <= avail - 1) break;
        const cur = parseFloat(getComputedStyle(el).fontSize);
        const next = cur * ((avail - 2) / need);
        if (next < MIN_TARGET_FONT) { el.style.fontSize = `${MIN_TARGET_FONT}px`; break; }
        el.style.fontSize = `${next}px`;
      }
      // 하한까지 줄여도 안 들어가면 그때만 줄바꿈을 허용한다 (잘려서 안 보이는 것보다 낫다)
      setWrapped(el.offsetWidth > box.clientWidth + 1);
    };

    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [text, oneLine]);

  return (
    <div className="danmun-target-wrap" ref={wrapRef}>
    <div
      ref={lineRef}
      className={
        "danmun-target" +
        (oneLine ? " is-oneline" : "") +
        (oneLine && wrapped ? " is-wrapped" : "")
      }
    >
      {splitWords(text).map((word, wi) => (
        // 어절 단위로 묶어야 "눈이"가 "눈 / 이"로 갈라지지 않는다.
        // (글자마다 span이라 묶지 않으면 flex가 글자 단위로 줄을 끊는다)
        <span key={wi} className="dw">
          {word.map(({ ch, i }) => (
            <span
              key={i}
              className={
                "dt" +
                (i < typedLen ? " is-done" : "") +
                (i === typedLen ? " is-now" : "") +
                (ch === " " ? " is-space" : "")
              }
            >
              {ch === " " ? " " : ch}
            </span>
          ))}
        </span>
      ))}
    </div>
    </div>
  );
}

/* ── 단문연습 화면 ────────────────────────────────────────────────── */
export default function DanmunScreen({
  levels, loading = false, initialStep = 1, onDone, onNext,
  saveState = null, onRetrySave,
}) {
  const [step, setStep] = useState(initialStep);
  // 원본이 이미 와 있으면 첫 렌더부터 문장을 들고 시작한다.
  // (빈 채로 한 프레임을 보내면 "문장이 없어요"가 번쩍이고 입력칸도 잠깐 잠긴다)
  const [lines, setLines] = useState(
    () => (levels && !loading ? genDanmun(levels, initialStep) : [])
  );
  const [idx, setIdx] = useState(0);
  const [value, setValue] = useState("");
  const [composing, setComposing] = useState(false);
  const [phase, setPhase] = useState("ready");   // ready → playing → done
  const [stats, setStats] = useState({ correct: 0, wrong: 0 });  // 자모(타) 단위 누적
  const [elapsed, setElapsed] = useState(0);
  const [cpm, setCpm] = useState(0);             // 문장을 확정한 시점에만 갱신
  const [showKeyboard, setShowKeyboard] = useState(false);   // 기본 숨김
  const [pressedCode, setPressedCode] = useState(null);
  const [tempHint, setTempHint] = useState("");
  const [focusKey, setFocusKey] = useState(0);   // 올려 주면 입력칸이 포커스를 가져간다
  const [roomForHands, setRoomForHands] = useState(
    () => (typeof window === "undefined" ? true : window.innerHeight >= HANDS_MIN_H)
  );

  const inputRef = useRef(null);
  const bumpFocus = () => setFocusKey((k) => k + 1);
  const seededRef = useRef(lines.length > 0);   // 판을 만든 적이 있는가
  const levelsRef = useRef(levels);             // 어떤 원본으로 만들었는가
  const startRef = useRef(null);
  const timerRef = useRef(null);
  const pressRef = useRef(null);
  const hintRef = useRef(null);
  const committingRef = useRef(false);

  const cur = lines[idx] || "";
  // 아직 판을 만들기 전(seeded=false)이라면 문장이 없는 게 아니라 "아직 안 뽑은" 것이다
  const empty = !loading && seededRef.current && lines.length === 0;

  // 제출은 state가 아니라 이 스냅샷만 읽는다 — IME 종료 직후·연타에서 옛 값이 채점되지 않게.
  const live = useRef({});
  live.current = { phase, value, idx, lines, stats };

  /* ── 판 만들기 ────────────────────────────────────────────────────
     문장 원본(levels)은 App이 갖고 있다. 관리자가 문장을 바꿔 새 원본이 내려와도
     치는 중인 판은 그대로 두고, 아직 시작 전이면 새 원본으로 다시 만든다.
     (단계를 직접 고를 때는 selectStep이 곧바로 새 판을 만든다) */
  useEffect(() => {
    if (loading || !levels) return;
    if (phase === "playing" || phase === "done") return;
    if (levelsRef.current === levels && lines.length > 0) return;  // 이미 이 원본으로 뽑았다
    levelsRef.current = levels;
    reset(genDanmun(levels, step));
  }, [levels, loading]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (phase === "playing") {
      timerRef.current = setInterval(
        () => setElapsed((Date.now() - startRef.current) / 1000), 500
      );
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [phase]);

  useEffect(() => {
    const measure = () => setRoomForHands(window.innerHeight >= HANDS_MIN_H);
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  // 눌린 키 표시는 키보드를 펼쳤을 때만. preventDefault는 절대 하지 않는다 —
  // 하면 IME 입력이 통째로 막힌다. (자리·낱말연습과 다른 점)
  useEffect(() => {
    if (!showKeyboard) return;
    const on = (e) => {
      setPressedCode(e.code);
      clearTimeout(pressRef.current);
      pressRef.current = setTimeout(() => setPressedCode(null), 110);
    };
    window.addEventListener("keydown", on);
    return () => { window.removeEventListener("keydown", on); clearTimeout(pressRef.current); };
  }, [showKeyboard]);

  useEffect(() => () => { clearTimeout(hintRef.current); clearTimeout(pressRef.current); }, []);

  /* ── 비교·채점 ─────────────────────────────────────────────────── */
  const cells = useMemo(
    () => compareLine(cur, value, composing), [cur, value, composing]
  );

  // 다음에 눌러야 할 키(키보드를 펼쳤을 때만 의미 있다). 틀리게 치는 동안엔 어긋날 수 있는 근사.
  const flat = useMemo(() => decomposeWord(cur).flat, [cur]);
  const nextKey = flat[countLineKeys(value)] || null;
  const targetCode = nextKey ? nextKey.code : null;
  const needShift = !!(nextKey && nextKey.shift);
  const shiftCode = needShift
    ? (FINGER[targetCode] || "").startsWith("R") ? "ShiftLeft" : "ShiftRight"
    : null;

  const result = phase === "done" ? {
    screen: "danmun", step, mode: null,
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

  /* ── 입력 ──────────────────────────────────────────────────────── */
  function flashHint(text) {
    setTempHint(text);
    clearTimeout(hintRef.current);
    hintRef.current = setTimeout(() => setTempHint(""), 2000);
  }

  const handleChange = (v) => {
    if (phase === "done" || empty) return;
    if (phase === "ready" && v) { startRef.current = Date.now(); setPhase("playing"); }
    setValue(v);
  };

  // Enter — 문장 확정. 조합 중·자동반복은 SentenceInput이 이미 걸러 준다.
  const handleSubmit = () => {
    const now = live.current;
    if (now.phase === "done" || empty) return;
    if (!now.value) { flashHint("한 글자라도 써 보세요"); return; }
    if (committingRef.current) return;      // 연타로 두 문장이 넘어가지 않게
    committingRef.current = true;
    commitLine();
    requestAnimationFrame(() => { committingRef.current = false; });
  };

  function commitLine() {
    const { value: typed, idx: at, lines: seq, stats: acc } = live.current;
    const { correct, wrong } = scoreLine(seq[at] || "", typed);
    const sec = ((Date.now() - (startRef.current || Date.now())) / 1000) || 0;
    const total = { correct: acc.correct + correct, wrong: acc.wrong + wrong };
    setStats(total);
    setElapsed(sec);
    setCpm(calcCpm(total.correct, sec));   // 확정 시점에만 갱신 → 가만히 있어도 안 떨어진다
    setValue("");
    setTempHint("");
    if (at + 1 >= seq.length) setPhase("done");
    else { setIdx(at + 1); bumpFocus(); }
  }

  /* ── 판 조작 ───────────────────────────────────────────────────── */
  function reset(newLines) {
    seededRef.current = true;
    setLines(newLines);
    setIdx(0); setValue(""); setComposing(false); setPhase("ready");
    setStats({ correct: 0, wrong: 0 }); setElapsed(0); setCpm(0);
    startRef.current = null; committingRef.current = false;
    clearTimeout(hintRef.current); setTempHint("");
    bumpFocus();
  }
  // 다시 시작: 방금 친 문장은 피해서 새로 뽑는다
  const restart = () => reset(genDanmun(levels, step, lines));
  const selectStep = (id) => { setStep(id); reset(genDanmun(levels, id)); };
  const toggleKeyboard = () => {
    setShowKeyboard((v) => !v);
    bumpFocus();   // 자판을 여닫아도 곧바로 이어서 칠 수 있어야 한다
  };

  /* ── 안내 문구 ─────────────────────────────────────────────────── */
  const hasLatin = /[A-Za-z]/.test(value);
  const hint = hasLatin
    ? <span className="is-warn">한/영 키를 눌러 한글로 바꿔 주세요</span>
    : (tempHint || HINT_DEFAULT);

  return (
    <div
      data-screen-label="04 단문연습"
      style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden", position: "relative" }}
    >
      <div style={{ padding: "12px 40px 0", maxWidth: 1180, margin: "0 auto", width: "100%", boxSizing: "border-box" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <span style={{ fontFamily: '"IBM Plex Mono",monospace', fontSize: 11, color: "var(--accent)", letterSpacing: "0.18em", textTransform: "uppercase" }}>CH. 04</span>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, fontFamily: '"Noto Serif KR","Jua",serif' }}>단문연습</h1>
          <div style={{ flex: 1 }} />
          <StatsInline
            correct={stats.correct} wrong={stats.wrong} cpm={cpm}
            total={lines.length} idx={idx} unit="문장"
          />
        </div>
      </div>

      <div className="danmun-body" style={{ flex: 1, display: "flex", alignItems: "flex-start", minHeight: 0, maxWidth: 1180, margin: "0 auto", width: "100%", boxSizing: "border-box", padding: "14px 40px 0", gap: 24 }}>
        <StepList value={step} onChange={selectStep} steps={DANMUN_STEPS} />

        <div className="danmun-main" onPointerDown={() => inputRef.current?.focus()}>
          {loading ? (
            <div className="danmun-notice">문장을 가져오는 중이에요…</div>
          ) : empty ? (
            <div className="danmun-notice">
              이 단계에는 아직 문장이 없어요.<br />선생님께 말씀드려 주세요.
            </div>
          ) : (
            <TargetLine text={cur} typedLen={[...value].length} oneLine={step <= 2} />
          )}

          <SentenceInput
            ref={inputRef}
            value={value}
            cells={cells}
            disabled={loading || empty || phase === "done"}
            focusKey={focusKey}
            hint={hint}
            onChange={handleChange}
            onComposingChange={setComposing}
            onSubmit={handleSubmit}
          />
        </div>

        <div style={{ width: 172, flexShrink: 0 }} aria-hidden="true" />
      </div>

      <div className="danmun-foot">
        <div className="danmun-foot-row">
          <button
            type="button" className="kb-toggle"
            aria-expanded={showKeyboard} onClick={toggleKeyboard}
          >
            {showKeyboard ? "⌨ 키보드 숨기기" : "⌨ 키보드 보기"}
          </button>
          <span className="danmun-tip">
            {needShift && showKeyboard
              ? "⇧ Shift를 함께 누르세요"
              : "한자 키를 잘못 눌렀으면 Esc를 누르세요"}
          </span>
        </div>
        {showKeyboard && (
          <VirtualKeyboard
            targetCode={targetCode} shiftCode={shiftCode}
            pressedCode={pressedCode} showHands={roomForHands}
          />
        )}
      </div>

      {phase === "done" && (
        <DoneOverlay
          correct={stats.correct} wrong={stats.wrong} elapsed={elapsed}
          onRestart={restart}
          nextAction={nextPractice && onNext ? { label: nextPractice.label, onClick: () => onNext(nextPractice) } : null}
          saveState={saveState}
          onRetrySave={onRetrySave}
          autoFocus
        />
      )}
    </div>
  );
}
