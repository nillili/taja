import { shuffle } from "../kit/shuffle.js";

// 자리연습 단계 — 자모 묶음. (기본 자리 → 윗줄 → 아랫줄 → 전체 섞기)
export const JARI_STEPS = [
  { id: 1, name: "1단계", sub: "기본 자리",
    jamo: ["ㅁ", "ㄴ", "ㅇ", "ㄹ", "ㅎ", "ㅗ", "ㅓ", "ㅏ", "ㅣ"] },
  { id: 2, name: "2단계", sub: "윗 줄",
    jamo: ["ㅂ", "ㅈ", "ㄷ", "ㄱ", "ㅅ", "ㅛ", "ㅕ", "ㅑ", "ㅐ", "ㅔ"] },
  { id: 3, name: "3단계", sub: "아랫 줄",
    jamo: ["ㅋ", "ㅌ", "ㅊ", "ㅍ", "ㅠ", "ㅜ", "ㅡ"] },
  { id: 4, name: "4단계", sub: "전체 + 쌍자음",
    jamo: ["ㅂ", "ㅈ", "ㄷ", "ㄱ", "ㅅ", "ㅛ", "ㅕ", "ㅑ", "ㅐ", "ㅔ",
           "ㅁ", "ㄴ", "ㅇ", "ㄹ", "ㅎ", "ㅗ", "ㅓ", "ㅏ", "ㅣ",
           "ㅋ", "ㅌ", "ㅊ", "ㅍ", "ㅠ", "ㅜ", "ㅡ",
           // Shift가 필요한 자모 — 낱말 4단계에 자주 나와서 미리 익혀둔다
           "ㄲ", "ㄸ", "ㅃ", "ㅆ", "ㅉ", "ㅒ", "ㅖ"] },
];

// 한 단계 시퀀스: 두 바퀴 모두 무작위 순서(각 자모를 두 번씩, 순서는 랜덤).
export function genJariSeq(stepId) {
  const step = JARI_STEPS.find((s) => s.id === stepId) || JARI_STEPS[0];
  return [...shuffle(step.jamo), ...shuffle(step.jamo)];
}
