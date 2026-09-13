<!--
Ai viết: Codex
Tại sao: Tách geocoding địa chỉ phòng thành slice có ranh giới mạng, cache và trạng thái an toàn.
Link: docs/03_SPEC/SPEC-006_MapRadiusSearch.md
-->

# PROMPT-010 — Định vị địa chỉ phòng

> Trạng thái: ✅ Self-checked | Từ: SPEC-006, TASK-010 | Ngày: 2026-09-12

## 1. Context

Kho `room_records` đã lưu tin phòng. Cần nhận địa chỉ cụ thể do người vận hành nhập, gọi Nominatim theo yêu cầu trực tiếp, cache cục bộ và chỉ gắn tọa độ khi có đúng một kết quả.

## 2. Yêu cầu

- Chỉ gửi địa chỉ phòng; không gửi tên, số điện thoại, ghi chú khách hay nội dung Zalo.
- Tuần tự tối đa 1 request/giây, User-Agent rõ ràng, timeout 10 giây, giới hạn kích thước phản hồi.
- Cache `located`, `ambiguous`, `not_found`; lỗi timeout/429/lỗi mạng trả trạng thái `failed` để có thể retry.
- Nhiều kết quả không tạo marker. Đổi địa chỉ phải xóa tọa độ cũ và đánh dấu stale trước khi resolve lại.

## 3. Files IN/OUT

- IN: `src/db/client.js`, migration, `src/features/customer-search/{schema,repository,service,route}.js`.
- OUT: Leaflet/UI và lọc theo vùng (TASK-011), bulk geocode, thay đổi nội dung Zalo.

## 4. API

`POST /api/rooms/:roomId/location/resolve`

```json
{ "address": "Ngõ 7 Nguyễn Thái Học, Hà Đông, Hà Nội" }
```

## 5. Verify

- Mock fetcher chứng minh URL chỉ có query địa chỉ, có User-Agent và không gọi mạng thật.
- Service test cho located/cache, ambiguous, failed và đổi địa chỉ xóa tọa độ cũ.
- `npm test`, `npm run build`, `git diff --check`, audit và review xanh.
