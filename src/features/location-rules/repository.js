// Ai viết: Muse Spark | Tại sao: JSON local + ghi atomic, bot chạy offline hoàn toàn
// Link SPEC: yêu cầu "Kho địa danh Hà Nội" ngày 2026-09-11 (local-first, attribution ODbL)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RULES_DIR = path.dirname(path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url)))));
export const RULES_PATH = path.join(RULES_DIR, "data", "location-rules.json");
export const SEED_PATH = path.join(RULES_DIR, "data", "location-rules.seed.json");

export const OSM_ATTRIBUTION = "© OpenStreetMap contributors (ODbL) — dữ liệu đường lấy qua Overpass API, lưu local";

function blankStore() {
  return { version: 1, updatedAt: Date.now(), source: "seed", attribution: OSM_ATTRIBUTION, rules: [] };
}

export function loadRules(rulesPath = RULES_PATH) {
  try {
    const raw = JSON.parse(fs.readFileSync(rulesPath, "utf8"));
    if (!Array.isArray(raw.rules)) return blankStore();
    return { ...blankStore(), ...raw, rules: raw.rules };
  } catch {
    return blankStore();
  }
}

export function saveRules(store, rulesPath = RULES_PATH) {
  const payload = { ...store, updatedAt: Date.now(), attribution: OSM_ATTRIBUTION };
  fs.mkdirSync(path.dirname(rulesPath), { recursive: true });
  const tmp = `${rulesPath}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(payload, null, 2), "utf8");
  fs.renameSync(tmp, rulesPath);
  return payload;
}

export function loadSeed(seedPath = SEED_PATH) {
  try {
    const raw = JSON.parse(fs.readFileSync(seedPath, "utf8"));
    return Array.isArray(raw.rules) ? raw.rules : [];
  } catch {
    return [];
  }
}

let cachedStore = null;
// WHY: batcher/forwarder gọi mỗi tin — stat rẻ, chỉ parse lại khi file đổi (rule mới lưu là nhận ngay, không cần restart).
export function loadRulesCached(rulesPath = RULES_PATH) {
  let mtimeMs = 0;
  try {
    mtimeMs = fs.statSync(rulesPath).mtimeMs;
  } catch {}
  if (!cachedStore || cachedStore.path !== rulesPath || cachedStore.mtimeMs !== mtimeMs) {
    cachedStore = { path: rulesPath, mtimeMs, store: loadRules(rulesPath) };
  }
  return cachedStore.store;
}
