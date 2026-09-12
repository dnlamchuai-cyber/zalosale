// Ai viết: Codex
// Tại sao: nhận diện thông báo full tòa bằng text, không phụ thuộc định dạng quote của Zalo.
// Link: docs/03_SPEC/SPEC-005_StickerSeparatedPosts.md — mở rộng trạng thái nguồn.

import { normalizeText } from "./processor.js";

const BUILDING_CODE_PATTERN = /\b\d+[a-z]\d*\b/i;
const FULL_NOTICE_PATTERN = /^(.*?)\s+full\s+(?:tòa|toà|toa)(?=\s|$)/i;
const FULL_NOTICE_SUFFIX_PATTERN = /^full\s+(?:tòa|toà|toa)\s*[:\-]?\s*(.+)$/i;
const GENERIC_BUILDING_WORDS = new Set([
  "can", "chung", "cu", "phong", "studio", "toa", "building", "khu", "nha",
]);

function cleanLabel(value) {
  return String(value || "").replace(/[\u200B-\u200D\uFEFF]/g, "").replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "").trim();
}

function buildingNameTokens(label, code) {
  const normalized = normalizeText(label).replace(code ? new RegExp(`\\b${code}\\b`, "ig") : /$^/, " ");
  return normalized
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 2 && !GENERIC_BUILDING_WORDS.has(token));
}

export function buildingKeyFromText(text) {
  const normalized = normalizeText(text);
  if (!normalized) return "";
  const code = normalized.match(BUILDING_CODE_PATTERN)?.[0];
  if (code) return code.toLowerCase();
  const firstPart = normalized.split(/\r?\n|\||\s[-–—]\s|[.!?]/)[0].replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  const tokens = firstPart.split(/\s+/).filter((token) => !GENERIC_BUILDING_WORDS.has(token));
  return tokens.join(" ").slice(0, 80);
}

export function parseFullBuildingNotice(text) {
  const value = String(text || "").trim();
  if (!value) return null;
  const prefixMatch = value.match(FULL_NOTICE_PATTERN);
  const suffixMatch = value.match(FULL_NOTICE_SUFFIX_PATTERN);
  const rawLabel = prefixMatch?.[1] || suffixMatch?.[1];
  const label = cleanLabel(rawLabel);
  const key = buildingKeyFromText(label);
  if (!label || !key) return null;
  const code = normalizeText(label).match(BUILDING_CODE_PATTERN)?.[0]?.toLowerCase() || "";
  return { key, code, nameTokens: buildingNameTokens(label, code), label, text: value };
}

/**
 * So khớp thông báo full với bài kế tiếp. Mã tòa là khóa chính; tên tòa
 * được dùng để phân biệt trường hợp hai tòa dùng chung địa chỉ/mã hiển thị.
 * Khi không yêu cầu tên, bài chỉ có mã (ví dụ P201) vẫn được xem là cùng tòa.
 */
export function buildingNoticeMatchesText(text, notice, { requireName = false } = {}) {
  if (!notice?.key) return false;
  const normalized = normalizeText(text);
  if (!normalized) return !requireName;
  const candidateCode = normalized.match(BUILDING_CODE_PATTERN)?.[0]?.toLowerCase() || "";
  if (notice.code && candidateCode && candidateCode !== notice.code) return false;
  const nameTokens = Array.isArray(notice.nameTokens) ? notice.nameTokens : [];
  if (!nameTokens.length) return true;
  const nameMatches = nameTokens.every((token) => normalized.includes(token));
  if (nameMatches) return true;
  if (requireName) return false;
  // Không có mã trong tin phòng thì không đủ dữ kiện để khẳng định là tòa khác;
  // giữ hành vi an toàn là loại theo mã đã lưu.
  return Boolean(notice.code && candidateCode === "");
}
