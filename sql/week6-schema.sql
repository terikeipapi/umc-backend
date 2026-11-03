-- Week 6 movie-rating tables. Run in the database selected by DB_NAME.
-- Existing library tables are not modified. Requires MySQL 8.0.16+.
CREATE TABLE IF NOT EXISTS member (
  member_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  email VARCHAR(254) NOT NULL,
  password VARCHAR(60) NOT NULL,
  nickname VARCHAR(12) NOT NULL,
  PRIMARY KEY (member_id),
  CONSTRAINT uq_member_email UNIQUE (email),
  CONSTRAINT uq_member_nickname UNIQUE (nickname)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS rating (
  rating_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  member_id INT UNSIGNED NOT NULL,
  -- External TMDB ID, not a reference to a local movie table.
  movie_id BIGINT UNSIGNED NOT NULL,
  score TINYINT UNSIGNED NOT NULL,
  comment VARCHAR(500) NULL,
  PRIMARY KEY (rating_id),
  CONSTRAINT uq_rating_member_movie UNIQUE (member_id, movie_id),
  CONSTRAINT fk_rating_member FOREIGN KEY (member_id) REFERENCES member(member_id),
  CONSTRAINT chk_rating_score CHECK (score BETWEEN 1 AND 5),
  CONSTRAINT chk_rating_movie_id CHECK (movie_id BETWEEN 1 AND 9007199254740991)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
