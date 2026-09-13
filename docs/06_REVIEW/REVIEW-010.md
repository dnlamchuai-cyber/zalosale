<!--
Ai viết: Codex
Tại sao: Review boundary geocoding và tính đúng đắn trạng thái tọa độ trước khi dùng marker.
Link: docs/05_TASKS/TASK-010_RoomLocationResolution.md
-->

# REVIEW-010 — Định vị địa chỉ phòng

> Từ: TASK-010 | Ngày: 2026-09-12 | Kết luận: Approved with residual risks

## Findings

Không có finding blocker trong phạm vi TASK-010.

## Review 5 trục

- **Correctness:** chỉ một candidate mới thành `located`; nhiều candidate thành `ambiguous` và tọa độ null; đổi địa chỉ làm tọa độ cũ stale.
- **Regression:** migration idempotent cho DB cũ; full test/build pass.
- **Security:** schema giới hạn địa chỉ; User-Agent rõ ràng; không log địa chỉ, khách hoặc nội dung Zalo; lỗi ngoài được che ở HTTP.
- **Maintainability:** geocoder là boundary có dependency injection fetcher; repository giữ SQL/cache; service giữ trạng thái nghiệp vụ.
- **Scope:** chưa thêm Leaflet/UI, chưa bulk-geocode, không thay đổi luồng quét/gửi Zalo.

## Residual risks

- Nominatim public có chính sách tải thấp và có thể ngừng phục vụ; provider cần cấu hình thay thế trong slice production.
- `located` hiện dùng quy tắc đúng một candidate; operator vẫn phải chỉnh địa chỉ khi kết quả mơ hồ.
