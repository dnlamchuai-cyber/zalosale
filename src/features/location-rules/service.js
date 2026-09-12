// Ai viết: Muse Spark | Tại sao: mọi logic kho địa danh nằm một chỗ, classifier chỉ gọi match
// Link SPEC: yêu cầu "Kho địa danh Hà Nội & định tuyến nhiều nhóm" ngày 2026-09-11
import crypto from "node:crypto";
import { normalizeText } from "../../processor.js";
import { HANOI_DISTRICT_ALIASES } from "../../hanoi-districts.js";
import { loadRules, saveRules, loadSeed } from "./repository.js";

export const routingKeyOf = (area) => {
  if (area?.routingKey) return String(area.routingKey);
  const base = normalizeText(area?.keywords?.[0] || "nhom")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "nhom";
  return base.slice(0, 30);
};

/** Gán routingKey ổn định cho areas thiếu; trả areas mới (không mutate). */
export function ensureRoutingKeys(areas = []) {
  const seen = new Set();
  return areas.map((area) => {
    if (area?.routingKey) { seen.add(area.routingKey); return area; }
    let key = routingKeyOf(area);
    let i = 2;
    while (seen.has(key)) key = `${routingKeyOf(area)}-${i++}`;
    seen.add(key);
    return { ...area, routingKey: key };
  });
}

export const normalizeRuleName = (name) => normalizeText(String(name ?? ""));

function toRule(row) {
  return {
    id: String(row.id || crypto.randomUUID()),
    name: String(row.name),
    normalizedName: normalizeRuleName(row.name),
    type: row.type,
    routingKeys: [...new Set((row.routingKeys || []).map(String))],
    enabled: row.enabled !== false,
    source: row.source || "manual",
    note: String(row.note || ""),
    updatedAt: Number(row.updatedAt || Date.now()),
  };
}

/** Migrate alias phường/quận hiện có thành rule nguồn "alias". */
export function aliasRules(areas = []) {
  const out = [];
  for (const area of areas) {
    const key = routingKeyOf(area);
    const district = HANOI_DISTRICT_ALIASES[normalizeText(area?.keywords?.[0])];
    for (const alias of district?.aliases ?? []) {
      out.push(toRule({ name: alias, type: "phuong", routingKeys: [key], source: "alias" }));
    }
  }
  return out;
}

export function listRules(rulesPath) {
  return loadRules(rulesPath).rules;
}

/** Seed lần đầu: seed file + alias; không ghi đè store đã có. */
export function ensureSeeded(areas = [], rulesPath) {
  const store = loadRules(rulesPath);
  if (store.rules.length) return store;
  const seeded = [...loadSeed().map(toRule), ...aliasRules(areas)];
  return saveRules({ ...store, source: "seed", rules: dedupeRules(seeded) }, rulesPath);
}

function dedupeRules(rules) {
  // Rule thủ công cùng tên ghi đè rule OSM/alias.
  const rank = { manual: 3, osm: 2, alias: 1 };
  const byName = new Map();
  for (const rule of rules) {
    const prev = byName.get(rule.normalizedName);
    if (!prev || (rank[rule.source] ?? 0) >= (rank[prev.source] ?? 0)) byName.set(rule.normalizedName, rule);
  }
  return [...byName.values()];
}

export function createRule(input, rulesPath) {
  const store = loadRules(rulesPath);
  const rule = toRule({ ...input, source: "manual", updatedAt: Date.now() });
  if (store.rules.some((r) => r.normalizedName === rule.normalizedName)) {
    throw new Error(`Đã có rule "${input.name}" trong kho (trùng sau chuẩn hóa)`);
  }
  store.rules.push(rule);
  return { store: saveRules(store, rulesPath), rule };
}

export function updateRule(id, patch, rulesPath) {
  const store = loadRules(rulesPath);
  const idx = store.rules.findIndex((r) => r.id === id);
  if (idx < 0) throw new Error("Không tìm thấy rule");
  const next = toRule({ ...store.rules[idx], ...patch, id, updatedAt: Date.now() });
  if (store.rules.some((r, i) => i !== idx && r.normalizedName === next.normalizedName)) {
    throw new Error(`Tên "${patch.name ?? next.name}" trùng rule khác sau chuẩn hóa`);
  }
  store.rules[idx] = next;
  return { store: saveRules(store, rulesPath), rule: next };
}

export function deleteRule(id, rulesPath) {
  const store = loadRules(rulesPath);
  store.rules = store.rules.filter((r) => r.id !== id);
  return saveRules(store, rulesPath);
}

