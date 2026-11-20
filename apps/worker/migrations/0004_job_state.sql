-- 예약 작업이 기억할 작은 값들(설계 문서 7.5).
-- 지금은 'refill' 하나: 문제 채우기(GitHub Actions)를 마지막으로 부른 때와 결과
CREATE TABLE job_state (key TEXT PRIMARY KEY, value TEXT NOT NULL);
