// Ai viết: AI PROMPT-002
// Tại sao chọn POST thay vì GET: vì body có keyword dài, không idempotent, tránh lộ groupId trên URL
// Link: docs/03_SPEC/SPEC-001.md + docs/04_PROMPTS/PROMPT-002.md

import { CheckCommunitySchema, checkCommunity } from "./service.js";

export async function communityCheckRoute(req, res) {
  if (!req.body?.groupId) {
    return res.status(400).json({ ok: false, error: "Thiếu groupId" });
  }

  let parsed;
  try {
    parsed = CheckCommunitySchema.parse(req.body);
  } catch (e) {
    return res.status(400).json({ ok: false, error: e.errors?.[0]?.message || e.message });
  }

  try {
    const result = await checkCommunity(parsed, {
      api: req.api,
      areas: req.areas ?? [],
    });
    return res.json({ ok: true, total: result.total, posts: result.posts, range: result.range });
  } catch (e) {
    const msg = e.message || "Lỗi không xác định";
    if (msg.includes("Ngày") || msg.includes("groupId") || msg.includes("keyword")) {
      return res.status(400).json({ ok: false, error: msg });
    }
    return res.status(500).json({ ok: false, error: msg });
  }
}
