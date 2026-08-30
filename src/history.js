import { logger } from "./logger.js";

function tsOf(msg) {
  const d = msg?.data ?? msg ?? {};
  return Number(d.ts || d.timestamp || d.createdTime || 0);
}

export function startOfDay(d) {
  const t = new Date(d);
  t.setHours(0, 0, 0, 0);
  return t.getTime();
}

export function endOfDay(d) {
  const t = new Date(d);
  t.setHours(23, 59, 59, 999);
  return t.getTime();
}

/** Hỗ trợ định dạng: dd/MM/yyyy, dd/MM (năm hiện tại), yyyy-MM-dd (date input) */
export function parseDateInput(s) {
  const str = String(s ?? "").trim();
  let m;
  if ((m = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/))) {
    const d = Number(m[1]);
    const mo = Number(m[2]);
    const y = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
    const t = new Date(y, mo - 1, d);
    return t.getMonth() === mo - 1 ? t : null;
  }
  if ((m = str.match(/^(\d{1,2})\/(\d{1,2})$/))) {
    const d = Number(m[1]);
    const mo = Number(m[2]);
    const t = new Date(new Date().getFullYear(), mo - 1, d);
    return t.getMonth() === mo - 1 ? t : null;
  }
  if ((m = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/))) {
    const y = Number(m[1]);
    const mo = Number(m[2]);
    const d = Number(m[3]);
    const t = new Date(y, mo - 1, d);
    return t.getFullYear() === y && t.getMonth() === mo - 1 ? t : null;
  }
  return null;
}

/** Chuyển tham số (days | from/to) thành khoảng ms. Trả {fromMs, toMs, error, label} */
export function resolveRange({ days, from, to } = {}) {
  const now = new Date();
  if (typeof days === "number" && Number.isFinite(days)) {
    if (days <= 0) return { error: `Số ngày phải lớn hơn 0 (nhận: ${days})` };
    if (days > 60) return { error: `Số ngày quá dài (${days}). Tối đa 60 ngày.` };
    const fromMs = startOfDay(now.getTime() - days * 86400000);
    const toMs = endOfDay(now);
    return {
      fromMs,
      toMs,
      error: null,
      label: `${fmtDate(fromMs)} → ${fmtDate(toMs)} (${days} ngày)`,
    };
  }
  const fromDate = from ? parseDateInput(from) : null;
  const toDate = to ? parseDateInput(to) : null;
  if (from && !fromDate) return { error: `Ngày bắt đầu không hợp lệ: "${from}" (dd/MM/yyyy hoặc yyyy-MM-dd)` };
  if (to && !toDate) return { error: `Ngày kết thúc không hợp lệ: "${to}"` };
  const fromMs = fromDate ? startOfDay(fromDate) : startOfDay(now);
  const toMs = toDate ? endOfDay(toDate) : endOfDay(now);
  if (toMs < fromMs) return { error: "Ngày kết thúc phải sau ngày bắt đầu" };
  const rangeDays = Math.floor((toMs - fromMs) / 86400000) + 1;
  if (rangeDays > 60) return { error: `Khoảng thời gian quá dài (${rangeDays} ngày). Tối đa 60 ngày.` };
  return { fromMs, toMs, error: null, label: `${fmtDate(fromMs)} → ${fmtDate(toMs)} (${rangeDays} ngày)` };
}

export function fmtDate(ms) {
  const t = new Date(ms);
  return `${String(t.getDate()).padStart(2, "0")}/${String(t.getMonth() + 1).padStart(2, "0")}/${t.getFullYear()}`;
}

/**
 * Lấy lịch sử trong khoảng {fromMs → toMs} của nhóm + gom thành các bài đăng
 * (text + cụm ảnh nằm trong khoảng gapMs coi là 1 bài).
 * Lưu ý: zca-js 2.1.2 giới hạn API là tin mới nhất (count tin) — không phân trang theo ngày,
 * nên khoảng quá dài có thể thiếu tin cũ (cảnh báo trong log).
 */
