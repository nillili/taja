import { describe, it, expect } from "vitest";
import { calcCpm, calcAccuracyRaw, displayAccuracy, isPassed } from "./stats.js";

describe("정확도", () => {
  it("입력 없으면 100", () => {
    expect(calcAccuracyRaw(0, 0)).toBe(100);
  });
  it("원시값은 소수 유지", () => {
    expect(calcAccuracyRaw(899, 101)).toBeCloseTo(89.9, 5);
  });
  it("표시값은 반올림", () => {
    expect(displayAccuracy(2, 1)).toBe(67);
  });
});

describe("isPassed — 90% 경계(원시값 기준)", () => {
  it("89.9는 실패", () => {
    expect(isPassed(899, 101)).toBe(false);
  });
  it("90.0은 통과", () => {
    expect(isPassed(9, 1)).toBe(true);
  });
  it("표시상 90이어도 원시 89.x면 실패", () => {
    // 89.6% → 표시 90, 판정은 실패여야 한다
    expect(displayAccuracy(897, 103)).toBe(90);
    expect(isPassed(897, 103)).toBe(false);
  });
});

describe("calcCpm", () => {
  it("1초 이하면 0", () => {
    expect(calcCpm(5, 0.5)).toBe(0);
  });
  it("분당 타수 계산", () => {
    expect(calcCpm(60, 60)).toBe(60);
    expect(calcCpm(30, 60)).toBe(30);
  });
});
