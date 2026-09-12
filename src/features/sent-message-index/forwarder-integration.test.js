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
  forward: { retries: 0, sendDelayMs: 0 },
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
