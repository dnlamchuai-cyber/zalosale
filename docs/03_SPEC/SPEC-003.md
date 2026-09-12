# SPEC-003 — Nhóm đích nhận tất cả bài viết

> AI: Codex. WHY: Ghi rõ quy tắc gửi đồng thời để triển khai và kiểm thử nhất quán.
> Yêu cầu: Hội thoại ngày 2026-09-05; user xác nhận nhóm Tổng hợp vẫn nhận bài đã khớp nhóm riêng.

## Phạm vi đã xác nhận

- Mỗi nhóm đích chọn “Lọc theo từ khóa” hoặc “Tất cả bài viết”.
- `matchAll: true` nhận mọi bài qua bộ lọc chung, không cần từ khóa hay điều kiện giá riêng.
- Nhóm theo từ khóa tiếp tục nhận bài phù hợp, đồng thời nhóm Tổng hợp nhận cùng bài.
- Không tự bật chế độ này cho cấu hình cũ có từ khóa trống. Thiếu `matchAll` giữ hành vi cũ.
- Mỗi nhóm thực tế chỉ nhận một bản; chống trùng hiện tại tiếp tục áp dụng.
- Không dùng nhóm Tổng hợp làm tín hiệu nhận diện tòa nhà khi gom tin/ảnh.
- Bộ lọc loại trừ, khoảng giá chung, làm sạch nội dung và lựa chọn nguồn giữ nguyên.

## Kế hoạch một slice

1. Kiểm thử phân loại, fallback, đích kế thừa, chống trùng và validation.
2. Bổ sung cờ boolean và logic định tuyến, giữ nguyên stack và dependencies hiện có.
3. Thêm lựa chọn trên UI, kiểm thử lưu và tải lại cấu hình.
4. Chạy suite, build/type-check và review diff; không gửi tin Zalo thật khi kiểm thử.

## Trạng thái

APPROVED → PLANNED → IMPLEMENTING theo phạm vi user đã xác nhận trong hội thoại.
