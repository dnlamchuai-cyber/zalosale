import { normalizeText } from "./processor.js";

/**
 * Nhận định khu vực bằng từ khoá.
 * - Từ khoá dài hơn được ưu tiên (ít trùng lặp giả)
 * - Trả về area (đối tượng trong config.areas) hoặc null
 */
export function classifyArea(text, areas, defaultArea = null) {
  const n = normalizeText(text);
  let best = null;
  let bestScore = 0;

  for (const area of areas) {
    const keywords = Array.isArray(area.keywords) ? area.keywords : [];
    let score = 0;
    for (const kw of keywords) {
      const k = normalizeText(kw);
      if (!k || k.length < 2) continue;
      if (n.includes(k)) score += k.length * 10;
    }
    if (score > bestScore) {
      bestScore = score;
      best = area;
    }
  }
  if (best) return best;

  if (defaultArea) {
    const def = normalizeText(defaultArea);
    const hit = areas.find((area) =>
      (Array.isArray(area.keywords) ? area.keywords : []).some((kw) => normalizeText(kw).includes(def))
    );
    if (hit) return hit;
  }
  return null;
}