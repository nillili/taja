-- 오늘의 기록: 모든 플레이 저장, date 필터로 하루치만 조회
CREATE TABLE IF NOT EXISTS today_records (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  recorded_at TEXT NOT NULL,   -- ISO8601 "2026-06-02T14:30:00Z"
  name        TEXT NOT NULL,
  school      TEXT NOT NULL,
  wpm         INTEGER NOT NULL,
  accuracy    REAL NOT NULL
);

-- 단문/장문 명예의전당: 최고 기록 상위 20인 영구보관
CREATE TABLE IF NOT EXISTS hall_of_fame (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  board       TEXT NOT NULL,   -- 'danmun' | 'jangmun'
  recorded_at TEXT NOT NULL,
  name        TEXT NOT NULL,
  school      TEXT NOT NULL,
  wpm         INTEGER NOT NULL,
  accuracy    REAL NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_today_date   ON today_records(recorded_at);
CREATE INDEX IF NOT EXISTS idx_hof_board_wpm ON hall_of_fame(board, wpm DESC);
