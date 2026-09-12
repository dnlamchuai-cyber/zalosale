// AI: Codex | WHY: đảm bảo xóa nhóm nguồn cũng xóa tin quét cũ, không thể gửi nhầm từ nhóm đã bỏ.
// SPEC: yêu cầu quản lý nhóm nguồn ngày 11/09/2026
import assert from "node:assert/strict";
import { test } from "node:test";
import { isSentScanPost, pruneScanSources, removeScanPosts } from "./listener.js";

test("bỏ dữ liệu quét và raw payload của nhóm nguồn đã xóa", () => {
  const scan = {
    groups: 2,
    posts: [{ id: "keep", tid: "source-keep" }, { id: "remove", tid: "source-remove" }],
    raw: new Map([["keep", { tid: "source-keep" }], ["remove", { tid: "source-remove" }]]),
    fullBuildings: [{ threadId: "source-keep", key: "a" }, { threadId: "source-remove", key: "b" }],
  };

  assert.equal(pruneScanSources(scan, (sourceId) => sourceId === "source-keep"), true);
  assert.deepEqual(scan.posts.map((post) => post.id), ["keep"]);
  assert.deepEqual([...scan.raw.keys()], ["keep"]);
  assert.deepEqual(scan.fullBuildings.map((notice) => notice.threadId), ["source-keep"]);
  assert.equal(scan.groups, 1);
});

test("xóa ngay payload của tin đã gửi khỏi danh sách quét", () => {
  const scan = {
    groups: 2,
    posts: [{ id: "sent", tid: "source-a" }, { id: "pending", tid: "source-b" }],
    raw: new Map([["sent", { tid: "source-a" }], ["pending", { tid: "source-b" }]]),
    fullBuildings: [],
  };

  assert.equal(removeScanPosts(scan, new Set(["sent"])), true);
  assert.deepEqual(scan.posts.map((post) => post.id), ["pending"]);
  assert.deepEqual([...scan.raw.keys()], ["pending"]);
  assert.equal(scan.groups, 1);
});

test("nhận diện tin đã gửi: khớp nội dung ngắn hoặc khớp mọi ID tin (bảng cắt 400 ký tự)", async () => {
  const no = async () => false;
  const zero = async () => 0;
  // Tin ngắn khớp nội dung là đủ.
  assert.equal(
    await isSentScanPost({ id: "a", tid: "s", clean: "ngắn" }, [], async () => true, zero),
    true,
  );
  // Tin dài: nội dung cắt 400 ký tự không khớp, nhưng mọi ID tin đều đã gửi.
  const longClean = `x`.repeat(400);
  const items = [{ data: { msgId: "m1" } }, { data: { cliMsgId: "m2" } }];
  assert.equal(
    await isSentScanPost({ id: "b", tid: "s", clean: longClean }, items, no, async (ids) => ids.length),
    true,
  );
  // Thiếu 1 ID chưa gửi thì giữ lại.
  assert.equal(
    await isSentScanPost({ id: "c", tid: "s", clean: longClean }, items, no, async () => 1),
    false,
  );
  // Không nội dung, không ID thì giữ lại.
  assert.equal(await isSentScanPost({ id: "d", tid: "s" }, [], no, zero), false);
});
