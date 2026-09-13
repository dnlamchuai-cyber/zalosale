<!--
Ai viết: Codex
Tại sao: Ghi evidence cho CRUD vùng và rule Haversine để slice bản đồ sau tái dùng.
Link: docs/05_TASKS/TASK-009_SearchZonesAndDistance.md
-->

# CHECKTASK-009 — Vùng tìm trọ và tính khoảng cách

> Từ: TASK-009 | Ngày: 2026-09-12

## Checklist

- [x] Bảng `customer_search_zones` local có FK, check bán kính và unique tâm+bán kính theo nhu cầu.
- [x] API GET/POST/PUT/DELETE validate UUID, tọa độ, nhãn, 200–20.000m và lỗi an toàn.
- [x] Một nhu cầu tối đa 10 vùng; vùng trùng hoặc ownership sai bị chặn.
- [x] Haversine dùng mét; một phòng khớp nhiều vùng chỉ có một kết quả, kèm các zone IDs.
- [x] Focused tests service/route/distance pass.
- [x] `npm test`: 1,641 script cases + 43 React tests pass.
- [x] `npm run build` và `git diff --check` pass.
- [x] Không thêm dependency hay network access; audit trước đó không có High/Critical, còn 1 Moderate ở `qs`.

## Kết luận

PASS cho trạng thái REVIEWED. Chưa DONE/SHIP vì worktree có thay đổi của các task khác và chưa có quyết định commit.
