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

const deliveredTexts = [];
const excludedReply = new Forwarder(
  { sendMessage: async (message) => { deliveredTexts.push(typeof message === "string" ? message : message.msg); return { messageId: "zalo-filter" }; } },
  { ...structuredClone(config), excludeKeywords: ["@all"] },
);
const excludedReplyResult = await excludedReply.forwardPayload({
  threadId: "source-a",
  source: "manual",
  items: [
    { data: { content: "Địa chỉ: Cầu Giấy. Phòng studio đầy đủ nội thất." } },
    { data: { content: "@Thương Khánh 78 Võ Chí Công GIẢM GIÁ CHÀO KHÁCH @All", quote: { cliMsgId: "photo-1" } } },
    { data: { content: "Trục 01 còn trống." } },
  ],
});
assert.equal(excludedReplyResult.sent, true);
assert.equal(deliveredTexts.some((value) => value.includes("@All")), false);
assert.equal(deliveredTexts.includes("Trục 01 còn trống."), true);

const unquotedExcludedText = new Forwarder(
  { sendMessage: async (message) => { deliveredTexts.push(typeof message === "string" ? message : message.msg); return { messageId: "zalo-filter-unquoted" }; } },
  { ...structuredClone(config), excludeKeywords: ["@all"] },
);
const unquotedExcludedResult = await unquotedExcludedText.forwardPayload({
  threadId: "source-a",
  source: "manual",
  items: [
    { data: { content: "Địa chỉ: Cầu Giấy. Phòng studio đầy đủ nội thất." } },
    { data: { content: "Thông báo @All vui lòng không gửi." } },
    { data: { content: "Trục 04 còn trống." } },
  ],
});
assert.equal(unquotedExcludedResult.sent, true);
assert.equal(deliveredTexts.some((value) => value.includes("Thông báo @All")), false);
assert.equal(deliveredTexts.includes("Trục 04 còn trống."), true);

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
