// Ai viết: Codex — kiểm thử log nền, xoay file và giảm dữ liệu nhạy cảm
// Tại sao: logging không được chặn bot hoặc giữ token/link/số điện thoại trong file lâu dài
// Link: yêu cầu tối ưu bảo mật và tốc độ ngày 2026-09-10

import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createLogger } from "./logger.js";

test("ghi nền che dữ liệu nhạy cảm, xoay log và xóa archive quá hạn", async () => {
  const logDir = await fs.mkdtemp(path.join(os.tmpdir(), "zalosale-logger-"));
  const oldArchive = path.join(logDir, "app-20000101T000000000.log");
  try {
    await fs.writeFile(oldArchive, "old");
    await fs.utimes(oldArchive, new Date("2000-01-01"), new Date("2000-01-01"));
    const logger = createLogger({
      logDir,
      maxFileBytes: 1,
      retentionDays: 14,
      consoleWriter: () => {},
    });

    logger.info("token=secret-value https://zalo.me/g/private-link +84871234567");
    await logger.flush();
    const activeLog = await fs.readFile(path.join(logDir, "app.log"), "utf8");
    assert.doesNotMatch(activeLog, /secret-value|private-link|84871234567/);
    assert.match(activeLog, /\[REDACTED\]/);

    logger.info("rotate this log");
    await logger.flush();
    const files = await fs.readdir(logDir);
    assert.equal(files.includes(path.basename(oldArchive)), false);
    assert.equal(files.some((file) => /^app-\d{8}T\d{9}\.log$/.test(file)), true);
  } finally {
    await fs.rm(logDir, { recursive: true, force: true });
  }
});

test("giữ archive chưa quá 30 ngày theo chính sách mặc định", async () => {
  const logDir = await fs.mkdtemp(path.join(os.tmpdir(), "zalosale-logger-retention-"));
  const recentArchive = path.join(logDir, "app-20000101T000000000.log");
  try {
    await fs.writeFile(recentArchive, "keep");
    const twentyDaysAgo = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000);
    await fs.utimes(recentArchive, twentyDaysAgo, twentyDaysAgo);
    const logger = createLogger({ logDir, consoleWriter: () => {} });

    logger.info("run cleanup");
    await logger.flush();

    assert.equal((await fs.readdir(logDir)).includes(path.basename(recentArchive)), true);
  } finally {
    await fs.rm(logDir, { recursive: true, force: true });
  }
});
