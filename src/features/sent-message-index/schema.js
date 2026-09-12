// Ai viết: Codex — schema HTTP cho tìm kho tin
// Tại sao: mọi input được chặn tại boundary trước khi vào service/SQLite
// Link: docs/03_SPEC/SPEC-002.md + docs/04_PROMPTS/PROMPT-005.md

import { z } from "zod";

export const SearchSentRoomsSchema = z.object({
  q: z.string().max(200, "Từ khóa tối đa 200 ký tự").default(""),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const ClearSentRoomsSchema = z.object({
  confirmation: z.literal("CLEAR_SENT_ROOMS"),
});
