-- 문제 자동 출제 (설계 문서 7장)
-- 대기열의 문제마다 게임에서 실제로 갈 수 있는 길(정답 예시)과 예상 난이도를 둔다.
-- 정답 예시는 공개하지 않는다. 문제를 내기 전날 이 길이 아직 살아 있는지 확인하는 데 쓴다.
ALTER TABLE puzzle_queue ADD COLUMN difficulty TEXT;      -- easy | normal | hard
ALTER TABLE puzzle_queue ADD COLUMN solution TEXT;        -- JSON [{ id, title, via }]
ALTER TABLE puzzle_queue ADD COLUMN created_at INTEGER;
ALTER TABLE puzzle_queue ADD COLUMN note TEXT;            -- 뺀 이유 등
ALTER TABLE puzzles ADD COLUMN difficulty TEXT;
ALTER TABLE puzzles ADD COLUMN solution TEXT;
CREATE UNIQUE INDEX puzzle_queue_pair ON puzzle_queue (start_id, end_id);
