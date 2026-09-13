// Ai viết: Codex
// Tại sao: tách phép tính khoảng cách thuần để test chính xác mà không cần SQLite hay map UI.
// Link: docs/03_SPEC/SPEC-006_MapRadiusSearch.md + docs/04_PROMPTS/PROMPT-009_SearchZonesAndDistance.md

const EARTH_RADIUS_METERS = 6_371_000; // WHY: bán kính Trái Đất trung bình, đủ chính xác cho vòng tìm trọ.
const DEGREES_TO_RADIANS = Math.PI / 180;

function toRadians(degrees) {
  return degrees * DEGREES_TO_RADIANS;
}

export function haversineMeters(from, to) {
  const latitudeDelta = toRadians(to.latitude - from.latitude);
  const longitudeDelta = toRadians(to.longitude - from.longitude);
  const latitudeA = toRadians(from.latitude);
  const latitudeB = toRadians(to.latitude);
  const halfChord = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(latitudeA) * Math.cos(latitudeB) * Math.sin(longitudeDelta / 2) ** 2;
  return EARTH_RADIUS_METERS * 2 * Math.atan2(Math.sqrt(halfChord), Math.sqrt(1 - halfChord));
}

function matchedZoneIds(room, zones) {
  return zones.flatMap((zone) => {
    if (zone.enabled === false) return [];
    const distance = haversineMeters(room, zone.center);
    return distance <= zone.radiusMeters ? [zone.id] : [];
  });
}

export function matchRoomsToZones({ rooms = [], zones = [] }) {
  return rooms.flatMap((room) => {
    const zoneIds = matchedZoneIds(room, zones);
    return zoneIds.length ? [{ room, matchedZoneIds: zoneIds }] : [];
  });
}
