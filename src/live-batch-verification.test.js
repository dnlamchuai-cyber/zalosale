// Ai viết: Codex — kiểm thử xác minh bài AUTO trước khi gửi
// Tại sao: cửa sổ nhanh giảm tải nhưng fallback phải giữ an toàn khi nhóm đông tin
// Link: yêu cầu tối ưu AUTO ngày 2026-09-10

import assert from "node:assert/strict";
import test from "node:test";
import { isLiveBatchStillPresent } from "./live-batch-verification.js";

function message(id) {
  return { data: { msgId: id, content: `Tin ${id}` } };
}

test("dùng cửa sổ lịch sử nhỏ khi bài AUTO vẫn còn", async () => {
  const calls = [];
  const api = {
    getGroupChatHistory: async (_threadId, count) => {
      calls.push(count);
      return { groupMsgs: [message("a"), message("b")] };
    },
  };

  const present = await isLiveBatchStillPresent(api, "source", [message("a"), message("b")]);

  assert.equal(present, true);
  assert.deepEqual(calls, [200]);
});

test("fallback lịch sử đầy đủ khi cửa sổ nhỏ chưa đủ bài", async () => {
  const calls = [];
  const api = {
    getGroupChatHistory: async (_threadId, count) => {
      calls.push(count);
      return { groupMsgs: count === 200 ? [message("b")] : [message("a"), message("b")] };
    },
  };

  const present = await isLiveBatchStillPresent(api, "source", [message("a"), message("b")]);

  assert.equal(present, true);
  assert.deepEqual(calls, [200, 1500]);
});

test("không gửi AUTO khi lịch sử không còn bài hoặc API lỗi", async () => {
  const removedApi = { getGroupChatHistory: async () => ({ groupMsgs: [] }) };
  const failedApi = { getGroupChatHistory: async () => { throw new Error("network unavailable"); } };

  assert.equal(await isLiveBatchStillPresent(removedApi, "source", [message("a")]), false);
  assert.equal(await isLiveBatchStillPresent(failedApi, "source", [message("a")]), false);
});
