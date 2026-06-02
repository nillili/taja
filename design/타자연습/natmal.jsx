/* natmal.jsx — 낱말연습 화면 (자리연습과 동일 디자인 + 단어) */
(function(){
const { useState, useEffect, useRef, useCallback, useMemo } = React;
const { VirtualKeyboard, StepList, StatsBar, DoneOverlay, DUBEOL, decomposeWord } = window.TypingKit;

/* ── 단계별 낱말 (기본/심화) ─────────────────────────────────────── */
const MODES = [{ id:'basic', label:'기본' }, { id:'adv', label:'심화' }];
const WORD_STEPS = [
  { id: 1, name: '1단계', sub: '쉬운 낱말', modes: MODES,
    basic: ['가구','나무','바다','사자','머리','노래','다리','모자','우유','오리'],
    adv:   [] },
  { id: 2, name: '2단계', sub: '받침 낱말', modes: MODES,
    basic: ['학교','선생','연필','책상','가방','거울','동물','구름','바람','시간'],
    adv:   [] },
  { id: 3, name: '3단계', sub: '긴 낱말', modes: MODES,
    basic: ['도서관','컴퓨터','자전거','운동장','무지개','병아리','놀이터','이야기','초등학교','과학자'],
    adv:   [] },
  { id: 4, name: '4단계', sub: '전체 섞기', modes: MODES,
    basic: ['가구','나무','학교','연필','책상','도서관','컴퓨터','무지개','자전거','구름','바람','운동장','병아리','이야기','거울'],
    adv:   [] },
];
// 심화 세트
WORD_STEPS[0].adv = ['토끼','꼬리','뚜껑','코끼리','까치','메뚜기','보따리','새싹','우표','찌개'];
WORD_STEPS[1].adv = ['공책','숙제','달력','목욕','정답','색종이','받침','넓이','밝다','앉다'];
WORD_STEPS[2].adv = ['과학실','전람회','횡단보도','관찰력','왕복하기','괜찬다','꽃다발','읽기책','넓적다리','외갓집'];
WORD_STEPS[3].adv = ['토끼','공책','과학실','꽃다발','횡단보도','색종이','관찰력','받침','앉다','외갓집','메뚜기','읽기책','넓이','정답','뚜껑'];

function genWords(stepId, modeId) {
  const step = WORD_STEPS.find(s => s.id === stepId) || WORD_STEPS[3];
  const src = (modeId === 'adv' ? step.adv : step.basic);
  const arr = [...src].sort(() => Math.random() - 0.5);
  return arr.slice(0, 10);
}

/* ── WordTape : 슬라이딩 단어 + 현재 글자 강조 ───────────────────── */
function WordTape({ seq, idx, curCharIndex, flash }) {
  const prev = idx > 0 ? seq[idx - 1] : null;
  const next = idx < seq.length - 1 ? seq[idx + 1] : null;

  return (
    <div style={{ position:'relative', height:150, width:'100%', display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden' }}>
      {/* prev word */}
      {prev && (
        <div style={{ position:'absolute', left:'4%', top:'50%', transform:'translateY(-50%)', fontSize:32, opacity:0.22, color:'var(--ink-faint)', fontFamily:'"Noto Serif KR","Jua",serif', userSelect:'none' }}>
          {prev}
        </div>
      )}
      {/* current word */}
      <div style={{ display:'inline-flex', gap:6 }}>
        {[...seq[idx]].map((ch, ci) => {
          const done  = ci < curCharIndex;
          const isCur = ci === curCharIndex;
          return (
            <span key={ci} style={{
              position:'relative',
              fontSize:72, lineHeight:1,
              fontFamily:'"Noto Serif KR","Jua",serif', fontWeight:700,
              padding:'8px 6px', borderRadius:14,
              color: flash==='wrong' && isCur ? '#ef4444'
                   : done ? 'var(--accent)' : isCur ? 'var(--ink)' : 'var(--ink-faint)',
              background: isCur
                ? (flash==='wrong' ? 'rgba(239,68,68,0.10)' : 'var(--accent-soft)')
                : 'transparent',
              border: isCur
                ? (flash==='wrong' ? '2.5px solid #ef4444' : '2.5px solid var(--accent)')
                : '2.5px solid transparent',
              opacity: done ? 0.55 : 1,
              transition:'color .12s, background .12s, border-color .12s, opacity .15s',
              userSelect:'none',
            }}>
              {ch}
            </span>
          );
        })}
      </div>
      {/* next word */}
      {next && (
        <div style={{ position:'absolute', right:'4%', top:'50%', transform:'translateY(-50%)', fontSize:32, opacity:0.3, color:'var(--ink-soft)', fontFamily:'"Noto Serif KR","Jua",serif', userSelect:'none' }}>
          {next}
        </div>
      )}
    </div>
  );
}

/* ── NatmalScreen ────────────────────────────────────────────────── */
function NatmalScreen({ showHands = true }) {
  const [step,  setStep]  = useState(4);              // 기본 4단계
  const [mode,  setMode]  = useState('basic');        // 기본/심화, 기본이 default
  const [seq,   setSeq]   = useState(() => genWords(4, 'basic'));
  const [idx,   setIdx]   = useState(0);              // 현재 낱말
  const [keyIndex, setKeyIndex] = useState(0);        // 낱말 내 키 입력 위치
  const [phase, setPhase] = useState('ready');
  const [flash, setFlash] = useState(null);
  const [pressedCode, setPressedCode] = useState(null);
  const [stats, setStats] = useState({ correct:0, wrong:0 });
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(null);
  const timerRef = useRef(null);
  const flashRef = useRef(null);

  const decomposed = useMemo(() => decomposeWord(seq[idx] || ''), [seq, idx]);
  const keys   = decomposed.flat;
  const target = keys[keyIndex];
  const targetCode = target ? target.code : null;
  const curCharIndex = target ? target.charIndex : (decomposed.chars.length);

  useEffect(() => {
    if (phase === 'playing') {
      timerRef.current = setInterval(() => setElapsed((Date.now() - startRef.current) / 1000), 500);
    } else { clearInterval(timerRef.current); }
    return () => clearInterval(timerRef.current);
  }, [phase]);

  /* live snapshot so the single keydown listener never reads stale state */
  const live = useRef({});
  live.current = { phase, target, keyIndex, keys, idx, seq };

  const handleKey = useCallback((e) => {
    const ignore = ['Tab','Escape','F1','F2','F3','F4','F5','F6','F7','F8','F9','F10','F11','F12','Alt','Control','Meta','Shift','CapsLock','Enter','Backspace'];
    if (ignore.includes(e.key)) return;
    const typed = DUBEOL[e.code];
    if (!typed && e.code !== 'Space') return;
    e.preventDefault();
    if (e.repeat) return;

    const { phase, target, keyIndex, keys, idx, seq } = live.current;
    if (phase === 'done' || !target) return;
    if (phase === 'ready') { startRef.current = Date.now(); setPhase('playing'); }

    setPressedCode(e.code);
    clearTimeout(flashRef.current);
    flashRef.current = setTimeout(() => setPressedCode(null), 110);

    const ok = e.code === target.code && (!target.shift || e.shiftKey);
    if (ok) {
      setFlash('right'); setTimeout(() => setFlash(null), 130);
      setStats(s => ({ ...s, correct: s.correct + 1 }));
      const nextKey = keyIndex + 1;
      if (nextKey >= keys.length) {
        const nextWord = idx + 1;
        if (nextWord >= seq.length) { setPhase('done'); }
        else { setIdx(nextWord); setKeyIndex(0); }
      } else {
        setKeyIndex(nextKey);
      }
    } else {
      setFlash('wrong'); setTimeout(() => setFlash(null), 260);
      setStats(s => ({ ...s, wrong: s.wrong + 1 }));
    }
  }, []);

  useEffect(() => {
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [handleKey]);

  const reset = (newSeq) => {
    setSeq(newSeq); setIdx(0); setKeyIndex(0); setPhase('ready');
    setFlash(null); setPressedCode(null);
    setStats({ correct:0, wrong:0 }); setElapsed(0); startRef.current = null;
  };
  const restart    = () => reset(genWords(step, mode));
  const selectStep = (id) => { setStep(id); setMode('basic'); reset(genWords(id, 'basic')); };
  const selectMode = (m)  => { setMode(m); reset(genWords(step, m)); };

  return (
    <div data-screen-label="03 낱말연습" style={{ display:'flex', flexDirection:'column', height:'calc(100vh - 70px)', overflow:'hidden', position:'relative' }}>
      <div style={{ padding:'12px 40px 0', maxWidth:1180, margin:'0 auto', width:'100%', boxSizing:'border-box' }}>
        <div style={{ display:'flex', alignItems:'baseline', gap:12, marginBottom:10 }}>
          <span style={{ fontFamily:'"IBM Plex Mono",monospace', fontSize:11, color:'var(--accent)', letterSpacing:'0.18em', textTransform:'uppercase' }}>CH. 03</span>
          <h1 style={{ margin:0, fontSize:24, fontWeight:700, fontFamily:'"Noto Serif KR","Jua",serif' }}>낱말연습</h1>
          <span style={{ marginLeft:'auto', fontSize:12, color:'var(--ink-faint)', fontStyle:'italic', fontFamily:'"Noto Serif KR",serif' }}>
            {phase === 'ready' ? '아무 키나 눌러 시작' : phase === 'done' ? '완료!' : '낱말을 한 글자씩 완성해요'}
          </span>
        </div>
        <StatsBar correct={stats.correct} wrong={stats.wrong} elapsed={elapsed} total={seq.length} idx={idx} unit="낱말" />
      </div>

      <div style={{ flex:1, display:'flex', alignItems:'flex-start', minHeight:210, maxWidth:1180, margin:'0 auto', width:'100%', boxSizing:'border-box', padding:'12px 40px 0', gap:24, overflow:'hidden' }}>
        <StepList value={step} onChange={selectStep} steps={WORD_STEPS} mode={mode} onMode={selectMode} />
        <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', minWidth:0, alignSelf:'stretch' }}>
          <WordTape seq={seq} idx={idx} curCharIndex={curCharIndex} flash={flash} />
        </div>
        <div style={{ width:148, flexShrink:0 }} aria-hidden="true" />
      </div>

      <div style={{ padding:'4px 0 14px', display:'flex', flexDirection:'column', alignItems:'center', gap:6 }}>
        <div style={{ fontFamily:'"IBM Plex Mono",monospace', fontSize:10, letterSpacing:'0.16em', color:'var(--ink-faint)', textTransform:'uppercase' }}>
          두벌식 자판 · 강조된 손가락으로 누르세요
        </div>
        <VirtualKeyboard targetCode={targetCode} pressedCode={pressedCode} showHands={showHands}/>
      </div>

      {phase === 'done' && <DoneOverlay correct={stats.correct} wrong={stats.wrong} elapsed={elapsed} onRestart={restart} />}
    </div>
  );
}

window.NatmalScreen = NatmalScreen;
})();
