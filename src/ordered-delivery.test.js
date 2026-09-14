// AI: Codex | WHY: chứng minh chuẩn bị song song không đảo thứ tự hoặc gửi sau lệnh dừng.
// SPEC: docs/03_SPEC/SPEC-007_HistoryAndOrderedDelivery.md (PROMPT-007)
import assert from "node:assert/strict";
import { test } from "node:test";
import { runOrderedDelivery } from "./ordered-delivery.js";

function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

test("chuẩn bị cụm sau khi cụm trước đang gửi; gửi luôn đúng thứ tự", async () => {
  const events = [];
  const nextPrepared = deferred();
  await runOrderedDelivery([1, 2, 3], {
    prepare: async (item) => { events.push(`prepare:${item}`); if (item === 2) nextPrepared.resolve(); return item; },
    send: async (item) => {
      events.push(`start:${item}`);
      if (item === 1) await nextPrepared.promise;
      events.push(`end:${item}`);
      return { sent: true };
    },
    onStart: () => {}, onResult: () => {}, shouldStop: () => false, dispose: () => {},
  });
  assert.deepEqual(events.filter((event) => /^(start|end):/.test(event)), ["start:1", "end:1", "start:2", "end:2", "start:3", "end:3"]);
  assert.ok(events.indexOf("prepare:2") < events.indexOf("end:1"));
  assert.ok(events.indexOf("prepare:3") > events.indexOf("end:1"));
});

test("dừng sau cụm hiện tại hủy tải trước và dọn media, không gửi cụm sau", async () => {
  const nextStarted = deferred();
  let stop = false;
  let aborted = false;
  const disposed = [];
  const sent = [];
  await runOrderedDelivery([1, 2, 3], {
    prepare: async (item, signal) => {
      if (item === 2) {
        nextStarted.resolve();
        await new Promise((resolve) => signal.addEventListener("abort", () => { aborted = true; resolve(); }, { once: true }));
      }
      return item;
    },
    send: async (item) => { sent.push(item); await nextStarted.promise; stop = true; return { sent: true }; },
    onStart: () => {}, onResult: () => {}, shouldStop: () => stop,
    dispose: (media) => disposed.push(media),
  });
  assert.deepEqual(sent, [1]);
  assert.equal(aborted, true);
  assert.deepEqual(disposed, [1, 2]);
});

test("lỗi chuẩn bị và lỗi gửi báo theo từng cụm, không chặn cụm còn lại", async () => {
  const results = [];
  await runOrderedDelivery([1, 2, 3], {
    prepare: async (item) => { if (item === 1) throw new Error("prepare failed"); return item; },
    send: async (item) => { if (item === 2) throw new Error("send failed"); return { sent: true }; },
    onStart: () => {}, shouldStop: () => false, dispose: () => {},
    onResult: (item, outcome) => results.push([item, Boolean(outcome.sent), Boolean(outcome.error)]),
  });
  assert.deepEqual(results, [[1, false, true], [2, false, true], [3, true, false]]);
});

test("onResult còn đang nghỉ thì không gửi cụm tiếp, chỉ tải trước một cụm", async () => {
  const events = [];
  await runOrderedDelivery([1, 2, 3], {
    prepare: async (item) => { events.push(`prepare:${item}`); return item; },
    send: async (item) => { events.push(`send:${item}`); return { sent: true }; },
    onStart: () => {}, shouldStop: () => false, dispose: () => {},
    onResult: async (item) => {
      if (item === 1) {
        await Promise.resolve();
        assert.ok(!events.includes("send:2"));
        assert.ok(!events.includes("prepare:3"));
      }
    },
  });
});