function containsName(normalizedText, normalizedName) {
  if (normalizedName.length < 2) return false;
  const escaped = normalizedName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:^|[^a-z0-9])${escaped}(?=$|[^a-z0-9])`).test(normalizedText);
}

/**
 * Khớp địa danh trong dòng địa chỉ → routingKeys (gộp nhiều nhóm).
 * Rule manual cùng tên ghi đè OSM/alias.
 */
export function matchRules(addressText, rules = []) {
  const normalized = normalizeText(addressText);
  if (!normalized) return { routingKeys: [], matched: [] };
  const effective = dedupeRules(rules.filter((r) => r.enabled !== false));
  const matched = effective.filter((r) => containsName(normalized, r.normalizedName));
  // Ưu tiên tên dài (ít trùng giả: "Bưởi" < "Đường Bưởi").
  matched.sort((a, b) => b.normalizedName.length - a.normalizedName.length);
  return { routingKeys: [...new Set(matched.flatMap((r) => r.routingKeys))], matched };
}

// ---- OSM import (chỉ chạy khi user bấm nút, tuần tự từng khu vực) ----
const OVERPASS_URL = "https://overpass-api.de/api/interpreter";
const FETCH_TIMEOUT_MS = 25000;
const MAX_RESPONSE_BYTES = 2_000_000;

function districtQuery(districtLabel) {
  return `[out:json][timeout:25];area["name"="${districtLabel}"]["boundary"="administrative"]->.q;way(area.q)["highway"]["name"];out tags;`;
}

async function fetchDistrictRoads(districtLabel) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(OVERPASS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `data=${encodeURIComponent(districtQuery(districtLabel))}`,
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`Overpass HTTP ${res.status} cho "${districtLabel}"`);
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > MAX_RESPONSE_BYTES) throw new Error(`Phản hồi quá lớn cho "${districtLabel}"`);
    const data = JSON.parse(buf.toString("utf8"));
    const names = new Set();
    for (const el of data.elements || []) {
      const name = el.tags?.name;
      if (typeof name === "string" && name.trim().length >= 2) names.add(name.trim());
    }
    return { district: districtLabel, names: [...names], error: null };
  } catch (e) {
    return { district: districtLabel, names: [], error: e.name === "AbortError" ? "Timeout 25s" : e.message };
  } finally {
    clearTimeout(timer);
  }
}

const DISTRICT_LABEL_BY_KEY = {
  "ha-dong": "Hà Đông", "cau-giay": "Cầu Giấy", "dong-da": "Đống Đa",
  "thanh-xuan": "Thanh Xuân", "hai-ba-trung": "Hai Bà Trưng", "tay-ho": "Tây Hồ",
  "ba-dinh": "Ba Đình", "bac-tu-liem": "Bắc Từ Liêm", "nam-tu-liem": "Nam Từ Liêm",
  "hoang-mai": "Hoàng Mai", "hoan-kiem": "Hoàn Kiếm", "hoai-duc": "Hoài Đức",
  "hoa-lac": "Hòa Lạc",
};

/** Preview: lấy tên đường OSM, gộp trùng nhiều khu vực, KHÔNG lưu. */
export async function previewOsmImport(routingKeys, fetcher = fetchDistrictRoads) {
  const results = [];
  for (const key of routingKeys) {
    const label = DISTRICT_LABEL_BY_KEY[key] || key;
    results.push({ routingKey: key, ...(await fetcher(label)) });
  }
  // Tên xuất hiện ở nhiều khu vực → một rule nhiều nhóm.
  const byName = new Map();
  for (const r of results) {
    for (const name of r.names) {
      const norm = normalizeRuleName(name);
      if (!byName.has(norm)) byName.set(norm, { name, routingKeys: new Set() });
      byName.get(norm).routingKeys.add(r.routingKey);
    }
  }
  const preview = [...byName.values()].map(({ name, routingKeys: keys }) => ({
    name, type: "duong", routingKeys: [...keys], source: "osm",
  }));
  return { results, preview, total: preview.length };
}

/** Lưu preview OSM: không thay thế rule thủ công cùng tên. */
export function applyOsmPreview(preview, rulesPath) {
  const store = loadRules(rulesPath);
  const manualNames = new Set(store.rules.filter((r) => r.source === "manual").map((r) => r.normalizedName));
  let added = 0;
  let skipped = 0;
  for (const row of preview) {
    const rule = toRule({ ...row, source: "osm", updatedAt: Date.now() });
    const idx = store.rules.findIndex((r) => r.normalizedName === rule.normalizedName);
    if (manualNames.has(rule.normalizedName)) { skipped++; continue; }
    if (idx >= 0) store.rules[idx] = rule;
    else store.rules.push(rule);
    added++;
  }
  return { store: saveRules({ ...store, source: "osm-import" }, rulesPath), added, skipped };
}
