// progress.js — 90% 통과 판정 후 다음 연습 연결 규칙.
// 화면 내부에 흩뿌리지 않고 여기서 중앙 관리.

import { isPassed } from "../kit/stats.js";

// result: { screen, step, mode, correct, wrong }
// 반환: { screen, step, mode, label } 또는 null(다음 없음)
export function getNextPractice(result) {
  if (!isPassed(result.correct, result.wrong)) return null;

  if (result.screen === "jari") {
    return {
      screen: "natmal",
      step: result.step,
      mode: "basic",
      label: `${result.step}단계 낱말연습으로 넘어갈까요?`,
    };
  }

  if (result.screen === "natmal" && result.mode === "basic") {
    return {
      screen: "natmal",
      step: result.step,
      mode: "adv",
      label: "심화로 넘어갈까요?",
    };
  }

  // natmal adv 완료 → 다음 없음
  return null;
}
