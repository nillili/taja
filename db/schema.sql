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

-- ── 낱말연습 단어 (이제 D1이 원본, wordSteps.js는 fallback) ────────
CREATE TABLE IF NOT EXISTS words (
  id     INTEGER PRIMARY KEY AUTOINCREMENT,
  step   INTEGER NOT NULL CHECK(step BETWEEN 1 AND 4),
  mode   TEXT    NOT NULL CHECK(mode IN ('basic','adv')),  -- 기본/심화
  text   TEXT    NOT NULL CHECK(length(text) > 0),
  UNIQUE(step, mode, text)          -- 같은 칸 중복 등록 방지
);
CREATE INDEX IF NOT EXISTS idx_words_step_mode ON words(step, mode);

-- 일괄 교체 직전 스냅샷 1회분 ("직전 교체 되돌리기"용)
CREATE TABLE IF NOT EXISTS words_backup (
  id INTEGER, step INTEGER, mode TEXT, text TEXT,
  backed_up_at TEXT NOT NULL
);

-- ── 단문/장문 공용 문장 테이블 (이번엔 생성까지만) ─────────────────
-- 단문: kind='danmun', title='', seq=1  → 행 하나가 연습문제 1개 (난이도별 여러 개)
-- 장문: kind='jangmun', 같은 (level,title) 행들을 seq 순으로 이으면 수필 한 편
CREATE TABLE IF NOT EXISTS sentences (
  id     INTEGER PRIMARY KEY AUTOINCREMENT,
  kind   TEXT    NOT NULL CHECK(kind IN ('danmun','jangmun')),
  level  INTEGER NOT NULL CHECK(level BETWEEN 1 AND 3),    -- 난이도 1·2·3
  title  TEXT    NOT NULL DEFAULT '',                      -- 장문(수필) 제목
  seq    INTEGER NOT NULL DEFAULT 1,                       -- 장문 내 문장 순서
  text   TEXT    NOT NULL CHECK(length(text) BETWEEN 1 AND 150),
  CHECK(
    (kind = 'danmun'  AND title =  '' AND seq  = 1) OR
    (kind = 'jangmun' AND title <> '' AND seq >= 1)
  )
);
-- 장문: 같은 수필 안에서 문장 순서 중복 금지
CREATE UNIQUE INDEX IF NOT EXISTS uq_sentences_jangmun_seq
  ON sentences(level, title, seq) WHERE kind = 'jangmun';
-- 단문: 같은 난이도에 같은 문장 중복 금지
CREATE UNIQUE INDEX IF NOT EXISTS uq_sentences_danmun_text
  ON sentences(level, text) WHERE kind = 'danmun';
CREATE INDEX IF NOT EXISTS idx_sentences_pick ON sentences(kind, level, title, seq);

-- 문장 일괄 교체 직전 스냅샷 (kind별로 1회분)
CREATE TABLE IF NOT EXISTS sentences_backup (
  id INTEGER, kind TEXT, level INTEGER, title TEXT, seq INTEGER, text TEXT,
  backed_up_at TEXT NOT NULL
);

-- ── 관리자 PIN 시도 기록 (시도 제한용) ─────────────────────────────
CREATE TABLE IF NOT EXISTS admin_attempts (
  ip TEXT NOT NULL,
  at TEXT NOT NULL,        -- ISO8601
  ok INTEGER NOT NULL      -- 1 성공 / 0 실패
);
CREATE INDEX IF NOT EXISTS idx_admin_attempts ON admin_attempts(ip, at);
