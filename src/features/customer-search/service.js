// Ai viết: Codex
// Tại sao: tập trung quy tắc số điện thoại và quan hệ khách → nhiều nhu cầu trước khi thêm bản đồ.
// Link: docs/03_SPEC/SPEC-006_MapRadiusSearch.md + docs/04_PROMPTS/PROMPT-008_MapSearchRequestFoundation.md + docs/04_PROMPTS/PROMPT-009_SearchZonesAndDistance.md + docs/04_PROMPTS/PROMPT-010_RoomLocationResolution.md

import path from "node:path";
import { fileURLToPath } from "node:url";
import { createCustomerSearchRepository } from "./repository.js";
import { createNominatimGeocoder, normalizeAddress } from "./geocoder.js";
import { matchRoomsToZones } from "./distance.js";
import { extractRoomAddress } from "./address.js";

const MAX_ZONES_PER_REQUEST = 10; // WHY: tránh vùng dư thừa làm map và lọc khó đọc.
const REUSABLE_GEOCODE_STATUSES = new Set(["located", "ambiguous"]);

const ROOT = path.dirname(path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url)))));
const DEFAULT_DATABASE_PATH = path.join(ROOT, "data", "zalosale.sqlite");
const VIETNAM_MOBILE_PATTERN = /^0\d{9}$/; // WHY: chỉ lưu số di động VN đã chuẩn hóa ở slice đầu.

function createDomainError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

export function normalizeVietnamesePhone(phone) {
  const compact = String(phone).trim().replace(/[\s().-]/g, "");
  const localNumber = compact.startsWith("+84")
    ? `0${compact.slice(3)}`
    : compact.startsWith("84")
      ? `0${compact.slice(2)}`
      : compact;
  if (!VIETNAM_MOBILE_PATTERN.test(localNumber)) {
    throw createDomainError("INVALID_PHONE", "Số điện thoại Việt Nam không hợp lệ");
  }
  return localNumber;
}

