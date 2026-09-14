// AI: Codex | WHY: kiểm chứng kho kết quả quét được khôi phục sau khi khởi động lại.
// SPEC: yêu cầu “Quét & chọn tin để gửi” ngày 2026-09-10
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { readPersistedScan, writePersistedScan } from "./scan-state.js";

test("lưu và đọc lại scan hiện tại cùng raw items để gửi tiếp", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "zalosale-scan-"));
  const filePath = path.join(directory, "scan-state.json");
  const scan = {
    scanId: "scan-1",
    scanQueryKey: "nguon-a|",
    range: { fromMs: 1, toMs: 2 },
    groups: 1,
    posts: [{ id: "post-1", tid: "source-1", name: "Nguồn A", status: "pending", ts: 1 }],
    raw: new Map([["post-1", { tid: "source-1", items: [{ data: { content: "Mã P101", ts: 1 } }, { data: { originUrl: "https://example.test/p101.jpg", ts: 2 } }], batchMeta: { segmentType: "building" } }]]),
    fullBuildings: [],
    historyCoverage: [{ threadId: "source-1", sourceName: "Nguồn A", complete: false, reason: "no_progress", received: 1500, oldestTs: 1 }],
  };

  await writePersistedScan(filePath, scan);
  const restored = await readPersistedScan(filePath);

  assert.equal(restored.scanId, "scan-1");
  assert.deepEqual(restored.posts, scan.posts);
  assert.deepEqual(restored.historyCoverage, scan.historyCoverage);
  assert.deepEqual(restored.raw.get("post-1"), scan.raw.get("post-1"));
  await fs.rm(directory, { recursive: true, force: true });
});

test("đọc scan cũ và đổi trạng thái mơ hồ thành lý do cụ thể", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "zalosale-scan-"));
  const filePath = path.join(directory, "scan-state.json");
  await fs.writeFile(filePath, JSON.stringify({
    scanId: "scan-cũ",
    posts: [{ id: "text-only", tid: "source-1", status: "no_images", ts: 1 }],
    raw: [{ postId: "text-only", tid: "source-1", items: [{ data: { content: "Chỉ là thông báo", ts: 1 } }], batchMeta: { segmentType: "building" } }],
  }), "utf8");

  const restored = await readPersistedScan(filePath);
  assert.equal(restored.posts[0].status, "text_only");
  await fs.rm(directory, { recursive: true, force: true });
});
