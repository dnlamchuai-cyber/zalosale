// AI: Codex — phân loại lý do một cụm quét không thể gửi.
// Tại sao: luồng quét mới và dữ liệu quét được khôi phục phải hiển thị cùng một lý do, không để “Chưa xác định” mơ hồ.
// Link: yêu cầu “ghi rõ thiếu địa danh / chỉ có chữ” ngày 2026-09-13
import { photoUrls, videoUrls } from "./media.js";

export const NON_SENDABLE_SCAN_STATUSES = new Set([
  "building_full",
  "text_only",
  "media_only",
  "missing_opening",
  "missing_location",
  "undetermined",
  "no_images",
  "duplicate",
]);

function hasText(items) {
  return items.some((item) => typeof item?.data?.content === "string" && item.data.content.trim());
}

function hasVisualMedia(items) {
  return items.some((item) => photoUrls(item).length > 0 || videoUrls(item).length > 0);
}

function hasRecognizedOpening(batchMeta) {
  return batchMeta?.segmentType === "building" || batchMeta?.segmentType === "lead";
}

function isFullAvailabilityNotice(items) {
  const text = items
    .map((item) => (typeof item?.data?.content === "string" ? item.data.content : ""))
    .join("\n");
  return /(?:^|\s)(?:full\s*(?:[❌×x!]|$)|het\s*(?:phong|p)\b|hết\s*(?:phòng|p)\b)/i.test(text);
}

/** Xếp nguyên nhân theo thứ tự người dùng có thể hành động: nội dung, ảnh, tin mở, rồi địa danh. */
export function classifyScanPost({ items = [], batchMeta = {}, undetermined = false } = {}) {
  if (!hasVisualMedia(items) && isFullAvailabilityNotice(items)) return "building_full";
  if (!hasVisualMedia(items)) return "text_only";
  if (!hasText(items)) return "media_only";
  if (!hasRecognizedOpening(batchMeta)) return "missing_opening";
  if (undetermined) return "missing_location";
  return "pending";
}

export function isAutomaticallySendableScanStatus(status) {
  return !NON_SENDABLE_SCAN_STATUSES.has(status || "pending") && status !== "sent";
}
