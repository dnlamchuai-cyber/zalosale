// Ai viết: Codex — lập kế hoạch gửi tuần tự cho một cụm Zalo
// Tại sao: giữ đúng thứ tự chữ/album thay vì dồn toàn bộ chữ lên trước ảnh
// Link: docs/05_TASKS/TASK-006.md — quy tắc cụm được duyệt 2026-09-05

import { attachmentUrls } from "./media.js";
import { cleanText } from "./processor.js";

export function buildDeliveryUnits(items, cleanOptions) {
  const units = [];
  for (const item of items || []) {
    const urls = attachmentUrls(item);
    if (urls.length) {
      const previous = units.at(-1);
      if (previous?.kind === "media") previous.urls.push(...urls);
      else units.push({ kind: "media", urls: [...urls] });
      continue;
    }
    const content = item?.data?.content;
    if (typeof content !== "string") continue;
    const text = cleanText(content, cleanOptions);
    if (text) units.push({ kind: "text", text });
  }
  return units;
}
