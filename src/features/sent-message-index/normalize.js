// Ai viết: Codex — chuẩn hóa khóa tìm kiếm và mã phòng
// Tại sao: tìm tiếng Việt không dấu ổn định, không phụ thuộc cú pháp FTS từ user
// Link: docs/03_SPEC/SPEC-002.md + docs/04_PROMPTS/PROMPT-005.md

import crypto from "node:crypto";

const ROOM_CODE_PATTERN = /(?:mã(?:\s+phòng)?|code)\s*[:#-]?\s*([a-z0-9-]{2,50})/iu;

export function normalizeSearchText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function extractRoomCode(content) {
  const match = String(content || "").match(ROOM_CODE_PATTERN);
  return match?.[1]?.toUpperCase() || null;
}

export function generateRoomCode() {
  return `P-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
}

export function contentHash(content) {
  return crypto.createHash("sha256").update(String(content || "")).digest("hex");
}

export function toFtsQuery(query) {
  return normalizeSearchText(query)
    .split(" ")
    .filter(Boolean)
    .map((token) => `"${token}"*`)
    .join(" AND ");
}
