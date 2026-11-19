-- 설계 문서 3.9의 표를 처음부터 최종 모양으로 만든다.
-- 무한 모드(구현 순서 9번, 11번)에서 스키마를 다시 뜯지 않으려고 아직 쓰지 않는 칸과 표도 함께 둔다.

CREATE TABLE puzzles (                   -- 오늘의 문제와 커뮤니티 문제를 한 표에 둔다
  id          INTEGER PRIMARY KEY,
  kind        TEXT NOT NULL,             -- daily | official | community
  number      INTEGER NOT NULL,          -- kind별 일련번호
  date        TEXT UNIQUE,               -- daily만. KST YYYY-MM-DD
  start_id    INTEGER NOT NULL, start_title TEXT NOT NULL,
  end_id      INTEGER NOT NULL, end_title   TEXT NOT NULL,
  par         INTEGER,                   -- 생성 도구가 확인한 최단 클릭 수
  author_id   TEXT,                      -- community만
  author_moves INTEGER,                  -- 출제자가 직접 푼 이동 횟수
  status      TEXT NOT NULL DEFAULT 'published',  -- draft | published | hidden
  plays       INTEGER NOT NULL DEFAULT 0,
  clears      INTEGER NOT NULL DEFAULT 0, -- 순위에 드는(ranked) 완료 수. 완료 순서 번호를 여기서 뽑는다
  created_at  INTEGER NOT NULL
);
CREATE UNIQUE INDEX puzzles_number ON puzzles (kind, number);
CREATE UNIQUE INDEX puzzles_pair ON puzzles (start_id, end_id) WHERE kind != 'daily';

CREATE TABLE puzzle_queue (
  id INTEGER PRIMARY KEY,
  start_id INTEGER, start_title TEXT, end_id INTEGER, end_title TEXT,
  par INTEGER,
  status TEXT NOT NULL DEFAULT 'candidate',   -- candidate | approved | rejected | used
  pool   TEXT NOT NULL DEFAULT 'daily'        -- daily | official
);

CREATE TABLE players (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, created_at INTEGER NOT NULL  -- name: 자동 생성 닉네임
);

CREATE TABLE runs (
  id          TEXT PRIMARY KEY,
  puzzle_id   INTEGER NOT NULL,
  mode        TEXT NOT NULL,             -- daily | archive | community
  ranked      INTEGER NOT NULL DEFAULT 0, -- 1: 오늘의 문제 당일 Run, 커뮤니티 문제 첫 도전
  player_id   TEXT NOT NULL,
  started_at  INTEGER NOT NULL,
  finished_at INTEGER,                   -- 서버가 완료 제출을 받은 시각
  duration_ms INTEGER,                   -- 기록으로 쓰는 소요 시간. 서버가 잰 경과 시간보다 길 수 없다
  moves       INTEGER,
  events      TEXT,                      -- JSON
  visit_log   TEXT,                      -- JSON. 방문 알림에 서버 시각을 붙인 것. community만
  emoji       TEXT,                      -- JSON 배열. 클라이언트가 계산한 값. 표시용
  flags       TEXT NOT NULL DEFAULT '',  -- 쉼표로 이은 표시 이름
  finish_order INTEGER,
  verified    INTEGER NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX runs_ranked_once ON runs (puzzle_id, player_id) WHERE ranked = 1;
CREATE INDEX runs_board ON runs (puzzle_id, moves, duration_ms) WHERE ranked = 1 AND finished_at IS NOT NULL;

CREATE TABLE reports (                   -- 2단계
  puzzle_id INTEGER NOT NULL, player_id TEXT NOT NULL, at INTEGER NOT NULL,
  PRIMARY KEY (puzzle_id, player_id)
);

CREATE TABLE daily_stats (date TEXT PRIMARY KEY, payload TEXT NOT NULL);
