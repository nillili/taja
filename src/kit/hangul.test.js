import { describe, it, expect } from "vitest";
import { charToKeys, decomposeWord } from "./hangul.js";

const jamos = (ch) => charToKeys(ch).map((k) => k.jamo);
const codes = (ch) => charToKeys(ch).map((k) => k.code);

describe("charToKeys — 받침/겹받침/복합모음", () => {
  it("넓: ㄴ ㅓ + 겹받침 ㄼ(ㄹ,ㅂ)", () => {
    expect(jamos("넓")).toEqual(["ㄴ", "ㅓ", "ㄹ", "ㅂ"]);
  });
  it("외: ㅇ + 복합모음 ㅚ(ㅗ,ㅣ)", () => {
    expect(jamos("외")).toEqual(["ㅇ", "ㅗ", "ㅣ"]);
  });
  it("갓: ㄱ ㅏ ㅅ", () => {
    expect(jamos("갓")).toEqual(["ㄱ", "ㅏ", "ㅅ"]);
  });
  it("괜: ㄱ + ㅙ(ㅗ,ㅐ) + ㄴ", () => {
    expect(jamos("괜")).toEqual(["ㄱ", "ㅗ", "ㅐ", "ㄴ"]);
  });
  it("찮: ㅊ ㅏ + 겹받침 ㄶ(ㄴ,ㅎ)", () => {
    expect(jamos("찮")).toEqual(["ㅊ", "ㅏ", "ㄴ", "ㅎ"]);
  });
});

describe("charToKeys — 쌍자음(Shift)", () => {
  it("까: ㄲ는 ㄱ(KeyR)을 Shift로", () => {
    const ks = charToKeys("까");
    expect(ks[0]).toMatchObject({ code: "KeyR", jamo: "ㄲ", shift: true });
    expect(ks[1]).toMatchObject({ jamo: "ㅏ", shift: false });
  });
  it("뚜/찌/쌍 첫 자음은 Shift", () => {
    expect(charToKeys("뚜")[0]).toMatchObject({ jamo: "ㄸ", shift: true });
    expect(charToKeys("찌")[0]).toMatchObject({ jamo: "ㅉ", shift: true });
    expect(charToKeys("쌍")[0]).toMatchObject({ jamo: "ㅆ", shift: true });
  });
});

describe("decomposeWord", () => {
  it("넓적다리 — charIndex가 글자별로 매겨진다", () => {
    const { chars, flat } = decomposeWord("넓적다리");
    expect(chars.map((c) => c.ch)).toEqual(["넓", "적", "다", "리"]);
    expect(flat[0]).toMatchObject({ charIndex: 0 });
    expect(flat.at(-1)).toMatchObject({ charIndex: 3 });
    // 넓(4) + 적(3) + 다(2) + 리(2) = 11 keystrokes
    expect(flat.length).toBe(11);
  });
  it("공백은 Space 키", () => {
    expect(codes(" ")).toEqual(["Space"]);
  });
});
