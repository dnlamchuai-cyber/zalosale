<!--
Ai viết: Codex
Tại sao: Review UI map, API phân nhóm phòng và bundle/security trade-off trước release.
Link: docs/05_TASKS/TASK-011_MapPickerAndRoomResults.md
-->

# REVIEW-011 — Chọn vùng và xem phòng trên bản đồ

> Từ: TASK-011 | Ngày: 2026-09-12 | Kết luận: Approved with residual risks

## Findings

Không có finding blocker trong phạm vi TASK-011.

## Review 5 trục

- **Correctness:** click/search đặt tâm; radius cập nhật vòng; có preset 3 cụm gần → xa; tin chưa định vị có thể thử geocode từng tin; API `POST /api/map/rooms` nhận vùng phiên không cần customer/request và phân tách matched/unmatched/unlocated; marker chỉ nhận matched rooms.
- **Regression:** 46 React tests, full npm test và build pass; panel được mock trong App tests để không phá test cũ.
- **Security:** request map chỉ chứa vùng/query địa chỉ; lỗi hiển thị an toàn; attribution OSM; tile/geocoder không nhận dữ liệu khách.
- **Maintainability:** API typed ở `web/src/api.ts`; Leaflet nằm chunk lazy; component map tách khỏi state/form panel.
- **Scope:** không bulk geocode, không sửa forwarding; thêm dependency đúng theo spec.

## Residual risks

- Nominatim không phân giải được trong môi trường smoke do DNS; geocoder có fallback Photon, còn UI vẫn cho phép click map để đặt tâm.
- Leaflet chunk khoảng 156 kB chưa gzip; production cần theo dõi bundle và provider tile/quota.
