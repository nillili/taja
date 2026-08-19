import { describe, it, expect } from "vitest";
import {
  DANMUN_LEVELS, LINES_PER_ROUND, normalizeDanmunLevels, genDanmun,
} from "./danmunSteps.js";

describe("normalizeDanmunLevels", () => {
  it.each([
    ["null", null],
    ["undefined", undefined],
    ["배열", ["가"]],
    ["빈 객체", {}],
    ["모르는 키만", { "9": ["가"] }],
  ])("%s 이면 null (호출부가 fallback 전체를 쓴다)", (_, input) => {
    expect(normalizeDanmunLevels(input)).toBeNull();
  });

  it("정상 응답은 그대로 통과한다", () => {
    const input = { "1": ["하늘이 맑다."], "2": ["비가 온다."], "3": ["눈이 내린다."] };
    expect(normalizeDanmunLevels(input)).toEqual(input);
  });

  it("배열이 아닌 값이 오면 그 단계는 빈 배열로 만든다", () => {
    expect(normalizeDanmunLevels({ "1": "문자열" })).toEqual({ "1": [] });
  });

  it("빈 문자열·공백·150자 초과는 걸러낸다", () => {
    const long = "가".repeat(151);
    const ok = "가".repeat(150);
    const out = normalizeDanmunLevels({ "1": ["정상", "", "   ", long, ok, 42, null] });
    expect(out["1"]).toEqual(["정상", ok]);
  });

  it("앞뒤 공백은 다듬는다", () => {
    expect(normalizeDanmunLevels({ "1": ["  하늘이 맑다.  "] })).toEqual({
      "1": ["하늘이 맑다."],
    });
  });

  it("일부 단계만 오면 그 단계만 남기고, 빈 단계는 빈 채로 유지한다", () => {
    const out = normalizeDanmunLevels({ "1": ["가나다"], "2": [] });
    expect(out).toEqual({ "1": ["가나다"], "2": [] });
    expect("3" in out).toBe(false);
  });
});

describe("genDanmun (단계별 무작위 출제)", () => {
  it("해당 단계 문장 중에서만, 중복 없이, 정해진 개수만큼 뽑는다", () => {
    const out = genDanmun(DANMUN_LEVELS, 2);
    expect(out).toHaveLength(LINES_PER_ROUND);
    expect(new Set(out).size).toBe(out.length);
    for (const s of out) expect(DANMUN_LEVELS["2"]).toContain(s);
  });

  it("문장이 모자라면 있는 만큼만 뽑는다", () => {
    const levels = { "1": ["가", "나", "다"] };
    expect(genDanmun(levels, 1)).toHaveLength(3);
  });

  it("등록된 문장이 없으면 빈 배열", () => {
    expect(genDanmun({ "1": [] }, 1)).toEqual([]);
    expect(genDanmun(null, 1)).toEqual([]);
    expect(genDanmun(DANMUN_LEVELS, 9)).toEqual([]);
  });

  it("직전 판 문장을 피한다 (후보가 넉넉할 때)", () => {
    const levels = { "1": ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"] };
    const prev = genDanmun(levels, 1);
    const next = genDanmun(levels, 1, prev);
    expect(next).toHaveLength(LINES_PER_ROUND);
    for (const s of next) expect(prev).not.toContain(s);
  });

  it("후보가 모자라면 제외 규칙을 풀고도 개수를 채운다", () => {
    const levels = { "1": ["a", "b", "c", "d", "e", "f"] };
    const prev = genDanmun(levels, 1);              // 6개 중 5개
    const next = genDanmun(levels, 1, prev);        // 남은 후보 1개뿐 → 규칙을 푼다
    expect(next).toHaveLength(LINES_PER_ROUND);
    expect(new Set(next).size).toBe(LINES_PER_ROUND);
  });

  it("여러 번 뽑으면 순서·조합이 달라진다 (무작위)", () => {
    const runs = new Set();
    for (let i = 0; i < 30; i++) runs.add(genDanmun(DANMUN_LEVELS, 3).join("|"));
    expect(runs.size).toBeGreaterThan(1);
  });
});
