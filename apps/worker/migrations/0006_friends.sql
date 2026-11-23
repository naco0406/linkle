-- 친구와 겨루기(설계 문서 16장)
-- 도전장: 끝낸 판 하나를 친구에게 보내는 짧은 코드. 같은 판으로 다시 만들면 같은 코드다
CREATE TABLE challenges (
  code       TEXT PRIMARY KEY,
  puzzle_id  INTEGER NOT NULL,
  run_id     TEXT NOT NULL UNIQUE,
  player_id  TEXT NOT NULL,
  takers     INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
-- 그 판이 받은 도전장 코드(도전장 순위)와 같이 달리기 방('K7PX:3', 방 코드:판 번호)
ALTER TABLE runs ADD COLUMN challenge TEXT;
ALTER TABLE runs ADD COLUMN room TEXT;
CREATE INDEX runs_challenge ON runs (challenge, duration_ms) WHERE challenge IS NOT NULL;
-- 이름 다시 뽑기: 이름은 기기 id와 이 숫자로 정해진다(직접 쓴 이름은 받지 않는다)
ALTER TABLE players ADD COLUMN salt INTEGER NOT NULL DEFAULT 0;
-- puzzles.kind 에 'random'(같이 달리기 랜덤 풀), puzzles.status 에 'draft'(출제자가 아직 안 풂)와 'unlisted'(링크가 있는 사람만)가 더해진다
CREATE INDEX puzzles_author ON puzzles (author_id) WHERE author_id IS NOT NULL;
CREATE INDEX puzzles_random ON puzzles (kind, difficulty) WHERE kind = 'random';
