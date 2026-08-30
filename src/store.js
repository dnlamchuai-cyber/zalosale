import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
export const STORE_PATH = path.join(ROOT, "data", "history.jsonl");
const MAX_LINES = 50000;
const KEEP_DAYS = 30;

function ensureDir() {
  try {
    fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true });
  } catch {}
}

/**
 * Ghi 1 batch (1 bài đăng đã gom) vào file.
 * Mỗi dòng là 1 JSON: { ts, threadId, threadName, items }
 */
export function appendBatch(threadId, items, threadName = "") {
  if (!Array.isArray(items) || !items.length) return;
  ensureDir();
  const ts = Number(items[0]?.data?.ts || items[0]?.ts || Date.now());
  const line = JSON.stringify({ ts, threadId: String(threadId), threadName: String(threadName || ""), items });
  try {
    fs.appendFileSync(STORE_PATH, line + "\n", "utf8");
  } catch {}
  // xoay vòng không đồng bộ (không chặn)
  try {
    const stat = fs.statSync(STORE_PATH);
    // nếu file > ~50MB thì cắt bớt (tránh đọc quá nặng)
    if (stat.size > 60 * 1024 * 1024) rotate();
  } catch {}
}

function rotate() {
  try {
    const raw = fs.readFileSync(STORE_PATH, "utf8").split("\n").filter(Boolean);
    if (raw.length <= MAX_LINES) return;
    const keep = raw.slice(-MAX_LINES);
    fs.writeFileSync(STORE_PATH, keep.join("\n") + "\n", "utf8");
  } catch {}
}

/**
 * Truy vấn từ file local.
 * @param {object} opts
 * @param {number} opts.fromMs
 * @param {number} opts.toMs
 * @param {string[]} opts.sourceIds - lọc theo threadId, rỗng = tất cả
 * @param {string} opts.keyword - lọc tin chứa chữ (đã chuẩn hoá), rỗng = tất cả
 */
export function query({ fromMs = 0, toMs = Date.now(), sourceIds = [], keyword = "" } = {}) {
  ensureDir();
  if (!fs.existsSync(STORE_PATH)) return [];
  const kw = keyword ? String(keyword).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").trim() : "";
  const idSet = sourceIds.length ? new Set(sourceIds.map(String)) : null;
  const cutoff = Date.now() - KEEP_DAYS * 86400000;
  const out = [];
  try {
    const lines = fs.readFileSync(STORE_PATH, "utf8").split("\n");
    for (const line of lines) {
      if (!line) continue;
      let rec;
      try {
        rec = JSON.parse(line);
      } catch {
        continue;
      }
      if (!rec.ts || rec.ts < cutoff) continue;
      if (rec.ts < fromMs || rec.ts > toMs) continue;
      if (idSet && !idSet.has(String(rec.threadId))) continue;
      if (kw) {
        const text = (rec.items || []).map((it) => (typeof it.data?.content === "string" ? it.data.content : "")).join(" ");
        const norm = text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d");
        if (!norm.includes(kw)) continue;
      }
      if (Array.isArray(rec.items) && rec.items.length) out.push(rec.items);
    }
  } catch {}
  return out;
}

export function count() {
  try {
    return fs.readFileSync(STORE_PATH, "utf8").split("\n").filter(Boolean).length;
  } catch {
    return 0;
  }
}
