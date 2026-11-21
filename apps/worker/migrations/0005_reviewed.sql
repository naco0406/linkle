-- 관리자 화면 훑어보기(설계 문서 7.7). 자동으로 들어온 문제를 관리자가 봤는지 남긴다.
-- 문제 채우기로 들어온 문제는 비어 있고(안 본 문제), 관리자가 "괜찮아요"를 누르거나 직접 넣은 문제는 그 시각이 들어간다.
ALTER TABLE puzzle_queue ADD COLUMN reviewed_at INTEGER;
-- 이미 앞으로 당겨 둔 문제는 관리자가 고른 것이다
UPDATE puzzle_queue SET reviewed_at = created_at WHERE priority > 0;
