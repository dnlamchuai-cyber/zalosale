# TASK-005 — Tìm lại tin phòng bot đã gửi

> Trạng thái: 🔍 Reviewed | Từ: PROMPT-005 | Ngày bắt đầu: 2026-08-30 | Ngày xong: 2026-09-04

## Mô tả

Slice nhỏ nhất có giá trị: sau khi bot gửi thành công một tin phòng, lưu tin vào SQLite và cho người vận hành tìm trên UI bằng mã hoặc địa chỉ, xem nhóm nguồn và các nhóm đích đã gửi.

## Input / Output

- Input ghi: nội dung gốc, nội dung đã gửi, nhóm nguồn, nhóm đích, thời gian, số ảnh.
- Input tìm: từ khóa tối đa 200 ký tự và tối đa 100 kết quả.
- Output: danh sách gom theo phòng, ưu tiên mã chính xác rồi bản ghi mới nhất.

## Phụ thuộc

- BIZ-002 và SPEC-002 đã Approved.
- Runtime Node 22.13+ có `node:sqlite`; máy hiện tại là Node 24.19.0.
- Forwarder chỉ ghi sau khi lời gọi Zalo gửi thành công.

## Acceptance Criteria

- [x] Tin mã `R151` gửi thành công vào hai nhóm tạo một phòng và hai lần gửi.
- [x] Tìm `R151` hoặc `trung kinh` trả đúng một phòng với nguồn và hai nhóm đích.
- [x] Tìm `trung kinh` khớp nội dung `Trung Kính` không phụ thuộc dấu.
- [x] Input dài hơn 200 ký tự bị trả 400; SQL dùng tham số, không nối chuỗi input.
- [x] UI có loading, empty, error và kết quả; dùng được bằng bàn phím và màn hình mobile.
- [x] Gửi thất bại không được tính là đã gửi thành công.

## Ngoài phạm vi slice

- Thu tin `isSelf`, quét bù, gộp thủ công, cập nhật trạng thái và backup/restore.
- Nhập dữ liệu cũ từ trước khi tính năng được bật.

## Rủi ro

- Zalo có thể không trả message ID: dùng ID nội bộ và hash để hỗ trợ chống trùng trong phiên bản sau.
- FTS5 tokenizer không chuẩn hóa mọi trường hợp `đ/d`: lưu thêm chuỗi tìm kiếm do app chuẩn hóa.

## Verify

- [x] Focused backend tests
- [x] Focused React component tests
- [x] `npm test`
- [x] `npm run build`
- [x] Type-check bằng compiler của `web`
- [x] `npm audit --audit-level=high`: 0 High/Critical; còn 1 Moderate trong `qs`
- [x] Browser desktop + mobile: tìm và xem kết quả thật

## Definition of Done

- [x] Code
- [x] Test
- [x] Review (docs/06_REVIEW)
- [x] Checktask (docs/07_CHECKTASK)
- [x] Ghi worklog (docs/08_WORKLOG)

## Kết quả / ghi chú

Đã VERIFIED và REVIEWED. Chưa chuyển DONE vì chưa commit/ship; user chưa yêu cầu commit hoặc push.
