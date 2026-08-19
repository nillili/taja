// danmunSteps.js — 단문연습 데이터.
// 원본은 D1 sentences(kind='danmun') 테이블이고, 여기 것은 API 실패·오프라인 대비 fallback이다.
//
// 낱말(wordSteps.js)은 setWordSource()로 모듈 전역을 갈아끼우지만,
// 단문은 levels를 App의 상태로 소유하고 prop으로 내린다 — 그래야 관리자가 문장을 바꿨을 때
// 이미 열려 있는 연습 화면이 모른 채 지나가지 않는다. genDanmun도 levels를 인자로 받는다.

import { shuffle } from "../kit/shuffle.js";

// db/seed_sentences.sql의 단문 18개 (난이도별 6개)
export const DANMUN_LEVELS = {
  "1": [
    "하늘이 맑다.",
    "오늘도 좋은 날이다.",
    "나비가 꽃밭을 날아다닌다.",
    "동생이 나를 보고 웃었다.",
    "바람이 시원하게 불어온다.",
    "우리 반은 노래를 잘한다.",
  ],
  "2": [
    "학교 가는 길에 노란 은행잎이 소복하게 쌓였다.",
    "점심시간에 친구들과 운동장에서 공을 차며 놀았다.",
    "선생님께서 내일 준비물을 꼭 챙겨 오라고 말씀하셨다.",
    "창밖으로 보이는 산이 붉은색으로 물들기 시작했다.",
    "도서관에서 빌린 책을 밤늦도록 읽다가 잠이 들었다.",
    "비가 그치자 하늘에 커다란 무지개가 걸렸다.",
  ],
  "3": [
    "아침 일찍 일어나 창문을 열었더니 밤새 내린 눈이 온 마을을 하얗게 덮고 있었다.",
    "운동회 날 우리 반은 마지막 이어달리기에서 힘을 모아 끝내 일 등을 차지했다.",
    "할머니께서 들려주시는 옛날이야기를 듣고 있으면 시간이 어떻게 가는지 모를 정도였다.",
    "방학 동안 매일 조금씩 일기를 썼더니 어느새 공책 한 권이 가득 채워져 있었다.",
    "처음에는 어려워 보이던 문제도 차근차근 풀어 보니 생각보다 쉽게 답을 찾을 수 있었다.",
    "친구와 다투고 나서 먼저 미안하다고 말하는 일이 얼마나 용기가 필요한지 알게 되었다.",
  ],
};

export const DANMUN_STEPS = [
  { id: 1, name: "1단계", sub: "짧은 문장" },
  { id: 2, name: "2단계", sub: "조금 긴 문장" },
  { id: 3, name: "3단계", sub: "길고 복잡한 문장" },
];

export const LINES_PER_ROUND = 5;   // 한 판에 치는 문장 수
const MAX_LEN = 150;                // sentences.text CHECK와 같은 값

/**
 * 서버 응답을 믿지 않고 정규화한다.
 * - null / 비객체 / 유효 단계 0개  → null (호출부가 fallback 전체를 쓴다)
 * - 유효한 단계만 남긴다: 키 "1"|"2"|"3", 값은 문자열 배열, 각 항목 1~150자
 * - 서버가 어떤 단계를 비워 보냈다면 그 단계는 빈 배열로 유지한다 (관리자 의도 보존)
 */
export function normalizeDanmunLevels(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const out = {};
  let dropped = 0;
  let kept = 0;
  for (const k of ["1", "2", "3"]) {
    if (!(k in raw)) continue;               // 아예 안 온 단계는 만들지 않는다
    const list = Array.isArray(raw[k]) ? raw[k] : null;
    if (!list) { dropped++; out[k] = []; continue; }
    out[k] = list
      .filter((s) => {
        const ok = typeof s === "string" && s.trim().length > 0 && s.trim().length <= MAX_LEN;
        if (!ok) dropped++;
        return ok;
      })
      .map((s) => s.trim());
    kept += out[k].length;
  }
  if (Object.keys(out).length === 0) return null;
  if (dropped && typeof console !== "undefined" && import.meta.env && import.meta.env.DEV) {
    console.warn(`[danmun] 형식이 맞지 않아 제외한 문장 ${dropped}개 (사용 ${kept}개)`);
  }
  return out;
}

/**
 * 단계별 무작위 출제.
 * - 매 판 Fisher-Yates로 섞어 LINES_PER_ROUND개를 뽑는다 → 같은 단계를 다시 해도 매번 다르다
 * - exclude(직전 판 문장)는 되도록 피한다. 남는 문장이 모자라면 제외 규칙을 푼다
 *   (문장이 6개뿐인 단계에서 5개를 빼면 뽑을 게 없으므로)
 * - 등록된 문장이 없으면 빈 배열 → 화면이 "문장 없음" 안내를 띄운다
 */
export function genDanmun(levels, level, exclude = []) {
  const all = (levels && levels[String(level)]) || [];
  if (all.length === 0) return [];
  const ex = new Set(exclude);
  let pool = all.filter((s) => !ex.has(s));
  if (pool.length < Math.min(LINES_PER_ROUND, all.length)) pool = all;
  return shuffle(pool).slice(0, LINES_PER_ROUND);
}
