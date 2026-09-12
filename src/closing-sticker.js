// AI: OpenAI Codex
// WHY: Lưu đúng định danh sticker Zalo, không lưu nội dung chat hoặc URL tạm thời.
// SPEC: Yêu cầu DM /setsticker — một sticker tự chọn ở cuối mỗi cụm.
import fs from "node:fs";
import path from "node:path";

const STICKER_MESSAGE_TYPE = "chat.sticker";
const INTEGER_KEYS = {
  id: ["stickerId", "sticker_id", "id"],
  cateId: ["cateId", "cate_id"],
  type: ["type", "stickerType", "sticker_type"],
};

function positiveInteger(value, allowZero = false) {
  const number = Number(value);
  return Number.isSafeInteger(number) && (allowZero ? number >= 0 : number > 0) ? number : null;
}

function parseContent(content) {
  if (content && typeof content === "object") return content;
  if (typeof content !== "string" || !content.trim().startsWith("{")) return {};
  try {
    const parsed = JSON.parse(content);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function readKey(objects, keys, allowZero = false) {
  for (const object of objects) {
    for (const key of keys) {
      const value = positiveInteger(object?.[key], allowZero);
      if (value !== null) return value;
    }
  }
  return null;
}

export function isStickerMessage(message) {
  return String(message?.msgType || message?.type || "").toLowerCase() === STICKER_MESSAGE_TYPE;
}

export function extractStickerId(message) {
  if (!isStickerMessage(message)) return null;
  const content = parseContent(message.content);
  return readKey([content, message], INTEGER_KEYS.id);
}

export function normalizeSticker(sticker) {
  if (!sticker || typeof sticker !== "object") return null;
  const id = readKey([sticker], INTEGER_KEYS.id);
  const cateId = readKey([sticker], INTEGER_KEYS.cateId, true);
  const type = readKey([sticker], INTEGER_KEYS.type);
  return id && cateId !== null && type ? { id, cateId, type } : null;
}

export class ClosingStickerStore {
  constructor(filePath) {
    this.filePath = filePath;
  }

  get() {
    try {
      return normalizeSticker(JSON.parse(fs.readFileSync(this.filePath, "utf8")));
    } catch {
      return null;
    }
  }

  save(sticker) {
    const safeSticker = normalizeSticker(sticker);
    if (!safeSticker) throw new Error("Sticker Zalo không hợp lệ");
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    fs.writeFileSync(this.filePath, JSON.stringify(safeSticker, null, 2), "utf8");
    return safeSticker;
  }

  clear() {
    fs.rmSync(this.filePath, { force: true });
  }
}
