// AI: Codex + Muse Spark | WHY: Keep keyword routing independent of catch-all destinations.
// SPEC: docs/03_SPEC/SPEC-003.md + Kho địa danh Hà Nội ngày 2026-09-11
import { normalizeText, parsePrice } from "./processor.js";
import { HANOI_DISTRICT_ALIASES } from "./hanoi-districts.js";
import { matchRules } from "./features/location-rules/service.js";

const ADDRESS_MARKER_PATTERN = /(?:^|[^a-z0-9])(?:dia\s*chi|d\/c|dc)(?=\s|:|-|$)/i;
// WHY: tin thực tế bắt đầu thẳng bằng Ngõ/Ngách/Đường/Phố/Số/KĐT/Chung cư/Hẻm thay vì chữ "Địa chỉ"
const ADDRESS_START_PATTERN = /^(?:ngo|ngach|hem|duong|pho|kdt|khu\s*do\s*thi|chung\s*cu|toa|so\s*\d|dia\s*chi|d\/c|dc)\b/i;
// WHY: tin kiểu "Cho thuê nhà ngõ 172 Xuân Đỉnh..." mở đầu bằng lời rao, địa chỉ nằm giữa dòng
const ADDRESS_INLINE_PATTERN = /(?:^|[^a-z0-9])(?:ngo|ngach|hem|duong|pho)\s*\d|(?:^|[^a-z0-9])so\s+\d/i;
const EMOJI_MARKER_PATTERN = /[📍🏡📌]/;

function areaAliases(area) {
  if (area?.matchAll === true) return [];
  const configured = Array.isArray(area?.keywords) ? area.keywords : [];
  const district = HANOI_DISTRICT_ALIASES[normalizeText(configured[0])];
  return [...configured, ...(district?.aliases ?? [])];
}

/** Dòng khai báo địa chỉ: marker Địa chỉ/Đ-C, emoji 📍🏡📌, hoặc mở đầu Ngõ/Đường/Phố/Số/KĐT/Chung cư/Hẻm. */
export function extractAddressText(text) {
  return String(text ?? "")
    .split(/\r?\n/)
    .filter((line) => {
      if (EMOJI_MARKER_PATTERN.test(line)) return true;
      const normalized = normalizeText(line);
      return ADDRESS_MARKER_PATTERN.test(normalized)
        || ADDRESS_START_PATTERN.test(normalized)
        || ADDRESS_INLINE_PATTERN.test(normalized);
    })
    .join("\n");
}

function containsLocation(normalizedText, keyword) {
  const normalizedKeyword = normalizeText(keyword);
  if (normalizedKeyword.length < 2) return false;
  const escaped = normalizedKeyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:^|[^a-z0-9])${escaped}(?=$|[^a-z0-9])`).test(normalizedText);
}

export function findAreaMatch(text, area) {
  const normalizedText = normalizeText(extractAddressText(text));
  let matchedKeyword = "";
  for (const alias of areaAliases(area)) {
    const normalizedAlias = normalizeText(alias);
    if (!containsLocation(normalizedText, normalizedAlias)) continue;
    if (normalizedAlias.length > normalizeText(matchedKeyword).length) matchedKeyword = String(alias);
  }
  if (!matchedKeyword) return null;
  const district = HANOI_DISTRICT_ALIASES[normalizeText(area?.keywords?.[0])];
  return { keyword: matchedKeyword, district: district?.label ?? String(area?.keywords?.[0] ?? "") };
}

/** Nhận diện quận từ nội dung, không phụ thuộc nhóm đích đã cấu hình. */
export function detectHanoiDistrict(text) {
  const normalizedText = normalizeText(extractAddressText(text));
  let bestMatch = null;
  for (const district of Object.values(HANOI_DISTRICT_ALIASES)) {
    for (const keyword of [district.label, ...district.aliases]) {
      const normalizedKeyword = normalizeText(keyword);
      if (!containsLocation(normalizedText, normalizedKeyword)) continue;
      if (!bestMatch || normalizedKeyword.length > normalizeText(bestMatch.keyword).length) {
        bestMatch = { district: district.label, keyword };
      }
    }
  }
  return bestMatch;
}

function matchesPriceCondition(text, condition) {
  if (!condition) return true;
  const price = parsePrice(text)?.first;
  const value = Number(condition.value);
  if (price == null || !Number.isFinite(value)) return false;
  if (condition.operator === "<") return price < value;
  if (condition.operator === ">") return price > value;
  if (condition.operator === "=") return price === value;
  return false;
}

function areaScore(normalizedText, area) {
  return areaAliases(area).reduce((score, keyword) => {
    const normalizedKeyword = normalizeText(keyword);
    return containsLocation(normalizedText, normalizedKeyword) ? score + normalizedKeyword.length * 10 : score;
  }, 0);
}

/** "Gần <quận>" là tín hiệu định tuyến có chủ đích, kể cả khi bài không có dòng địa chỉ chuẩn. */
function isExplicitlyNearby(normalizedText, area) {
  return areaAliases(area).some((alias) => {
    const normalizedAlias = normalizeText(alias);
    if (normalizedAlias.length < 2) return false;
    const escaped = normalizedAlias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(?:^|[^a-z0-9])gan\\s+${escaped}(?=$|[^a-z0-9])`).test(normalizedText);
  });
}