function toCustomer(row) {
  return {
    id: row.id,
    name: row.name,
    phoneDisplay: row.phone_display,
    phoneNormalized: row.phone_normalized,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toSearchRequest(row) {
  return {
    id: row.id,
    customerId: row.customer_id,
    title: row.title,
    active: Boolean(row.active),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toSearchZone(row) {
  return {
    id: row.id,
    requestId: row.search_request_id,
    label: row.label,
    center: { latitude: row.latitude, longitude: row.longitude },
    radiusMeters: row.radius_meters,
    enabled: Boolean(row.enabled),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function parseCandidates(value) {
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function toRoomLocation(row, candidates = []) {
  return {
    roomId: row.id,
    address: row.location_address || row.address || "",
    status: row.location_status || "pending",
    latitude: row.latitude ?? null,
    longitude: row.longitude ?? null,
    updatedAt: row.location_updated_at ?? null,
    candidates,
  };
}

function toMapRoom(row) {
  return {
    id: row.id,
    roomCode: row.room_code,
    address: row.address || row.location_address || "",
    latestContent: row.latest_content || "",
    status: row.status || "unknown",
    locationStatus: row.location_status || "pending",
    latitude: row.latitude ?? null,
    longitude: row.longitude ?? null,
  };
}

export function createCustomerSearchService({ databasePath = DEFAULT_DATABASE_PATH, geocoder = createNominatimGeocoder() } = {}) {
  const repository = createCustomerSearchRepository(databasePath);

  function createCustomer({ name, phone }) {
    const phoneNormalized = normalizeVietnamesePhone(phone);
    if (repository.findCustomerByPhone(phoneNormalized)) {
      throw createDomainError("DUPLICATE_PHONE", "Số điện thoại đã tồn tại");
    }
    return toCustomer(repository.insertCustomer({
      name: name.trim(),
      phoneNormalized,
      phoneDisplay: phone.trim(),
      timestamp: Date.now(),
    }));
  }

  function listCustomers() {
    return repository.listCustomers().map(toCustomer);
  }

  function createSearchRequest({ customerId, title }) {
    if (!repository.findCustomerById(customerId)) {
      throw createDomainError("CUSTOMER_NOT_FOUND", "Không tìm thấy khách");
    }
    return toSearchRequest(repository.insertSearchRequest({
      customerId,
      title: title.trim(),
      timestamp: Date.now(),
    }));
  }

  function listSearchRequests(customerId) {
    if (!repository.findCustomerById(customerId)) {
      throw createDomainError("CUSTOMER_NOT_FOUND", "Không tìm thấy khách");
    }
    return repository.listSearchRequests(customerId).map(toSearchRequest);
  }

  function setSearchRequestActive({ customerId, requestId, active }) {
    const request = repository.updateSearchRequestActive({
      customerId, requestId, active, timestamp: Date.now(),
    });
    if (!request || request.customer_id !== customerId) {
      throw createDomainError("SEARCH_REQUEST_NOT_FOUND", "Không tìm thấy nhu cầu");
    }
    return toSearchRequest(request);
  }

  function requireSearchRequest(requestId) {
    if (!repository.findSearchRequestById(requestId)) {
      throw createDomainError("SEARCH_REQUEST_NOT_FOUND", "Không tìm thấy nhu cầu");
    }
  }

  function createSearchZone({ requestId, label, center, radiusMeters, enabled }) {
    requireSearchRequest(requestId);
    if (repository.countSearchZones(requestId) >= MAX_ZONES_PER_REQUEST) {
      throw createDomainError("ZONE_LIMIT_REACHED", "Mỗi nhu cầu tối đa 10 vùng");
    }
    if (repository.findDuplicateSearchZone({ requestId, latitude: center.latitude, longitude: center.longitude, radiusMeters })) {
      throw createDomainError("DUPLICATE_ZONE", "Vùng có cùng tâm và bán kính đã tồn tại");
    }
    return toSearchZone(repository.insertSearchZone({
      requestId, label: label.trim(), latitude: center.latitude, longitude: center.longitude, radiusMeters, enabled, timestamp: Date.now(),
    }));
  }

  function listSearchZones(requestId) {
    requireSearchRequest(requestId);
    return repository.listSearchZones(requestId).map(toSearchZone);
  }

  function updateSearchZone({ requestId, zoneId, label, center, radiusMeters, enabled }) {
    requireSearchRequest(requestId);
    const currentZone = repository.findSearchZoneById(zoneId);
    if (!currentZone || currentZone.search_request_id !== requestId) {
      throw createDomainError("SEARCH_ZONE_NOT_FOUND", "Không tìm thấy vùng");
    }
    if (repository.findDuplicateSearchZone({
      requestId, latitude: center.latitude, longitude: center.longitude, radiusMeters, excludingZoneId: zoneId,
    })) {
      throw createDomainError("DUPLICATE_ZONE", "Vùng có cùng tâm và bán kính đã tồn tại");
    }
    return toSearchZone(repository.updateSearchZone({
      requestId, zoneId, label: label.trim(), latitude: center.latitude, longitude: center.longitude, radiusMeters, enabled, timestamp: Date.now(),
    }));
  }

  function deleteSearchZone({ requestId, zoneId }) {
    requireSearchRequest(requestId);
    if (!repository.deleteSearchZone({ requestId, zoneId })) {
      throw createDomainError("SEARCH_ZONE_NOT_FOUND", "Không tìm thấy vùng");
    }
  }

  async function resolveRoomLocation({ roomId, address, selectFirst = false }) {
    const room = repository.findRoomById(roomId);
    if (!room) throw createDomainError("ROOM_NOT_FOUND", "Không tìm thấy phòng");
    const cleanAddress = address.trim();
    const normalizedAddress = normalizeAddress(cleanAddress);
    const timestamp = Date.now();
    const changed = normalizeAddress(room.location_address || room.address || "") !== normalizedAddress;
    if (changed) repository.updateRoomLocation({ roomId, address: cleanAddress, status: "stale", latitude: null, longitude: null, timestamp });

    const cached = repository.findGeocodeCache(normalizedAddress);
    let status;
    let candidates;
    if (cached && REUSABLE_GEOCODE_STATUSES.has(cached.status)) {
      status = cached.status;
      candidates = parseCandidates(cached.candidates_json);
    } else {
      try {
        candidates = await geocoder.geocode(cleanAddress);
        status = candidates.length === 1 ? "located" : candidates.length > 1 ? "ambiguous" : "not_found";
        repository.upsertGeocodeCache({ normalizedAddress, status, candidatesJson: JSON.stringify(candidates), timestamp });
      } catch (error) {
        status = "failed";
        candidates = [];
      }
    }
    if (selectFirst && candidates.length > 0) status = "located";
    const point = status === "located" ? candidates[0] : null;
    const updated = repository.updateRoomLocation({
      roomId,
      address: cleanAddress,
      status,
      latitude: point?.latitude ?? null,
      longitude: point?.longitude ?? null,
      timestamp: Date.now(),
    });
    return toRoomLocation(updated, status === "ambiguous" ? candidates : []);
  }

  async function geocodeMapQuery(query) {
    const cleanQuery = query.trim();
    const normalizedQuery = normalizeAddress(cleanQuery);
    const cached = repository.findGeocodeCache(normalizedQuery);
    if (cached) return parseCandidates(cached.candidates_json);
    const candidates = await geocoder.geocode(cleanQuery);
    const status = candidates.length === 1 ? "located" : candidates.length > 1 ? "ambiguous" : "not_found";
    repository.upsertGeocodeCache({ normalizedAddress: normalizedQuery, status, candidatesJson: JSON.stringify(candidates), timestamp: Date.now() });
    return candidates;
  }

  function backfillRoomAddresses() {
    let updated = 0;
    for (const room of repository.listRoomsWithLocations()) {
      const address = extractRoomAddress(room.latest_original_content || room.latest_content);
      const staleLocation = ["not_found", "failed", "stale"].includes(room.location_status);
      const shouldRefresh = room.address.includes("\n") || normalizeAddress(room.address) !== normalizeAddress(address) || staleLocation;
      if (address) updated += repository.updateRoomAddress({ roomId: room.id, address, overwrite: shouldRefresh });
    }
    return { updated };
  }

  function mapRooms(requestId) {
    requireSearchRequest(requestId);
    const zones = repository.listSearchZones(requestId).map(toSearchZone);
    return mapRoomsForZones(zones, requestId);
  }

  function mapRoomsForZones(inputZones, requestId = null) {
    const timestamp = Date.now();
    const zones = inputZones.map((zone, index) => ({
      id: zone.id || `map-zone-${index + 1}`,
      requestId: zone.requestId || requestId || "",
      label: zone.label,
      center: zone.center,
      radiusMeters: zone.radiusMeters,
      enabled: zone.enabled !== false,
      createdAt: zone.createdAt || timestamp,
      updatedAt: zone.updatedAt || timestamp,
    }));
    const rows = repository.listRoomsWithLocations();
    const located = rows.filter((row) => row.location_status === "located" && Number.isFinite(row.latitude) && Number.isFinite(row.longitude));
    const matched = matchRoomsToZones({ rooms: located, zones }).map(({ room, matchedZoneIds }) => ({ room: toMapRoom(room), matchedZoneIds }));
    const matchedIds = new Set(matched.map((item) => item.room.id));
    const unmatchedRooms = located.filter((room) => !matchedIds.has(room.id)).map(toMapRoom);
    const unlocatedRooms = rows.filter((room) => !located.includes(room)).map(toMapRoom);
    return { requestId, zones, matchedRooms: matched, unmatchedRooms, unlocatedRooms };
  }

  return {
    createCustomer,
    listCustomers,
    createSearchRequest,
    listSearchRequests,
    setSearchRequestActive,
    createSearchZone,
    listSearchZones,
    updateSearchZone,
    deleteSearchZone,
    resolveRoomLocation,
    geocodeMapQuery,
    backfillRoomAddresses,
    mapRooms,
    mapRoomsForZones,
    close: repository.close,
  };
}
