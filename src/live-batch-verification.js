// Ai viết: Codex — xác minh bài AUTO chưa bị gỡ trước khi chuyển tiếp
// Tại sao: đọc ít lịch sử trước để giảm tải, nhưng luôn fallback đầy đủ để không bỏ sót nhóm đông tin
// Link: yêu cầu tối ưu AUTO ngày 2026-09-10

import { logger } from "./logger.js";

const QUICK_HISTORY_COUNT = 200;
const FULL_HISTORY_COUNT = 1500;
const MESSAGE_ID_KEYS = ["msgId", "msgID", "messageId", "cliMsgId", "globalMsgId", "id"];

function messageSignature(item) {
  const roots = [item?.raw, item?.data, item].filter(Boolean);
  for (const root of roots) {
    for (const key of MESSAGE_ID_KEYS) {
      const value = root?.[key];
      if (value !== undefined && value !== null && String(value)) return `id:${String(value)}`;
    }
  }
  const data = item?.data ?? item ?? {};
  const text = typeof data.content === "string" ? data.content : "";
  const timestamp = Number(data.ts || data.timestamp || data.createdTime || item?.ts || 0);
  const media = [data.normalUrl, data.href, data.url].filter(Boolean).join(",");
  return timestamp || text || media ? `fallback:${timestamp}|${text}|${media}` : null;
}

async function availableSignatures(api, threadId, count) {
  const response = await api.getGroupChatHistory(threadId, count);
  return new Set((response?.groupMsgs || []).map(messageSignature).filter(Boolean));
}

export async function isLiveBatchStillPresent(api, threadId, items) {
  const expected = items.map(messageSignature);
  if (expected.some((signature) => !signature)) return true;
  try {
    const quickHistory = await availableSignatures(api, threadId, QUICK_HISTORY_COUNT);
    if (expected.every((signature) => quickHistory.has(signature))) return true;

    const fullHistory = await availableSignatures(api, threadId, FULL_HISTORY_COUNT);
    return expected.every((signature) => fullHistory.has(signature));
  } catch (error) {
    logger.warn(`Không xác minh được bài auto ở nhóm nguồn ${threadId}: ${error.message}`);
    return false;
  }
}
