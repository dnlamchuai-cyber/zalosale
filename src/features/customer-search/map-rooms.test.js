// Ai viết: Codex
// Tại sao: chứng minh API map chỉ trả phòng có tọa độ khớp, tách riêng phòng lệch vùng và chưa định vị.
// Link: docs/03_SPEC/SPEC-006_MapRadiusSearch.md + docs/04_PROMPTS/PROMPT-010_RoomLocationResolution.md

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createSentMessageRepository } from "../sent-message-index/repository.js";
import { createCustomerSearchService } from "./service.js";

const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "zalosale-map-rooms-"));
const databasePath = path.join(tempDirectory, "test.sqlite");
let sentRepository;
let service;

function addRoom(code) {
  return sentRepository.recordDelivery({
    roomCode: code,
    sourceGroup: { id: "source", name: "Nguồn" },
    destinationGroup: { id: "destination", name: "Đích" },
    originalContent: code,
    sentContent: code,
    normalizedSearch: code.toLowerCase(),
    contentHash: `hash-${code}`,
    sentAt: Date.now(),
    imageTotal: 0,
  });
}

try {
  sentRepository = createSentMessageRepository(databasePath);
  const matchedRoomId = addRoom("R-MATCH");
  const outsideRoomId = addRoom("R-OUTSIDE");
  const pendingRoomId = addRoom("R-PENDING");
  service = createCustomerSearchService({
    databasePath,
    geocoder: { geocode: async (address) => address.includes("match")
      ? [{ latitude: 20.972, longitude: 105.778, displayName: "Match" }]
      : [{ latitude: 21.2, longitude: 105.9, displayName: "Outside" }] },
  });
  await service.resolveRoomLocation({ roomId: matchedRoomId, address: "match address" });
  await service.resolveRoomLocation({ roomId: outsideRoomId, address: "outside address" });
  const customer = service.createCustomer({ name: "Lan", phone: "0901234567" });
  const request = service.createSearchRequest({ customerId: customer.id, title: "Hà Đông" });
  service.createSearchZone({ requestId: request.id, label: "Ga Hà Đông", center: { latitude: 20.972, longitude: 105.778 }, radiusMeters: 2_000, enabled: true });

  const result = service.mapRooms(request.id);
  assert.deepEqual(result.matchedRooms.map((entry) => entry.room.id), [matchedRoomId]);
  assert.deepEqual(result.unmatchedRooms.map((room) => room.id), [outsideRoomId]);
  assert.deepEqual(result.unlocatedRooms.map((room) => room.id), [pendingRoomId]);

  const standaloneResult = service.mapRoomsForZones([{ label: "Ga Hà Đông", center: { latitude: 20.972, longitude: 105.778 }, radiusMeters: 2_000, enabled: true }]);
  assert.equal(standaloneResult.requestId, null);
  assert.deepEqual(standaloneResult.matchedRooms.map((entry) => entry.room.id), [matchedRoomId]);
} finally {
  service?.close();
  sentRepository?.close();
  fs.rmSync(tempDirectory, { recursive: true, force: true });
}
