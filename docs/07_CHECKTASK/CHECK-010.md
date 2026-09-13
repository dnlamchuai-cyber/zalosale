<!--
Ai viết: Codex
Tại sao: Checklist evidence cho định vị phòng và ranh giới mạng.
Link: docs/05_TASKS/TASK-010_RoomLocationResolution.md
-->

# CHECKTASK-010 — Định vị địa chỉ phòng

> Từ: TASK-010 | Ngày: 2026-09-12

## Checklist

- [x] Schema địa chỉ 2–300 ký tự, room id UUID; API không nhận customer/Zalo payload.
- [x] Nominatim tuần tự, timeout, User-Agent và bounded response; mock fetcher không gọi mạng thật.
- [x] Cache kết quả normalized address; ambiguous/not_found không tạo tọa độ dùng cho marker.
- [x] Đổi địa chỉ xóa latitude/longitude cũ và trạng thái cuối phản ánh kết quả mới.
- [x] `npm test` pass (1,641 script + 44 React); `npm run build` pass.
- [x] `git diff --check` pass; audit không có High/Critical; không có `scripts/security-audit.ps1` để chạy.

## Kết luận

PASS — TASK-010 ở trạng thái REVIEWED, chưa ship do worktree còn thay đổi của các slice khác.
