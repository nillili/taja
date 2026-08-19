// gen-danmun-sheet.mjs — 단문 난이도를 한 단계씩 낮춘 업로드용 엑셀을 만든다.
// 실행: node scripts/gen-danmun-sheet.mjs   (프로젝트 루트에서)
//
//   새 1단계 = 여기 적은 "주어 + 동사" 100문장 (아래 LEVEL1)
//   새 2단계 = 지금 등록된 1단계 100문장 그대로
//   새 3단계 = 지금 등록된 2단계 100문장 그대로
//   (지금 3단계 100문장은 이번 판에서 빠진다 — 가장 어려운 묶음이라 한 칸씩 내리면 자리가 없다)
//
// 1단계 원칙: 두 어절짜리 "무엇이 + 어찌한다". 초등 저학년이 아는 낱말만.
//   Shift를 함께 눌러야 하는 글자(ㄲ ㄸ ㅃ ㅆ ㅉ ㅒ ㅖ)는 되도록 피하고 몇 개만 남긴다 —
//   아예 없으면 나중에 처음 만났을 때 당황하므로 가끔 보이게 둔다.

import { readFileSync, writeFileSync } from "node:fs";
import * as XLSX from "xlsx";
import { charToKeys } from "../src/kit/hangul.js";

const SRC = "docs/단문_샘플_100.xlsx";   // 지금 등록돼 있는 내용
const OUT = "docs/단문_100제_v2.xlsx";   // 관리 화면에 올릴 파일

const LEVEL1 = [
  // ── 자연 ──
  "새가 난다.",
  "비가 온다.",
  "눈이 내린다.",
  "달이 밝다.",
  "별이 빛난다.",
  "바람이 분다.",
  "구름이 흐른다.",
  "나무가 자란다.",
  "잎이 흔들린다.",
  "물이 맑다.",
  "파도가 친다.",
  "산이 높다.",
  "바다가 넓다.",
  "들판이 푸르다.",
  "안개가 걷힌다.",
  "해가 저문다.",
  "하늘이 파랗다.",
  "노을이 진다.",
  "이슬이 맺힌다.",
  "햇살이 눈부시다.",
  // ── 동물 ──
  "개가 짖는다.",
  "고양이가 운다.",
  "소가 걷는다.",
  "말이 달린다.",
  "꽃이 핀다.",              // Shift 맛보기
  "오리가 헤엄친다.",
  "물고기가 모인다.",
  "나비가 앉는다.",
  "벌이 날아간다.",
  "개미가 기어간다.",
  "다람쥐가 오른다.",
  "사슴이 달아난다.",
  "여우가 숨는다.",
  "곰이 잔다.",
  "원숭이가 논다.",
  "기린이 먹는다.",
  "병아리가 걸어간다.",
  "참새가 모여든다.",
  "비둘기가 날아든다.",
  "매미가 매달린다.",
  "거북이 느리다.",
  "돼지가 뒹군다.",
  "양이 순하다.",
  "토끼가 뛴다.",            // Shift 맛보기
  "강아지가 반긴다.",
  // ── 사람 ──
  "아이가 웃는다.",
  "동생이 부른다.",
  "형이 도와준다.",
  "누나가 노래한다.",
  "언니가 그린다.",
  "오빠가 읽는다.",
  "엄마가 안아준다.",
  "아빠가 요리한다.",
  "친구가 기다린다.",
  "선생님이 가르친다.",
  "할머니가 웃으신다.",
  "할아버지가 앉으신다.",
  "우리가 인사한다.",
  "나는 공부한다.",
  "너는 잘한다.",
  "아기가 예쁘다.",          // Shift 맛보기
  "학생이 대답한다.",
  "해가 뜬다.",              // Shift 맛보기
  "어머니가 부르신다.",
  "아버지가 오신다.",
  // ── 사물 ──
  "시계가 간다.",
  "종이 울린다.",
  "문이 열린다.",
  "창문이 닫힌다.",
  "전등이 켜진다.",
  "그림자가 길어진다.",
  "연필이 부러진다.",
  "공이 구른다.",
  "자동차가 지나간다.",
  "버스가 도착한다.",
  "기차가 멈춘다.",
  "배가 나아간다.",
  "비행기가 날아오른다.",
  "풍선이 터진다.",
  "그네가 움직인다.",
  "우산이 젖는다.",
  "신발이 마른다.",
  "밥이 익는다.",
  "국이 식는다.",
  "얼음이 녹는다.",
  // ── 학교·하루 ──
  "수업이 시작된다.",
  "교실이 조용하다.",
  "칠판이 하얗다.",
  "책이 무겁다.",
  "가방이 가볍다.",
  "운동장이 붐빈다.",
  "친구들이 달려온다.",
  "눈이 쌓인다.",            // Shift 맛보기
  "급식이 나온다.",
  "우리는 배운다.",
  "아이들이 줄을 선다.",
  "우리가 청소한다.",
  "내가 숙제한다.",
  "형이 밥을 먹는다.",
  "누나가 노래를 부른다.",
];

