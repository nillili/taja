/* jari.jsx — 자리연습 화면 (키보드 + 손 가이드) */
(function(){
const { useState, useEffect, useRef, useCallback } = React;

/* ── 두벌식 키 매핑 ──────────────────────────────────────────────── */
const DUBEOL = {
  KeyQ:'ㅂ', KeyW:'ㅈ', KeyE:'ㄷ', KeyR:'ㄱ', KeyT:'ㅅ',
  KeyY:'ㅛ', KeyU:'ㅕ', KeyI:'ㅑ', KeyO:'ㅐ', KeyP:'ㅔ',
  KeyA:'ㅁ', KeyS:'ㄴ', KeyD:'ㅇ', KeyF:'ㄹ', KeyG:'ㅎ',
  KeyH:'ㅗ', KeyJ:'ㅓ', KeyK:'ㅏ', KeyL:'ㅣ',
  KeyZ:'ㅋ', KeyX:'ㅌ', KeyC:'ㅊ', KeyV:'ㅍ',
  KeyB:'ㅠ', KeyN:'ㅜ', KeyM:'ㅡ',
};
const JAMO_CODE = Object.fromEntries(Object.entries(DUBEOL).map(([k,v])=>[v,k]));

/* ── 한글 분해: 단어 → 키 입력 순서 ──────────────────────────────── */
/* 각 keystroke = { code, jamo, shift } */
const CHO  = ['ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ','ㅅ','ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
const JUNG = ['ㅏ','ㅐ','ㅑ','ㅒ','ㅓ','ㅔ','ㅕ','ㅖ','ㅗ','ㅘ','ㅙ','ㅚ','ㅛ','ㅜ','ㅝ','ㅞ','ㅟ','ㅠ','ㅡ','ㅢ','ㅣ'];
const JONG = ['','ㄱ','ㄲ','ㄳ','ㄴ','ㄵ','ㄶ','ㄷ','ㄹ','ㄺ','ㄻ','ㄼ','ㄽ','ㄾ','ㄿ','ㅀ','ㅁ','ㅂ','ㅄ','ㅅ','ㅆ','ㅇ','ㅈ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];

/* 겹자모 → 단일 자모 키 시퀀스 */
const SHIFT_JAMO = { 'ㄲ':'ㄱ','ㄸ':'ㄷ','ㅃ':'ㅂ','ㅆ':'ㅅ','ㅉ':'ㅈ','ㅒ':'ㅐ','ㅖ':'ㅔ' };
const SPLIT_JAMO = {
  'ㅘ':['ㅗ','ㅏ'],'ㅙ':['ㅗ','ㅐ'],'ㅚ':['ㅗ','ㅣ'],
  'ㅝ':['ㅜ','ㅓ'],'ㅞ':['ㅜ','ㅔ'],'ㅟ':['ㅜ','ㅣ'],'ㅢ':['ㅡ','ㅣ'],
  'ㄳ':['ㄱ','ㅅ'],'ㄵ':['ㄴ','ㅈ'],'ㄶ':['ㄴ','ㅎ'],
  'ㄺ':['ㄹ','ㄱ'],'ㄻ':['ㄹ','ㅁ'],'ㄼ':['ㄹ','ㅂ'],'ㄽ':['ㄹ','ㅅ'],
  'ㄾ':['ㄹ','ㅌ'],'ㄿ':['ㄹ','ㅍ'],'ㅀ':['ㄹ','ㅎ'],'ㅄ':['ㅂ','ㅅ'],
};

/* 자모 하나 → keystroke 배열 */
function jamoToKeys(j) {
  if (SPLIT_JAMO[j]) return SPLIT_JAMO[j].flatMap(jamoToKeys);
  if (SHIFT_JAMO[j]) {
    const base = SHIFT_JAMO[j];
    return [{ code: JAMO_CODE[base], jamo: j, shift: true }];
  }
  const code = JAMO_CODE[j];
  if (!code) return [];
  return [{ code, jamo: j, shift: false }];
}

/* 글자(음절/낱자) → keystroke 배열 */
function charToKeys(ch) {
  const cp = ch.codePointAt(0);
  // 완성형 음절
  if (cp >= 0xAC00 && cp <= 0xD7A3) {
    const s = cp - 0xAC00;
    const cho  = CHO[Math.floor(s / 588)];
    const jung = JUNG[Math.floor((s % 588) / 28)];
    const jong = JONG[s % 28];
    return [
      ...jamoToKeys(cho),
      ...jamoToKeys(jung),
      ...(jong ? jamoToKeys(jong) : []),
    ];
  }
  // 단독 자모
  if (JAMO_CODE[ch] || SHIFT_JAMO[ch] || SPLIT_JAMO[ch]) return jamoToKeys(ch);
  // 공백/기타
  if (ch === ' ') return [{ code:'Space', jamo:' ', shift:false }];
  return [];
}

/* 단어 → { chars:[{ch, keys:[...]}], flat:[keystrokes] } */
function decomposeWord(word) {
  const chars = [...word].map(ch => ({ ch, keys: charToKeys(ch) }));
  const flat = [];
  chars.forEach((c, ci) => c.keys.forEach((k, ki) =>
    flat.push({ ...k, charIndex: ci, keyInChar: ki })));
  return { chars, flat };
}

/* ── 손가락 매핑: keyCode → 'L'|'R' + pinky/ring/middle/index/thumb ─ */
const FINGER = {
  // left pinky
  Escape:'L-pinky', Backquote:'L-pinky', Digit1:'L-pinky',
  Tab:'L-pinky', KeyQ:'L-pinky',
  CapsLock:'L-pinky', KeyA:'L-pinky',
  ShiftLeft:'L-pinky', KeyZ:'L-pinky',
  ControlLeft:'L-pinky',
  // left ring
  Digit2:'L-ring', KeyW:'L-ring', KeyS:'L-ring', KeyX:'L-ring',
  // left middle
  Digit3:'L-middle', KeyE:'L-middle', KeyD:'L-middle', KeyC:'L-middle',
  // left index
  Digit4:'L-index', Digit5:'L-index',
  KeyR:'L-index', KeyT:'L-index',
  KeyF:'L-index', KeyG:'L-index',
  KeyV:'L-index', KeyB:'L-index',
  // thumbs
  AltLeft:'L-thumb', Space:'thumb', AltRight:'R-thumb',
  // right index
  Digit6:'R-index', Digit7:'R-index',
  KeyY:'R-index', KeyU:'R-index',
  KeyH:'R-index', KeyJ:'R-index',
  KeyN:'R-index', KeyM:'R-index',
  // right middle
  Digit8:'R-middle', KeyI:'R-middle', KeyK:'R-middle', Comma:'R-middle',
  // right ring
  Digit9:'R-ring', KeyO:'R-ring', KeyL:'R-ring', Period:'R-ring',
  // right pinky
  Digit0:'R-pinky', Minus:'R-pinky', Equal:'R-pinky', Backspace:'R-pinky',
  KeyP:'R-pinky', BracketLeft:'R-pinky', BracketRight:'R-pinky', Backslash:'R-pinky',
  Semicolon:'R-pinky', Quote:'R-pinky', Enter:'R-pinky',
  Slash:'R-pinky', ShiftRight:'R-pinky', ControlRight:'R-pinky',
};

/* ── 키 크기 ─────────────────────────────────────────────────────── */
const KW = 62, KH = 54, GAP = 4;
const kw = w => Math.round(w * (KW + GAP) - GAP);
const ROW_WIDTH = kw(16); /* row 0~3 모두 16u 정렬 */
const KB_HEIGHT = 5 * KH + 4 * GAP;

/* ── 전체 자판 행 정의 (each row sums to ~16u) ──────────────────── */
const KB_ROWS = [
  // row 0: ESC + 13 + Backspace = 16u
  [
    {c:'Escape',      main:'ESC', top:'',  type:'mod', w:1},
    {c:'Backquote',   main:'`',   top:'~', type:'sym', w:1},
    {c:'Digit1',      main:'1',   top:'!', type:'sym', w:1},
    {c:'Digit2',      main:'2',   top:'@', type:'sym', w:1},
    {c:'Digit3',      main:'3',   top:'#', type:'sym', w:1},
    {c:'Digit4',      main:'4',   top:'$', type:'sym', w:1},
    {c:'Digit5',      main:'5',   top:'%', type:'sym', w:1},
    {c:'Digit6',      main:'6',   top:'^', type:'sym', w:1},
    {c:'Digit7',      main:'7',   top:'&', type:'sym', w:1},
    {c:'Digit8',      main:'8',   top:'*', type:'sym', w:1},
    {c:'Digit9',      main:'9',   top:'(', type:'sym', w:1},
    {c:'Digit0',      main:'0',   top:')', type:'sym', w:1},
    {c:'Minus',       main:'-',   top:'_', type:'sym', w:1},
    {c:'Equal',       main:'=',   top:'+', type:'sym', w:1},
    {c:'Backspace',   main:'⌫',  top:'',  type:'mod', w:2},
  ],
  // row 1: Tab + 13 + Backslash = 16u
  [
    {c:'Tab',         main:'Tab', top:'', type:'mod', w:1.5},
    {c:'KeyQ', main:'Q', top:'ㅂ', type:'letter', w:1},
    {c:'KeyW', main:'W', top:'ㅈ', type:'letter', w:1},
    {c:'KeyE', main:'E', top:'ㄷ', type:'letter', w:1},
    {c:'KeyR', main:'R', top:'ㄱ', type:'letter', w:1},
    {c:'KeyT', main:'T', top:'ㅅ', type:'letter', w:1},
    {c:'KeyY', main:'Y', top:'ㅛ', type:'letter', w:1},
    {c:'KeyU', main:'U', top:'ㅕ', type:'letter', w:1},
    {c:'KeyI', main:'I', top:'ㅑ', type:'letter', w:1},
    {c:'KeyO', main:'O', top:'ㅐ', type:'letter', w:1},
    {c:'KeyP', main:'P', top:'ㅔ', type:'letter', w:1},
    {c:'BracketLeft',  main:'[', top:'{', type:'sym', w:1},
    {c:'BracketRight', main:']', top:'}', type:'sym', w:1},
    {c:'Backslash',    main:'\\',top:'|', type:'sym', w:1.5},
  ],
  // row 2: CapsLock + 11 + Enter = 16u  (12.25 -> 1.75+11+2.25 = 15u? let's recheck)
  //  1.75 + 11×1 + ?  We have 9 letter keys (A-L) + ; ' = 11 keys.
  //  1.75 + 11 + 2.25 = 15u — short one. Make CapsLock 2 and Enter 3.
  [
    {c:'CapsLock', main:'한/영', top:'', type:'mod', w:2},
    {c:'KeyA', main:'A', top:'ㅁ', type:'letter', w:1},
    {c:'KeyS', main:'S', top:'ㄴ', type:'letter', w:1},
    {c:'KeyD', main:'D', top:'ㅇ', type:'letter', w:1},
    {c:'KeyF', main:'F', top:'ㄹ', type:'letter', w:1},
    {c:'KeyG', main:'G', top:'ㅎ', type:'letter', w:1},
    {c:'KeyH', main:'H', top:'ㅗ', type:'letter', w:1},
    {c:'KeyJ', main:'J', top:'ㅓ', type:'letter', w:1},
    {c:'KeyK', main:'K', top:'ㅏ', type:'letter', w:1},
    {c:'KeyL', main:'L', top:'ㅣ', type:'letter', w:1},
    {c:'Semicolon', main:';', top:':', type:'sym', w:1},
    {c:'Quote',     main:"'", top:'"', type:'sym', w:1},
    {c:'Enter',     main:'↵', top:'',  type:'mod', w:3},
  ],
  // row 3: Shift + 10 + Shift = 16u  (2.25 + 10 + 3.75 = 16)
  [
    {c:'ShiftLeft',  main:'Shift', top:'', type:'mod', w:2.25},
    {c:'KeyZ', main:'Z', top:'ㅋ', type:'letter', w:1},
    {c:'KeyX', main:'X', top:'ㅌ', type:'letter', w:1},
    {c:'KeyC', main:'C', top:'ㅊ', type:'letter', w:1},
    {c:'KeyV', main:'V', top:'ㅍ', type:'letter', w:1},
    {c:'KeyB', main:'B', top:'ㅠ', type:'letter', w:1},
    {c:'KeyN', main:'N', top:'ㅜ', type:'letter', w:1},
    {c:'KeyM', main:'M', top:'ㅡ', type:'letter', w:1},
    {c:'Comma',  main:',', top:'<', type:'sym', w:1},
    {c:'Period', main:'.', top:'>', type:'sym', w:1},
    {c:'Slash',  main:'/', top:'?', type:'sym', w:1},
    {c:'ShiftRight', main:'Shift', top:'', type:'mod', w:3.75},
  ],
  // row 4: bottom modifier row (16u). Ctrl+Alt + Space + Alt+Ctrl
  [
    {c:'ControlLeft', main:'Ctrl', top:'', type:'mod', w:1.5},
    {c:'AltLeft',     main:'Alt',  top:'', type:'mod', w:1.5},
    {c:'Space',       main:'',     top:'', type:'space', w:8},
    {c:'AltRight',    main:'Alt',  top:'', type:'mod', w:1.5},
    {c:'ControlRight',main:'Ctrl', top:'', type:'mod', w:1.5},
    {c:'__pad',       main:'',     top:'', type:'pad',   w:2},
  ],
];

/* ── 연습 시퀀스 (단계별) ────────────────────────────────────────── */
const STEPS = [
  { id: 1, name: '1단계', sub: '기본 자리',
    jamo: ['ㅁ','ㄴ','ㅇ','ㄹ','ㅎ','ㅗ','ㅓ','ㅏ','ㅣ'] },
  { id: 2, name: '2단계', sub: '윗 줄',
    jamo: ['ㅂ','ㅈ','ㄷ','ㄱ','ㅅ','ㅛ','ㅕ','ㅑ','ㅐ','ㅔ'] },
  { id: 3, name: '3단계', sub: '아랫 줄',
    jamo: ['ㅋ','ㅌ','ㅊ','ㅍ','ㅠ','ㅜ','ㅡ'] },
  { id: 4, name: '4단계', sub: '전체 섞기',
    jamo: ['ㅂ','ㅈ','ㄷ','ㄱ','ㅅ','ㅛ','ㅕ','ㅑ','ㅐ','ㅔ',
           'ㅁ','ㄴ','ㅇ','ㄹ','ㅎ','ㅗ','ㅓ','ㅏ','ㅣ',
           'ㅋ','ㅌ','ㅊ','ㅍ','ㅠ','ㅜ','ㅡ'] },
];
function genSeq(stepId) {
  const step = STEPS.find(s => s.id === stepId) || STEPS[0];
  const base = step.jamo;
  const shuffled = [...base].sort(()=>Math.random()-0.5);
  return [...base, ...shuffled];
}

/* ── CharTape ────────────────────────────────────────────────────── */
function CharTape({ seq, idx, flash }) {
  const CELL = 90;
  return (
    <div style={{ position:'relative', height:140, overflow:'hidden', width:'100%', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{
        position:'absolute', width:104, height:104, borderRadius:16,
        border: flash==='wrong' ? '2.5px solid #ef4444' : '2.5px solid var(--accent)',
        background: flash==='wrong' ? 'rgba(239,68,68,0.08)' : 'var(--accent-soft)',
        transition:'border-color 0.12s, background 0.12s', pointerEvents:'none', zIndex:0,
      }}/>
      {seq.map((char, i) => {
        const dist = i - idx;
        if (Math.abs(dist) > 4) return null;
        const isCur  = dist === 0;
        const isPast = dist < 0;
        const size   = isCur ? 76 : Math.abs(dist)===1 ? 38 : 24;
        const opacity = isCur ? 1 : isPast ? (Math.abs(dist)===1 ? 0.35 : 0.15) : (Math.abs(dist)===1 ? 0.52 : 0.22);
        const color = flash==='wrong' && isCur ? '#ef4444' : flash==='right' && isCur ? 'var(--accent)' : isPast ? 'var(--ink-faint)' : 'var(--ink)';
        return (
          <div key={i} style={{
            position:'absolute', left:'50%', top:'50%',
            transform:`translate(calc(-50% + ${dist * CELL}px), -50%)`,
            transition:'transform 0.2s cubic-bezier(.22,.68,0,1.15), font-size 0.2s, opacity 0.2s, color 0.12s',
            fontSize:size, opacity, color,
            fontFamily:'"Noto Serif KR","Jua",serif', fontWeight: isCur?700:400,
            lineHeight:1, userSelect:'none', pointerEvents:'none', zIndex: isCur?2:1,
          }}>
            {char}
          </div>
        );
      })}
    </div>
  );
}

/* ── Key ─────────────────────────────────────────────────────────── */
function KeyCap({ data, isTarget, isPressed }) {
  const { main, top, type, w } = data;
  const width  = kw(w);

  if (type === 'pad') return <div style={{ width, flexShrink:0 }}/>;

  const isLetter = type === 'letter';
  const isMod    = type === 'mod';
  const isSpace  = type === 'space';

  const bg = isTarget
    ? 'var(--accent)'
    : isPressed
    ? 'var(--paper-edge)'
    : isMod
    ? 'color-mix(in oklab, var(--paper-edge) 50%, var(--paper-deep))'
    : 'var(--paper-deep)';

  const borderColor = isTarget ? 'var(--ink)' : 'var(--rule)';
  const textColor   = isTarget ? '#fff' : 'var(--ink)';
  const shadow      = isTarget ? `0 3px 0 var(--ink)` : isPressed ? 'none' : `0 2.5px 0 var(--rule)`;
  const translateY  = isPressed ? '2px' : '0';

  const base = {
    position:'relative', display:'flex', flexShrink:0,
    width, height: isSpace ? KH-6 : KH,
    borderRadius: 8, border:`1.5px solid ${borderColor}`,
    background: bg, color: textColor,
    boxShadow: shadow, transform:`translateY(${translateY})`,
    transition:'background 0.08s, transform 0.06s, box-shadow 0.06s, border-color 0.08s',
    cursor:'default', userSelect:'none', overflow:'hidden',
    alignItems:'center', justifyContent:'center',
  };

  if (isSpace) return <div style={base} />;

  if (isMod) {
    return (
      <div style={base}>
        <span style={{ fontSize: main.length > 3 ? 11 : 12, fontFamily:'"IBM Plex Mono","Gowun Dodum",monospace', fontWeight:500, letterSpacing:'-0.02em', textAlign:'center', lineHeight:1.2, padding:'0 6px' }}>
          {main}
        </span>
      </div>
    );
  }

  if (isLetter) {
    return (
      <div style={{ ...base, flexDirection:'column', alignItems:'stretch', justifyContent:'space-between', padding:'5px 7px' }}>
        <span style={{ fontSize:22, fontFamily:'"Noto Serif KR","Jua",serif', fontWeight: isTarget?700:500, lineHeight:1, color: isTarget?'#fff':'var(--ink)', alignSelf:'flex-start' }}>{top}</span>
        <span style={{ fontSize:11, fontFamily:'"IBM Plex Mono",monospace', color: isTarget?'rgba(255,255,255,0.7)':'var(--ink-faint)', alignSelf:'flex-end', lineHeight:1 }}>{main}</span>
      </div>
    );
  }

  // sym key
  return (
    <div style={{ ...base, flexDirection:'column', alignItems:'stretch', justifyContent:'space-between', padding:'5px 7px' }}>
      <span style={{ fontSize:13, fontFamily:'"IBM Plex Mono",monospace', color: isTarget?'rgba(255,255,255,0.7)':'var(--ink-soft)', alignSelf:'flex-end', lineHeight:1, fontWeight:500 }}>{top}</span>
      <span style={{ fontSize:16, fontFamily:'"IBM Plex Mono",monospace', fontWeight:500, color: isTarget?'#fff':'var(--ink)', alignSelf:'flex-start', lineHeight:1 }}>{main}</span>
    </div>
  );
}

/* ── HandOverlay ─────────────────────────────────────────────────── */
/* Single hand SVG: rendered facing palm-down, fingers reaching UP    */
function HandSVG({ side, highlightFinger }) {
  // SVG drawn as a LEFT hand (pinky on the left, thumb on the right reaching toward center).
  // For the right hand, we mirror horizontally.
  const flip = side === 'R' ? -1 : 1;
  const baseColor   = 'rgba(120,118,138,0.32)';
  const strokeColor = 'rgba(40,38,60,0.45)';
  const hotFill     = 'rgba(229,80,80,0.55)';
  const hotStroke   = 'rgba(180,40,40,0.85)';

  const fill = (f) => highlightFinger === f ? hotFill   : baseColor;
  const strk = (f) => highlightFinger === f ? hotStroke : strokeColor;

  return (
    <svg viewBox="0 0 240 220" width="100%" height="100%" style={{ overflow:'visible' }}>
      <g transform={`translate(120 0) scale(${flip} 1) translate(-120 0)`}>
        {/* palm */}
        <path
          d="M 60 200 Q 50 150 60 110 Q 65 95 80 95 L 175 95 Q 195 95 200 115 Q 210 165 195 200 Q 190 215 170 218 L 80 218 Q 65 215 60 200 Z"
          fill={baseColor} stroke={strokeColor} strokeWidth="1.5"
        />
        {/* pinky */}
        <path d="M 70 110 Q 64 60 76 35 Q 88 28 96 38 Q 102 60 96 110 Z"
              fill={fill('pinky')} stroke={strk('pinky')} strokeWidth="1.5"/>
        {/* ring */}
        <path d="M 100 105 Q 96 50 108 22 Q 122 14 130 26 Q 134 50 128 108 Z"
              fill={fill('ring')} stroke={strk('ring')} strokeWidth="1.5"/>
        {/* middle */}
        <path d="M 132 100 Q 130 35 144 8 Q 158 0 166 12 Q 170 38 160 102 Z"
              fill={fill('middle')} stroke={strk('middle')} strokeWidth="1.5"/>
        {/* index */}
        <path d="M 164 102 Q 168 50 180 30 Q 194 24 200 36 Q 200 60 192 108 Z"
              fill={fill('index')} stroke={strk('index')} strokeWidth="1.5"/>
        {/* thumb (offset right) */}
        <path d="M 200 145 Q 230 135 238 155 Q 240 180 218 195 Q 200 200 195 185 Q 192 165 200 145 Z"
              fill={fill('thumb')} stroke={strk('thumb')} strokeWidth="1.5"/>
      </g>
    </svg>
  );
}

function HandsOverlay({ targetCode }) {
  const f = FINGER[targetCode] || '';
  const leftFinger  = f.startsWith('L-') ? f.slice(2) : f === 'thumb' ? 'thumb' : null;
  const rightFinger = f.startsWith('R-') ? f.slice(2) : f === 'thumb' ? 'thumb' : null;

  const handStyle = {
    position:'absolute', top:'-2px',
    width:'46%', height:'calc(100% + 12px)',
    pointerEvents:'none',
    transition:'opacity 0.15s',
  };

  return (
    <div style={{ position:'absolute', inset:0, pointerEvents:'none', zIndex:5 }}>
      {/* SVG is authored as a LEFT hand. Use it as-is for L, mirror for R. */}
      <div style={{ ...handStyle, left:'2%' }}>
        <HandSVG side="L" highlightFinger={leftFinger} />
      </div>
      <div style={{ ...handStyle, right:'2%' }}>
        <HandSVG side="R" highlightFinger={rightFinger} />
      </div>
    </div>
  );
}

/* ── VirtualKeyboard ─────────────────────────────────────────────── */
function VirtualKeyboard({ targetCode, pressedCode, showHands }) {
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const compute = () => {
      const widthScale  = Math.min(window.innerWidth * 0.92, 1100) / ROW_WIDTH;
      // give the keyboard at most ~42% of the viewport height so the step
      // list + char tape above always keep their room on short screens.
      const heightScale = (window.innerHeight * 0.42) / KB_HEIGHT;
      setScale(Math.max(0.5, Math.min(1, widthScale, heightScale)));
    };
    compute();
    window.addEventListener('resize', compute);
    return () => window.removeEventListener('resize', compute);
  }, []);

  return (
    <div style={{
      width:  ROW_WIDTH * scale,
      height: KB_HEIGHT * scale,
      position: 'relative',
    }}>
      <div style={{
        position:'absolute', top:0, left:0,
        width: ROW_WIDTH,
        transform: `scale(${scale})`,
        transformOrigin: 'top left',
      }}>
        <div style={{ position:'relative', width: ROW_WIDTH }}>
          <div style={{ display:'flex', flexDirection:'column', gap:GAP, alignItems:'flex-start' }}>
            {KB_ROWS.map((row, ri) => (
              <div key={ri} style={{ display:'flex', gap:GAP }}>
                {row.map(k => (
                  <KeyCap key={k.c} data={k} isTarget={k.c === targetCode} isPressed={k.c === pressedCode}/>
                ))}
              </div>
            ))}
          </div>
          {showHands && <HandsOverlay targetCode={targetCode} />}
        </div>
      </div>
    </div>
  );
}

/* ── StatsBar ────────────────────────────────────────────────────── */
function StatsBar({ correct, wrong, elapsed, total, idx, unit = '자' }) {
  const cpm = elapsed > 1 ? Math.round((correct / elapsed) * 60) : 0;
  const acc = correct + wrong > 0 ? Math.round((correct / (correct + wrong)) * 100) : 100;
  const pct = total > 0 ? Math.round((idx / total) * 100) : 0;
  return (
    <div style={{ display:'flex', gap:24, alignItems:'center', paddingBottom:10, borderBottom:'1px dashed var(--rule)' }}>
      <div style={{ flex:1 }}>
        <div style={{ height:5, background:'var(--paper-edge)', borderRadius:3, overflow:'hidden' }}>
          <div style={{ height:'100%', width:`${pct}%`, background:'var(--accent)', borderRadius:3, transition:'width 0.25s' }}/>
        </div>
        <div style={{ marginTop:4, fontSize:11, fontFamily:'"IBM Plex Mono",monospace', color:'var(--ink-faint)' }}>
          {idx} / {total} {unit}
        </div>
      </div>
      {[['타수', `${cpm}`], ['정확도', `${acc}%`]].map(([lbl, val]) => (
        <div key={lbl} style={{ textAlign:'right', minWidth:60 }}>
          <div style={{ fontFamily:'"IBM Plex Mono",monospace', fontSize:22, fontWeight:500, color:'var(--ink)', lineHeight:1 }}>{val}</div>
          <div style={{ fontFamily:'"IBM Plex Mono",monospace', fontSize:10, color:'var(--ink-faint)', letterSpacing:'0.14em', textTransform:'uppercase', marginTop:2 }}>{lbl}</div>
        </div>
      ))}
    </div>
  );
}

/* ── StepList (단일 선택, 선택 단계는 기본/심화 토글 내장) ─────────── */
function StepList({ value, onChange, steps = STEPS, mode, onMode }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:5, width:148 }}>
      <div style={{ fontFamily:'"IBM Plex Mono",monospace', fontSize:9, letterSpacing:'0.16em', color:'var(--ink-faint)', textTransform:'uppercase', marginBottom:1 }}>
        단계 선택
      </div>
      {steps.map(s => {
        const active = s.id === value;
        const hasModes = !!s.modes && active;
        return (
          <div
            key={s.id}
            role="button"
            tabIndex={0}
            onClick={() => onChange(s.id)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onChange(s.id); } }}
            style={{
              display:'flex', alignItems:'center', gap:8,
              textAlign:'left', cursor:'pointer',
              padding:'6px 10px',
              border: active ? '2px solid var(--ink)' : '1.5px solid var(--rule)',
              background: active ? 'var(--accent)' : 'var(--paper-deep)',
              color: active ? '#fff' : 'var(--ink)',
              borderRadius:7,
              boxShadow: active ? '0 2px 0 var(--ink)' : 'none',
              transition:'background 0.1s, border-color 0.1s, box-shadow 0.1s',
              fontFamily:'"Noto Serif KR","Jua",serif',
            }}
          >
            <span style={{
              width:13, height:13, borderRadius:'50%', flexShrink:0,
              border: active ? '2px solid #fff' : '2px solid var(--ink-faint)',
              background: active ? '#fff' : 'transparent',
              boxShadow: active ? 'inset 0 0 0 2.5px var(--accent)' : 'none',
            }}/>
            <span style={{ display:'flex', flexDirection:'column', lineHeight:1.1, minWidth:0, flex:1 }}>
              <span style={{ fontSize:14, fontWeight:700, whiteSpace:'nowrap' }}>{s.name}</span>
              {hasModes ? (
                /* 세그먼트 토글: 설명글 자리에 들어가 높이 증가 없음 */
                <span style={{
                  display:'flex', marginTop:4,
                  background:'rgba(0,0,0,0.18)', borderRadius:6, padding:2, gap:2,
                }}>
                  {s.modes.map(m => {
                    const on = m.id === mode;
                    return (
                      <span
                        key={m.id}
                        role="button"
                        tabIndex={0}
                        onClick={(e) => { e.stopPropagation(); onMode && onMode(m.id); }}
                        onKeyDown={(e) => { if (e.key==='Enter'||e.key===' ') { e.preventDefault(); e.stopPropagation(); onMode && onMode(m.id); } }}
                        style={{
                          flex:1, textAlign:'center', cursor:'pointer',
                          padding:'3px 0', borderRadius:4,
                          fontFamily:'"Noto Serif KR","Jua",serif', fontSize:11, fontWeight:700,
                          background: on ? 'var(--paper-deep)' : 'transparent',
                          color: on ? 'var(--ink)' : 'rgba(255,255,255,0.78)',
                          border: on ? '1.5px solid var(--ink)' : '1.5px solid transparent',
                          transition:'background .1s, color .1s, border-color .1s',
                        }}
                      >
                        {m.label}
                      </span>
                    );
                  })}
                </span>
              ) : (
                <span style={{ fontSize:10, opacity: active ? 0.85 : 0.6, fontFamily:'"IBM Plex Mono","Gowun Dodum",monospace', whiteSpace:'nowrap' }}>{s.sub}</span>
              )}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* ── DoneOverlay ─────────────────────────────────────────────────── */
function DoneOverlay({ correct, wrong, elapsed, onRestart }) {
  const cpm = elapsed > 1 ? Math.round((correct / elapsed) * 60) : 0;
  const acc = correct + wrong > 0 ? Math.round((correct / (correct + wrong)) * 100) : 100;
  return (
    <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,0.12)', backdropFilter:'blur(2px)', zIndex:20 }}>
      <div style={{ background:'var(--paper)', border:'2.5px solid var(--ink)', padding:'36px 52px', boxShadow:'7px 7px 0 var(--ink)', textAlign:'center', minWidth:280 }}>
        <div style={{ fontFamily:'"IBM Plex Mono",monospace', fontSize:11, color:'var(--accent)', letterSpacing:'0.2em', textTransform:'uppercase', marginBottom:10 }}>연습 완료!</div>
        <div style={{ fontSize:48, fontWeight:700, fontFamily:'"Noto Serif KR",serif', lineHeight:1, marginBottom:16 }}>수고했어요</div>
        <div style={{ fontFamily:'"IBM Plex Mono",monospace', color:'var(--ink-soft)', fontSize:15, marginBottom:8 }}>{cpm} 타 &nbsp;·&nbsp; 정확도 {acc}%</div>
        <div style={{ fontFamily:'"IBM Plex Mono",monospace', color:'var(--ink-faint)', fontSize:12, marginBottom:28 }}>맞춤 {correct} · 틀림 {wrong}</div>
        <button onClick={onRestart} style={{ padding:'11px 32px', border:'2px solid var(--ink)', background:'var(--ink)', color:'var(--paper)', fontFamily:'"Noto Serif KR",serif', fontSize:16, cursor:'pointer', borderRadius:4 }}>
          다시 시작
        </button>
      </div>
    </div>
  );
}

/* ── JariScreen ──────────────────────────────────────────────────── */
function JariScreen({ showHands = true }) {
  const [step,  setStep]  = useState(1);
  const [seq,   setSeq]   = useState(() => genSeq(1));
  const [idx,   setIdx]   = useState(0);
  const [phase, setPhase] = useState('ready');
  const [flash, setFlash] = useState(null);
  const [pressedCode, setPressedCode] = useState(null);
  const [stats, setStats] = useState({ correct:0, wrong:0 });
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(null);
  const timerRef = useRef(null);
  const flashRef = useRef(null);

  useEffect(() => {
    if (phase === 'playing') {
      timerRef.current = setInterval(() => setElapsed((Date.now() - startRef.current) / 1000), 500);
    } else { clearInterval(timerRef.current); }
    return () => clearInterval(timerRef.current);
  }, [phase]);

  const target     = seq[idx];
  const targetCode = target ? JAMO_CODE[target] : null;

  const live = useRef({});
  live.current = { phase, target, idx, seq };

  const handleKey = useCallback((e) => {
    const ignore = ['Tab','Escape','F1','F2','F3','F4','F5','F6','F7','F8','F9','F10','F11','F12','Alt','Control','Meta','Shift','CapsLock','Enter','Backspace'];
    if (ignore.includes(e.key)) return;
    e.preventDefault();
    if (e.repeat) return;
    const typed = DUBEOL[e.code];
    if (!typed) return;
    const { phase, target, idx, seq } = live.current;
    if (phase === 'done') return;
    if (phase === 'ready') { startRef.current = Date.now(); setPhase('playing'); }
    setPressedCode(e.code);
    clearTimeout(flashRef.current);
    flashRef.current = setTimeout(() => setPressedCode(null), 110);
    if (typed === target) {
      setFlash('right'); setTimeout(() => setFlash(null), 150);
      setStats(s => ({ ...s, correct: s.correct + 1 }));
      const next = idx + 1;
      if (next >= seq.length) setPhase('done'); else setIdx(next);
    } else {
      setFlash('wrong'); setTimeout(() => setFlash(null), 280);
      setStats(s => ({ ...s, wrong: s.wrong + 1 }));
    }
  }, []);

  useEffect(() => {
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [handleKey]);

  const restart = () => {
    setSeq(genSeq(step));
    setIdx(0); setPhase('ready'); setFlash(null); setPressedCode(null);
    setStats({ correct:0, wrong:0 }); setElapsed(0); startRef.current = null;
  };

  const selectStep = (id) => {
    setStep(id);
    setSeq(genSeq(id));
    setIdx(0); setPhase('ready'); setFlash(null); setPressedCode(null);
    setStats({ correct:0, wrong:0 }); setElapsed(0); startRef.current = null;
  };

  return (
    <div data-screen-label="02 자리연습" style={{ display:'flex', flexDirection:'column', height:'calc(100vh - 70px)', overflow:'hidden', position:'relative' }}>
      <div style={{ padding:'12px 40px 0', maxWidth:1180, margin:'0 auto', width:'100%', boxSizing:'border-box' }}>
        <div style={{ display:'flex', alignItems:'baseline', gap:12, marginBottom:10 }}>
          <span style={{ fontFamily:'"IBM Plex Mono",monospace', fontSize:11, color:'var(--accent)', letterSpacing:'0.18em', textTransform:'uppercase' }}>CH. 02</span>
          <h1 style={{ margin:0, fontSize:24, fontWeight:700, fontFamily:'"Noto Serif KR","Jua",serif' }}>자리연습</h1>
          <span style={{ marginLeft:'auto', fontSize:12, color:'var(--ink-faint)', fontStyle:'italic', fontFamily:'"Noto Serif KR",serif' }}>
            {phase === 'ready' ? '아무 키나 눌러 시작' : phase === 'done' ? '완료!' : '두벌식 기본 자리 익히기'}
          </span>
        </div>
        <StatsBar correct={stats.correct} wrong={stats.wrong} elapsed={elapsed} total={seq.length} idx={idx} />
      </div>

      <div style={{ flex:1, display:'flex', alignItems:'flex-start', minHeight:210, maxWidth:1180, margin:'0 auto', width:'100%', boxSizing:'border-box', padding:'12px 40px 0', gap:24, overflow:'hidden' }}>
        <StepList value={step} onChange={selectStep} />
        <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', minWidth:0, alignSelf:'stretch' }}>
          <CharTape seq={seq} idx={idx} flash={flash} />
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

window.JariScreen = JariScreen;

/* shared building blocks for other practice screens */
window.TypingKit = {
  VirtualKeyboard, StepList, StatsBar, DoneOverlay,
  DUBEOL, JAMO_CODE, FINGER,
  decomposeWord, charToKeys,
};
})();
