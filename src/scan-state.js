// AI: Codex | WHY: giữ kết quả quét thủ công qua lần khởi động lại, đồng thời khôi phục raw items để gửi tiếp.
// SPEC: yêu cầu “Quét & chọn tin để gửi” ngày 2026-09-10
import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import { classifyScanPost } from "./scan-post-status.js";

function toPersistedRaw(raw) {
  if (!(raw instanceof Map)) return [];
  return [...raw.entries()].map(([postId, value]) => ({
    postId: String(postId),
    tid: String(value?.tid || ""),
    items: Array.isArray(value?.items) ? value.items : [],
    batchMeta: value?.batchMeta && typeof value.batchMeta === "object" ? value.batchMeta : null,
  }));
}

function normalizeScan(value) {
  if (!value || typeof value !== "object") return null;
  if (typeof value.scanId !== "string" || !value.scanId || !Array.isArray(value.posts)) return null;
  const raw = new Map();
  for (const entry of Array.isArray(value.raw) ? value.raw : []) {
    if (!entry?.postId || !Array.isArray(entry.items)) continue;
    raw.set(String(entry.postId), {
      tid: String(entry.tid || ""),
      items: entry.items,
      batchMeta: entry.batchMeta && typeof entry.batchMeta === "object" ? entry.batchMeta : {},
    });
  }
  const posts = value.posts.map((post) => {
    if (!post || ["sent", "duplicate", "error"].includes(post.status)) return post;
    const entry = raw.get(String(post.id));
    if (!entry) return post;
    const status = classifyScanPost({
      items: entry.items,
      batchMeta: entry.batchMeta,
      undetermined: Boolean(post.undetermined || post.status === "undetermined"),
    });
    return { ...post, status };
  });
  return {
    scanId: value.scanId,
    scanQueryKey: String(value.scanQueryKey || ""),
    range: value.range && typeof value.range === "object" ? value.range : { label: "" },
    groups: Number(value.groups) || 0,
    posts,
    raw,
    fullBuildings: Array.isArray(value.fullBuildings) ? value.fullBuildings : [],
    historyCoverage: Array.isArray(value.historyCoverage) ? value.historyCoverage : [],
  };
}

export async function readPersistedScan(filePath) {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return normalizeScan(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function readPersistedScanSync(filePath) {
  try {
    return normalizeScan(JSON.parse(fsSync.readFileSync(filePath, "utf8")));
  } catch {
    return null;
  }
}

export async function writePersistedScan(filePath, scan) {
  if (!scan?.scanId || !Array.isArray(scan.posts)) return;
  const payload = {
    scanId: scan.scanId,
    scanQueryKey: scan.scanQueryKey || "",
    range: scan.range,
    groups: scan.groups,
    posts: scan.posts,
    raw: toPersistedRaw(scan.raw),
    fullBuildings: scan.fullBuildings || [],
    historyCoverage: scan.historyCoverage || [],
    savedAt: Date.now(),
  };
  const temporaryPath = `${filePath}.tmp`;
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(temporaryPath, JSON.stringify(payload), "utf8");
  await fs.rename(temporaryPath, filePath);
}

export function writePersistedScanSync(filePath, scan) {
  if (!scan?.scanId || !Array.isArray(scan.posts)) return;
  const payload = {
    scanId: scan.scanId,
    scanQueryKey: scan.scanQueryKey || "",
    range: scan.range,
    groups: scan.groups,
    posts: scan.posts,
    raw: toPersistedRaw(scan.raw),
    fullBuildings: scan.fullBuildings || [],
    historyCoverage: scan.historyCoverage || [],
    savedAt: Date.now(),
  };
  const temporaryPath = `${filePath}.tmp`;
  try {
    fsSync.mkdirSync(path.dirname(filePath), { recursive: true });
    fsSync.writeFileSync(temporaryPath, JSON.stringify(payload), "utf8");
    fsSync.renameSync(temporaryPath, filePath);
  } catch {
    try { fsSync.rmSync(temporaryPath, { force: true }); } catch {}
  }
}
