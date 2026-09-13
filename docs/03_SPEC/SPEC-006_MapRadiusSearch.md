<!--
Ai viết: Codex
Tại sao: Định nghĩa dữ liệu vùng, tọa độ và hợp đồng lọc trước khi thêm thư viện bản đồ hoặc gọi geocoding.
Link: docs/02_BIZ/BIZ-005_MapRadiusSearch.md
-->

# SPEC-006 — Tìm phòng theo vùng bản đồ

> Trạng thái: ✅ Approved | Từ: BIZ-005 | Ngày: 2026-09-12 | Người duyệt: User

## 1. Quyết định kỹ thuật cần duyệt

- UI map: Leaflet + React Leaflet, tile từ OpenStreetMap. Cần thêm hai dependency frontend; chưa cài trước khi user duyệt spec.
- Geocoding: backend gọi Nominatim OpenStreetMap, tuần tự và cache cục bộ theo địa chỉ chuẩn hóa. Chỉ gửi địa chỉ phòng hoặc truy vấn địa chỉ do người vận hành nhập.
- Tính khoảng cách: Haversine tại service thuần, đường chim bay. Đây là bộ lọc vùng, không phải quãng đường di chuyển.
- Lưu cục bộ SQLite cùng kho tin đã gửi. Không gửi dữ liệu khách sang tile/geocoding service.

## 2. Kiểu dữ liệu

```ts
const MIN_RADIUS_METERS = 200;
const MAX_RADIUS_METERS = 20_000;

const MapPointSchema = z.object({
  latitude: z.number().finite().min(-90).max(90),
  longitude: z.number().finite().min(-180).max(180),
});

const SearchZoneInputSchema = z.object({
  label: z.string().trim().min(2).max(160),
  center: MapPointSchema,
  radiusMeters: z.number().int().min(MIN_RADIUS_METERS).max(MAX_RADIUS_METERS),
  enabled: z.boolean().default(true),
});

const RoomLocationStatus = z.enum(["pending", "located", "ambiguous", "not_found", "failed", "stale"]);
```

`customer_search_requests` owns search zones. A customer can own many requests and each request can own many zones. Room coordinates attach to `room_records`; the active location matches the current saved address. This keeps a search request independent of rooms selected later in CRM.

## 3. SQLite migration

```sql
CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone_normalized TEXT NOT NULL UNIQUE,
  phone_display TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS customer_search_requests (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS customer_search_zones (
  id TEXT PRIMARY KEY,
  search_request_id TEXT NOT NULL REFERENCES customer_search_requests(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  radius_meters INTEGER NOT NULL CHECK (radius_meters BETWEEN 200 AND 20000),
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS customer_search_zones_case_idx
  ON customer_search_zones(search_request_id);

ALTER TABLE room_records ADD COLUMN latitude REAL;
ALTER TABLE room_records ADD COLUMN longitude REAL;
ALTER TABLE room_records ADD COLUMN location_status TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE room_records ADD COLUMN location_address TEXT NOT NULL DEFAULT '';
ALTER TABLE room_records ADD COLUMN location_updated_at INTEGER;
```

The actual migration must be idempotent for existing databases; SQLite `ALTER TABLE` guards will be implemented in the migration runner rather than executed blindly.

## 4. API contract

| Method | Endpoint | Purpose | Key validation |
|---|---|---|---|
| GET/POST | `/api/customers` | List/create customer profiles | name and normalized phone |
| GET/POST | `/api/customers/:customerId/search-requests` | List/create search requests | UUID customer id; title 2–120 chars |
| PATCH | `/api/customers/:customerId/search-requests/:requestId` | Turn a request on/off | UUID ownership and boolean `active` |
| GET | `/api/search-requests/:requestId/search-zones` | List request zones | UUID request id |
| POST | `/api/search-requests/:requestId/search-zones` | Create a zone | `SearchZoneInputSchema`, maximum 10 zones |
| PUT | `/api/search-requests/:requestId/search-zones/:zoneId` | Edit/toggle a zone | Same schema, ownership check |
| DELETE | `/api/search-requests/:requestId/search-zones/:zoneId` | Remove a zone | UUIDs, ownership check |
| POST | `/api/map/geocode` | Search an address chosen by the operator | query 2–160 chars, rate-limited |
| POST | `/api/rooms/:roomId/location/resolve` | Resolve/retry one room address | body `{ address }` (2–300 chars); room id, no customer data in request |
| GET | `/api/search-requests/:requestId/map-rooms` | Return mapped rooms and matching zones | active zones only; returns unmatched/unlocated separately |
| POST | `/api/map/rooms` | Return mapped rooms for map-only zones | body `{ zones }`, maximum 10; no customer/request required |

All API errors are sanitized. No address, coordinate, name, phone number or geocoder response is logged.

## 5. Architecture

```text
src/features/customer-search/
  schema.js             # Zod boundary validation
  distance.js           # pure Haversine and zone matching
  geocoder.js           # Nominatim request, timeout, rate-limit and response parsing
  repository.js         # SQLite queries and local cache
  service.js            # business rules, stale coordinates and matching
  route.js              # Express request/response boundary
  *.test.js             # colocated tests
web/src/features/customer-search/
  MapZonePicker.tsx     # select/search/click center and radius
  RoomMap.tsx           # markers, circles and empty states
  api.ts                # typed API boundary
  *.test.tsx            # focused UI tests
```

## 6. Delivery slices

1. **Search-request foundation:** keep customers plus independent search requests for CRM workflows; the map picker itself remains standalone.
2. **Zones:** add migration, CRUD, Haversine tests and a map picker; mock map/geocoding in UI tests. Map-only zones are session-local.
3. **Room location:** resolve only explicit addresses, cache outcomes and offer manual correction for ambiguous results.
4. **Filter and map:** return matching rooms, draw circles/markers, and show unmatched plus unlocated lists.

## 7. Security and operational constraints

- Nominatim calls must use a clear application User-Agent, one request at a time, timeout and local cache. If Nominatim is unavailable, retry through Photon with the same response bound; do not bulk-geocode historical rooms automatically.
- UI must display OpenStreetMap attribution. Tile/geocoding service outage must preserve local data and show a retry action.
- Coordinates are personal-context data; remain local. A map request contains only zones and never customer identity or notes.
- Khi ghi tin mới, hệ thống tách riêng dòng địa chỉ từ nội dung gốc; công cụ backfill dùng lại nội dung gốc của tin đã gửi để bổ sung các phòng cũ.
- Before adding dependencies, run `npm audit`, record package versions/bundle impact, and keep the map code lazy-loaded so it does not affect the normal scanning screen.
