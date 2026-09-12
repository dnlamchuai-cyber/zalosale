// Ai viết: Codex — biên kết nối SQLite dùng module sẵn có của Node
// Tại sao: một nơi duy nhất mở DB, bật an toàn và chạy migration
// Link: docs/03_SPEC/SPEC-002.md + docs/04_PROMPTS/PROMPT-005.md

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
  return database;
}
