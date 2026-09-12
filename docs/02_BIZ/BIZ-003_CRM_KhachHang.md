<!--
Ai viết: Codex
Tại sao: Chốt nghiệp vụ CRM khách thuê, tránh nhầm trạng thái phòng với trạng thái chăm sóc khách.
Link: docs/03_SPEC/SPEC-004_CRM_KhachHang.md
-->

# BIZ-003 — Bảng tổng hợp khách hàng và bắn khách

> Trạng thái: 📝 Draft | Ngày: 2026-09-06 | Người duyệt: Chờ user

## 1. User story

> Là người vận hành zaloSALE, tôi muốn quản lý khách và từng nhu cầu thuê phòng trong app để biết cần chăm sóc ai, đã bắn khách vào nhóm sale nào, và không gửi lại phòng đã được chủ xác nhận trạng thái.

## 2. Phạm vi

### Trong phạm vi

- Bảng CRM trong app, không dùng Excel làm nguồn dữ liệu chính.
- Một khách có thể có nhiều nhu cầu phòng; mỗi nhu cầu gắn với một phòng cụ thể.
- Trạng thái chăm sóc: `new`, `consulting`, `viewing_scheduled`, `reserved`, `rented`, `follow_up`, `not_suitable`.
- Phiếu bắn khách có thể sửa trước khi sao chép; mỗi nhóm sale có mẫu văn bản riêng.
- Khi nhu cầu chuyển sang `reserved`, phòng chuyển sang `reserved` và bot không forward lại bài có cùng mã phòng.
- Chi tiết phòng hiển thị nhóm nguồn mới nhất và nút chỉ sao chép địa chỉ để tìm tin trong Zalo.

### Ngoài phạm vi của slice đầu

- Gửi tự động tin khách vào Zalo.
- Đồng bộ Excel hai chiều.
- Tự đọc, phân tích hoặc suy đoán trạng thái từ tin nhắn của chủ phòng.
- Tự tìm hoặc mở đúng tin gốc bằng deep-link Zalo chưa được xác minh.

## 3. Business rules

- BR1: Số điện thoại là định danh tìm kiếm của khách; số chuẩn hóa trùng sẽ cảnh báo thay vì tự ghi đè dữ liệu.
- BR2: Địa chỉ phòng là dữ liệu do người vận hành cập nhật; nội dung tin gốc chỉ được gợi ý, không tự ghi địa chỉ nếu không chắc chắn.
- BR3: Form bắn khách gồm mã phòng, địa chỉ, giá, thời gian xem, tên và số điện thoại khách. Mọi trường đều sửa được trước khi sao chép.
- BR4: Mỗi nhóm sale có một mẫu với biến `{{roomCode}}`, `{{address}}`, `{{price}}`, `{{viewingTime}}`, `{{customerName}}`, `{{customerPhone}}`.
- BR5: Nhấn “Sao chép địa chỉ” chỉ sao chép địa chỉ. Nhóm nguồn được hiển thị cạnh nút để người vận hành chọn đúng nhóm trong Zalo.
- BR6: Khi một khách cần chăm sóc lại, người vận hành đặt ngày/giờ chăm sóc tiếp; bảng CRM ưu tiên các mục đến hạn.
- BR7: Không ghi số điện thoại hoặc nội dung form bắn khách vào log hệ thống.

## 4. Edge cases

- EC1: Phòng chưa có địa chỉ: vô hiệu hóa nút sao chép địa chỉ và yêu cầu cập nhật địa chỉ.
- EC2: Phòng chưa có nhóm nguồn: hiển thị “Không xác định”, vẫn cho quản lý thông tin khách.
- EC3: Một khách quan tâm nhiều phòng: tạo nhiều nhu cầu, không tạo lại hồ sơ khách.
- EC4: Mẫu nhóm sale chứa biến không hỗ trợ: chặn lưu mẫu và chỉ rõ biến lỗi.
- EC5: Đổi nhu cầu từ `reserved` sang trạng thái khác không tự mở chặn forward; người vận hành phải mở chặn riêng để tránh gửi nhầm.

## 5. Acceptance criteria

- AC1: GIVEN một khách mới WHEN người vận hành tạo nhu cầu cho phòng V48 THEN bảng CRM có khách, phòng, trạng thái và lần chăm sóc tiếp.
- AC2: GIVEN một nhu cầu đang tư vấn WHEN đổi sang `reserved` THEN phòng hiển thị “Đang giữ chỗ” và bài cùng mã phòng không được forward.
- AC3: GIVEN nhóm sale N HOME có mẫu riêng WHEN người vận hành tạo form THEN preview dùng đúng mẫu, thay đủ biến, và vẫn sửa được trước khi sao chép.
- AC4: GIVEN phòng có địa chỉ và nhóm nguồn WHEN nhấn “Sao chép địa chỉ” THEN clipboard chỉ chứa địa chỉ; nhóm nguồn không nằm trong clipboard.
- AC5: GIVEN ngày chăm sóc tiếp đã đến WHEN mở CRM THEN nhu cầu đó đứng trong phần “Cần chăm sóc”.

## 6. Góc nhìn sản phẩm, kỹ thuật và quản lý

- Sản phẩm: Nối việc tìm phòng, bắn khách và chăm sóc khách vào một luồng có thể tra cứu.
- Kỹ thuật: Lưu dữ liệu khách cục bộ SQLite, tách hồ sơ khách khỏi nhu cầu phòng để không nhân bản khách có nhiều lựa chọn.
- Quản lý: P0. Triển khai theo slice: dữ liệu + bảng CRM; trạng thái phòng/chặn forward; mẫu nhóm sale; xuất Excel.
