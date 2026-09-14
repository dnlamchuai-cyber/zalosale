// AI: Codex | WHY: khóa các lý do không gửi để bảng quét không hiển thị trạng thái mơ hồ.
// SPEC: yêu cầu “ghi rõ thiếu địa danh / chỉ có chữ” ngày 2026-09-13
import test from "node:test";
import assert from "node:assert/strict";
import { classifyScanPost } from "./scan-post-status.js";

const image = { data: { originUrl: "https://example.test/room.jpg", ts: 1 } };
const text = (content) => ({ data: { content, ts: 1 } });

test("phân loại rõ các cụm không đủ điều kiện gửi", () => {
  assert.equal(classifyScanPost({ items: [text("358/109 Bùi Xương Trạch full ❌❌❌")], batchMeta: { segmentType: "generic" } }), "building_full");
  assert.equal(classifyScanPost({ items: [text("Thông báo" )], batchMeta: { segmentType: "building" } }), "text_only");
  assert.equal(classifyScanPost({ items: [image], batchMeta: { segmentType: "building" } }), "media_only");
  assert.equal(classifyScanPost({ items: [text("P101"), image], batchMeta: { segmentType: "room" } }), "missing_opening");
  assert.equal(classifyScanPost({ items: [text("Địa chỉ: Yên Xá"), image], batchMeta: { segmentType: "building" }, undetermined: true }), "missing_location");
  assert.equal(classifyScanPost({ items: [text("Địa chỉ: Hà Đông"), image], batchMeta: { segmentType: "building" } }), "pending");
});
