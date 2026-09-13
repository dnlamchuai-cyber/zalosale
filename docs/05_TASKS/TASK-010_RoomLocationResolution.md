<!--
Ai viết: Codex
Tại sao: Cô lập rủi ro geocoding bên ngoài trước khi marker được dùng để lọc phòng.
Link: docs/03_SPEC/SPEC-006_MapRadiusSearch.md
-->

# TASK-010 — Định vị địa chỉ phòng an toàn

> Trạng thái: ✅ Reviewed | Từ: SPEC-006 | Phụ thuộc: TASK-009

## Mô tả

Định vị từng phòng có địa chỉ cụ thể qua Nominatim, lưu cache/trạng thái và hỗ trợ retry hoặc chỉnh tay khi mơ hồ.

## Acceptance criteria

- Chỉ gửi địa chỉ phòng cho geocoder; không gửi dữ liệu khách hoặc nội dung Zalo.
- Timeout, 429, không tìm thấy và nhiều kết quả đều lưu trạng thái an toàn, không tự tạo marker sai.
- Sửa địa chỉ làm vị trí cũ stale và không còn dùng để lọc.

## Rủi ro / DoD

- Không bulk-geocode; tuần tự, timeout, rate-limit, cache.
- Xong khi mock integration tests chứng minh ranh giới mạng và full verification xanh.

## Evidence (2026-09-12)

- `geocoder.js` gọi Nominatim tuần tự, tối đa 1 request/giây, User-Agent rõ ràng, timeout 10 giây và giới hạn phản hồi 1 MB; chỉ truyền địa chỉ phòng.
- SQLite thêm tọa độ/trạng thái phòng và `geocode_cache`; migration cũ được nâng cấp idempotent qua `PRAGMA table_info`.
- `room-location.test.js` mock fetcher/service chứng minh located + cache, ambiguous không có marker, 429 thành `failed`, và đổi địa chỉ xóa tọa độ cũ. Route test chứng minh UUID/địa chỉ được validate.
- `npm test`: 1,641 script cases + 44 React tests pass; `npm run build` pass; `git diff --check` pass; `npm audit --omit=dev --audit-level=high` không có High/Critical (còn 1 Moderate `qs`, tồn tại trước slice).

## Review outcome

Approved with residual risks: chưa có UI map, marker và lọc phòng (TASK-011); Nominatim public có thể giới hạn/thu hồi quyền nên cần khả năng đổi provider về sau.
