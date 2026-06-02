// keyboard.js — 두벌식 전체 자판 레이아웃 + 손가락 매핑 + 키 크기 계산.

// 손가락 매핑: KeyCode → 'L-pinky' | 'R-index' | 'thumb' ...
export const FINGER = {
  // left pinky
  Escape: "L-pinky", Backquote: "L-pinky", Digit1: "L-pinky",
  Tab: "L-pinky", KeyQ: "L-pinky", CapsLock: "L-pinky", KeyA: "L-pinky",
  ShiftLeft: "L-pinky", KeyZ: "L-pinky", ControlLeft: "L-pinky",
  // left ring
  Digit2: "L-ring", KeyW: "L-ring", KeyS: "L-ring", KeyX: "L-ring",
  // left middle
  Digit3: "L-middle", KeyE: "L-middle", KeyD: "L-middle", KeyC: "L-middle",
  // left index
  Digit4: "L-index", Digit5: "L-index", KeyR: "L-index", KeyT: "L-index",
  KeyF: "L-index", KeyG: "L-index", KeyV: "L-index", KeyB: "L-index",
  // thumbs
  AltLeft: "L-thumb", Space: "thumb", AltRight: "R-thumb",
  // right index
  Digit6: "R-index", Digit7: "R-index", KeyY: "R-index", KeyU: "R-index",
  KeyH: "R-index", KeyJ: "R-index", KeyN: "R-index", KeyM: "R-index",
  // right middle
  Digit8: "R-middle", KeyI: "R-middle", KeyK: "R-middle", Comma: "R-middle",
  // right ring
  Digit9: "R-ring", KeyO: "R-ring", KeyL: "R-ring", Period: "R-ring",
  // right pinky
  Digit0: "R-pinky", Minus: "R-pinky", Equal: "R-pinky", Backspace: "R-pinky",
  KeyP: "R-pinky", BracketLeft: "R-pinky", BracketRight: "R-pinky", Backslash: "R-pinky",
  Semicolon: "R-pinky", Quote: "R-pinky", Enter: "R-pinky",
  Slash: "R-pinky", ShiftRight: "R-pinky", ControlRight: "R-pinky",
};

// 키 크기
export const KW = 62, KH = 54, GAP = 4;
export const kw = (w) => Math.round(w * (KW + GAP) - GAP);
export const ROW_WIDTH = kw(16); // 모든 행을 16u로 정렬
export const KB_HEIGHT = 5 * KH + 4 * GAP;

