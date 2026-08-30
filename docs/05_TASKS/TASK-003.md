# TASK-003 — UI CommunityCheckPanel (chọn nhóm + calendar 3 ngày)

> Trạng thái: ✅ Done | Từ: PROMPT-003 | Ngày: 2026-08-24 | Ngày xong: 2026-08-24

## Mô tả
Làm 1 component `CommunityCheckPanel.tsx` theo PROMPT-003 (chỉ UI, đã có route).

## Checklist

### Code
- [x] Tạo `web/src/components/CommunityCheckPanel.tsx` với header 3 Biết + `PAGE_SIZE=12` (138 dòng)
- [x] Hiện danh sách Community (GET /api/groups → lọc type 2, thumbnail + radio + phân trang 12, chọn 1)
- [x] 2 ô calendar (default 3 ngày) + keyword + nút Quét → POST /api/community/check → hiện total/posts/range

### Test
- [x] Tạo `web/src/components/CommunityCheckPanel.test.tsx` (2 case: render + Quét)
- [x] `npm test` xanh (1429 PASS) + `service.test.js` 3 PASS + `route.test.js` 2 PASS
- [x] `npm --prefix web run build` xanh

### Verify
- [x] `npx tsc --noEmit` (web) — build xanh
- [x] `npm run build` (web) — xanh
- [x] Thêm `<CommunityCheckPanel />` vào `web/src/App.tsx:204` dưới `ScanReviewPanel`

## Kết quả / ghi chú
- Code xong 138 dòng, test 2 case PASS, `npm run build` xanh, đã gắn vào `App.tsx`
- Đã test với `groupId 8089152704833938973` thật, `type 2` lọc đúng

## Góc nhìn
- **Thợ (làm):** Chỉ 1 component, test mock `fetch` với `type 2`, không cần DB thật.
- **Thầy (dạy):** Tại sao chọn `type 2` để lọc Community? Vì Zalo phân biệt Group (1) vs Community (2) qua `getGroupInfo` — đã verify với `api.getGroupInfo` thật.
- **PM (quản lý):** Xong TASK này là có thể demo quét 3 ngày cho Community bằng UI mà chưa cần forward. Tiếp theo là tích hợp forward cho Community nếu cần.
