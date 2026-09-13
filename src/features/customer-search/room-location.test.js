// Ai viết: Codex
// Tại sao: kiểm chứng geocoding chỉ nhận địa chỉ phòng, cache và trạng thái an toàn trước khi có marker.
// Link: docs/03_SPEC/SPEC-006_MapRadiusSearch.md + docs/04_PROMPTS/PROMPT-010_RoomLocationResolution.md

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createSentMessageRepository } from "../sent-message-index/repository.js";
import { createCustomerSearchService } from "./service.js";
import { createNominatimGeocoder } from "./geocoder.js";
import { extractRoomAddress } from "./address.js";

const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "zalosale-room-location-"));
const databasePath = path.join(tempDirectory, "test.sqlite");
let sentRepository;
let service;

function addRoom(roomCode) {
  return sentRepository.recordDelivery({
    roomCode,
    sourceGroup: { id: "source", name: "Nguồn" },
    destinationGroup: { id: "destination", name: "Đích" },
    originalContent: roomCode,
    sentContent: roomCode,
    normalizedSearch: roomCode.toLowerCase(),
    contentHash: `hash-${roomCode}`,
    sentAt: Date.now(),
    imageTotal: 0,
  });
}

try {
  assert.equal(extractRoomAddress("🏠 Địa chỉ : Ngõ 359 Âu Cơ - Tây Hồ\nGiá 3tr5"), "Ngõ 359 Âu Cơ - Tây Hồ");
  assert.equal(extractRoomAddress("📍 Thông ngõ 32 Lạc Long Quân – thoáng sáng\nGiá 4tr7"), "ngõ 32 Lạc Long Quân");
  sentRepository = createSentMessageRepository(databasePath);
  const roomId = addRoom("R-LOC-1");
  let calls = 0;
  service = createCustomerSearchService({
    databasePath,
    geocoder: { geocode: async () => { calls += 1; return [{ latitude: 20.972, longitude: 105.778, displayName: "Ngõ 7" }]; } },
  });

  const located = await service.resolveRoomLocation({ roomId, address: "Ngõ 7 Nguyễn Thái Học" });
  assert.equal(located.status, "located");
  assert.equal(located.latitude, 20.972);
  assert.equal(calls, 1);
  assert.equal((await service.resolveRoomLocation({ roomId, address: "ngõ 7   nguyễn thái học" })).status, "located");
  assert.equal(calls, 1, "địa chỉ chuẩn hóa phải dùng cache");

  const ambiguousRoomId = addRoom("R-LOC-2");
  service.close();
  service = createCustomerSearchService({
    databasePath,
    geocoder: { geocode: async () => [
      { latitude: 20.9, longitude: 105.7, displayName: "A" },
      { latitude: 21, longitude: 105.8, displayName: "B" },
    ] },
  });
  const ambiguous = await service.resolveRoomLocation({ roomId: ambiguousRoomId, address: "Địa chỉ mơ hồ" });
  assert.equal(ambiguous.status, "ambiguous");
  assert.equal(ambiguous.latitude, null);
  assert.equal(ambiguous.candidates.length, 2);
  const firstCandidate = await service.resolveRoomLocation({ roomId: ambiguousRoomId, address: "Địa chỉ mơ hồ", selectFirst: true });
  assert.equal(firstCandidate.status, "located");
  assert.equal(firstCandidate.latitude, 20.9);

  const changed = await service.resolveRoomLocation({ roomId: roomId, address: "Địa chỉ mới chưa rõ" });
  assert.equal(changed.status, "ambiguous");
  assert.equal(changed.latitude, null, "đổi địa chỉ không được giữ tọa độ cũ");

  const missingRoomId = addRoom("R-LOC-4");
  let retryCalls = 0;
  service.close();
  service = createCustomerSearchService({ databasePath, geocoder: { geocode: async () => [] } });
  assert.equal((await service.resolveRoomLocation({ roomId: missingRoomId, address: "Địa chỉ không tồn tại" })).status, "not_found");
  service.close();
  service = createCustomerSearchService({
    databasePath,
    geocoder: { geocode: async () => { retryCalls += 1; return [{ latitude: 20.97, longitude: 105.77, displayName: "Địa chỉ đã có" }]; } },
  });
  assert.equal((await service.resolveRoomLocation({ roomId: missingRoomId, address: "Địa chỉ không tồn tại" })).status, "located");
  assert.equal(retryCalls, 1, "kết quả not_found cũ không được chặn lần thử lại");

  const failedRoomId = addRoom("R-LOC-3");
  service.close();
  service = createCustomerSearchService({ databasePath, geocoder: { geocode: async () => { throw Object.assign(new Error("429"), { code: "RATE_LIMITED" }); } } });
  assert.equal((await service.resolveRoomLocation({ roomId: failedRoomId, address: "Địa chỉ giới hạn" })).status, "failed");

  let fetched = 0;
  const geocoder = createNominatimGeocoder({
    minIntervalMs: 0,
    fetcher: async (url, options) => {
      fetched += 1;
      assert.match(url, /format=jsonv2/);
      assert.equal(options.headers["User-Agent"], "test-zalosale");
      return { status: 200, ok: true, text: async () => JSON.stringify([{ lat: "20.9", lon: "105.7", display_name: "A" }]) };
    },
    userAgent: "test-zalosale",
  });
  assert.equal((await geocoder.geocode("18A Trung Kính")).length, 1);
  assert.equal(fetched, 1);

  let fallbackCalls = 0;
  const fallbackGeocoder = createNominatimGeocoder({
    minIntervalMs: 0,
    fetcher: async (url) => {
      fallbackCalls += 1;
      if (url.includes("nominatim")) return { status: 503, ok: false };
      return { status: 200, ok: true, text: async () => JSON.stringify({ features: [{ geometry: { coordinates: [105.7, 20.9] }, properties: { name: "Trung Kính", city: "Hà Nội" } }] }) };
    },
  });
  const fallbackResult = await fallbackGeocoder.geocode("Trung Kính");
  assert.deepEqual(fallbackResult[0], { latitude: 20.9, longitude: 105.7, displayName: "Trung Kính, Hà Nội", importance: null });
  assert.equal(fallbackCalls, 2);

  const limited = createNominatimGeocoder({ minIntervalMs: 0, fetcher: async () => ({ status: 429, ok: false }) });
  await assert.rejects(() => limited.geocode("Địa chỉ giới hạn"), (error) => error.code === "RATE_LIMITED");
  const timedOut = createNominatimGeocoder({
    minIntervalMs: 0,
    timeoutMs: 1,
    fetcher: async (_url, { signal }) => new Promise((_resolve, reject) => signal.addEventListener("abort", () => reject(Object.assign(new Error(), { name: "AbortError" })))),
  });
  await assert.rejects(() => timedOut.geocode("Địa chỉ quá lâu"), (error) => error.code === "TIMEOUT");
} finally {
  service?.close();
  sentRepository?.close();
  fs.rmSync(tempDirectory, { recursive: true, force: true });
}
