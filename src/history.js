// AI: Codex | WHY: lấy lịch sử theo ngày, trả độ đầy đủ cùng kết quả gom cụm.
// SPEC: docs/03_SPEC/SPEC-007_HistoryAndOrderedDelivery.md (PROMPT-007)
import { logger } from "./logger.js";
import { collectGroupHistory, attachHistoryCoverage, localHistoryCoverage, MAX_HISTORY_MESSAGES } from "./history-range.js";
import { Batcher, isMediaItem, isRoomLabel } from "./batcher.js";
import { buildingNoticeMatchesText } from "./full-building.js";
import { isStickerMessage } from "./closing-sticker.js";
import { loadRulesCached } from "./features/location-rules/repository.js";

// WHY: Zalo đôi lúc trả mô tả tòa và album/list phòng thành hai run lịch sử
// cách nhau hơn maxWaitMs, dù cùng một bài; chỉ nối tiếp trong cửa sổ ngắn.
const HISTORY_FOLLOW_UP_MAX_GAP_MS = 10 * 60 * 1000;

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
    const fromMs = startOfDay(now.getTime() - (days - 1) * 86400000);
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
 * Mở rộng số tin nhóm thường, phân trang Community đến mốc ngày;
 * historyCoverage cho biết nguồn đã trả đủ hay dừng do giới hạn/lỗi.
 */
