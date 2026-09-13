<!--
Ai viết: Codex
Tại sao: Giữ TASK-009 ở dữ liệu vùng và quy tắc khoảng cách, không kéo map/geocoding vào cùng slice.
Link: docs/03_SPEC/SPEC-006_MapRadiusSearch.md
-->

# PROMPT-009 — Vùng tìm trọ và khoảng cách

> Trạng thái: ✅ Self-checked | Từ: SPEC-006, TASK-009 | Ngày: 2026-09-12

## 1. Context

TASK-008 đã có `customers` và `customer_search_requests` trong SQLite. TASK-009 thêm nhiều vùng cho từng nhu cầu cùng Haversine thuần; chưa có Leaflet, geocoding, tọa độ phòng lưu bền hay UI.

## 2. Yêu cầu

Lưu/list/sửa/tắt/xóa vùng có tâm, nhãn và bán kính 200–20.000 m; tối đa 10 vùng mỗi nhu cầu. Một hàm thuần trả từng phòng khớp đúng một lần, kèm tất cả zone IDs đã khớp.

## 3. Files IN/OUT

- IN: `src/features/customer-search/{schema,repository,service,route}.js`, migration và test TASK-008.
- OUT: mở rộng feature customer-search; tạo `distance.js` + test; `PROMPT-009`, TASK-009.
- Không sửa: React UI, geocoder, `room_records`, Zalo forwarding hoặc dependency.

## 4. Ví dụ I/O

```text
POST /api/search-requests/:id/search-zones
{ label: "Ngõ 7 Nguyễn Thái Học", center: { latitude: 20.972, longitude: 105.778 }, radiusMeters: 2000 }
→ 201 với zone đã lưu.

Tạo zone thứ 11 hoặc cùng tâm + bán kính với zone cũ
→ 409, không ghi dữ liệu mới.

Một phòng cách tâm 500 m, thuộc hai vòng đang bật
→ kết quả chỉ có một phòng với matchedZoneIds gồm cả hai zone.
```

## 5. Ràng buộc thợ code + kiến trúc

- File ≤300 dòng, hàm ≤50 dòng, tên rõ nghĩa, early return, DRY/YAGNI; mọi file mới có header 3 Biết.
- Route chỉ Zod validate/HTTP; service giữ quota/sở hữu/trùng; repository chỉ SQLite; `distance.js` không I/O.
- Hằng số bán kính và bán kính Trái Đất phải có WHY. Dùng metre xuyên suốt, không lẫn km.
- Tọa độ và nhãn chỉ ở local SQLite; không log chúng; lỗi database không lộ ra API.
- Chỉ kiểm tra trùng trong cùng search request; update không được chiếm zone của request khác.

## 6. Verify

- [ ] Viết RED test cho biên 200/20.000 m, zone thứ 11, trùng, ownership và Haversine/multiple-match.
- [ ] Focused service, distance, route tests pass.
- [ ] `npm test`, `npm run build`, `npx tsc --noEmit`, audit và review pass.

## Self-check

- [x] Scope không bao gồm map/dependency/network.
- [x] Có ví dụ hợp lệ, quota/trùng lỗi và output match nhiều vùng.
- [x] Có boundary, data privacy và verification rõ ràng.
