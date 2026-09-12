// AI: Codex | WHY: đảm bảo xóa nhóm nguồn cũng xóa tin quét cũ, không thể gửi nhầm từ nhóm đã bỏ.
// SPEC: yêu cầu quản lý nhóm nguồn ngày 11/09/2026
import assert from "node:assert/strict";
import { test } from "node:test";
import { pruneScanSources, removeScanPosts } from "./listener.js";

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
