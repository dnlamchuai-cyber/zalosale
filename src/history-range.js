// AI: Codex | WHY: tách giới hạn tài nguyên và độ đầy đủ khỏi logic gom cụm.
// SPEC: docs/03_SPEC/SPEC-007_HistoryAndOrderedDelivery.md (PROMPT-007)
export const MAX_HISTORY_MESSAGES = 50000;
const HISTORY_TIMEOUT_MS = 120000;
const PAGE_DELAY_MS = 100;
const INITIAL_GROUP_COUNT = 1500;

export function historyTimestamp(message) {
  const data = message?.data ?? message ?? {};
  return Number(data.ts || data.timestamp || data.createdTime || 0);
}

function messageKey(message) {
  const data = message?.data ?? message ?? {};
  const id = data.msgId ?? data.messageId ?? data.globalMsgId ?? data.cliMsgId;
  return id != null ? `id:${id}` : JSON.stringify(message);
}

function createState(options) {
  const requested = Number(options.maxMessages);
  const limit = Number.isFinite(requested) && requested > 0
    ? Math.min(MAX_HISTORY_MESSAGES, Math.floor(requested)) : MAX_HISTORY_MESSAGES;
  return {
    limit, messages: [], ids: new Set(), oldestTs: null,
    fromMs: options.fromMs,
    deadline: Date.now() + (options.timeoutMs ?? HISTORY_TIMEOUT_MS),
    delayMs: options.pageDelayMs ?? PAGE_DELAY_MS,
  };
}

function appendPage(state, page) {
  if (!Array.isArray(page?.groupMsgs)) throw new Error("Invalid history response");
  for (const message of page.groupMsgs) {
    const key = messageKey(message);
    if (state.ids.has(key) || state.messages.length >= state.limit) continue;
    state.ids.add(key);
    state.messages.push(message);
    const ts = historyTimestamp(message);
    if (Number.isFinite(ts) && ts > 0) state.oldestTs = Math.min(state.oldestTs ?? ts, ts);
  }
}

function finish(state, reason) {
  return {
    groupMsgs: state.messages,
    historyCoverage: {
      complete: reason === "range_reached" || reason === "source_exhausted",
      reason, received: state.messages.length, oldestTs: state.oldestTs,
    },
  };
}

function stopReason(state, page, previousCount) {
  if (Number.isFinite(state.fromMs) && state.oldestTs !== null && state.oldestTs < state.fromMs) return "range_reached";
  if (page.hasMore === false && state.messages.length < state.limit) return "source_exhausted";
  if (state.messages.length >= state.limit) return "message_limit";
  if (state.messages.length === previousCount) return "no_progress";
  return null;
}

async function readPage(fetchPage, state) {
  const remaining = state.deadline - Date.now();
  if (remaining <= 0) throw Object.assign(new Error("History timeout"), { code: "HISTORY_TIMEOUT" });
  const controller = new AbortController();
  let timer;
  try {
    return await Promise.race([
      Promise.resolve().then(() => fetchPage(controller.signal)),
      new Promise((_, reject) => {
        timer = setTimeout(() => {
          reject(Object.assign(new Error("History timeout"), { code: "HISTORY_TIMEOUT" }));
          controller.abort();
        }, remaining);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

async function nextPagePause(state) {
  const delay = Math.min(state.delayMs, Math.max(0, state.deadline - Date.now()));
  if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));
}

function partialOrThrow(error, state) {
  if (!state.messages.length) throw error;
  return finish(state, error.code === "HISTORY_TIMEOUT" ? "timeout" : "request_error");
}

export async function collectGroupHistory(fetchCount, options = {}) {
  const state = createState(options);
  let count = Math.min(state.limit, options.initialCount || INITIAL_GROUP_COUNT);
  while (true) {
    const previousCount = state.messages.length;
    try {
      const page = await readPage(() => fetchCount(count), state);
      appendPage(state, page);
      const reason = stopReason(state, page, previousCount);
      if (reason) return finish(state, reason);
      if (count === state.limit) return finish(state, "source_limit");
    } catch (error) {
      return partialOrThrow(error, state);
    }
    count = Math.min(state.limit, count * 2);
    await nextPagePause(state);
  }
}

export async function collectCommunityHistory(fetchPage, options = {}) {
  const state = createState(options);
  const cursors = new Set(["0"]);
  let cursor = 0;
  while (true) {
    const previousCount = state.messages.length;
    try {
      const page = await readPage((signal) => fetchPage(cursor, state.limit - state.messages.length, signal), state);
      appendPage(state, page);
      const reason = stopReason(state, page, previousCount);
      if (reason) return finish(state, reason);
      const nextCursor = page.lastMsgId;
      if (nextCursor == null || nextCursor === "" || cursors.has(String(nextCursor))) return finish(state, "no_progress");
      cursors.add(String(nextCursor));
      cursor = nextCursor;
    } catch (error) {
      return partialOrThrow(error, state);
    }
    await nextPagePause(state);
  }
}

export function attachHistoryCoverage(batches, coverage) {
  Object.defineProperty(batches, "historyCoverage", { value: coverage, enumerable: false });
  return batches;
}

export function localHistoryCoverage(batches) {
  const messages = batches.flat();
  const oldestTs = messages.reduce((oldest, message) => {
    const ts = historyTimestamp(message);
    return ts > 0 ? Math.min(oldest ?? ts, ts) : oldest;
  }, null);
  return attachHistoryCoverage(batches, { complete: false, reason: "local_store", received: messages.length, oldestTs });
}
