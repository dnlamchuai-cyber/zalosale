// AI: Codex | WHY: Require explicit opt-in for catch-all routing.
// SPEC: docs/03_SPEC/SPEC-003.md
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { logger } from "./logger.js";
import { ensureRoutingKeys } from "./features/location-rules/service.js";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
export const CONFIG_PATH = path.join(ROOT, "config", "config.json");
export const SESSION_DIR = path.join(ROOT, "config", "session");
export const TEMP_DIR = path.join(ROOT, ".temp");
export const GROUPS_CACHE_PATH = path.join(ROOT, "config", "groups-cache.json");
export const CLOSING_STICKER_PATH = path.join(ROOT, "config", "closing-sticker.json");
export const SCAN_STATE_PATH = path.join(ROOT, "data", "scan-state.json");

const DEFAULT_FORWARD = {
  windowMs: 3000,
  maxBatchItems: 10,
  maxWaitMs: 120000,
  sendDelayMs: 500,
  retries: 1,
  historyGapMs: 120000,
  imageMaxDim: 1600,
  imageQuality: 80,
};
const CONTACT_FIELD_LIMIT = 2000;
const CONTACT_FIELDS = ["admins", "deputies", "supportGroup", "note"];

function parseSourceGroupContacts(rawContacts, sourceGroups) {
  if (!rawContacts || typeof rawContacts !== "object" || Array.isArray(rawContacts)) return {};
  const contacts = {};

  for (const source of sourceGroups) {
    const sourceId = String(source);
    const rawContact = rawContacts[sourceId];
    if (!rawContact || typeof rawContact !== "object" || Array.isArray(rawContact)) continue;

    const contact = {};
    for (const field of CONTACT_FIELDS) {
      const value = rawContact[field] ?? "";
      if (typeof value !== "string") throw new Error(`config: sourceGroupContacts.${field} phải là chuỗi`);
      if (value.length > CONTACT_FIELD_LIMIT) throw new Error(`config: sourceGroupContacts.${field} tối đa ${CONTACT_FIELD_LIMIT} ký tự`);
      contact[field] = value.trim();
    }
    if (CONTACT_FIELDS.some((field) => contact[field])) contacts[sourceId] = contact;
  }
  return contacts;
}

export function parseConfig(raw) {
  const sourceGroups = Array.isArray(raw.sourceGroups) ? raw.sourceGroups : [];
  const config = {
    mode: raw.mode === "manual" ? "manual" : "auto",
    sourceGroups,
    sourceGroupContacts: parseSourceGroupContacts(raw.sourceGroupContacts, sourceGroups),
    areas: ensureRoutingKeys(Array.isArray(raw.areas) ? raw.areas : []),
    deleteLines: Array.isArray(raw.deleteLines) ? raw.deleteLines : [],
    excludeKeywords: Array.isArray(raw.excludeKeywords) ? raw.excludeKeywords : [],
    filter: {
      removePercentLines: true,
      removePriceLines: false,
      ...(raw.filter || {}),
    },
    defaultArea: raw.defaultArea ?? null,
    priceRange: raw.priceRange != null
      ? { min: raw.priceRange.min, max: raw.priceRange.max }
      : null,
    ui: { port: 3000, ...(raw.ui || {}) },
    forward: { ...DEFAULT_FORWARD, ...(raw.forward || {}) },
  };
  validate(config);
  return config;
}

export function loadConfig() {
  if (!fs.existsSync(CONFIG_PATH)) {
    throw new Error(`Không tìm thấy file cấu hình: ${CONFIG_PATH}`);
  }
  return parseConfig(JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8")));
}

/** Lưu config từ UI: validate rồi ghi file, trả về config đã parse */
export function saveConfig(raw) {
  const parsed = parseConfig(raw);
  fs.writeFileSync(CONFIG_PATH, JSON.stringify({ ...raw, areas: parsed.areas, sourceGroupContacts: parsed.sourceGroupContacts }, null, 2), "utf8");
  logger.info("Đã lưu config/config.json từ giao diện");
  return parsed;
}

function validate(config) {
  if (!config.sourceGroups.length) {
    logger.warn("config: chưa có sourceGroups (nhóm nguồn) — bot sẽ không forward gì");
  }
  if (!config.areas.length) {
    logger.warn("config: chưa có areas (nhóm đích) — bot sẽ không forward gì");
  }
  config.areas.forEach((area, i) => {
    if (area.matchAll !== undefined && typeof area.matchAll !== "boolean") {
      throw new Error(`config: areas[${i}].matchAll phải là boolean`);
    }
    if (area.matchAll !== true && (!Array.isArray(area.keywords) || !area.keywords.length)) {
      logger.warn(`config: areas[${i}] thiếu keywords (từ khoá nhận định khu vực)`);
    }
    if (!area.groupLink && !area.id) {
      logger.warn(`config: areas[${i}] thiếu groupLink (link nhóm đích)`);
    }
    if (area.priceCondition) {
      const { operator, value } = area.priceCondition;
      if (!["<", ">", "="].includes(operator) || !Number.isFinite(Number(value)) || Number(value) < 0) {
        throw new Error(`config: areas[${i}].priceCondition không hợp lệ`);
      }
      area.priceCondition = { operator, value: Number(value) };
    }
  });
  const f = config.forward;
  if (f.maxBatchItems < 1) f.maxBatchItems = 1;
  if (f.windowMs < 500) logger.warn("config: forward.windowMs quá nhỏ, có thể gom thiếu ảnh");
}
