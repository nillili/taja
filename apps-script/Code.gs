// =====================================================================
// 한글 타자연습 — Google Apps Script 웹앱
// 배포: 스크립트 편집기 → 배포 → 새 배포 → 웹앱
//       실행 계정: 나(소유자)   액세스 권한: 모든 사용자
// =====================================================================

var SS_ID = "1Z4KvYs0VSUDWGNaELbIN5aTgA2iXuslOSNsxAu7K7uA";

// ── CORS 응답 헬퍼 ─────────────────────────────────────────────────
function json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── GET 라우팅 ─────────────────────────────────────────────────────
function doGet(e) {
  var action = (e.parameter && e.parameter.action) || "";
  var board  = (e.parameter && e.parameter.board)  || "today";
  try {
    if (action === "words")   return json(getWords());
    if (action === "records") return json(getRecords(board));
    return json({ error: "unknown action: " + action });
  } catch (err) {
    return json({ error: err.message });
  }
}

// ── POST 라우팅 ────────────────────────────────────────────────────
function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    if (data.action === "saveRecord") return json(saveRecord(data));
    return json({ error: "unknown action: " + data.action });
  } catch (err) {
    return json({ error: err.message });
  }
}

// ── 낱말 데이터 읽기 ───────────────────────────────────────────────
// 낱말_1_기본 탭: 컬럼 0~7 = 1단계_기본 .. 4단계_심화
function getWords() {
  var sheet = SpreadsheetApp.openById(SS_ID).getSheetByName("낱말_1_기본");
  var values = sheet.getDataRange().getValues();
  // 첫 행은 헤더
  var cols = [[], [], [], [], [], [], [], []];
  var seen = [new Set(), new Set(), new Set(), new Set(), new Set(), new Set(), new Set(), new Set()];
  for (var r = 1; r < values.length; r++) {
    for (var c = 0; c < 8; c++) {
      var v = String(values[r][c] || "").trim();
      if (v && !seen[c].has(v)) { seen[c].add(v); cols[c].push(v); }
    }
  }
  var steps = {};
  for (var s = 1; s <= 4; s++) {
    steps[String(s)] = { basic: cols[(s-1)*2], adv: cols[(s-1)*2 + 1] };
  }
  return { steps: steps, updatedAt: new Date().toISOString() };
}

// ── 기록 읽기 ──────────────────────────────────────────────────────
// board="today" → 기록 탭 "오늘" 컬럼(A열)
// 각 셀: "학교,이름,최고타수,정확도"  →  파싱 후 wpm 내림차순 정렬
function getRecords(board) {
  var colMap = { today: 0, danmun: 1, jangmun: 2 };
  var colIdx = colMap[board] !== undefined ? colMap[board] : 0;
  var sheet = SpreadsheetApp.openById(SS_ID).getSheetByName("기록");
  var values = sheet.getDataRange().getValues();
  var records = [];
  // 첫 행은 헤더(오늘/장문/단문)
  for (var r = 1; r < values.length; r++) {
    var cell = String(values[r][colIdx] || "").trim();
    if (!cell) continue;
    var parts = cell.split(",");
    if (parts.length < 4) continue;
    records.push({
      school: parts[0].trim(),
      name:   parts[1].trim(),
      wpm:    parseInt(parts[2].trim(), 10) || 0,
      acc:    parseFloat(parts[3].trim()) || 0
    });
  }
  records.sort(function(a, b) { return b.wpm - a.wpm; });
  return records;
}

// ── 기록 저장 ──────────────────────────────────────────────────────
// data: { board, school, name, wpm, acc, screen, step, mode }
// 기록 탭 해당 컬럼에 새 행 append. 동일 학교+이름이 있으면 높은 타수만 유지.
function saveRecord(data) {
  var colMap = { today: 0, danmun: 1, jangmun: 2 };
  var colIdx = colMap[data.board] !== undefined ? colMap[data.board] : 0;
  var sheet = SpreadsheetApp.openById(SS_ID).getSheetByName("기록");
  var values = sheet.getDataRange().getValues();
  var key = (data.school + "," + data.name).toLowerCase();
  // 기존 행에서 같은 학교+이름이 있으면 타수 비교 후 교체
  for (var r = 1; r < values.length; r++) {
    var cell = String(values[r][colIdx] || "").trim();
    if (!cell) continue;
    var parts = cell.split(",");
    if (parts.length < 2) continue;
    var existKey = (parts[0].trim() + "," + parts[1].trim()).toLowerCase();
    if (existKey === key) {
      var existWpm = parseInt(parts[2] || "0", 10);
      if (data.wpm <= existWpm) return { ok: false, reason: "not_higher", existWpm: existWpm };
      // 갱신
      var row = r + 1; // 1-indexed
      var col = colIdx + 1;
      sheet.getRange(row, col).setValue(
        [data.school, data.name, data.wpm, data.acc].join(",")
      );
      return { ok: true, updated: true };
    }
  }
  // 새 행: 빈 행 찾거나 마지막에 추가
  var newRow = null;
  for (var r2 = 1; r2 < values.length; r2++) {
    var cell2 = String(values[r2][colIdx] || "").trim();
    if (!cell2) { newRow = r2 + 1; break; }
  }
  if (!newRow) newRow = values.length + 1;
  sheet.getRange(newRow, colIdx + 1).setValue(
    [data.school, data.name, data.wpm, data.acc].join(",")
  );
  return { ok: true, updated: false };
}
