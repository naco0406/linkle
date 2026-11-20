-- 관리자 화면 (설계 문서 7.5)
-- 대기열에서 먼저 낼 문제를 앞으로 당길 수 있게 순서 칸을 둔다. 큰 값이 먼저다.
ALTER TABLE puzzle_queue ADD COLUMN priority INTEGER NOT NULL DEFAULT 0;
