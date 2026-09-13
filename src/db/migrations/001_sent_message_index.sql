-- Ai viết: Codex — schema kho tin bot đã gửi
-- Tại sao: tách hồ sơ phòng khỏi từng lần gửi để vừa gom vừa truy vết
-- Link: docs/03_SPEC/SPEC-002.md + docs/04_PROMPTS/PROMPT-005.md + docs/03_SPEC/SPEC-006_MapRadiusSearch.md

CREATE TABLE IF NOT EXISTS room_records (
  id TEXT PRIMARY KEY,
  room_code TEXT NOT NULL UNIQUE COLLATE NOCASE,
  address TEXT NOT NULL DEFAULT '',
  latest_content TEXT NOT NULL DEFAULT '',
  normalized_search TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'unknown',
  latitude REAL,
  longitude REAL,
  location_status TEXT NOT NULL DEFAULT 'pending',
  location_address TEXT NOT NULL DEFAULT '',
  location_updated_at INTEGER,
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

-- ID tin nhắn Zalo đã gửi (msgId/cliMsgId): quét lại gặp đúng tin cũ thì loại,
-- tin khác ID vẫn xét tiếp bằng content-hash như cũ.
CREATE TABLE IF NOT EXISTS sent_message_ids (
  message_id TEXT PRIMARY KEY,
  sent_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS sent_message_ids_time_idx ON sent_message_ids(sent_at DESC);

-- Customer search foundation: requests exist before a room is selected in CRM.
CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone_normalized TEXT NOT NULL UNIQUE,
  phone_display TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS customer_search_requests (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS customer_search_requests_customer_idx
  ON customer_search_requests(customer_id, created_at);

CREATE TABLE IF NOT EXISTS customer_search_zones (
  id TEXT PRIMARY KEY,
  search_request_id TEXT NOT NULL REFERENCES customer_search_requests(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  radius_meters INTEGER NOT NULL CHECK (radius_meters BETWEEN 200 AND 20000),
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE (search_request_id, latitude, longitude, radius_meters)
);

CREATE INDEX IF NOT EXISTS customer_search_zones_request_idx
  ON customer_search_zones(search_request_id, created_at);

CREATE TABLE IF NOT EXISTS geocode_cache (
  normalized_address TEXT PRIMARY KEY,
  status TEXT NOT NULL,
  candidates_json TEXT NOT NULL DEFAULT '[]',
  updated_at INTEGER NOT NULL
);
