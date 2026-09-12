// Ai viết: AI PROMPT-002 + AI regression TASK-004
// Tại sao dùng node:assert: assertion sai phải làm process thất bại và kiểm tra lỗi 500 an toàn
// Link SPEC/PROMPT: docs/03_SPEC/SPEC-001.md + docs/05_TASKS/TASK-004_KIEM-THU-TOAN-DIEN.md
import assert from "node:assert/strict";
import { communityCheckRoute } from "./route.js";

function mockRes() {
  const res = {};
  res.statusCode = 200;
  res.body = null;
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (obj) => { res.body = obj; return res; };
  return res;
}

async function run() {
  // Mock api để fetchRecentMessages trả về 1 batch
  const mockApi = {
    getGroupChatHistory: async () => ({
      groupMsgs: [{ data: { content: "Phòng Cầu Giấy 4tr5", ts: Date.now() } }],
    }),
  };
  const req1 = { body: { groupId: "8089152704833938973", from: "2026-08-21", to: "2026-08-24" }, api: mockApi, areas: [{ keywords: ["cau giay"] }] };
  const res1 = mockRes();
  await communityCheckRoute(req1, res1);
  assert.equal(res1.statusCode, 200);
  assert.equal(res1.body.ok, true);

  const req2 = { body: { groupId: "8089152704833938973", from: "abc" }, api: mockApi, areas: [] };
  const res2 = mockRes();
  await communityCheckRoute(req2, res2);
  assert.equal(res2.statusCode, 400);

  const internalMessage = "adapter token=secret-internal";
  const req3 = {
    body: { groupId: "8089152704833938973", from: "2026-08-21", to: "2026-08-24" },
    api: { getGroupChatHistory: async () => { throw new Error(internalMessage); } },
    areas: [],
  };
  const res3 = mockRes();
  await communityCheckRoute(req3, res3);
  assert.equal(res3.statusCode, 500);
  assert.equal(res3.body.error, "Không thể kiểm tra Community lúc này");
  assert.equal(JSON.stringify(res3.body).includes(internalMessage), false);
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
