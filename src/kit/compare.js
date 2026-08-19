// compare.js — 단문/장문의 "본보기 vs 내가 쓴 글" 비교와 채점. 순수 함수만.
// 화면(DanmunScreen)에서 분리해 두어야 단위 테스트가 쉽다 — hangul.js·stats.js와 같은 방침.

import { charToKeys } from "./hangul.js";

// 글자 하나의 타수. 문장부호·매핑에 없는 글자도 최소 1타로 센다.
export const countKeys = (ch) => Math.max(1, charToKeys(ch || "").length);

// 문장 전체 타수
export const countLineKeys = (text) =>
  [...(text || "")].reduce((n, ch) => n + countKeys(ch), 0);

/**
 * 본보기(target)와 입력(typed)을 앞에서부터 같은 자리끼리 비교한다.
 * 정렬 보정(LCS)은 하지 않는다 — 글자를 빠뜨리면 뒤가 모두 어긋나 보이지만,
 * 초등 학습자에게는 "지우고 다시"가 오히려 명확하다.
 * composing=true면 입력의 마지막 글자는 아직 조합 중이라 판정을 미룬다.
 *
 * 반환: [{ want, got, ch, state }]
 *   want  이 자리의 정답 글자 (초과 입력이면 undefined) ← 채점은 언제나 want 기준
 *   got   이 자리에 실제로 친 글자 (안 쳤으면 undefined)
 *   ch    화면에 그릴 글자 (got ?? want)
 *   state pending | correct | wrong | extra | composing
 */
export function compareLine(target, typed, composing = false) {
  const t = [...(target || "")];
  const u = [...(typed || "")];
  const cells = [];
  for (let i = 0; i < Math.max(t.length, u.length); i++) {
    const want = t[i];
    const got = u[i];
    let state;
    if (got === undefined) state = "pending";
    else if (want === undefined) state = "extra";
    else if (composing && i === u.length - 1) state = "composing";
    else state = got === want ? "correct" : "wrong";
    cells.push({ want, got, ch: got ?? want, state });
  }
  return cells;
}

/**
 * 문장 확정(Enter) 시의 채점. 자모(타) 단위 — 자리·낱말연습과 같은 단위라
 * calcCpm()/displayAccuracy()를 그대로 쓸 수 있다.
 *
 * 정답 자리(correct/wrong/pending)는 **정답 글자(want)의 타수**로 센다.
 * 그래야 "값"을 "가"로 틀리든 "뷁"으로 틀리든 그 자리의 무게가 같다.
 * (오타 글자로 세면 쉬운 글자로 틀릴수록 정확도가 부풀려진다)
 * 초과 입력(extra)만 실제로 더 친 글자(got)의 타수를 더한다.
 * 안 친 자리(pending)도 틀린 것으로 센다 — 덜 치고 넘어가면 그만큼 감점.
 */
export function scoreLine(target, typed) {
  let correct = 0;
  let wrong = 0;
  for (const c of compareLine(target, typed, false)) {
    if (c.state === "extra") { wrong += countKeys(c.got); continue; }
    const n = countKeys(c.want);
    if (c.state === "correct") correct += n;
    else wrong += n;
  }
  return { correct, wrong };
}