export async function fetchRecentMessages(
  api,
  threadId,
  {
    fromMs,
    toMs = Date.now(),
    gapMs = 10000,
    maxBatchItems = 10,
    count = 1500,
    communityFetch,
    storeQuery,
  } = {}
) {
  if (!isFinite(fromMs)) throw new Error("Thiếu fromMs (mốc thời gian bắt đầu)");

  // Thử group/history trước, nếu 404 thì thử community (CM)
  let res;
  try {
    res = await api.getGroupChatHistory(threadId, count);
  } catch (e) {
    const msg = String(e?.message || "") + " " + String(e?.code || "");
    const isNotFound = msg.includes("404");
    if (isNotFound) {
      logger.warn(`getGroupChatHistory 404 cho ${threadId} — thử Community (cm/getrecentv2)`);
      try {
        let getCommunityHistory = communityFetch;
        if (!getCommunityHistory) {
          const { getCommunityHistoryFactory } = await import("./community.js");
          const ctx = api.listener?.ctx || api._ctx || api.ctx;
          if (!ctx) throw new Error("No ctx for community history");
          getCommunityHistory = getCommunityHistoryFactory(ctx, api);
        }
        res = await getCommunityHistory(threadId, count);
        logger.info(`Community history OK cho ${threadId}`);
      } catch (e2) {
        logger.warn(`Community history cũng lỗi (${e2.message}) — thử đọc từ store local`);
        try {
          let query = storeQuery;
          if (!query) ({ query } = await import("./store.js"));
          const batches = query({ fromMs, toMs, sourceIds: [String(threadId)] });
          logger.info(`Đọc từ store: ${batches.length} bài trong khoảng (fallback)`);
          return batches;
        } catch (e3) {
          logger.warn(`Đọc store cũng lỗi: ${e3.message}`);
        }
        throw e2;
      }
    } else {
      // lỗi khác (không phải 404) → thử store luôn nếu là network
      const isFallback = msg.includes("fetch failed") || msg.includes("ENOTFOUND") || msg.includes("Failed");
      if (isFallback) {
        logger.warn(`getGroupChatHistory lỗi (${e.message}) — thử đọc từ store local`);
        try {
          const { query } = await import("./store.js");
          const batches = query({ fromMs, toMs, sourceIds: [String(threadId)] });
          logger.info(`Đọc từ store: ${batches.length} bài trong khoảng (fallback)`);
          return batches;
        } catch (e2) {
          logger.warn(`Đọc store cũng lỗi: ${e2.message}`);
        }
      }
      throw e;
    }
  }
  const items = Array.isArray(res?.groupMsgs) ? res.groupMsgs : [];
  const inRange = items.filter((m) => {
    if (m?.isSelf || m?.data?.isSelf) return false;
    const t = tsOf(m);
    return t && t >= fromMs && t <= toMs;
  });
  const reachedEnd = res?.hasMore === false || items.length < count;
  logger.info(
    `Quét lịch sử: nhận ${items.length} tin, trong khoảng ${inRange.length} tin` +
      (reachedEnd ? "" : ` (⚠️ hết giới hạn ${count} tin, có thể thiếu tin cũ)`)
  );
  return groupIntoBatches(inRange.reverse(), gapMs, maxBatchItems);
}

/** Quét + gom bài đăng theo cấu hình forward của bot (dùng chung cho preview và forward) */
export function fetchRecentBatches(api, threadId, range, config) {
  return fetchRecentMessages(api, threadId, {
    fromMs: range.fromMs,
    toMs: range.toMs,
    gapMs: config.forward.historyGapMs,
    maxBatchItems: config.forward.maxBatchItems,
  });
}

/**
 * Quét lịch sử nhóm trong khoảng ngày → gom bài → đưa từng bài vào hàng đợi forwarder.
 * Trả về số bài đã đưa vào hàng đợi.
 */
export async function scanGroupRange(api, threadId, range, forwarder, config) {
  const batches = await fetchRecentBatches(api, threadId, range, config);
  let count = 0;
  for (const items of batches) {
    forwarder.enqueue({ threadId, items, source: "history" });
    count++;
  }
  return count;
}

function groupIntoBatches(messages, gapMs, maxBatchItems) {
  const batches = [];
  let cur = [];
  let prevTs = null;

  for (const m of messages) {
    const t = tsOf(m);
    const cut = cur.length && (prevTs === null || t - prevTs > gapMs || t - prevTs < -5000);
    if (cut || cur.length >= maxBatchItems) {
      if (cur.length) batches.push(cur);
      cur = [];
    }
    cur.push(m);
    prevTs = t;
  }
  if (cur.length) batches.push(cur);
  return batches;
}
