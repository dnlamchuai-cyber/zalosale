import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { logger } from "./logger.js";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
export const CONFIG_PATH = path.join(ROOT, "config", "config.json");
export const SESSION_DIR = path.join(ROOT, "config", "session");
export const TEMP_DIR = path.join(ROOT, ".temp");
export const GROUPS_CACHE_PATH = path.join(ROOT, "config", "groups-cache.json");

const DEFAULT_FORWARD = {
  windowMs: 3000,
  maxBatchItems: 10,
  maxWaitMs: 30000,
  sendDelayMs: 1500,
  retries: 3,
  historyGapMs: 10000,
};

export function parseConfig(raw) {
  const config = {
    mode: raw.mode === "manual" ? "manual" : "auto",
    sourceGroups: Array.isArray(raw.sourceGroups) ? raw.sourceGroups : [],
    areas: Array.isArray(raw.areas) ? raw.areas : [],
    deleteLines: Array.isArray(raw.deleteLines) ? raw.deleteLines : [],
    excludeKeywords: Array.isArray(raw.excludeKeywords) ? raw.excludeKeywords : [],
    filter: {
      removePercentLines: false,
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
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(raw, null, 2), "utf8");
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
    if (!Array.isArray(area.keywords) || !area.keywords.length) {
      logger.warn(`config: areas[${i}] thiếu keywords (từ khoá nhận định khu vực)`);
    }
    if (!area.groupLink && !area.id) {
      logger.warn(`config: areas[${i}] thiếu groupLink (link nhóm đích)`);
    }
  });
  const f = config.forward;
  if (f.maxBatchItems < 1) f.maxBatchItems = 1;
  if (f.windowMs < 500) logger.warn("config: forward.windowMs quá nhỏ, có thể gom thiếu ảnh");
}