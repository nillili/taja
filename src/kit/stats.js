// stats.js — 타수/정확도/통과 판정. 표시는 반올림, 판정은 원시값.

// 분당 타수(CPM). elapsed(초). 1초 이하 구간은 0으로(초기 튐 방지).
export function calcCpm(correct, elapsedSec) {
  return elapsedSec > 1 ? Math.round((correct / elapsedSec) * 60) : 0;
}

// 정확도 원시값(0~100, 소수 유지). 입력이 없으면 100.
export function calcAccuracyRaw(correct, wrong) {
  const total = correct + wrong;
  return total > 0 ? (correct / total) * 100 : 100;
}

// 화면 표시용(정수 %).
export function displayAccuracy(correct, wrong) {
  return Math.round(calcAccuracyRaw(correct, wrong));
}

// 통과 판정: 원시 정확도 기준(89.9 실패 / 90.0 통과).
export const PASS_THRESHOLD = 90;
export function isPassed(correct, wrong, threshold = PASS_THRESHOLD) {
  return calcAccuracyRaw(correct, wrong) >= threshold;
}
