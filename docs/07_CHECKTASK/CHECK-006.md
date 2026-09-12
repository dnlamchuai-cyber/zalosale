# CHECKTASK-006 — Hoa hồng và xem ảnh trong bảng quét

> Từ: TASK-006 | Ngày: 2026-09-04

## Checklist

- [x] Cột `Hoa hồng` hiển thị `%` hoặc `—`
- [x] API scan trả `commissionPercent` và tối đa 8 `photoUrls`
- [x] Tối đa 3 thumbnail mỗi dòng, bấm xem lớn, ESC/nút đóng
- [x] URL ảnh chỉ nhận `http/https`, lazy-load, không gửi referrer
- [x] Focused TDD backend + React PASS
- [x] Regression mẫu thực tế `💐 30%12th, Mã A410` → `30%`
- [x] Tin ảnh Community dạng `content: { href, thumb }` được nhận diện và ưu tiên ảnh gốc
- [x] Tin được sắp theo timestamp trước khi gom; album Community nhiều ảnh không bị cắt
- [x] Tin mở cụm mới không kéo ảnh đứng trước sang cụm mới
- [x] Forward giữ thứ tự `chữ → album → chữ → album`; ảnh liên tiếp gửi thành một album
- [x] Nút `Xem cụm` hiển thị các phần chữ/ảnh theo thứ tự gốc
- [x] `npm test`: 1.503 backend cases + 10 React tests PASS
- [x] `npm run build`: type-check + Vite build PASS
- [x] `npm audit --audit-level=high`: PASS ngưỡng High; còn 1 Moderate
- [x] `git diff --check`, UTF-8 và giới hạn file PASS
- [ ] Browser với dữ liệu Zalo thật sau khi restart backend

## Kết luận

PASS cho trạng thái REVIEWED. Chưa DONE/SHIP vì tiến trình backend cần restart để kiểm tra tích hợp với dữ liệu Zalo thật và chưa có quyết định commit.
