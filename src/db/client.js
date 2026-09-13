// Ai viết: Codex — biên kết nối SQLite dùng module sẵn có của Node
// Tại sao: một nơi duy nhất mở DB, bật an toàn và chạy migration
// Link: docs/03_SPEC/SPEC-002.md + docs/04_PROMPTS/PROMPT-005.md + docs/04_PROMPTS/PROMPT-010_RoomLocationResolution.md

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

const CURRENT_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_MIGRATION = path.join(CURRENT_DIR, "migrations", "001_sent_message_index.sql");

export function openDatabase(databasePath, migrationPath = DEFAULT_MIGRATION) {
  fs.mkdirSync(path.dirname(databasePath), { recursive: true });
  const database = new DatabaseSync(databasePath);
  database.exec("PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;");
  database.exec("PRAGMA journal_mode = WAL;");
  database.exec(fs.readFileSync(migrationPath, "utf8"));
  ensureRoomLocationColumns(database);
  return database;
}

function ensureRoomLocationColumns(database) {
  const columns = new Set(database.prepare("PRAGMA table_info(room_records)").all().map((row) => row.name));
  const additions = [
    ["latitude", "REAL"],
    ["longitude", "REAL"],
    ["location_status", "TEXT NOT NULL DEFAULT 'pending'"],
    ["location_address", "TEXT NOT NULL DEFAULT ''"],
    ["location_updated_at", "INTEGER"],
  ];
  for (const [name, definition] of additions) {
    if (!columns.has(name)) database.exec(`ALTER TABLE room_records ADD COLUMN ${name} ${definition}`);
  }
}