/** Tiện ích "xe buýt đi/đến/qua <quận>" là tuyến tiếp cận có chủ đích của bài đăng. */
function isTransitToArea(normalizedText, area) {
  return areaAliases(area).some((alias) => {
    const normalizedAlias = normalizeText(alias);
    if (normalizedAlias.length < 2) return false;
    const escaped = normalizedAlias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(?:^|[^a-z0-9])(?:xe\\s*buyt|bus)\\s+(?:di|den|toi|qua|ve)\\s+${escaped}(?=$|[^a-z0-9])`).test(normalizedText);
  });
}

function keyOf(area) {
  if (area?.routingKey) return String(area.routingKey);
  return normalizeText(area?.keywords?.[0] || "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

// Phường nào chỉ thuộc đúng 1 quận → nhắc phường đó cũng như nêu tên quận.
const DISTRICT_WARDS = (() => {
  const owners = new Map();
  for (const [key, district] of Object.entries(HANOI_DISTRICT_ALIASES)) {
    for (const alias of district?.aliases ?? []) {
      const norm = normalizeText(alias);
      if (!owners.has(norm)) owners.set(norm, new Set());
      owners.get(norm).add(key);
    }
  }
  const byDistrict = new Map();
  for (const [norm, keys] of owners) {
    if (keys.size !== 1) continue;
    const key = [...keys][0];
    if (!byDistrict.has(key)) byDistrict.set(key, []);
    byDistrict.get(key).push(norm);
  }
  return byDistrict;
})();

/**
 * Quận được nêu TÊN RÕ trong dòng địa chỉ: từ khóa quận cấu hình hoặc phường
 * chỉ thuộc 1 quận. Không tính tên đường (đường hay trùng nhiều quận).
 */
export function findExplicitDistricts(normalizedAddress, areas, skipNames = new Set()) {
  const out = new Set();
  if (!normalizedAddress) return out;
  for (const area of areas) {
    const hitKeyword = (area?.keywords || []).some((kw) => containsLocation(normalizedAddress, kw));
    // Phường trùng tên đường vừa khớp rule (vd Thụy Khuê) thì không tính là nêu quận.
    const hitWard = (area?.keywords || []).some((kw) =>
      (DISTRICT_WARDS.get(normalizeText(kw)) || []).some(
        (ward) => !skipNames.has(ward) && containsLocation(normalizedAddress, ward)));
    if (hitKeyword || hitWard) out.add(keyOf(area));
  }
  return out;
}

/**
 * Định tuyến chi tiết qua kho địa danh + tín hiệu cũ.
 * reason: "dia-chi" | "gan" | "xe-buyt" | null (null = chưa xác định).
 */
export function classifyAreasDetailed(text, areas, defaultArea = null, rules = []) {
  const normalizedPost = normalizeText(text);
  const addressText = extractAddressText(text);
  const normalizedAddress = normalizeText(addressText);
  const catchAll = areas.filter((area) => area.matchAll === true);
  const filtered = areas.filter((area) => area.matchAll !== true);

  let ruleKeys = [];
  let matchedRules = [];
  if (normalizedAddress && rules.length) {
    const hit = matchRules(normalizedAddress, rules);
    ruleKeys = hit.routingKeys;
    matchedRules = hit.matched;
  }

  const matched = filtered.filter((area) => {
    const key = keyOf(area);
    const ruleHit = ruleKeys.includes(key);
    const keywordHit = normalizedAddress && areaScore(normalizedAddress, area) > 0;
    const nearby = isExplicitlyNearby(normalizedPost, area);
    const transit = isTransitToArea(normalizedPost, area);
    area._routeVia = ruleHit || keywordHit ? "dia-chi" : nearby ? "gan" : transit ? "xe-buyt" : null;
    area._matchedRules = ruleHit ? matchedRules.filter((r) => r.routingKeys.includes(key)) : [];
    return (ruleHit || keywordHit || nearby || transit) && matchesPriceCondition(text, area.priceCondition);
  });
  // Ưu tiên quận ghi rõ: đường giáp nhiều quận mà tin nêu tên quận/phường nào
  // thì chỉ giữ quận đó (gần/xe buýt vẫn cộng thêm). Mâu thuẫn thì giữ nguyên để khỏi mất tin.
  const ruleNames = new Set(matchedRules.map((r) => r.normalizedName));
  const explicit = findExplicitDistricts(normalizedAddress, filtered, ruleNames);
  let finalMatched = matched;
  let finalRules = matchedRules;
  if (explicit.size) {
    const narrowed = matched.filter((area) => area._routeVia !== "dia-chi" || explicit.has(keyOf(area)));
    if (narrowed.length) {
      finalMatched = narrowed;
      const keptKeys = new Set(narrowed.map(keyOf));
      finalRules = matchedRules.filter((r) => r.routingKeys.some((k) => keptKeys.has(k)));
      for (const area of finalMatched) {
        area._matchedRules = (area._matchedRules || []).filter((r) => r.routingKeys.some((k) => keptKeys.has(k)));
      }
    }
  }
  const destinations = [...finalMatched, ...catchAll];
  const reason = finalMatched.length ? (finalMatched[0]._routeVia || "dia-chi") : null;
  return { destinations, reason, matchedRules: finalRules, undetermined: destinations.length === 0 };
}

/** Trả tất cả nhóm đích khớp khu vực và điều kiện giá riêng. */
export function classifyAreas(text, areas, defaultArea = null, rules = []) {
  return classifyAreasDetailed(text, areas, defaultArea, rules).destinations;
}

export function destinationLabel(area) {
  return area?.matchAll === true ? "Tất cả bài viết" : (area?.keywords?.[0] || "?");
}

/**
 * Nhận định khu vực bằng từ khoá.
 * - Từ khoá dài hơn được ưu tiên (ít trùng lặp giả)
 * - Trả về area (đối tượng trong config.areas) hoặc null
 */
export function classifyArea(text, areas, defaultArea = null) {
  const n = normalizeText(extractAddressText(text));
  if (!n) return null;
  let best = null;
  let bestScore = 0;

  for (const area of areas) {
    const keywords = areaAliases(area);
    let score = 0;
    for (const kw of keywords) {
      const k = normalizeText(kw);
      if (containsLocation(n, k)) score += k.length * 10;
    }
    if (score > bestScore) {
      bestScore = score;
      best = area;
    }
  }
  if (best) return best;

  return null;
}
