<!--
Ai viết: Codex
Tại sao: Chốt hành vi chọn nhiều vùng tìm trọ của khách trước khi thêm bản đồ, tọa độ và bộ lọc.
Link: docs/03_SPEC/SPEC-006_MapRadiusSearch.md
-->

# BIZ-005 — Tìm phòng theo vùng bản đồ của khách

> Trạng thái: ✅ Approved | Ngày: 2026-09-12 | Người duyệt: User

## 1. User story

Là nhân viên tư vấn, tôi muốn quản lý nhiều nhu cầu tìm trọ cho mỗi khách và chọn một hoặc nhiều vị trí cùng bán kính cho từng nhu cầu trên bản đồ, để chỉ xem các phòng nằm trong các vùng khách chấp nhận.

## 2. Phạm vi

### Trong phạm vi

- Mở bản đồ từ hồ sơ/nhu cầu tìm phòng của khách.
- Tìm địa chỉ, hoặc bấm trực tiếp trên bản đồ để đặt tâm vùng.
- Nhập hoặc kéo để đổi bán kính; bản đồ hiển thị vòng tròn ngay lập tức.
- Một khách có thể có nhiều nhu cầu tìm trọ; mỗi nhu cầu có thể có nhiều vùng. Phòng ở trong ít nhất một vùng của nhu cầu đang xem là phù hợp.
- Tự đổi địa chỉ phòng đã lưu thành tọa độ khi cần; chỉ hiển thị marker khi đã có tọa độ tin cậy.
- Hiển thị marker các phòng phù hợp trên cùng bản đồ và cho phép mở thông tin phòng.

### Ngoài phạm vi slice đầu

- Dẫn đường hoặc ước tính thời gian di chuyển.
- Tự suy đoán tọa độ từ nội dung mơ hồ/thiếu địa chỉ.
- Gửi vị trí khách/phòng sang Zalo hoặc chia sẻ liên kết công khai.

## 3. Business rules

- BR1: Mỗi vùng gồm nhãn địa chỉ, tọa độ tâm và bán kính 0,2–20 km; thao tác lưu chỉ có hiệu lực khi cả ba hợp lệ.
- BR2: Một nhu cầu khách có tối đa 10 vùng đang bật; có thể sửa, tắt hoặc xóa từng vùng.
- BR3: Phòng phù hợp khi khoảng cách đường chim bay từ tọa độ phòng đến tâm của ít nhất một vùng không lớn hơn bán kính vùng đó.
- BR4: Địa chỉ phòng chỉ được geocode khi có địa chỉ cụ thể; kết quả phải lưu kèm trạng thái để không gọi dịch vụ lặp lại vô hạn khi lỗi/không tìm thấy.
- BR5: Nếu geocode trả về nhiều kết quả hoặc độ tin cậy thấp, không tự đặt marker; nhân viên chọn/chỉnh tọa độ bằng tay trước khi dùng để lọc.
- BR6: Chỉ gửi chuỗi địa chỉ/tọa độ cần thiết tới dịch vụ OpenStreetMap được duyệt; không gửi tên, số điện thoại, ghi chú hay nội dung tin Zalo.
- BR7: Map hiển thị rõ phòng chưa định vị và không đưa chúng vào kết quả “phù hợp”; người dùng vẫn xem được chúng qua danh sách riêng.

## 4. Edge cases

- EC1: Dịch vụ bản đồ/geocoding timeout hoặc giới hạn tốc độ → giữ dữ liệu đã lưu, báo lỗi rõ và cho thử lại; không làm treo app.
- EC2: Người dùng tạo vùng trùng tâm/bán kính → cảnh báo và không lưu trùng.
- EC3: Bán kính bằng biên 0,2 km hoặc 20 km → cho phép; ngoài khoảng → chặn tại UI và API.
- EC4: Một phòng nằm trong nhiều vùng → hiển thị một marker, kèm các vùng khớp.
- EC5: Địa chỉ phòng thay đổi → tọa độ cũ bị đánh dấu cần định vị lại, không âm thầm dùng cho lọc.

## 5. Acceptance criteria

- AC1: GIVEN một nhu cầu khách WHEN nhân viên tìm/chọn “Ngõ 7 Nguyễn Thái Học” và đặt 2 km THEN app vẽ vòng tròn đúng tâm, lưu lại sau khi tải lại và chỉ nhận giá trị hợp lệ.
- AC2: GIVEN khách có hai vùng WHEN một phòng đã định vị thuộc một trong hai vòng THEN marker phòng xuất hiện và danh sách đánh dấu “phù hợp”.
- AC3: GIVEN phòng có địa chỉ mơ hồ hoặc geocoding không xác định được WHEN mở bản đồ THEN phòng không có marker, được nêu rõ là “Chưa định vị”, và không bị coi là phù hợp.
- AC4: GIVEN dịch vụ geocoding lỗi WHEN nhân viên thử định vị THEN app báo lỗi không lộ dữ liệu khách và cho phép thử lại.
- AC5: GIVEN địa chỉ phòng được sửa WHEN lưu địa chỉ mới THEN tọa độ cũ không còn được dùng để tính khoảng cách đến khi định vị lại thành công.

## 6. Các góc nhìn

- Sản phẩm: thay ảnh khoanh tay bằng vùng tìm kiếm có thể lưu, tái dùng và lọc phòng nhất quán.
- Kỹ thuật: cần thêm bản đồ tương tác, geocoding có giới hạn tốc độ và dữ liệu tọa độ cục bộ; không thay đổi Zalo integration.
- Quản lý: P0, phụ thuộc CRM nhu cầu khách (BIZ-003 vẫn Draft). Chia slice: dữ liệu vùng + map picker; định vị phòng; lọc/marker; tích hợp CRM.
