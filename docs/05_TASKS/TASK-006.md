# TASK-006 — Cột hoa hồng và xem ảnh khi quét tin

> Trạng thái: ✅ Reviewed | Ngày bắt đầu: 2026-09-04 | Từ: yêu cầu user + PROMPT-006

## Hành vi

- Bảng quét có cột `Hoa hồng`, đơn vị `%`; lấy phần trăm trên dòng `🌹`, `HH` hoặc `hoa hồng`.
- Bảng quét có tối đa 8 thumbnail ảnh từ tin; bấm để xem ảnh lớn và đóng bằng nút/ESC.
- URL ảnh chỉ chấp nhận `http/https`, lazy-load và không gửi referrer.

## Acceptance Criteria

- [x] `🌹7th 40%` → `40%`; `HH: 20%` → `20%`; không có → `—`.
- [x] API scan trả `commissionPercent` và `photoUrls`.
- [x] Thumbnail có nhãn truy cập, bấm mở ảnh lớn, ESC đóng.
- [x] Không phá luồng chọn/gửi tin hiện tại qua full regression test.

## Verify

- [x] Focused RED/GREEN backend + frontend
- [x] `npm test`: 1.503 backend cases + 10 React tests PASS
- [x] `npm run build`: type-check + Vite build PASS
- [ ] Browser desktop với dữ liệu Zalo thật — cần restart backend đang chạy để nạp code mới