/* ── 지금 등록된 내용 읽기 ─────────────────────────────────────── */
const wb = XLSX.read(readFileSync(SRC), { type: "buffer" });
const aoa = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, blankrows: false });
const oldCols = [[], [], []];
for (let r = 1; r < aoa.length; r++) {
  for (let c = 0; c < 3; c++) {
    const t = String((aoa[r] || [])[c] ?? "").trim();
    if (t) oldCols[c].push(t);
  }
}

const cols = [LEVEL1, oldCols[0], oldCols[1]];   // 1단계는 새로, 2·3단계는 한 칸씩 내려서

/* ── 검증 ──────────────────────────────────────────────────────── */
const shiftKeys = (text) =>
  [...text].reduce((n, ch) => n + charToKeys(ch).filter((k) => k.shift).length, 0);

let bad = 0;
cols.forEach((list, i) => {
  const level = i + 1;
  const dup = list.filter((t, idx) => list.indexOf(t) !== idx);
  const tooLong = list.filter((t) => t.length > 150);
  const lens = list.map((t) => t.length);
  const withShift = list.filter((t) => shiftKeys(t) > 0);
  const avg = (lens.reduce((a, b) => a + b, 0) / list.length).toFixed(1);

  console.log(`\n${level}단계 — ${list.length}개 · 길이 ${Math.min(...lens)}~${Math.max(...lens)}자(평균 ${avg})`);
  console.log(`  Shift가 필요한 글자가 든 문장: ${withShift.length}개` +
    (level === 1 && withShift.length ? ` → ${withShift.join(", ")}` : ""));
  if (list.length !== 100) { console.log(`  ⚠ 100개가 아니다 (${list.length}개)`); bad++; }
  if (dup.length) { console.log(`  ⚠ 같은 단계 안에 중복: ${[...new Set(dup)].join(", ")}`); bad++; }
  if (tooLong.length) { console.log(`  ⚠ 150자 초과 ${tooLong.length}개`); bad++; }
});

// 단계가 올라갈수록 길어지는지 (난이도 흐름 확인)
const avgOf = (l) => l.reduce((a, t) => a + t.length, 0) / l.length;
if (!(avgOf(cols[0]) < avgOf(cols[1]) && avgOf(cols[1]) < avgOf(cols[2]))) {
  console.log("\n⚠ 단계가 올라가는데 평균 길이가 늘지 않는다");
  bad++;
}

/* ── 쓰기 ──────────────────────────────────────────────────────── */
const out = [["1단계", "2단계", "3단계"]];
const height = Math.max(...cols.map((c) => c.length));
for (let i = 0; i < height; i++) out.push(cols.map((c) => c[i] || ""));

const outWb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(outWb, XLSX.utils.aoa_to_sheet(out), "단문");
writeFileSync(OUT, XLSX.write(outWb, { type: "buffer", bookType: "xlsx" }));

console.log(`\n${bad ? "⚠ 확인할 점이 " + bad + "건 있다. " : "✓ 이상 없음. "}${OUT} 저장 (${height}행)`);
