// Ai viết: Codex
// Tại sao: kiểm chứng HTTP boundary validate input và không lộ lỗi nội bộ/PII.
// Link: docs/03_SPEC/SPEC-006_MapRadiusSearch.md + docs/04_PROMPTS/PROMPT-008_MapSearchRequestFoundation.md + docs/04_PROMPTS/PROMPT-009_SearchZonesAndDistance.md

import assert from "node:assert/strict";
import { customerSearchRoutes } from "./route.js";

function mockResponse() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
    send() { return this; },
  };
}

function mockApp() {
  const routes = new Map();
  return {
    routes,
    get(path, handler) { routes.set(`GET ${path}`, handler); },
    post(path, handler) { routes.set(`POST ${path}`, handler); },
    patch(path, handler) { routes.set(`PATCH ${path}`, handler); },
    put(path, handler) { routes.set(`PUT ${path}`, handler); },
    delete(path, handler) { routes.set(`DELETE ${path}`, handler); },
  };
}

const customer = { id: "52eeaebd-70ef-4d57-8a55-78fd95e2fc9d", name: "Lan", phoneNormalized: "0901234567" };
const searchRequest = { id: "6a1c10b5-065c-429b-8658-bcf449ea0a29", customerId: customer.id, title: "Quanh Ga Hà Đông", active: true };
const zone = { id: "f6a4fb5d-a18a-4a98-bb47-0b6e44b9b978", requestId: searchRequest.id, label: "Ngõ 7 Nguyễn Thái Học", center: { latitude: 20.972, longitude: 105.778 }, radiusMeters: 2_000, enabled: true };
const roomId = "f7a4fb5d-a18a-4a98-bb47-0b6e44b9b978";
const location = { roomId, address: "Ngõ 7 Nguyễn Thái Học", status: "located", latitude: 20.972, longitude: 105.778, updatedAt: 1, candidates: [] };
const app = mockApp();
const service = {
  createCustomer: () => customer,
  listCustomers: () => [customer],
  createSearchRequest: () => searchRequest,
  listSearchRequests: () => [searchRequest],
  setSearchRequestActive: () => ({ ...searchRequest, active: false }),
  createSearchZone: () => zone,
  listSearchZones: () => [zone],
  updateSearchZone: () => zone,
  deleteSearchZone: () => {},
  resolveRoomLocation: async () => location,
  mapRooms: () => ({ requestId: searchRequest.id, zones: [zone], matchedRooms: [], unmatchedRooms: [], unlocatedRooms: [] }),
  mapRoomsForZones: (zones) => ({ requestId: null, zones, matchedRooms: [], unmatchedRooms: [], unlocatedRooms: [] }),
  geocodeMapQuery: async () => [{ latitude: 20.972, longitude: 105.778, displayName: zone.label }],
};

customerSearchRoutes(app, () => service);

const createResponse = mockResponse();
app.routes.get("POST /api/customers")({ body: { name: "Lan", phone: "0901 234 567" } }, createResponse);
assert.equal(createResponse.statusCode, 201);
assert.deepEqual(createResponse.body, { ok: true, customer });

const invalidResponse = mockResponse();
app.routes.get("POST /api/customers")({ body: { name: "", phone: "0901" } }, invalidResponse);
assert.equal(invalidResponse.statusCode, 400);

const requestResponse = mockResponse();
app.routes.get("POST /api/customers/:customerId/search-requests")({
  params: { customerId: customer.id }, body: { title: "Quanh Ga Hà Đông" },
}, requestResponse);
assert.equal(requestResponse.statusCode, 201);
assert.deepEqual(requestResponse.body, { ok: true, searchRequest });

const activeResponse = mockResponse();
app.routes.get("PATCH /api/customers/:customerId/search-requests/:requestId")({
  params: { customerId: customer.id, requestId: searchRequest.id }, body: { active: false },
}, activeResponse);
assert.equal(activeResponse.statusCode, 200);
assert.equal(activeResponse.body.searchRequest.active, false);

