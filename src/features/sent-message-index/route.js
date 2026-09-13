// Ai viết: Codex — route tìm kho tin đã gửi
// Tại sao: route chỉ validate, gọi service và trả lỗi an toàn
// Link: docs/03_SPEC/SPEC-002.md + docs/04_PROMPTS/PROMPT-005.md

import { ClearSentRoomsSchema, ResendSentRoomParamsSchema, SearchSentRoomsSchema } from "./schema.js";

export function searchSentRoomsRoute(req, res) {
  const parsed = SearchSentRoomsSchema.safeParse(req.query || {});
  if (!parsed.success) {
    return res.status(400).json({
      ok: false,
      error: parsed.error.issues[0]?.message || "Bộ lọc không hợp lệ",
    });
  }
  try {
    const rooms = req.sentMessageIndex.search({
      query: parsed.data.q.trim(),
      limit: parsed.data.limit,
    });
    return res.json({ ok: true, rooms });
  } catch {
    return res.status(500).json({ ok: false, error: "Không thể tìm kho tin lúc này" });
  }
}

export function clearSentRoomsRoute(req, res) {
  const parsed = ClearSentRoomsSchema.safeParse(req.body || {});
  if (!parsed.success) return res.status(400).json({ ok: false, error: "Xác nhận xóa không hợp lệ" });
  try {
    const clearedRooms = req.sentMessageIndex.clear();
    return res.json({ ok: true, clearedRooms });
  } catch {
    return res.status(500).json({ ok: false, error: "Không thể xóa kho tin lúc này" });
  }
}

export async function resendSentRoomRoute(req, res) {
  const parsed = ResendSentRoomParamsSchema.safeParse(req.params || {});
  if (!parsed.success) return res.status(400).json({ ok: false, error: "Mã kho tin không hợp lệ" });
  if (typeof req.resendSentRoom !== "function") {
    return res.status(503).json({ ok: false, error: "Bot chưa sẵn sàng để gửi lại" });
  }
  try {
    const result = await req.resendSentRoom(parsed.data.roomId);
    if (result?.error) return res.status(409).json({ ok: false, error: result.error });
    return res.json({ ok: true, sent: Number(result?.sent || 0), failed: Number(result?.failed || 0) });
  } catch {
    return res.status(500).json({ ok: false, error: "Không thể gửi lại tin lúc này" });
  }
}
