CREATE DATABASE IF NOT EXISTS rye_atlas
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE rye_atlas;

CREATE TABLE IF NOT EXISTS users (
  id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
  email VARCHAR(254) NOT NULL UNIQUE,
  display_name VARCHAR(55) NOT NULL,
  password_hash VARCHAR(255) CHARACTER SET ascii,
  role ENUM('member', 'admin') NOT NULL DEFAULT 'member',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sessions (
  token_hash BINARY(32) PRIMARY KEY,
  user_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  expires_at DATETIME(3) NOT NULL,
  INDEX sessions_expiry (expires_at),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS stories (
  id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
  author_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  name VARCHAR(55) NOT NULL,
  place VARCHAR(65) NOT NULL,
  title VARCHAR(100) NOT NULL,
  body TEXT NOT NULL,
  flag VARCHAR(24) NOT NULL,
  topic VARCHAR(32) NOT NULL,
  use_photo_as_portrait BOOLEAN NOT NULL DEFAULT FALSE,
  status ENUM('pending', 'approved', 'declined') NOT NULL DEFAULT 'pending',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  reviewed_at DATETIME(3),
  reviewed_by CHAR(36) CHARACTER SET ascii COLLATE ascii_bin,
  INDEX stories_queue (status, created_at, id),
  FOREIGN KEY (author_id) REFERENCES users(id),
  FOREIGN KEY (reviewed_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS story_photos (
  story_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  slot TINYINT UNSIGNED NOT NULL,
  description VARCHAR(180) NOT NULL,
  jpeg MEDIUMBLOB NOT NULL,
  portrait_jpeg MEDIUMBLOB,
  PRIMARY KEY (story_id, slot),
  FOREIGN KEY (story_id) REFERENCES stories(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS auth_throttles (
  bucket BINARY(32) PRIMARY KEY,
  attempts INT UNSIGNED NOT NULL,
  expires_at DATETIME NOT NULL,
  INDEX auth_throttles_expiry (expires_at)
) ENGINE=InnoDB;
