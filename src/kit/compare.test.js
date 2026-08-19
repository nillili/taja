import { describe, it, expect } from "vitest";
import { compareLine, scoreLine, countKeys, countLineKeys } from "./compare.js";
import { isPassed } from "./stats.js";

const states = (target, typed, composing = false) =>
  compareLine(target, typed, composing).map((c) => c.state);

describe("countKeys / countLineKeys", () => {
  it("한글 음절은 자모 수만큼", () => {
    expect(countKeys("가")).toBe(2);   // ㄱ ㅏ
    expect(countKeys("값")).toBe(4);   // ㄱ ㅏ ㅂ ㅅ
  });
  it("공백·문장부호도 1타로 센다", () => {
    expect(countKeys(" ")).toBe(1);
    expect(countKeys(".")).toBe(1);
    expect(countKeys(",")).toBe(1);
  });
  it("매핑에 없는 글자도 최소 1타", () => {
    expect(countKeys("(")).toBe(1);
  });
  it("문장 전체 타수", () => {
    expect(countLineKeys("가 나.")).toBe(2 + 1 + 2 + 1);
  });
});

describe("compareLine", () => {
  it("완전히 같으면 전부 correct", () => {
    expect(states("하늘이 맑다.", "하늘이 맑다.")).toEqual(
      new Array(7).fill("correct")
    );
  });
  it("한 글자를 틀리면 그 자리만 wrong", () => {
    expect(states("좋다", "조다")).toEqual(["wrong", "correct"]);
  });
  it("띄어쓰기를 빠뜨리면 그 자리부터 어긋난다", () => {
    // "가 나" vs "가나" → 2번째 자리(공백↔나)가 wrong
    const s = states("가 나", "가나");
    expect(s[0]).toBe("correct");
    expect(s[1]).toBe("wrong");
    expect(s[2]).toBe("pending");
  });
  it("띄어쓰기를 더 넣으면 공백 자리가 wrong으로 보인다", () => {
    const cells = compareLine("가나", "가 나");
    expect(cells[1]).toMatchObject({ want: "나", got: " ", state: "wrong" });
    expect(cells[2]).toMatchObject({ got: "나", state: "extra" });
  });
  it("덜 치면 나머지는 pending이고 본보기 글자를 보여준다", () => {
    const cells = compareLine("하늘", "하");
    expect(cells[1]).toMatchObject({ state: "pending", ch: "늘", got: undefined });
  });
  it("더 치면 넘친 부분이 extra", () => {
    expect(states("하", "하늘")).toEqual(["correct", "extra"]);
  });
  it("조합 중이면 마지막 글자는 판정을 미룬다", () => {
    // "좋다"를 치는 중 "조"까지 나온 상태
    expect(states("좋다", "조", true)).toEqual(["composing", "pending"]);
    // 조합이 끝나면 그때 판정
    expect(states("좋다", "조", false)).toEqual(["wrong", "pending"]);
  });
});

describe("scoreLine", () => {
  it("정답이면 wrong이 0이고 correct는 문장 전체 타수", () => {
    const line = "하늘이 맑다.";
    expect(scoreLine(line, line)).toEqual({ correct: countLineKeys(line), wrong: 0 });
  });

  it("오타의 종류와 무관하게 그 자리의 감점은 정답 글자 타수로 같다", () => {
    // "값"(4타) 자리를 서로 다른 글자로 틀려도 wrong은 언제나 4
    const a = scoreLine("값", "가");   // 2타짜리 오타
    const b = scoreLine("값", "뷁");   // 더 복잡한 오타
    const c = scoreLine("값", ".");    // 1타짜리 오타
    expect(a).toEqual({ correct: 0, wrong: 4 });
    expect(b).toEqual({ correct: 0, wrong: 4 });
    expect(c).toEqual({ correct: 0, wrong: 4 });
  });

  it("안 친 자리도 정답 타수만큼 감점된다", () => {
    expect(scoreLine("가나", "가")).toEqual({ correct: 2, wrong: 2 });
  });

  it("초과 입력만 실제로 더 친 글자의 타수를 더한다", () => {
    expect(scoreLine("가", "가값")).toEqual({ correct: 2, wrong: 4 });
  });

  it("빈 입력은 문장 전체가 감점", () => {
    const line = "가 나.";
    expect(scoreLine(line, "")).toEqual({ correct: 0, wrong: countLineKeys(line) });
  });

  it("정확도 90% 경계가 원시값으로 판정된다", () => {
    // correct 90 / wrong 10 → 정확히 90.0% 통과
    expect(isPassed(90, 10)).toBe(true);
    // correct 899 / wrong 101 → 89.9% 실패
    expect(isPassed(899, 101)).toBe(false);
  });
});
