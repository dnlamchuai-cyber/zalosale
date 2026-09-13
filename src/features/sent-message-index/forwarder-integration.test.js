// Ai viết: Codex — kiểm chứng điểm nối Zalo gửi thành công sang kho tin
// Tại sao: callback không được chạy trước xác nhận gửi hoặc khi sendMessage lỗi
// Link: docs/03_SPEC/SPEC-002.md + docs/04_PROMPTS/PROMPT-005.md

import assert from "node:assert/strict";
import { Forwarder } from "../../forwarder.js";

const area = { id: "dest-a", keywords: ["cau giay"] };
const config = {
  areas: [area],
  defaultArea: null,
  deleteLines: [],
  excludeKeywords: [],
  filter: {},
  priceRange: null,
  forward: { retries: 0, sendDelayMs: 0, skipTextOnly: false },
};
const payload = {
  threadId: "source-a",
  source: "manual",
  items: [{ data: { content: "Mã: R151\nĐịa chỉ: Cầu Giấy" } }],
};

const recorded = [];
const successful = new Forwarder(
  { sendMessage: async () => ({ messageId: "zalo-1" }) },
  structuredClone(config),
  () => {},
  async (delivery) => recorded.push(delivery),
);
const successResult = await successful.forwardPayload(payload);
assert.equal(successResult.sent, true);
assert.equal(recorded.length, 1);
assert.equal(recorded[0].sourceGroupId, "source-a");
assert.equal(recorded[0].destinationGroup.id, "dest-a");

const resendDestinations = [];
const resend = new Forwarder(
  { sendMessage: async (message, destinationId) => { resendDestinations.push(destinationId); return { messageId: "zalo-resend" }; } },
  structuredClone(config),
);
const resendResult = await resend.forwardPayload({
  ...payload,
  source: "manual-resend",
  resendDestinations: [
    { id: "dest-old", keywords: ["Nhóm cũ"] },
    { id: "dest-a", keywords: ["Cầu Giấy"] },
  ],
  forceResend: true,
});
assert.equal(resendResult.destinations, 2);
assert.deepEqual(resendDestinations, ["dest-old", "dest-a"]);

let failedDeliveryCount = 0;
const failed = new Forwarder(
  { sendMessage: async () => { throw new Error("Zalo send failed"); } },
  structuredClone(config),
  () => {},
  async () => { failedDeliveryCount += 1; },
);
const failedResult = await failed.forwardPayload(payload);
assert.equal(failedResult.sent, false);
assert.equal(failedDeliveryCount, 0);

const duplicate = new Forwarder(
  { sendMessage: async () => { throw new Error("Không được gọi Zalo khi bài trùng"); } },
  structuredClone(config),
  () => {},
  async () => {},
  async () => true,
);
const duplicateResult = await duplicate.forwardPayload(payload);
assert.equal(duplicateResult.sent, false);
assert.equal(duplicateResult.duplicate, true);

const strictConfig = structuredClone(config);
strictConfig.forward.skipTextOnly = true;
const roomWithPhoto = new Forwarder(
  { sendMessage: async () => { throw new Error("Không được gửi cụm không có tin mở"); } },
  structuredClone(strictConfig),
);
const roomWithPhotoResult = await roomWithPhoto.forwardPayload({
  threadId: "source-a",
  source: "manual",
  segmentType: "room",
  items: [{ data: { content: "P301 1n1k 8tr", normalUrl: "https://example.test/room.jpg" } }],
});
assert.equal(roomWithPhotoResult.reason, "no-opening");

const openingWithPhoto = new Forwarder(
  { sendMessage: async () => ({ messageId: "zalo-opening-photo" }) },
  structuredClone(strictConfig),
);
openingWithPhoto.download = async () => null;
const openingWithPhotoResult = await openingWithPhoto.forwardPayload({
  ...payload,
  segmentType: "building",
  items: [
    { data: { content: "🏠 Nhà Cầu Giấy, phòng đầy đủ nội thất", normalUrl: "https://example.test/opening.jpg" } },
  ],
});
assert.equal(openingWithPhotoResult.sent, true);
