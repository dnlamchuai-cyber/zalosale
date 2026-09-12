# REVIEW-006 — Hoa hồng và xem ảnh trong bảng quét

> Từ: TASK-006 | Ngày: 2026-09-04 | Kết luận: Approved with residual risks

## Findings

Không còn finding blocker trong phạm vi TASK-006.

## Review 5 trục

- **Correctness:** parser chỉ lấy `%` trên dòng có `🌹`, `💐`, `HH` hoặc `hoa hồng`; lịch sử được sắp tăng dần theo timestamp; ranh giới cụm và thứ tự chữ/album được giữ khi gửi.
- **Regression:** `npm test` xanh với 1.503 backend cases và 10 React tests; build/type-check xanh.
- **Security:** chỉ chấp nhận URL `http/https`, giới hạn 8 URL mỗi bài, ảnh dùng `no-referrer`; URL không an toàn có test loại bỏ.
- **Maintainability:** logic media dùng chung ở `src/media.js`; UI typed và component 270 dòng, dưới giới hạn 300.
- **Scope:** chỉ bổ sung dữ liệu scan và UI preview; không thay đổi DB hoặc tự động gửi tin.

## Residual risks

- Backend đang chạy từ trước khi sửa nên phải restart mới trả hai trường mới cho UI.
- URL ảnh Zalo có thể hết hạn theo phía Zalo; phiên bản này không lưu bản sao ảnh.
- Lightbox có nút đóng và ESC nhưng chưa khóa focus như một modal hoàn chỉnh.
- `scripts/security-audit.ps1` không tồn tại; `npm audit` còn 1 Moderate ở dependency `qs`, không có High/Critical.
