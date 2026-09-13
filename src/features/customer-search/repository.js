// Ai viết: Codex
// Tại sao: cô lập SQLite để service giữ quy tắc khách và nhu cầu, không lẫn SQL.
// Link: docs/03_SPEC/SPEC-006_MapRadiusSearch.md + docs/04_PROMPTS/PROMPT-008_MapSearchRequestFoundation.md + docs/04_PROMPTS/PROMPT-009_SearchZonesAndDistance.md + docs/04_PROMPTS/PROMPT-010_RoomLocationResolution.md

import crypto from "node:crypto";
import { openDatabase } from "../../db/client.js";

export function createCustomerSearchRepository(databasePath) {
  const database = openDatabase(databasePath);

  function findCustomerByPhone(phoneNormalized) {
    return database.prepare("SELECT * FROM customers WHERE phone_normalized = ?").get(phoneNormalized);
  }

  function findCustomerById(customerId) {
    return database.prepare("SELECT * FROM customers WHERE id = ?").get(customerId);
  }

  function listCustomers() {
    return database.prepare("SELECT * FROM customers ORDER BY updated_at DESC, id DESC").all();
  }

  function insertCustomer({ name, phoneNormalized, phoneDisplay, timestamp }) {
    const id = crypto.randomUUID();
    database.prepare(`
      INSERT INTO customers (id, name, phone_normalized, phone_display, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, name, phoneNormalized, phoneDisplay, timestamp, timestamp);
    return findCustomerById(id);
  }

  function insertSearchRequest({ customerId, title, timestamp }) {
    const id = crypto.randomUUID();
    database.prepare(`
      INSERT INTO customer_search_requests (id, customer_id, title, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, customerId, title, timestamp, timestamp);
    return findSearchRequestById(id);
  }

  function findSearchRequestById(requestId) {
    return database.prepare("SELECT * FROM customer_search_requests WHERE id = ?").get(requestId);
  }

  function listSearchRequests(customerId) {
    return database.prepare(`
      SELECT * FROM customer_search_requests
      WHERE customer_id = ? ORDER BY created_at DESC, rowid DESC
    `).all(customerId);
  }

  function updateSearchRequestActive({ customerId, requestId, active, timestamp }) {
    database.prepare(`
      UPDATE customer_search_requests SET active = ?, updated_at = ?
      WHERE id = ? AND customer_id = ?
    `).run(active ? 1 : 0, timestamp, requestId, customerId);
    return findSearchRequestById(requestId);
  }

  function countSearchZones(requestId) {
    return database.prepare("SELECT COUNT(*) AS total FROM customer_search_zones WHERE search_request_id = ?")
      .get(requestId).total;
  }

  function findSearchZoneById(zoneId) {
    return database.prepare("SELECT * FROM customer_search_zones WHERE id = ?").get(zoneId);
  }

  function findDuplicateSearchZone({ requestId, latitude, longitude, radiusMeters, excludingZoneId = "" }) {
    return database.prepare(`
      SELECT id FROM customer_search_zones
      WHERE search_request_id = ? AND latitude = ? AND longitude = ? AND radius_meters = ? AND id != ?
    `).get(requestId, latitude, longitude, radiusMeters, excludingZoneId);
  }

  function insertSearchZone({ requestId, label, latitude, longitude, radiusMeters, enabled, timestamp }) {
    const id = crypto.randomUUID();
    database.prepare(`
      INSERT INTO customer_search_zones
        (id, search_request_id, label, latitude, longitude, radius_meters, enabled, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, requestId, label, latitude, longitude, radiusMeters, enabled ? 1 : 0, timestamp, timestamp);
    return findSearchZoneById(id);
  }

  function listSearchZones(requestId) {
    return database.prepare(`
      SELECT * FROM customer_search_zones WHERE search_request_id = ? ORDER BY created_at ASC, rowid ASC
    `).all(requestId);
  }

  function updateSearchZone({ requestId, zoneId, label, latitude, longitude, radiusMeters, enabled, timestamp }) {
    database.prepare(`
      UPDATE customer_search_zones
      SET label = ?, latitude = ?, longitude = ?, radius_meters = ?, enabled = ?, updated_at = ?
      WHERE id = ? AND search_request_id = ?
    `).run(label, latitude, longitude, radiusMeters, enabled ? 1 : 0, timestamp, zoneId, requestId);
    return findSearchZoneById(zoneId);
  }

  function deleteSearchZone({ requestId, zoneId }) {
    return database.prepare("DELETE FROM customer_search_zones WHERE id = ? AND search_request_id = ?")
      .run(zoneId, requestId).changes;
  }

  function findRoomById(roomId) {
    return database.prepare("SELECT * FROM room_records WHERE id = ?").get(roomId);
  }

  function listRoomsWithLocations() {
    return database.prepare(`
      SELECT room_records.*,
        (SELECT original_content FROM sent_messages WHERE room_id = room_records.id ORDER BY sent_at DESC, captured_at DESC LIMIT 1) AS latest_original_content
      FROM room_records ORDER BY updated_at DESC, id DESC
    `).all();
  }

  function findGeocodeCache(normalizedAddress) {
    return database.prepare("SELECT * FROM geocode_cache WHERE normalized_address = ?").get(normalizedAddress);
  }

  function upsertGeocodeCache({ normalizedAddress, status, candidatesJson, timestamp }) {
    database.prepare(`
      INSERT INTO geocode_cache (normalized_address, status, candidates_json, updated_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(normalized_address) DO UPDATE SET
        status = excluded.status, candidates_json = excluded.candidates_json, updated_at = excluded.updated_at
    `).run(normalizedAddress, status, candidatesJson, timestamp);
  }

  function updateRoomLocation({ roomId, address, status, latitude, longitude, timestamp }) {
    database.prepare(`
      UPDATE room_records
      SET address = ?, location_address = ?, location_status = ?, latitude = ?, longitude = ?, location_updated_at = ?
      WHERE id = ?
    `).run(address, address, status, latitude, longitude, timestamp, roomId);
    return findRoomById(roomId);
  }

  function updateRoomAddress({ roomId, address, overwrite = false }) {
    return database.prepare(`
      UPDATE room_records
      SET address = ?,
          location_address = ?,
          location_status = CASE WHEN ? = 1 THEN 'pending' ELSE location_status END,
          latitude = CASE WHEN ? = 1 THEN NULL ELSE latitude END,
          longitude = CASE WHEN ? = 1 THEN NULL ELSE longitude END,
          location_updated_at = CASE WHEN ? = 1 THEN NULL ELSE location_updated_at END
      WHERE id = ? AND (address = '' OR ? = 1)
    `).run(address, address, overwrite ? 1 : 0, overwrite ? 1 : 0, overwrite ? 1 : 0, overwrite ? 1 : 0, roomId, overwrite ? 1 : 0).changes;
  }

  return {
    findCustomerByPhone,
    findCustomerById,
    listCustomers,
    insertCustomer,
    insertSearchRequest,
    findSearchRequestById,
    listSearchRequests,
    updateSearchRequestActive,
    countSearchZones,
    findSearchZoneById,
    findDuplicateSearchZone,
    insertSearchZone,
    listSearchZones,
    updateSearchZone,
    deleteSearchZone,
    findRoomById,
    listRoomsWithLocations,
    findGeocodeCache,
    upsertGeocodeCache,
    updateRoomLocation,
    updateRoomAddress,
    close: () => database.close(),
  };
}
