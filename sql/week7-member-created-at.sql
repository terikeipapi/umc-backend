-- Run through scripts/week7-db.mjs, which checks whether the column exists.
-- Legacy members receive migration time because week 6 stored no signup time.
ALTER TABLE member
  ADD COLUMN created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);
