<!--
Ai viết: Codex
Tại sao: Chỉ thêm UI map khi dữ liệu vùng, khoảng cách và tọa độ phòng đã được kiểm chứng.
Link: docs/03_SPEC/SPEC-006_MapRadiusSearch.md
-->

# TASK-011 — Chọn vùng và xem phòng trên bản đồ

> Trạng thái: ✅ Reviewed | Từ: SPEC-006 | Phụ thuộc: TASK-010

## Mô tả

Lazy-load Leaflet/React Leaflet để chọn tâm, chỉnh bán kính, vẽ nhiều vòng và marker các phòng phù hợp.

## Acceptance criteria

- Tìm địa chỉ hoặc bấm bản đồ tạo tâm; đổi bán kính cập nhật vòng ngay.
- Không cần chọn khách hoặc nhu cầu; có thể thêm tối đa 10 vùng cho một phiên tìm kiếm.
- Có nút chọn nhanh 3 cụm Hà Đông theo thứ tự gần → xa, dùng được ngay khi geocoder không phản hồi.
- Chỉ marker phòng đã định vị phù hợp; danh sách riêng nêu rõ phòng chưa định vị và không khớp.
- Tin chưa định vị có ô nhập địa chỉ (nếu thiếu) và nút xử lý từng tin để thử geocode rồi tải lại kết quả.
- Nội dung tin mới và tin cũ có thể chạy nhận diện địa chỉ tự động trước bước geocode.
- Có attribution OpenStreetMap, loading/error/empty states và UI tests dùng mock thay vì tile thật.

## Rủi ro / DoD

- Cài dependency chỉ ở task này, sau `npm audit` và đánh giá bundle; không ảnh hưởng màn quét khi chưa mở map.
- Xong khi browser test hành trình chính, full verification, review và learning note đều xanh.

## Evidence (2026-09-12)

- Backend map API trả `matchedRooms`, `unmatchedRooms`, `unlocatedRooms`; Haversine và room-location tests bảo đảm marker chỉ dùng tọa độ located.
- Frontend `MapSearchPanel` không yêu cầu khách hoặc nhu cầu; tìm địa chỉ chọn tâm, bấm map chọn tâm, chỉnh bán kính 200–20.000m và thêm nhiều zone phiên hiện tại qua `/api/map/rooms`.
- `LeafletMap` được lazy-load, có vòng vùng, marker phòng khớp, popup và attribution OpenStreetMap. UI có loading/error/empty states và danh sách ba nhóm phòng.
- UI tests mock Leaflet/tile; browser smoke test desktop/mobile xác nhận panel và attribution hiển thị. `npm test`: 1,641 script + 49 React tests pass; `npm run build` pass.
- `npm --prefix web audit --omit=dev` không có lỗ hổng production; audit đầy đủ báo 4 cảnh báo dev từ toolchain hiện hữu.

## Review outcome

Approved with residual risks: browser smoke chưa nhập địa chỉ thật nên chưa gọi Nominatim trong browser; cần kiểm thử end-to-end có backend fixture trước production.
