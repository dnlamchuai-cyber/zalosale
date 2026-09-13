// Ai viết: Codex
// Tại sao: kiểm chứng quota/sở hữu SQLite và quy tắc khoảng cách trước khi có UI bản đồ.
// Link: docs/03_SPEC/SPEC-006_MapRadiusSearch.md + docs/04_PROMPTS/PROMPT-009_SearchZonesAndDistance.md

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { haversineMeters, matchRoomsToZones } from "./distance.js";
import { createCustomerSearchService } from "./service.js";

const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "zalosale-search-zones-"));
let service;

function zoneInput(index = 0) {
  return {
    label: `Vùng ${index}`,
    center: { latitude: 20.972 + index / 1000, longitude: 105.778 },
    radiusMeters: 2_000,
    enabled: true,
  };
}

try {
  service = createCustomerSearchService({ databasePath: path.join(tempDirectory, "test.sqlite") });
  const customer = service.createCustomer({ name: "Lan", phone: "0901234567" });
  const request = service.createSearchRequest({ customerId: customer.id, title: "Hà Đông" });
  const otherRequest = service.createSearchRequest({ customerId: customer.id, title: "Mỹ Đình" });

  const firstZone = service.createSearchZone({ requestId: request.id, ...zoneInput() });
  assert.equal(firstZone.radiusMeters, 2_000);
  assert.equal(
    service.updateSearchZone({ requestId: request.id, zoneId: firstZone.id, ...zoneInput(), label: "Ga Hà Đông" }).label,
    "Ga Hà Đông",
  );
  assert.throws(
    () => service.createSearchZone({ requestId: request.id, ...zoneInput() }),
    (error) => error.code === "DUPLICATE_ZONE",
  );

  for (let index = 1; index < 10; index++) {
    service.createSearchZone({ requestId: request.id, ...zoneInput(index) });
  }
  assert.equal(service.listSearchZones(request.id).length, 10);
  assert.throws(
    () => service.createSearchZone({ requestId: request.id, ...zoneInput(10) }),
    (error) => error.code === "ZONE_LIMIT_REACHED",
  );
  assert.throws(
    () => service.updateSearchZone({ requestId: otherRequest.id, zoneId: firstZone.id, ...zoneInput(20) }),
    (error) => error.code === "SEARCH_ZONE_NOT_FOUND",
  );
  service.deleteSearchZone({ requestId: request.id, zoneId: firstZone.id });
  assert.equal(service.listSearchZones(request.id).length, 9);

  const distance = haversineMeters(
    { latitude: 0, longitude: 0 },
    { latitude: 0, longitude: 0.01 },
  );
  assert.ok(distance > 1_100 && distance < 1_120);
  assert.deepEqual(
    matchRoomsToZones({
      rooms: [{ id: "room-1", latitude: 0, longitude: 0.005 }],
      zones: [
        { id: "zone-a", center: { latitude: 0, longitude: 0 }, radiusMeters: 1_000, enabled: true },
        { id: "zone-b", center: { latitude: 0, longitude: 0 }, radiusMeters: 1_000, enabled: true },
        { id: "zone-off", center: { latitude: 0, longitude: 0 }, radiusMeters: 1_000, enabled: false },
      ],
    }),
    [{ room: { id: "room-1", latitude: 0, longitude: 0.005 }, matchedZoneIds: ["zone-a", "zone-b"] }],
  );
} finally {
  service?.close();
  fs.rmSync(tempDirectory, { recursive: true, force: true });
}
