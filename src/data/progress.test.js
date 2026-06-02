import { describe, it, expect } from "vitest";
import { getNextPractice } from "./progress.js";

const r = (screen, step, mode, correct, wrong) =>
  ({ screen, step, mode, correct, wrong });

describe("getNextPractice", () => {
  it("자리 2단계 90% 통과 → 낱말 2단계 기본", () => {
    const next = getNextPractice(r("jari", 2, null, 9, 1));
    expect(next).toMatchObject({ screen: "natmal", step: 2, mode: "basic" });
    expect(next.label).toMatch("낱말연습");
  });

  it("자리 89.9% 미달 → null", () => {
    expect(getNextPractice(r("jari", 1, null, 899, 101))).toBeNull();
  });

  it("낱말 기본 90% 통과 → 심화", () => {
    const next = getNextPractice(r("natmal", 3, "basic", 9, 1));
    expect(next).toMatchObject({ screen: "natmal", step: 3, mode: "adv" });
    expect(next.label).toMatch("심화");
  });

  it("낱말 기본 89.9% 미달 → null", () => {
    expect(getNextPractice(r("natmal", 1, "basic", 899, 101))).toBeNull();
  });

  it("낱말 심화 완료 → null(다음 없음)", () => {
    expect(getNextPractice(r("natmal", 4, "adv", 10, 0))).toBeNull();
  });
});
