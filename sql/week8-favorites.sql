-- Run after week6-schema.sql and week7-member-created-at.sql in DB_NAME.
-- Additive only: existing members, ratings and library tables are preserved.
CREATE TABLE IF NOT EXISTS favorite (
  favorite_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  member_id INT UNSIGNED NOT NULL,
  -- External TMDB ID, matching the range accepted by the HTTP API.
  movie_id BIGINT UNSIGNED NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (favorite_id),
  CONSTRAINT uq_favorite_member_movie UNIQUE (member_id, movie_id),
  CONSTRAINT fk_favorite_member FOREIGN KEY (member_id) REFERENCES member(member_id),
  CONSTRAINT chk_favorite_movie_id CHECK (movie_id BETWEEN 1 AND 9007199254740991)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
