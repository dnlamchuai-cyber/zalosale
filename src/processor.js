export function normalizeText(str) {
  return String(str ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/\s+/g, " ")
    .trim();
}

/** Bài đăng chứa bất kỳ từ khoá loại trừ nào → KHÔNG chuyển tiếp toàn bộ */
export function isExcluded(text, excludeKeywords = []) {
  const n = normalizeText(text);
  return [excludeKeywords].flat().some((kw) => {
    const k = normalizeText(kw);
    return k && n.includes(k);
  });
}

/**
 * Làm sạch text trước khi forward.
 * - Xoá nguyên dòng chứa bất kỳ chữ nào trong deleteLines (nhập nhiều được)
 * - Nếu filter.removePercentLines: xoá dòng chứa % hoa hồng (dạng "30%", "🌹( 12t ) : 30%")
 * - Nếu filter.removePriceLines: xoá dòng chứa "giá" (dòng "💰Giá: 4tr4")
 */
export function cleanText(text, { deleteLines = [], removePercentLines = false, removePriceLines = false } = {}) {
  const keys = [deleteLines].flat().map(normalizeText).filter(Boolean);
  const lines = String(text ?? "").split(/\r?\n/);

  const kept = lines.filter((line) => {
    const n = normalizeText(line);
    if (keys.some((k) => k && n.includes(k))) return false;
    if (removePercentLines && /[0-9]\s*%/.test(line)) return false;
    if (removePriceLines && n.includes(normalizeText("giá"))) return false;
    return true;
  });

  return kept.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

/**
 * Trích xuất giá tiền từ text (đơn vị triệu VND).
 * Hỗ trợ: 4tr5, 4tr, 4.5tr, 4,5tr, 4 triệu 5, 4 triệu, 3tr5 – 5tr
 * Trả về { first, min, max } hoặc null nếu không tìm thấy.
 */
export function parsePrice(text) {
  const prices = [];
  const re = /(\d+)\s*(?:[.,]\s*(\d+))?\s*(triệu|trệu|tr)(?:\s*(\d+))?/gi;
  let m;
  while ((m = re.exec(text)) !== null) {
    const main = parseInt(m[1]);
    let frac = 0;
    if (m[2]) {
      frac = parseInt(m[2]) / Math.pow(10, m[2].length);
    } else if (m[4]) {
      frac = parseInt(m[4]) / Math.pow(10, m[4].length);
    }
    prices.push(main + frac);
  }
  if (!prices.length) return null;
  return { first: prices[0], min: Math.min(...prices), max: Math.max(...prices) };
}

/**
 * Kiểm tra bài đăng có nằm trong khoảng giá không.
 * Không có giá → cho qua (tránh mất bài không đề cập giá).
 * priceRange = { min, max } (triệu), có thể null = tắt, hoặc thiếu min/max.
 */
export function isInPriceRange(text, priceRange) {
  if (!priceRange) return true;
  const min = priceRange.min != null ? parseFloat(priceRange.min) : NaN;
  const max = priceRange.max != null ? parseFloat(priceRange.max) : NaN;
  if (isNaN(min) && isNaN(max)) return true;
  const p = parsePrice(text);
  if (!p) return true;
  if (!isNaN(min) && p.first < min) return false;
  if (!isNaN(max) && p.first > max) return false;
  return true;
}