// 전체 자판 행 정의 (각 행 합이 16u)
export const KB_ROWS = [
  // row 0: ESC + 13 + Backspace
  [
    { c: "Escape", main: "ESC", top: "", type: "mod", w: 1 },
    { c: "Backquote", main: "`", top: "~", type: "sym", w: 1 },
    { c: "Digit1", main: "1", top: "!", type: "sym", w: 1 },
    { c: "Digit2", main: "2", top: "@", type: "sym", w: 1 },
    { c: "Digit3", main: "3", top: "#", type: "sym", w: 1 },
    { c: "Digit4", main: "4", top: "$", type: "sym", w: 1 },
    { c: "Digit5", main: "5", top: "%", type: "sym", w: 1 },
    { c: "Digit6", main: "6", top: "^", type: "sym", w: 1 },
    { c: "Digit7", main: "7", top: "&", type: "sym", w: 1 },
    { c: "Digit8", main: "8", top: "*", type: "sym", w: 1 },
    { c: "Digit9", main: "9", top: "(", type: "sym", w: 1 },
    { c: "Digit0", main: "0", top: ")", type: "sym", w: 1 },
    { c: "Minus", main: "-", top: "_", type: "sym", w: 1 },
    { c: "Equal", main: "=", top: "+", type: "sym", w: 1 },
    { c: "Backspace", main: "⌫", top: "", type: "mod", w: 2 },
  ],
  // row 1: Tab + 13 + Backslash
  [
    { c: "Tab", main: "Tab", top: "", type: "mod", w: 1.5 },
    { c: "KeyQ", main: "Q", top: "ㅂ", type: "letter", w: 1 },
    { c: "KeyW", main: "W", top: "ㅈ", type: "letter", w: 1 },
    { c: "KeyE", main: "E", top: "ㄷ", type: "letter", w: 1 },
    { c: "KeyR", main: "R", top: "ㄱ", type: "letter", w: 1 },
    { c: "KeyT", main: "T", top: "ㅅ", type: "letter", w: 1 },
    { c: "KeyY", main: "Y", top: "ㅛ", type: "letter", w: 1 },
    { c: "KeyU", main: "U", top: "ㅕ", type: "letter", w: 1 },
    { c: "KeyI", main: "I", top: "ㅑ", type: "letter", w: 1 },
    { c: "KeyO", main: "O", top: "ㅐ", type: "letter", w: 1 },
    { c: "KeyP", main: "P", top: "ㅔ", type: "letter", w: 1 },
    { c: "BracketLeft", main: "[", top: "{", type: "sym", w: 1 },
    { c: "BracketRight", main: "]", top: "}", type: "sym", w: 1 },
    { c: "Backslash", main: "\\", top: "|", type: "sym", w: 1.5 },
  ],
  // row 2: 한/영 + 11 + Enter
  [
    { c: "CapsLock", main: "한/영", top: "", type: "mod", w: 2 },
    { c: "KeyA", main: "A", top: "ㅁ", type: "letter", w: 1 },
    { c: "KeyS", main: "S", top: "ㄴ", type: "letter", w: 1 },
    { c: "KeyD", main: "D", top: "ㅇ", type: "letter", w: 1 },
    { c: "KeyF", main: "F", top: "ㄹ", type: "letter", w: 1 },
    { c: "KeyG", main: "G", top: "ㅎ", type: "letter", w: 1 },
    { c: "KeyH", main: "H", top: "ㅗ", type: "letter", w: 1 },
    { c: "KeyJ", main: "J", top: "ㅓ", type: "letter", w: 1 },
    { c: "KeyK", main: "K", top: "ㅏ", type: "letter", w: 1 },
    { c: "KeyL", main: "L", top: "ㅣ", type: "letter", w: 1 },
    { c: "Semicolon", main: ";", top: ":", type: "sym", w: 1 },
    { c: "Quote", main: "'", top: '"', type: "sym", w: 1 },
    { c: "Enter", main: "↵", top: "", type: "mod", w: 3 },
  ],
  // row 3: Shift + 10 + Shift
  [
    { c: "ShiftLeft", main: "Shift", top: "", type: "mod", w: 2.25 },
    { c: "KeyZ", main: "Z", top: "ㅋ", type: "letter", w: 1 },
    { c: "KeyX", main: "X", top: "ㅌ", type: "letter", w: 1 },
    { c: "KeyC", main: "C", top: "ㅊ", type: "letter", w: 1 },
    { c: "KeyV", main: "V", top: "ㅍ", type: "letter", w: 1 },
    { c: "KeyB", main: "B", top: "ㅠ", type: "letter", w: 1 },
    { c: "KeyN", main: "N", top: "ㅜ", type: "letter", w: 1 },
    { c: "KeyM", main: "M", top: "ㅡ", type: "letter", w: 1 },
    { c: "Comma", main: ",", top: "<", type: "sym", w: 1 },
    { c: "Period", main: ".", top: ">", type: "sym", w: 1 },
    { c: "Slash", main: "/", top: "?", type: "sym", w: 1 },
    { c: "ShiftRight", main: "Shift", top: "", type: "mod", w: 3.75 },
  ],
  // row 4: 하단 모디파이어 + Space
  [
    { c: "ControlLeft", main: "Ctrl", top: "", type: "mod", w: 1.5 },
    { c: "AltLeft", main: "Alt", top: "", type: "mod", w: 1.5 },
    { c: "Space", main: "", top: "", type: "space", w: 8 },
    { c: "AltRight", main: "Alt", top: "", type: "mod", w: 1.5 },
    { c: "ControlRight", main: "Ctrl", top: "", type: "mod", w: 1.5 },
    { c: "__pad", main: "", top: "", type: "pad", w: 2 },
  ],
];
