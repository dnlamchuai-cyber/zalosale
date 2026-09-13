// Ai viết: Codex
// Tại sao: HTTP boundary chỉ validate, gọi service và che lỗi nội bộ/PII khỏi client.
// Link: docs/03_SPEC/SPEC-006_MapRadiusSearch.md + docs/04_PROMPTS/PROMPT-008_MapSearchRequestFoundation.md + docs/04_PROMPTS/PROMPT-009_SearchZonesAndDistance.md + docs/04_PROMPTS/PROMPT-010_RoomLocationResolution.md

import {
  CreateCustomerSchema,
  CreateSearchRequestSchema,
  CustomerIdSchema,
  SearchRequestIdSchema,
  SearchZoneIdSchema,
  SearchZoneInputSchema,
  UpdateSearchRequestSchema,
  ResolveRoomLocationSchema,
  RoomIdSchema,
  MapGeocodeQuerySchema,
  MapRoomsInputSchema,
} from "./schema.js";

function parseOrRespond(schema, value, res) {
  const parsed = schema.safeParse(value);
  if (parsed.success) return parsed.data;
  res.status(400).json({ ok: false, error: parsed.error.issues[0]?.message || "Dữ liệu không hợp lệ" });
  return null;
}

function serviceOrRespond(getService, res) {
  const service = getService();
  if (service) return service;
  res.status(503).json({ ok: false, error: "Tìm kiếm khách chưa sẵn sàng" });
  return null;
}

function errorStatus(error) {
  if (error?.code === "DUPLICATE_PHONE") return 409;
  if (error?.code === "CUSTOMER_NOT_FOUND" || error?.code === "SEARCH_REQUEST_NOT_FOUND" || error?.code === "SEARCH_ZONE_NOT_FOUND") return 404;
  if (error?.code === "ROOM_NOT_FOUND") return 404;
  if (error?.code === "RATE_LIMITED" || error?.code === "TIMEOUT" || error?.code === "GEOCODER_FAILED") return 502;
  if (error?.code === "DUPLICATE_ZONE" || error?.code === "ZONE_LIMIT_REACHED") return 409;
  if (error?.code === "INVALID_PHONE") return 400;
  return 500;
}

function sendServiceError(error, res, fallbackMessage = "Không thể định vị phòng lúc này") {
  const status = errorStatus(error);
  const message = status === 500 || status === 502 ? fallbackMessage : error.message;
  return res.status(status).json({ ok: false, error: message });
}

