// AI: Codex | WHY: tải trước một cụm nhưng chỉ cho một cụm gửi, để không đảo thứ tự.
// SPEC: docs/03_SPEC/SPEC-007_HistoryAndOrderedDelivery.md (PROMPT-007)
function startPreparation(item, prepare) {
  const controller = new AbortController();
  // Gắn nhánh lỗi ngay: tải trước có thể thất bại trong lúc đang gửi cụm hiện tại.
  const promise = Promise.resolve().then(() => prepare(item, controller.signal)).then(
    (media) => ({ media }),
    (error) => ({ error }),
  );
  return { controller, promise };
}

async function sendPrepared(item, prepared, send, dispose) {
  try {
    if (prepared.error) return { sent: false, error: true };
    return await send(item, prepared.media);
  } catch {
    return { sent: false, error: true };
  } finally {
    await dispose(prepared.media);
  }
}

export async function runOrderedDelivery(items, { prepare, send, onStart, onResult, shouldStop, dispose }) {
  if (!items.length || shouldStop()) return;
  let pending = startPreparation(items[0], prepare);
  try {
    for (let index = 0; index < items.length; index++) {
      if (shouldStop()) break;
      onStart(items[index], index);
      const prepared = await pending.promise;
      pending = index + 1 < items.length && !shouldStop()
        ? startPreparation(items[index + 1], prepare) : null;
      const outcome = await sendPrepared(items[index], prepared, send, dispose);
      await onResult(items[index], outcome, index);
    }
  } finally {
    if (pending) {
      pending.controller.abort();
      const prepared = await pending.promise;
      await dispose(prepared.media);
    }
  }
}