const zoneResponse = mockResponse();
app.routes.get("POST /api/search-requests/:requestId/search-zones")({
  params: { requestId: searchRequest.id }, body: { label: zone.label, center: zone.center, radiusMeters: 2_000, enabled: true },
}, zoneResponse);
assert.equal(zoneResponse.statusCode, 201);
assert.deepEqual(zoneResponse.body, { ok: true, zone });

const minimumRadiusResponse = mockResponse();
app.routes.get("POST /api/search-requests/:requestId/search-zones")({
  params: { requestId: searchRequest.id }, body: { label: zone.label, center: zone.center, radiusMeters: 200, enabled: true },
}, minimumRadiusResponse);
assert.equal(minimumRadiusResponse.statusCode, 201);

const maximumRadiusResponse = mockResponse();
app.routes.get("POST /api/search-requests/:requestId/search-zones")({
  params: { requestId: searchRequest.id }, body: { label: zone.label, center: zone.center, radiusMeters: 20_000, enabled: true },
}, maximumRadiusResponse);
assert.equal(maximumRadiusResponse.statusCode, 201);

const invalidZoneResponse = mockResponse();
app.routes.get("POST /api/search-requests/:requestId/search-zones")({
  params: { requestId: searchRequest.id }, body: { label: zone.label, center: zone.center, radiusMeters: 199, enabled: true },
}, invalidZoneResponse);
assert.equal(invalidZoneResponse.statusCode, 400);

const deletedZoneResponse = mockResponse();
app.routes.get("DELETE /api/search-requests/:requestId/search-zones/:zoneId")({
  params: { requestId: searchRequest.id, zoneId: zone.id },
}, deletedZoneResponse);
assert.equal(deletedZoneResponse.statusCode, 204);

const hiddenInternalResponse = mockResponse();
const errorApp = mockApp();
customerSearchRoutes(errorApp, () => ({
  ...service,
  createCustomer: () => { throw new Error("phone=0901234567 sqlite=/private/path"); },
}));
errorApp.routes.get("POST /api/customers")({ body: { name: "Lan", phone: "0901 234 567" } }, hiddenInternalResponse);
assert.equal(hiddenInternalResponse.statusCode, 500);
assert.equal(JSON.stringify(hiddenInternalResponse.body).includes("0901234567"), false);
assert.equal(JSON.stringify(hiddenInternalResponse.body).includes("/private/path"), false);

const locationResponse = mockResponse();
await app.routes.get("POST /api/rooms/:roomId/location/resolve")({
  params: { roomId }, body: { address: location.address },
}, locationResponse);
assert.equal(locationResponse.statusCode, 200);
assert.deepEqual(locationResponse.body, { ok: true, location });

const invalidLocationResponse = mockResponse();
await app.routes.get("POST /api/rooms/:roomId/location/resolve")({
  params: { roomId: "not-a-uuid" }, body: { address: location.address },
}, invalidLocationResponse);
assert.equal(invalidLocationResponse.statusCode, 400);

const mapRoomsResponse = mockResponse();
app.routes.get("GET /api/search-requests/:requestId/map-rooms")({ params: { requestId: searchRequest.id } }, mapRoomsResponse);
assert.equal(mapRoomsResponse.statusCode, 200);
assert.equal(mapRoomsResponse.body.matchedRooms.length, 0);

const geocodeResponse = mockResponse();
await app.routes.get("POST /api/map/geocode")({ body: { query: zone.label } }, geocodeResponse);
assert.equal(geocodeResponse.statusCode, 200);
assert.equal(geocodeResponse.body.candidates.length, 1);

const standaloneMapResponse = mockResponse();
app.routes.get("POST /api/map/rooms")({ body: { zones: [{ label: zone.label, center: zone.center, radiusMeters: zone.radiusMeters, enabled: true }] } }, standaloneMapResponse);
assert.equal(standaloneMapResponse.statusCode, 200);
assert.equal(standaloneMapResponse.body.requestId, null);
assert.equal(standaloneMapResponse.body.zones.length, 1);
