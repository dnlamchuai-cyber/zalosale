# CHECKTASK-005 — Kho tin phòng đã gửi

> Từ: TASK-005 | Ngày: 2026-09-04

## Checklist

- [x] SQLite + FTS5 qua `node:sqlite`, không thêm dependency
- [x] Ghi sau khi Zalo gửi thành công; gửi lỗi không ghi
- [x] API `GET /api/sent-rooms` validate input và lỗi an toàn
- [x] UI tìm mã/địa chỉ có loading, empty, error, result
- [x] Desktop và viewport mobile 390×844 hiển thị đầy đủ
- [x] `npm test`: 1.488 case backend cũ + feature tests + 8 React tests
- [x] `npm run build`: PASS
- [x] Type-check frontend: PASS
- [x] `npm audit --audit-level=high`: PASS ngưỡng High; còn 1 Moderate
- [x] Review: `docs/06_REVIEW/REVIEW-005.md`
- [x] UTF-8 và header 3 Biết cho file mới

## Kết luận

PASS cho trạng thái REVIEWED. Chưa DONE/SHIP vì chưa có quyết định commit.
