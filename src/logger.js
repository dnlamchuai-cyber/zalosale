// Ai viết: Codex — ghi log nền, xoay file và giảm dữ liệu nhạy cảm
// Tại sao: logging không được chặn bot hoặc giữ mã truy cập/link nhóm trong một file vô hạn
// Link: yêu cầu tối ưu bảo mật và tốc độ ngày 2026-09-10

import { EventEmitter } from "node:events";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DEFAULT_LOG_DIR = path.join(ROOT, "logs");
const DEFAULT_MAX_FILE_BYTES = 2 * 1024 * 1024;
const DEFAULT_RETENTION_DAYS = 30;
const DEFAULT_MAX_ARCHIVE_FILES = 10;
const FLUSH_INTERVAL_MS = 250;
const CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000;
const MAX_BUFFER_BYTES = 512 * 1024;

function formatArgument(arg) {
  if (arg instanceof Error) return arg.stack || arg.message;
  if (typeof arg === "object") {
    try {
      return JSON.stringify(arg);
    } catch {
      return String(arg);
    }
  }
  return String(arg);
}

function redactSensitiveText(text) {
  return text
    .replace(/\b(access[_-]?token|refresh[_-]?token|token|password|credential)\s*[:=]\s*[^\s,;]+/gi, "$1=[REDACTED]")
    .replace(/https?:\/\/zalo\.me\/g\/[^\s)\]]+/gi, "https://zalo.me/g/[REDACTED]")
    .replace(/(?<!\d)(?:\+84|0)\d{9}(?!\d)/g, "[REDACTED_PHONE]");
}

function archiveName(now) {
  return `app-${new Date(now).toISOString().replace(/[-:.]/g, "").replace("Z", "")}.log`;
}

export function createLogger({
  logDir = DEFAULT_LOG_DIR,
  maxFileBytes = DEFAULT_MAX_FILE_BYTES,
  retentionDays = DEFAULT_RETENTION_DAYS,
  maxArchiveFiles = DEFAULT_MAX_ARCHIVE_FILES,
  consoleWriter = console.log,
} = {}) {
  const logFile = path.join(logDir, "app.log");
  const logBus = new EventEmitter();
  let bufferedLines = [];
  let bufferedBytes = 0;
  let flushTimer = null;
  let flushing = null;
  let nextCleanupAt = 0;

  logBus.setMaxListeners(100);

  async function pruneArchives(now) {
    if (now < nextCleanupAt) return;
    nextCleanupAt = now + CLEANUP_INTERVAL_MS;
    const cutoff = now - retentionDays * 24 * 60 * 60 * 1000;
    const entries = await fs.readdir(logDir, { withFileTypes: true });
    const archives = await Promise.all(entries
      .filter((entry) => entry.isFile() && /^app-\d{8}T\d{9}(?:-\d+)?\.log$/.test(entry.name))
      .map(async (entry) => ({
        path: path.join(logDir, entry.name),
        modifiedAt: (await fs.stat(path.join(logDir, entry.name))).mtimeMs,
      })));
    archives.sort((a, b) => b.modifiedAt - a.modifiedAt);
    await Promise.all(archives
      .filter((archive, index) => archive.modifiedAt < cutoff || index >= maxArchiveFiles)
      .map((archive) => fs.unlink(archive.path)));
  }

  async function nextArchivePath(now) {
    const baseName = archiveName(now).replace(".log", "");
    for (let suffix = 0; suffix < 100; suffix++) {
      const candidate = path.join(logDir, `${baseName}${suffix ? `-${suffix}` : ""}.log`);
      try {
        await fs.access(candidate);
      } catch {
        return candidate;
      }
    }
    throw new Error("Không tạo được tên archive log duy nhất");
  }

  async function rotateIfNeeded(nextBytes, now) {
    try {
      const current = await fs.stat(logFile);
      if (current.size + nextBytes <= maxFileBytes) return;
      await fs.rename(logFile, await nextArchivePath(now));
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
  }

  async function flush() {
    if (flushTimer) {
      clearTimeout(flushTimer);
      flushTimer = null;
    }
    if (flushing) {
      await flushing;
      return flush();
    }
    if (!bufferedLines.length) return;

    const lines = bufferedLines.join("");
    const lineBytes = bufferedBytes;
    bufferedLines = [];
    bufferedBytes = 0;
    flushing = (async () => {
      await fs.mkdir(logDir, { recursive: true });
      const now = Date.now();
      await rotateIfNeeded(lineBytes, now);
      await fs.appendFile(logFile, lines, "utf8");
      await pruneArchives(now);
    })();
    try {
      await flushing;
    } catch (error) {
      consoleWriter(`${new Date().toISOString()} [WARN] Không ghi được log: ${error.message}`);
    } finally {
      flushing = null;
      if (bufferedLines.length) scheduleFlush();
    }
  }

  function scheduleFlush() {
    if (flushTimer || flushing) return;
    flushTimer = setTimeout(() => {
      flushTimer = null;
      void flush();
    }, FLUSH_INTERVAL_MS);
  }

  function write(level, args) {
    const line = redactSensitiveText(`${new Date().toISOString()} [${level}] ${args.map(formatArgument).join(" ")}`);
    consoleWriter(line);
    const lineBytes = Buffer.byteLength(line) + 1;
    if (bufferedBytes + lineBytes <= MAX_BUFFER_BYTES) {
      bufferedLines.push(`${line}\n`);
      bufferedBytes += lineBytes;
      scheduleFlush();
    }
    logBus.emit("log", { level, line });
  }

  process.once("beforeExit", () => { void flush(); });

  return {
    info: (...args) => write("INFO", args),
    warn: (...args) => write("WARN", args),
    error: (...args) => write("ERROR", args),
    debug: (...args) => write("DEBUG", args),
    onLog: (listener) => logBus.on("log", listener),
    flush,
  };
}

export const logger = createLogger();
