# REVIEW-003 — UI CommunityCheckPanel

> Từ: TASK-003 | Ngày: 2026-08-24 | Người review: AI + @dinhnam

## 1. Correctness
- [x] Đúng SPEC-001:3 (chọn 1 Community type 2, calendar 3 ngày, keyword, gọi POST)
- [x] Báo lỗi khi chưa chọn nhóm → "Chọn 1 nhóm Community trước"
- [x] Test 2 ví dụ pass (chọn + quét, không chọn → lỗi)

## 2. Readability
- [x] Tên rõ: `CommunityCheckPanel`, `selectedId`, `from/to` — không `data`
- [x] Early return nếu `!selectedId`
- [x] 138 dòng < 150

## 3. Architecture
- [x] Nằm đúng `web/src/components/CommunityCheckPanel.tsx` (feature folder), không đụng `App.tsx` logic khác
- [x] Tách biên: component chỉ gọi `fetch`, không chứa BR (BR ở service)
- [x] Dùng `api.groups()` đã có, không hardcode

## 4. Security
- [x] Không log `groupId` secret, chỉ log `total`
- [x] Validate `groupId` min 5 max 30 ở service, UI chỉ chọn từ danh sách nên an toàn

## 5. Performance
- [x] Phân trang 12, không fetch tất cả 300 cùng lúc
- [x] Không N+1, chỉ 1 fetch cho groups

## Verdict
- [x] **Approve** — Ready to merge
