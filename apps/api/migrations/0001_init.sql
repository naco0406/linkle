-- Linkle v1 schema. See docs/architecture.md §3.
-- Runs via: pnpm --filter @linkle/api run db:migrate:local (or :remote).

CREATE TABLE challenges (
  date        TEXT PRIMARY KEY,         -- 'YYYY-MM-DD' (KST)
  start_page  TEXT NOT NULL,
  end_page    TEXT NOT NULL,
  created_at  INTEGER NOT NULL,         -- unix ms
  created_by  TEXT                      -- admin username, nullable
);

CREATE TABLE rankings (
  id             TEXT PRIMARY KEY,      -- uuid v4
  challenge_date TEXT NOT NULL,
  user_id        TEXT NOT NULL,
  nickname       TEXT NOT NULL,
  move_count     INTEGER NOT NULL,      -- actual click count; no +1 offset
  time_sec       INTEGER NOT NULL,
  path_json      TEXT NOT NULL,         -- JSON Path (@linkle/shared PathEntry[])
  submitted_at   INTEGER NOT NULL,
  emoji_result   TEXT,                  -- nullable; populated async
  reason_json    TEXT,                  -- nullable; OpenAIReasonEntry[]
  FOREIGN KEY (challenge_date) REFERENCES challenges(date)
);

CREATE UNIQUE INDEX uidx_rankings_date_user   ON rankings(challenge_date, user_id);
CREATE INDEX        idx_rankings_date_time    ON rankings(challenge_date, time_sec, move_count);
CREATE INDEX        idx_rankings_date_moves   ON rankings(challenge_date, move_count, time_sec);
CREATE INDEX        idx_rankings_date_submit  ON rankings(challenge_date, submitted_at);

CREATE TABLE statistics (
  challenge_date          TEXT PRIMARY KEY,
  total_count             INTEGER NOT NULL DEFAULT 0,
  shortest_path_ranking   TEXT,                 -- FK to rankings.id
  fastest_time_ranking    TEXT,                 -- FK to rankings.id
  computed_at             INTEGER NOT NULL,
  FOREIGN KEY (challenge_date) REFERENCES challenges(date)
);

CREATE TABLE admins (
  id             TEXT PRIMARY KEY,
  username       TEXT UNIQUE NOT NULL,
  password_hash  TEXT NOT NULL,          -- PBKDF2-SHA256, base64 "salt$hash$iterations"
  created_at     INTEGER NOT NULL
);
