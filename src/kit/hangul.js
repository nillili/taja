// hangul.js — 두벌식 한글 분해. 단어/글자 → 키 입력 순서.
// 순수 함수만. UI/통계와 분리해 단위 테스트가 쉽게.

// 두벌식 키 매핑 (KeyCode → 자모)
export const DUBEOL = {
  KeyQ: "ㅂ", KeyW: "ㅈ", KeyE: "ㄷ", KeyR: "ㄱ", KeyT: "ㅅ",
  KeyY: "ㅛ", KeyU: "ㅕ", KeyI: "ㅑ", KeyO: "ㅐ", KeyP: "ㅔ",
  KeyA: "ㅁ", KeyS: "ㄴ", KeyD: "ㅇ", KeyF: "ㄹ", KeyG: "ㅎ",
  KeyH: "ㅗ", KeyJ: "ㅓ", KeyK: "ㅏ", KeyL: "ㅣ",
  KeyZ: "ㅋ", KeyX: "ㅌ", KeyC: "ㅊ", KeyV: "ㅍ",
  KeyB: "ㅠ", KeyN: "ㅜ", KeyM: "ㅡ",
};
// 자모 → KeyCode
export const JAMO_CODE = Object.fromEntries(
  Object.entries(DUBEOL).map(([k, v]) => [v, k])
);

const CHO = ["ㄱ","ㄲ","ㄴ","ㄷ","ㄸ","ㄹ","ㅁ","ㅂ","ㅃ","ㅅ","ㅆ","ㅇ","ㅈ","ㅉ","ㅊ","ㅋ","ㅌ","ㅍ","ㅎ"];
const JUNG = ["ㅏ","ㅐ","ㅑ","ㅒ","ㅓ","ㅔ","ㅕ","ㅖ","ㅗ","ㅘ","ㅙ","ㅚ","ㅛ","ㅜ","ㅝ","ㅞ","ㅟ","ㅠ","ㅡ","ㅢ","ㅣ"];
const JONG = ["","ㄱ","ㄲ","ㄳ","ㄴ","ㄵ","ㄶ","ㄷ","ㄹ","ㄺ","ㄻ","ㄼ","ㄽ","ㄾ","ㄿ","ㅀ","ㅁ","ㅂ","ㅄ","ㅅ","ㅆ","ㅇ","ㅈ","ㅊ","ㅋ","ㅌ","ㅍ","ㅎ"];

// 겹자모 → Shift 한 키 / 분해 키 시퀀스
const SHIFT_JAMO = { "ㄲ":"ㄱ", "ㄸ":"ㄷ", "ㅃ":"ㅂ", "ㅆ":"ㅅ", "ㅉ":"ㅈ", "ㅒ":"ㅐ", "ㅖ":"ㅔ" };
const SPLIT_JAMO = {
  "ㅘ":["ㅗ","ㅏ"], "ㅙ":["ㅗ","ㅐ"], "ㅚ":["ㅗ","ㅣ"],
  "ㅝ":["ㅜ","ㅓ"], "ㅞ":["ㅜ","ㅔ"], "ㅟ":["ㅜ","ㅣ"], "ㅢ":["ㅡ","ㅣ"],
  "ㄳ":["ㄱ","ㅅ"], "ㄵ":["ㄴ","ㅈ"], "ㄶ":["ㄴ","ㅎ"],
  "ㄺ":["ㄹ","ㄱ"], "ㄻ":["ㄹ","ㅁ"], "ㄼ":["ㄹ","ㅂ"], "ㄽ":["ㄹ","ㅅ"],
  "ㄾ":["ㄹ","ㅌ"], "ㄿ":["ㄹ","ㅍ"], "ㅀ":["ㄹ","ㅎ"], "ㅄ":["ㅂ","ㅅ"],
};

// 문장부호 → 키. 단문·장문에 마침표/쉼표가 들어오므로 타수와 키보드 강조가 맞아야 한다.
// (자판 레이아웃 keyboard.js에 Period·Comma·Slash·Quote·Minus·Digit1이 모두 있다)
const PUNCT = {
  ".": { code: "Period", shift: false },
  ",": { code: "Comma",  shift: false },
  "?": { code: "Slash",  shift: true  },
  "!": { code: "Digit1", shift: true  },
  "'": { code: "Quote",  shift: false },
  '"': { code: "Quote",  shift: true  },
  "-": { code: "Minus",  shift: false },
};

// 자모 하나 → keystroke 배열 [{ code, jamo, shift }]
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

// 글자(음절/낱자/공백) → keystroke 배열
export function charToKeys(ch) {
  const cp = ch.codePointAt(0);
  // 완성형 음절
  if (cp >= 0xac00 && cp <= 0xd7a3) {
    const s = cp - 0xac00;
    const cho = CHO[Math.floor(s / 588)];
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
  // 공백
  if (ch === " ") return [{ code: "Space", jamo: " ", shift: false }];
  // 문장부호
  if (PUNCT[ch]) return [{ ...PUNCT[ch], jamo: ch }];
  return [];
}

// 단어 → { chars:[{ch, keys:[...]}], flat:[keystroke + charIndex/keyInChar] }
export function decomposeWord(word) {
  const chars = [...word].map((ch) => ({ ch, keys: charToKeys(ch) }));
  const flat = [];
  chars.forEach((c, ci) =>
    c.keys.forEach((k, ki) => flat.push({ ...k, charIndex: ci, keyInChar: ki }))
  );
  return { chars, flat };
}
