// gen-word-seed.mjs — wordSteps.js(시트 원본을 구워넣은 fallback)에서 D1 시드 SQL 생성.
// 실행: node scripts/gen-word-seed.mjs   (프로젝트 루트에서)

import { writeFileSync } from "node:fs";
import { WORD_STEPS } from "../src/data/wordSteps.js";

const esc = (s) => String(s).replace(/'/g, "''");

let sql = "-- wordSteps.js에서 생성됨. 재생성: node scripts/gen-word-seed.mjs\n";
let total = 0;
for (const [step, modes] of Object.entries(WORD_STEPS)) {
  for (const [mode, list] of Object.entries(modes)) {
    for (const text of list) {
      sql += `INSERT OR IGNORE INTO words (step, mode, text) VALUES (${step}, '${mode}', '${esc(text)}');\n`;
      total++;
    }
    console.log(`  ${step}단계 ${mode}: ${list.length}개`);
  }
}

writeFileSync(new URL("../db/seed_words.sql", import.meta.url), sql);
console.log(`db/seed_words.sql 생성 완료 — 총 ${total}개`);
