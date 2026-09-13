<!--
Ai viết: Codex
Tại sao: Lưu checklist bằng chứng cho TASK-008, tách khỏi những slice bản đồ sau.
Link: docs/05_TASKS/TASK-008_MapSearchRequestFoundation.md
-->

# CHECKTASK-008 — Nền tảng khách và nhu cầu tìm trọ

> Từ: TASK-008 | Ngày: 2026-09-12

## Checklist

- [x] SQLite tạo an toàn bảng `customers` và `customer_search_requests` khi app mở database.
- [x] Một số điện thoại Việt Nam có thể nhập dạng `0...` hoặc `+84...`; số chuẩn hóa trùng bị chặn mà không ghi đè.
- [x] Một khách có nhiều nhu cầu; nhu cầu có thể bật/tắt và không thao tác được qua chủ khác.
- [x] Route validate payload/UUID bằng Zod, trả 400/404/409 phù hợp và che lỗi 500.
- [x] Focused service/route tests pass với SQLite thật.
- [x] `npm test`: 1,641 script cases và 43 React tests pass.
- [x] `npm run build`: frontend type-check + Vite build pass.
- [x] `git diff --check` và kiểm tra UTF-8 file mới pass.
- [x] Không có `scripts/security-audit.ps1`; `npm audit --omit=dev` không có High/Critical, còn 1 Moderate ở `qs`.

## Kết luận

PASS cho trạng thái REVIEWED. Chưa DONE/SHIP vì chưa có quyết định commit; TASK-009 chỉ bắt đầu sau khi user chọn tiếp tục.