export async function fetchRecentMessages(
  api,
  threadId,
  {
    fromMs,
    toMs = Date.now(),
    gapMs = 10000,
    maxBatchItems = 10,
    maxWaitMs = 120000,
    areas = [],
    defaultArea = null,
    count = MAX_HISTORY_MESSAGES,
    communityFetch,
    storeQuery,
    rules = [],
  } = {}
) {
  if (!isFinite(fromMs)) throw new Error("Thiếu fromMs (mốc thời gian bắt đầu)");

  // Thử group/history trước, nếu 404 thì thử community (CM)
  let res;
  try {
    res = await collectGroupHistory((requested) => api.getGroupChatHistory(threadId, requested), { fromMs, maxMessages: count });
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
        res = await getCommunityHistory(threadId, count, { fromMs });
        logger.info(`Community history OK cho ${threadId}`);
      } catch (e2) {
        logger.warn(`Community history cũng lỗi (${e2.message}) — thử đọc từ store local`);
        try {
          let query = storeQuery;
          if (!query) ({ query } = await import("./store.js"));
          const batches = query({ fromMs, toMs, sourceIds: [String(threadId)] });
          if (batches.length) {
            logger.info(`Đọc từ store: ${batches.length} bài trong khoảng (fallback)`);
            return localHistoryCoverage(batches);
          }
          logger.warn("Store fallback không có dữ liệu — giữ lỗi Community gốc");
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
          if (batches.length) {
            logger.info(`Đọc từ store: ${batches.length} bài trong khoảng (fallback)`);
            return localHistoryCoverage(batches);
          }
          logger.warn("Store fallback không có dữ liệu — giữ lỗi adapter gốc");
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
  const coverage = res?.historyCoverage ?? {
    complete: false, reason: "unknown", received: items.length, oldestTs: null,
  };
  logger.info(
    `Quét lịch sử: nhận ${items.length} tin, trong khoảng ${inRange.length} tin` +
      (coverage.complete ? "" : ` (⚠️ chưa xác minh đủ khoảng ngày: ${coverage.reason})`)
  );
  const chronological = inRange
    .map((message, sourceIndex) => ({ message, sourceIndex }))
    .sort((left, right) => tsOf(left.message) - tsOf(right.message) || left.sourceIndex - right.sourceIndex)
    .map(({ message }) => message);
  const batches = segmentMessages(chronological, {
    threadId,
    gapMs,
    maxBatchItems,
    maxWaitMs,
    areas,
    defaultArea,
    rules,
  });
  return attachHistoryCoverage(batches, coverage);
}

/** Quét + gom bài đăng theo cấu hình forward của bot (dùng chung cho preview và forward) */
export function fetchRecentBatches(api, threadId, range, config) {
  // WHY: quét lịch sử thấy toàn cảnh — chùm ảnh 10-20 tin không được xả sớm làm
  // vỡ cụm phòng trước khi tin mở cụm tới (SPEC-005 roomPrefix). Live vẫn giữ cap nhỏ.
  const historyBatchCap = Math.max(Number(config.forward.maxBatchItems) || 10, 30);
  let rules = [];
  try {
    rules = loadRulesCached().rules;
  } catch {}
  return fetchRecentMessages(api, threadId, {
    fromMs: range.fromMs,
    toMs: range.toMs,
    gapMs: config.forward.historyGapMs,
    maxBatchItems: historyBatchCap,
    maxWaitMs: config.forward.maxWaitMs,
    areas: config.areas,
    defaultArea: config.defaultArea,
    rules,
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
    forwarder.enqueue({ threadId, items, source: "history", ...(items.batchMeta || {}) });
    count++;
  }
  return count;
}

function batchHasText(items) {
  return (items || []).some((it) => typeof it?.data?.content === "string"
    && it.data.content.trim()
    && !isStickerMessage(it?.data ?? it));
}

function batchHasOnlyRoomLabels(items) {
  const segmentType = items?.batchMeta?.segmentType;
  if (segmentType === "building" || segmentType === "lead") return false;
  if ((items || []).some((it) => isMediaItem(it))) return false;
  const texts = (items || [])
    .filter((it) => !isStickerMessage(it?.data ?? it))
    .map((it) => (typeof it?.data?.content === "string" ? it.data.content.trim() : ""))
    .filter(Boolean);
  return texts.length > 0 && texts.every((text) => !/[\r\n]/.test(text) && isRoomLabel(text));
}

function batchTextIsOnlyRoomLabels(items) {
  const segmentType = items?.batchMeta?.segmentType;
  if (segmentType === "building" || segmentType === "lead") return false;
  const texts = (items || [])
    .filter((it) => !isStickerMessage(it?.data ?? it))
    .map((it) => (typeof it?.data?.content === "string" ? it.data.content.trim() : ""))
    .filter(Boolean);
  return texts.length > 0 && texts.every((text) => !/[\r\n]/.test(text) && isRoomLabel(text));
}

function quoteCliId(item) {
  const q = item?.data?.quote;
  if (!q || typeof q !== "object") return "";
  return String(q.cliMsgId || "");
}

/**
 * Gắn chùm chỉ-có-ảnh mồ côi sau khi tách cụm:
 * (a) tin mở reply trỏ ảnh nào → gộp ảnh đó vào cụm mở (tin mở đứng đầu);
 * (b) ảnh lẻ cuối run, sau cụm có chữ → gộp vào cụm chữ trước nó. Cho phép
 *     băng qua ranh giới thời gian của history nếu không có cụm chữ nào chen
 *     giữa, vì Zalo đôi khi trả album thành một run riêng.
 * Không gộp khi có cụm chữ khác đứng sau trong run (thuộc về cụm sau, tránh gửi nhầm).
 */
export function attachOrphanPhotoBatches(batches, runBounds) {
  const runOf = (i) => {
    for (let r = 0; r < runBounds.length - 1; r++) {
      if (i >= runBounds[r] && i < runBounds[r + 1]) return r;
    }
    return -1;
  };
  const consumed = new Set();
  // (a) reply-quote: ảnh được tin mở sau quote thì về cụm mở đó.
  const photoIdxByCli = new Map();
  batches.forEach((b, i) => {
    if (batchHasText(b)) return;
    for (const it of b) {
      const c = it?.data?.cliMsgId;
      if (c) photoIdxByCli.set(String(c), i);
    }
  });
  batches.forEach((b, j) => {
    for (const it of b) {
      const pi = photoIdxByCli.get(quoteCliId(it));
      if (pi === undefined || pi === j || consumed.has(pi)) continue;
      if (!quoteCliId(it) || runOf(pi) !== runOf(j)) continue;
      // Giữ tin mở đứng đầu, ảnh quote chèn ngay sau nó.
      const hostTextIdx = b.findIndex((x) => typeof x?.data?.content === "string" && x.data.content.trim());
      if (hostTextIdx < 0) continue;
      b.splice(hostTextIdx + 1, 0, ...batches[pi]);
      consumed.add(pi);
    }
  });
  // (b) ảnh lẻ sau tin mở: đưa về cụm chữ gần nhất phía trước. Một tin mở
  // đến ở run sau không được làm album này thành cụm mồ côi; chỉ khi album
  // nằm giữa hai cụm chữ trong cùng run mới giữ tách để tránh gửi nhầm.
  for (let i = 0; i < batches.length; i++) {
    if (consumed.has(i) || batchHasText(batches[i])) continue;
    let hasOtherTextInSameRun = false;
    const mediaRun = runOf(i);
    for (let j = i + 1; j < batches.length; j++) {
      if (runOf(j) !== mediaRun) break;
      if (!consumed.has(j) && batchHasText(batches[j]) && !batchTextIsOnlyRoomLabels(batches[j])) hasOtherTextInSameRun = true;
    }
    if (hasOtherTextInSameRun) continue;
    let host = -1;
    for (let j = i - 1; j >= 0; j--) {
      if (consumed.has(j)) continue;
      if (batchHasText(batches[j])) {
        host = j;
        break;
      }
    }
    if (host < 0) continue;
    batches[host].push(...batches[i]);
    consumed.add(i);
  }
  return batches.filter((_, i) => !consumed.has(i));
}

/**
 * Nhãn phòng một dòng có thể bị xả thành run riêng khi người đăng ngắt quãng.
 * Không có tin mở cụm thật thì nối nhãn vào bài ngay trước, để ảnh/sticker
 * của bài đó vẫn được gửi cùng mô tả phòng thay vì tạo một bài mồ côi.
 */
export function attachOrphanRoomLabelBatches(batches) {
  const consumed = new Set();
  for (let i = 0; i < batches.length; i++) {
    if (consumed.has(i) || !batchHasOnlyRoomLabels(batches[i])) continue;
    let host = i - 1;
    let textHost = -1;
    while (host >= 0) {
      if (!consumed.has(host) && batchHasText(batches[host])) {
        textHost = host;
        break;
      }
      host--;
    }
    // Ưu tiên cụm có chữ gần nhất; nếu trước đó chỉ còn album ảnh thì nối
    // vào album liền trước để không làm mất mô tả phòng một dòng.
    host = textHost >= 0 ? textHost : i - 1;
    while (host >= 0 && consumed.has(host)) host--;
    if (host < 0) continue;
    batches[host].push(...batches[i]);
    consumed.add(i);
  }
  return batches.filter((_, i) => !consumed.has(i));
}

function isOpeningBatch(items) {
  return items?.batchMeta?.segmentType === "building" && batchHasText(items);
}

function isMediaFollowUp(items) {
  const segmentType = items?.batchMeta?.segmentType;
  if (segmentType === "building" || segmentType === "lead") return false;
  return (items || []).some((item) => isMediaItem(item));
}

function hasRoomLabel(items) {
  return (items || []).some((item) => {
    const content = item?.data?.content;
    return typeof content === "string" && isRoomLabel(content);
  });
}

function latestBatchTimestamp(items) {
  return Math.max(...(items || []).map(tsOf).filter(Number.isFinite), 0);
}

/**
 * Một tin mở cụm có thể được Zalo tách khỏi list phòng/album kế tiếp chỉ vì
 * quá khoảng flush lịch sử. Chỉ nhập khi chúng sát nhau, cùng nguồn và phần
 * sau không tự mở cụm mới; 10 phút đủ cho ảnh/list gửi chậm nhưng không kéo
 * qua một bài mở tòa khác.
 */
export function attachShortFollowUpBatches(batches) {
  const consumed = new Set();
  for (let host = 0; host < batches.length; host++) {
    if (!isOpeningBatch(batches[host])) continue;
    let previousEnd = latestBatchTimestamp(batches[host]);
    let hasRoomEvidence = false;
    for (let candidate = host + 1; candidate < batches.length; candidate++) {
      if (consumed.has(candidate) || !isMediaFollowUp(batches[candidate])) break;
      const candidateStart = Math.min(...batches[candidate].map(tsOf).filter(Number.isFinite));
      if (!Number.isFinite(candidateStart) || candidateStart - previousEnd > HISTORY_FOLLOW_UP_MAX_GAP_MS) break;
      // Album trần không đủ để suy đoán: batch đầu tiên phải kèm mã/list phòng.
      if (!hasRoomEvidence && !hasRoomLabel(batches[candidate])) break;
      batches[host].push(...batches[candidate]);
      previousEnd = latestBatchTimestamp(batches[candidate]);
      hasRoomEvidence = true;
      consumed.add(candidate);
    }
  }
  return batches.filter((_, index) => !consumed.has(index));
}

export function segmentMessages(
  messages,
  { threadId = "history", gapMs = 10000, maxBatchItems = 10, maxWaitMs = 120000, areas = [], defaultArea = null, rules = [] } = {}
) {
  const batches = [];
  const batcher = new Batcher({
    windowMs: gapMs,
    maxBatchItems,
    maxWaitMs,
    areas,
    defaultArea,
    rules,
  });
  batcher.on("batch", ({ items }) => batches.push(items));
  let prevTs = null;
  const effectiveGap = Math.max(gapMs, maxWaitMs);
  const runBounds = [0];
  for (const message of messages) {
    const t = tsOf(message);
    const delta = prevTs === null ? 0 : t - prevTs;
    if (prevTs !== null && (delta >= effectiveGap || delta < -5000)) {
      batcher.flush(threadId);
      runBounds.push(batches.length);
    }
    batcher.add(threadId, message);
    prevTs = t;
  }
  batcher.flushAll();
  runBounds.push(batches.length);
  const merged = attachShortFollowUpBatches(
    attachOrphanRoomLabelBatches(attachOrphanPhotoBatches(batches, runBounds))
  );
  const activeBatches = merged.filter((items) => {
    const text = items
      .filter((item) => typeof item?.data?.content === "string")
      .map((item) => item.data.content)
      .join("\n\n");
    return !batcher.isBuildingFull(threadId, items.batchMeta?.buildingKey, text);
  });
  Object.defineProperty(activeBatches, "fullBuildingNotices", {
    value: batcher.fullBuildingNotices,
    enumerable: false,
  });
  return activeBatches;
}
