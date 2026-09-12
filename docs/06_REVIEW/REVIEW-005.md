# REVIEW-005 — Kho tin phòng đã gửi

> Từ: TASK-005 | Ngày: 2026-09-04 | Kết luận: Approved with residual risks

## Findings

Không còn finding blocker trong phạm vi TASK-005 sau khi sửa:

- Đường dẫn DB mặc định được sửa từ `src/data` về `data/` của project.
- Lỗi ghi SQLite sau khi Zalo đã gửi không còn bị báo nhầm là gửi Zalo thất bại.
- Nội dung lịch sử của cùng mã phòng vẫn nằm trong chỉ mục tìm kiếm sau lần cập nhật mới.

## Review 5 trục

- **Correctness:** Test repository SQLite thật, route 400/500, callback Forwarder success/failure và React behavior đều xanh.
- **Regression:** `npm test` xanh: 1.488 case backend hiện có + test feature mới + 8 React tests.
- **Security:** Zod giới hạn query 200, limit 100; SQL parameterized; lỗi 500 không lộ chi tiết; không log nội dung/từ khóa.
- **Maintainability:** Route → Service → Repository → DB; UI typed API; file mới đều dưới 300 dòng.
- **Scope:** Chỉ bot-send + search API + UI; không trộn self-event, merge, status edit hoặc backup.

## Residual risks

- `scripts/security-audit.ps1` không tồn tại nên không thể cung cấp S1-S8 PASS tự động.
- `npm audit` còn 1 Moderate từ `qs`; không có High/Critical.
- Nếu Zalo gửi thành công nhưng SQLite lỗi, hệ thống cảnh báo nhưng chưa có outbox phục hồi bền vững.
- Chưa benchmark 100.000 bản ghi; task hiện tại chỉ kiểm tra hành vi.
- Tin tự gửi trực tiếp và khoảng bot tắt thuộc slice tiếp theo.
