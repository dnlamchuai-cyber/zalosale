// AI: Codex | WHY: Lock the permanent metadata cache behavior without making Zalo API calls.
// SPEC: user request to retain source/destination group data on 2026-09-06
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { readPersistedGroups } from "./group-cache.js";

test("reads saved group metadata even when the scan timestamp is old", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "zalosale-group-cache-"));
  const cachePath = path.join(directory, "groups-cache.json");
  fs.writeFileSync(cachePath, JSON.stringify({
    savedAt: Date.now() - 365 * 24 * 60 * 60 * 1000,
    groups: [{ id: "source-1", name: "Nhóm nguồn", avatar: "https://example.test/source.jpg", creatorId: "private-owner-id" }],
  }), "utf8");

  try {
    assert.deepEqual(readPersistedGroups(cachePath), [{ id: "source-1", name: "Nhóm nguồn", avatar: "https://example.test/source.jpg" }]);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("ignores invalid entries from a manually changed cache file", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "zalosale-group-cache-"));
  const cachePath = path.join(directory, "groups-cache.json");
  fs.writeFileSync(cachePath, JSON.stringify({ groups: [{ id: "", name: "" }, { id: 42, name: "Nhóm hợp lệ" }] }), "utf8");

  try {
    assert.deepEqual(readPersistedGroups(cachePath), [{ id: "42", name: "Nhóm hợp lệ" }]);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
