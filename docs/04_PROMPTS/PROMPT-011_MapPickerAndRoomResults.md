<!--
Ai viết: Codex
Tại sao: Đưa contract vùng/phòng đã kiểm chứng vào UI bản đồ lazy-load, không làm nặng màn quét.
Link: docs/03_SPEC/SPEC-006_MapRadiusSearch.md
-->

# PROMPT-011 — Chọn vùng và xem phòng trên bản đồ

> Trạng thái: ✅ Self-checked | Từ: SPEC-006, TASK-011 | Ngày: 2026-09-12

## Yêu cầu

- UI bản đồ độc lập, không chọn khách hoặc nhu cầu.
- Tìm địa chỉ hoặc click map để đặt tâm; chỉnh bán kính và thêm tối đa 10 vùng.
- Vẽ vòng vùng, chỉ vẽ marker cho phòng `located` khớp Haversine; liệt kê phòng lệch vùng/chưa định vị riêng.
- Lazy-load Leaflet, attribution OpenStreetMap, loading/error/empty states; test mock tile/map.

## Files

- `web/src/features/customer-search/{MapSearchPanel,LeafletMap}.tsx`, `web/src/{api,types,App,index.css}`.
- `src/features/customer-search/{schema,service,route,repository}.js` và map tests.

## Verify

`npm test`, `npm run build`, browser smoke desktop/mobile, `npm audit --omit=dev` và review.
