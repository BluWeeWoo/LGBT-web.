-- Import after 001_initial.sql when installing through phpMyAdmin.
CREATE TABLE IF NOT EXISTS chat_preferences (
  user_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
  accepts_requests BOOLEAN NOT NULL DEFAULT FALSE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS chat_connections (
  id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
  pair_low CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  pair_high CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  requester_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  recipient_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  story_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin,
  requester_name VARCHAR(55) NOT NULL,
  recipient_name VARCHAR(55) NOT NULL,
  status ENUM('pending', 'accepted', 'declined', 'withdrawn', 'ended', 'blocked') NOT NULL DEFAULT 'pending',
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY chat_connections_pair (pair_low, pair_high),
  INDEX chat_connections_outbox (requester_id, updated_at),
  INDEX chat_connections_inbox (recipient_id, updated_at),
  FOREIGN KEY (requester_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (recipient_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (story_id) REFERENCES stories(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS chat_messages (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  connection_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  sender_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  client_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  body TEXT NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY chat_messages_retry (connection_id, sender_id, client_id),
  INDEX chat_messages_history (connection_id, id),
  FOREIGN KEY (connection_id) REFERENCES chat_connections(id) ON DELETE CASCADE,
  FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
