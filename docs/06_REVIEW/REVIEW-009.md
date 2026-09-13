<!--
Ai viết: Codex
Tại sao: Review rule vùng/bán kính trước khi dữ liệu tọa độ được dùng để định vị phòng.
Link: docs/05_TASKS/TASK-009_SearchZonesAndDistance.md
-->

# REVIEW-009 — Vùng tìm trọ và tính khoảng cách

> Từ: TASK-009 | Ngày: 2026-09-12 | Kết luận: Approved with residual risks

## Findings

Không có finding blocker trong phạm vi TASK-009.

## Review 5 trục

- **Correctness:** SQLite giữ tâm/bán kính trong mét, quota 10, chống trùng cùng nhu cầu và không cho cập nhật/xóa zone của nhu cầu khác. Haversine trả một phòng một lần với toàn bộ zone IDs khớp.
- **Regression:** focused test, full `npm test` (1,641 script cases + 43 React tests) và `npm run build` pass.
- **Security:** Zod chặn tọa độ/radius sai tại HTTP boundary; dữ liệu vùng không được log; lỗi SQLite vẫn được che bằng lỗi HTTP an toàn.
- **Maintainability:** tính khoảng cách là module thuần tách khỏi route/service/repository; chưa tạo coupling với map UI hoặc geocoder.
- **Scope:** chỉ CRUD địa phương + matching; không thêm dependency, gọi mạng, thay đổi `room_records` hay Zalo forwarding.

## Residual risks

- Đây là khoảng cách đường chim bay, không phải thời gian/đường di chuyển.
- Room chưa có tọa độ nên chưa có API lọc phòng thật hoặc marker; đó là TASK-010/011.
- Không có `scripts/security-audit.ps1`; audit hiện còn một Moderate ở `qs`, không có High/Critical.
