# SPEC-007 — Quét theo ngày và gửi cụm liền mạch

> AI: Codex. WHY: Ghi lại lựa chọn của người dùng ngày 14/09/2026 và kế hoạch kiểm chứng.
> PROMPT-007: “Theo khoảng ngày”, “Đều và đúng thứ tự”, “tiếp”.

## Yêu cầu và kế hoạch đã chốt

- Giữ stack, bộ lọc và khoảng ngày tối đa 60 ngày hiện có; không thêm dependency, đổi DB hoặc gọi Zalo thật trong kiểm thử.
- Bước 1: bỏ trần mặc định 1.500 tin ở màn Quét & chọn. Community đi theo cursor; nhóm thường tăng dần số tin gần nhất. Dừng khi vượt mốc bắt đầu, nguồn xác nhận hết, không tiến triển, gặp lỗi, hết 120 giây hoặc đạt 50.000 tin/nhóm. Trần kỹ thuật ngăn quét vô hạn, không phải cam kết lấy đủ.
- Không coi trang ngắn là bằng chứng đã đủ lịch sử. Giữ dữ liệu đã lấy khi trang sau lỗi; chống trùng và vòng lặp cursor; lọc đúng khoảng ngày và sắp cũ đến mới trước gom cụm.
- Thêm `historyCoverage` vào phản hồi quét và trạng thái lưu: từng nhóm có tên, số tin, mốc cũ nhất, mức đầy đủ và lý do dừng. UI cảnh báo nhóm thiếu dữ liệu, kể cả sau tải lại. Store fallback luôn được ghi là dữ liệu cục bộ chưa xác minh đầy đủ.
- Bước 2: gửi thủ công tuần tự cũ đến mới dù cấu hình AUTO dùng hai luồng. Chuẩn bị trước ảnh tối đa một cụm kế tiếp; gửi hết chữ/ảnh/video/sticker cụm hiện tại mới chuyển cụm. Giữ delay và cơ chế nghỉ khi lỗi; không tăng tốc bằng giảm delay.
- Tiến độ cập nhật tên cụm trước khi gửi, số hoàn tất sau mỗi cụm. Chặn lượt gửi thủ công thứ hai và quét mới trong lúc gửi; dừng sau cụm hiện tại, dọn media đã chuẩn bị nhưng không gửi.

## Kiểm chứng

- TDD cho lấy nhiều trang, mở rộng số tin, mốc ngày, trùng trang/cursor, thiếu metadata, trần, timeout và lỗi sau trang đầu.
- Test tích hợp metadata quét, fallback, lưu/khôi phục và cảnh báo UI.
- TDD cho thứ tự khi cụm đầu tải chậm, chuẩn bị ảnh kế tiếp, dừng/dọn file, lỗi và cập nhật tiến độ.
- Chạy suite, build/type-check, kiểm tra diff và kiểm thử UI với dữ liệu giả; không gửi tin thật.

## Trạng thái

APPROVED → PLANNED → IMPLEMENTING theo lựa chọn và yêu cầu tiếp tục của người dùng. Hai bước được triển khai, kiểm thử tuần tự. Chưa VERIFIED/REVIEWED/DONE.
