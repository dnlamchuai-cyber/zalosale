-- Ai viết: Codex — schema kho tin bot đã gửi
-- Tại sao: tách hồ sơ phòng khỏi từng lần gửi để vừa gom vừa truy vết
-- Link: docs/03_SPEC/SPEC-002.md + docs/04_PROMPTS/PROMPT-005.md

CREATE TABLE IF NOT EXISTS room_records (
  id TEXT PRIMARY KEY,
  room_code TEXT NOT NULL UNIQUE COLLATE NOCASE,
  address TEXT NOT NULL DEFAULT '',
  latest_content TEXT NOT NULL DEFAULT '',
  normalized_search TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'unknown',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS zalo_groups (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL DEFAULT '',
  last_resolved_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sent_messages (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL REFERENCES room_records(id),
  source_group_id TEXT REFERENCES zalo_groups(id),
  destination_group_id TEXT NOT NULL REFERENCES zalo_groups(id),
  original_content TEXT NOT NULL DEFAULT '',
  sent_content TEXT NOT NULL DEFAULT '',
  content_hash TEXT NOT NULL,
  capture_method TEXT NOT NULL DEFAULT 'bot_send',
  delivery_status TEXT NOT NULL DEFAULT 'sent',
  sent_at INTEGER NOT NULL,
  captured_at INTEGER NOT NULL,
  image_total INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS sent_messages_room_time_idx
  ON sent_messages(room_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS sent_messages_source_time_idx
  ON sent_messages(source_group_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS sent_messages_destination_time_idx
  ON sent_messages(destination_group_id, sent_at DESC);

CREATE VIRTUAL TABLE IF NOT EXISTS room_search USING fts5(
  room_id UNINDEXED,
  search_text,
  tokenize = 'unicode61 remove_diacritics 2'
);
