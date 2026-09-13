<!--
Ai viết: Codex
Tại sao: Review TASK-008 trước khi chuyển sang dữ liệu vùng/bán kính.
Link: docs/05_TASKS/TASK-008_MapSearchRequestFoundation.md
-->

# REVIEW-008 — Nền tảng khách và nhu cầu tìm trọ

> Từ: TASK-008 | Ngày: 2026-09-12 | Kết luận: Approved with residual risks

## Findings

Không có finding blocker trong phạm vi TASK-008.

## Review 5 trục

- **Correctness:** số điện thoại được chuẩn hóa trước khi kiểm tra trùng; một khách tạo và liệt kê nhiều nhu cầu, đồng thời bật/tắt nhu cầu theo đúng chủ sở hữu.
- **Regression:** test SQLite thật, route validation và full suite pass; build frontend cũng pass sau khi sửa callback UI sai kiểu và fixture test thiếu nhóm nguồn.
- **Security:** route dùng Zod; lỗi 500 không lộ số điện thoại hay đường dẫn SQLite; không có logger ghi PII; database chỉ được dùng qua API local hiện có.
- **Maintainability:** route → service → repository tách rõ, tất cả file feature mới dưới 110 dòng và header liên kết SPEC/PROMPT đầy đủ.
- **Scope:** chỉ thêm foundation dữ liệu/API. Không thêm Leaflet, geocoding, map UI hoặc thay đổi luồng gửi Zalo.

## Residual risks

- Chưa có UI tạo khách/nêu nhu cầu; UI này thuộc các slice map sau khi quy tắc vùng đã có test.
- Chưa chạy thử API trên backend Zalo đang đăng nhập để tránh tác động phiên người dùng; unit/integration local đã dùng SQLite thật.
- `scripts/security-audit.ps1` không tồn tại; `npm audit --omit=dev` còn một Moderate ở `qs`, không có High/Critical.
