// Ai viết: AI PROMPT-001 + human @dinhnam
// Tại sao chọn file local + community fallback: vì group/history 404 cho Community, cần 3 tầng fallback
// Link SPEC/PROMPT: docs/03_SPEC/SPEC-001.md + docs/04_PROMPTS/PROMPT-001.md

import { z } from "zod";
import { resolveRange } from "../../history.js";
import { isExcluded, normalizeText, cleanText } from "../../processor.js";
import { classifyArea } from "../../classifier.js";
import { fetchRecentMessages } from "../../history.js";

const MAX_DAYS = 60; // WHY: SPEC BR1 - max 60 ngày để tránh quá tải 1500 tin
const DEFAULT_COUNT = 500; // WHY: đủ cho 3 ngày, ít hơn 1500 để nhanh

export const CheckCommunitySchema = z.object({
  groupId: z.string().min(5).max(30),
  from: z.string().min(1),
  to: z.string().min(1).optional(),
  keyword: z.string().max(50).optional(),
  count: z.number().int().min(1).max(1500).default(DEFAULT_COUNT).optional(),
});

export async function checkCommunity(input, deps) {
  const parsed = CheckCommunitySchema.parse(input);
  const range = resolveRange({ from: parsed.from, to: parsed.to });
  if (range.error) throw new Error(range.error);

  const areas = deps.areas ?? [];
  const fetchFn = deps.fetchFn ?? fetchRecentMessages;
  const batches = await fetchFn(deps.api, parsed.groupId, {
    fromMs: range.fromMs,
    toMs: range.toMs,
    count: parsed.count ?? DEFAULT_COUNT,
  });

  const kwNorm = parsed.keyword ? normalizeText(parsed.keyword) : "";
  const posts = [];
  let idx = 0;

  for (const items of batches) {
    const text = items.map((it) => (typeof it.data?.content === "string" ? it.data.content : "")).join("\n\n");
    if (isExcluded(text, [])) continue;
    if (kwNorm && !normalizeText(text).includes(kwNorm)) continue;

    const clean = cleanText(text, { deleteLines: [], removePercentLines: false, removePriceLines: false });
    const photos = items.filter((it) => it.data?.content?.startsWith?.("{") || it.data?.originUrl).length;
    if (!clean && photos === 0) continue;

    const area = classifyArea(text, areas, null);
    const ts = Number(items[0]?.data?.ts || 0);

    posts.push({
      id: `${parsed.groupId}:${idx++}`,
      ts,
      clean: clean.slice(0, 400),
      areaName: area?.keywords?.[0] ?? null,
      kw: area ? (area.keywords || []).join(", ") : "",
      photos,
      price: null,
    });
  }

  return { total: posts.length, posts, range: range.label };
}