export function customerSearchRoutes(app, getService) {
  app.get("/api/customers", (req, res) => {
    const service = serviceOrRespond(getService, res);
    if (!service) return;
    try {
      return res.json({ ok: true, customers: service.listCustomers() });
    } catch (error) {
      return sendServiceError(error, res);
    }
  });

  app.post("/api/customers", (req, res) => {
    const input = parseOrRespond(CreateCustomerSchema, req.body || {}, res);
    if (!input) return;
    const service = serviceOrRespond(getService, res);
    if (!service) return;
    try {
      return res.status(201).json({ ok: true, customer: service.createCustomer(input) });
    } catch (error) {
      return sendServiceError(error, res);
    }
  });

  app.get("/api/customers/:customerId/search-requests", (req, res) => {
    const customerId = parseOrRespond(CustomerIdSchema, req.params.customerId, res);
    if (!customerId) return;
    const service = serviceOrRespond(getService, res);
    if (!service) return;
    try {
      return res.json({ ok: true, searchRequests: service.listSearchRequests(customerId) });
    } catch (error) {
      return sendServiceError(error, res);
    }
  });

  app.post("/api/customers/:customerId/search-requests", (req, res) => {
    const customerId = parseOrRespond(CustomerIdSchema, req.params.customerId, res);
    if (!customerId) return;
    const input = parseOrRespond(CreateSearchRequestSchema, req.body || {}, res);
    if (!input) return;
    const service = serviceOrRespond(getService, res);
    if (!service) return;
    try {
      return res.status(201).json({ ok: true, searchRequest: service.createSearchRequest({ customerId, ...input }) });
    } catch (error) {
      return sendServiceError(error, res);
    }
  });

  app.patch("/api/customers/:customerId/search-requests/:requestId", (req, res) => {
    const customerId = parseOrRespond(CustomerIdSchema, req.params.customerId, res);
    if (!customerId) return;
    const requestId = parseOrRespond(SearchRequestIdSchema, req.params.requestId, res);
    if (!requestId) return;
    const input = parseOrRespond(UpdateSearchRequestSchema, req.body || {}, res);
    if (!input) return;
    const service = serviceOrRespond(getService, res);
    if (!service) return;
    try {
      return res.json({ ok: true, searchRequest: service.setSearchRequestActive({ customerId, requestId, ...input }) });
    } catch (error) {
      return sendServiceError(error, res);
    }
  });

  app.get("/api/search-requests/:requestId/search-zones", (req, res) => {
    const requestId = parseOrRespond(SearchRequestIdSchema, req.params.requestId, res);
    if (!requestId) return;
    const service = serviceOrRespond(getService, res);
    if (!service) return;
    try {
      return res.json({ ok: true, zones: service.listSearchZones(requestId) });
    } catch (error) {
      return sendServiceError(error, res);
    }
  });

  app.post("/api/search-requests/:requestId/search-zones", (req, res) => {
    const requestId = parseOrRespond(SearchRequestIdSchema, req.params.requestId, res);
    if (!requestId) return;
    const input = parseOrRespond(SearchZoneInputSchema, req.body || {}, res);
    if (!input) return;
    const service = serviceOrRespond(getService, res);
    if (!service) return;
    try {
      return res.status(201).json({ ok: true, zone: service.createSearchZone({ requestId, ...input }) });
    } catch (error) {
      return sendServiceError(error, res);
    }
  });

  app.put("/api/search-requests/:requestId/search-zones/:zoneId", (req, res) => {
    const requestId = parseOrRespond(SearchRequestIdSchema, req.params.requestId, res);
    if (!requestId) return;
    const zoneId = parseOrRespond(SearchZoneIdSchema, req.params.zoneId, res);
    if (!zoneId) return;
    const input = parseOrRespond(SearchZoneInputSchema, req.body || {}, res);
    if (!input) return;
    const service = serviceOrRespond(getService, res);
    if (!service) return;
    try {
      return res.json({ ok: true, zone: service.updateSearchZone({ requestId, zoneId, ...input }) });
    } catch (error) {
      return sendServiceError(error, res);
    }
  });

  app.delete("/api/search-requests/:requestId/search-zones/:zoneId", (req, res) => {
    const requestId = parseOrRespond(SearchRequestIdSchema, req.params.requestId, res);
    if (!requestId) return;
    const zoneId = parseOrRespond(SearchZoneIdSchema, req.params.zoneId, res);
    if (!zoneId) return;
    const service = serviceOrRespond(getService, res);
    if (!service) return;
    try {
      service.deleteSearchZone({ requestId, zoneId });
      return res.status(204).send();
    } catch (error) {
      return sendServiceError(error, res);
    }
  });

  app.post("/api/rooms/:roomId/location/resolve", async (req, res) => {
    const roomId = parseOrRespond(RoomIdSchema, req.params.roomId, res);
    if (!roomId) return;
    const input = parseOrRespond(ResolveRoomLocationSchema, req.body || {}, res);
    if (!input) return;
    const service = serviceOrRespond(getService, res);
    if (!service) return;
    try {
      return res.json({ ok: true, location: await service.resolveRoomLocation({ roomId, ...input }) });
    } catch (error) {
      return sendServiceError(error, res);
    }
  });

  app.get("/api/search-requests/:requestId/map-rooms", (req, res) => {
    const requestId = parseOrRespond(SearchRequestIdSchema, req.params.requestId, res);
    if (!requestId) return;
    const service = serviceOrRespond(getService, res);
    if (!service) return;
    try {
      return res.json({ ok: true, ...service.mapRooms(requestId) });
    } catch (error) {
      return sendServiceError(error, res);
    }
  });

  app.post("/api/map/rooms", (req, res) => {
    const input = parseOrRespond(MapRoomsInputSchema, req.body || {}, res);
    if (!input) return;
    const service = serviceOrRespond(getService, res);
    if (!service) return;
    try {
      return res.json({ ok: true, ...service.mapRoomsForZones(input.zones) });
    } catch (error) {
      return sendServiceError(error, res, "Không thể tải dữ liệu phòng lúc này");
    }
  });

  app.post("/api/map/rooms/backfill-addresses", (req, res) => {
    const service = serviceOrRespond(getService, res);
    if (!service) return;
    try {
      return res.json({ ok: true, ...service.backfillRoomAddresses() });
    } catch (error) {
      return sendServiceError(error, res, "Không thể nhận diện địa chỉ lúc này");
    }
  });

  app.post("/api/map/geocode", async (req, res) => {
    const input = parseOrRespond(MapGeocodeQuerySchema, req.body || {}, res);
    if (!input) return;
    const service = serviceOrRespond(getService, res);
    if (!service) return;
    try {
      return res.json({ ok: true, candidates: await service.geocodeMapQuery(input.query) });
    } catch (error) {
      return sendServiceError(error, res, "Không thể tìm địa chỉ lúc này");
    }
  });
}
