<!--
Ai viết: Codex
Tại sao: Checklist evidence cho UI map và lọc phòng theo vùng.
Link: docs/05_TASKS/TASK-011_MapPickerAndRoomResults.md
-->

# CHECKTASK-011 — Chọn vùng và xem phòng trên bản đồ

> Từ: TASK-011 | Ngày: 2026-09-12

## Checklist

- [x] API map geocode và `POST /api/map/rooms` có validation và phân nhóm phòng.
- [x] UI không cần khách hoặc nhu cầu; click/search tâm, radius slider, nhiều zone phiên.
- [x] Marker chỉ cho phòng matched; unmatched/unlocated có danh sách riêng và nút định vị từng tin chưa có tọa độ.
- [x] Leaflet lazy-load, attribution và responsive CSS.
- [x] UI tests mock map: 5 tests pass; full suite 1,641 script + 49 React pass.
- [x] Browser smoke backend thật: panel không có khách hoặc nhu cầu, thêm vùng thành công, attribution hiển thị; geocode outage báo đúng lỗi.
- [x] Build pass; web production audit 0 vulnerabilities; dev audit cảnh báo toolchain hiện hữu.
- [x] `npx tsc --noEmit` root không chạy type-check vì dự án không có root `tsconfig.json`; type-check frontend đã pass trong build. Project chưa có script `lint`.

## Kết luận

PASS — TASK-011 ở trạng thái REVIEWED, chưa ship vì worktree còn thay đổi các task khác và chưa có user authorization commit/push.
