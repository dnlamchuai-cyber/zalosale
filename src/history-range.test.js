// AI: Codex | WHY: kiểm chứng lấy sâu theo ngày mà không vòng lặp hoặc báo đủ sai.
// SPEC: docs/03_SPEC/SPEC-007_HistoryAndOrderedDelivery.md (PROMPT-007)
import assert from "node:assert/strict";
import { test } from "node:test";
import { collectGroupHistory, collectCommunityHistory } from "./history-range.js";
import { fetchRecentMessages } from "./history.js";

const msg = (id, ts) => ({ msgId: String(id), ts });
const options = { fromMs: 100, maxMessages: 20, initialCount: 2, pageDelayMs: 0 };

test("nhóm thường mở rộng số tin đến mốc ngày, giữ tin duy nhất", async () => {
  const counts = [];
  const all = [msg(4, 400), msg(3, 300), msg(2, 200), msg(1, 50)];
  const result = await collectGroupHistory(async (count) => {
    counts.push(count);
    return { groupMsgs: all.slice(0, count), hasMore: true };
  }, options);
  assert.deepEqual(counts, [2, 4]);
  assert.equal(result.groupMsgs.length, 4);
  assert.equal(result.historyCoverage.complete, true);
  assert.equal(result.historyCoverage.reason, "range_reached");
});

test("trang ngắn không đồng nghĩa đã lấy hết lịch sử", async () => {
  let calls = 0;
  const result = await collectGroupHistory(async () => {
    calls++;
    return { groupMsgs: [msg(1, 200)] };
  }, options);
  assert.equal(calls, 2);
  assert.equal(result.historyCoverage.complete, false);
  assert.equal(result.historyCoverage.reason, "no_progress");
});

test("Community theo cursor chuỗi lớn, chống trùng và dừng sau mốc ngày", async () => {
  const cursors = [];
  const result = await collectCommunityHistory(async (cursor) => {
    cursors.push(cursor);
    return cursors.length === 1
      ? { groupMsgs: [msg(3, 300), msg(2, 200)], hasMore: true, lastMsgId: "90071992547409931" }
      : { groupMsgs: [msg(2, 200), msg(1, 50)], hasMore: true, lastMsgId: "90071992547409930" };
  }, options);
  assert.deepEqual(cursors, [0, "90071992547409931"]);
  assert.equal(result.groupMsgs.length, 3);
  assert.equal(result.historyCoverage.complete, true);
});

test("Community dừng khi cursor quay vòng dù mỗi trang vẫn có tin mới", async () => {
  let calls = 0;
  const result = await collectCommunityHistory(async () => {
    calls++;
    return { groupMsgs: [msg(calls, 200 + calls)], hasMore: true, lastMsgId: calls % 2 ? "a" : "b" };
  }, options);
  assert.equal(calls, 3);
  assert.equal(result.historyCoverage.reason, "no_progress");
});

test("giữ dữ liệu và báo thiếu khi trang sau lỗi", async () => {
  let calls = 0;
  const result = await collectCommunityHistory(async () => {
    if (++calls === 2) throw new Error("network unavailable");
    return { groupMsgs: [msg(1, 200)], hasMore: true, lastMsgId: "next" };
  }, options);
  assert.equal(result.groupMsgs.length, 1);
  assert.equal(result.historyCoverage.reason, "request_error");
  assert.equal(result.historyCoverage.complete, false);
});

test("giới hạn tài nguyên trả kết quả thiếu thay vì vòng lặp", async () => {
  const result = await collectCommunityHistory(async () => ({
    groupMsgs: [msg(1, 200), msg(2, 300)], hasMore: true, lastMsgId: "next",
  }), { ...options, maxMessages: 2 });
  assert.equal(result.historyCoverage.reason, "message_limit");
  assert.equal(result.historyCoverage.complete, false);
});

test("timeout trang sau vẫn trả trang đầu và không treo", async () => {
  let calls = 0;
  const result = await collectCommunityHistory(async () => {
    if (++calls === 2) return new Promise(() => {});
    return { groupMsgs: [msg(1, 200)], hasMore: true, lastMsgId: "next" };
  }, { ...options, timeoutMs: 30 });
  assert.equal(result.historyCoverage.reason, "timeout");
  assert.equal(result.groupMsgs.length, 1);
});

test("nguồn xác nhận hết thì hoàn tất; lỗi trang đầu vẫn throw cho fallback", async () => {
  const result = await collectGroupHistory(async () => ({ groupMsgs: [], hasMore: false }), options);
  assert.equal(result.historyCoverage.complete, true);
  await assert.rejects(collectGroupHistory(async () => { throw new Error("404"); }, options), /404/);
});

test("fetchRecentMessages lọc đúng ngày và giữ metadata khi gom cụm", async () => {
  const batches = await fetchRecentMessages({ getGroupChatHistory: async () => ({
    groupMsgs: [msg(3, 300), msg(1, 50), { data: { msgId: "2", ts: 200, content: "Phòng P101" } }], hasMore: false,
  }) }, "source", { fromMs: 100, toMs: 250 });
  assert.equal(batches.historyCoverage.complete, true);
  assert.equal(batches.historyCoverage.received, 3);
  assert.equal(batches.flat().length, 1);
  assert.equal(batches.flat()[0].data.ts, 200);
});

test("fallback local luôn báo chưa xác minh đủ khoảng ngày", async () => {
  const batches = await fetchRecentMessages({ getGroupChatHistory: async () => { throw new Error("404"); } }, "source", {
    fromMs: 100, toMs: 300,
    communityFetch: async () => { throw new Error("Unavailable"); },
    storeQuery: () => [[{ data: { msgId: "1", ts: 200, content: "Phòng P101" } }]],
  });
  assert.equal(batches.historyCoverage.reason, "local_store");
  assert.equal(batches.historyCoverage.complete, false);
});
