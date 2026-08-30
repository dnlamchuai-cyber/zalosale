import { EventEmitter } from "events";

/**
 * Gom các tin nhắn liên tiếp (text + cụm ảnh) của cùng 1 nhóm nguồn
 * thành 1 "bài đăng" duy nhất.
 * - Cửa sổ windowMs sau tin cuối (idle) thì flush
 * - Đủ maxBatchItems thì flush sớm
 * - Quá maxWaitMs kể từ tin đầu thì flush
 */
export class Batcher extends EventEmitter {
  constructor({ windowMs, maxBatchItems, maxWaitMs }) {
    super();
    this.windowMs = windowMs;
    this.maxBatchItems = maxBatchItems;
    this.maxWaitMs = maxWaitMs;
    this.batches = new Map();
  }

  add(threadId, item) {
    const now = Date.now();
    let batch = this.batches.get(threadId);
    if (!batch) {
      batch = { threadId, items: [], startedAt: now, timer: null };
      this.batches.set(threadId, batch);
    }
    batch.items.push(item);
    clearTimeout(batch.timer);

    if (batch.items.length >= this.maxBatchItems) {
      this.flush(threadId);
      return;
    }
    const elapsed = now - batch.startedAt;
    if (elapsed >= this.maxWaitMs) {
      this.flush(threadId);
      return;
    }
    const wait = Math.min(this.windowMs, this.maxWaitMs - elapsed);
    batch.timer = setTimeout(() => this.flush(threadId), wait);
    if (batch.timer.unref) batch.timer.unref();
  }

  flush(threadId) {
    const batch = this.batches.get(threadId);
    if (!batch) return;
    clearTimeout(batch.timer);
    this.batches.delete(threadId);
    if (batch.items.length) {
      this.emit("batch", { threadId: batch.threadId, items: batch.items });
    }
  }

  flushAll() {
    for (const id of [...this.batches.keys()]) this.flush(id);
  }
}