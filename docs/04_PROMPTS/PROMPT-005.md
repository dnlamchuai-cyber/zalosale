# PROMPT-005 — Tìm lại tin phòng bot đã gửi

> Trạng thái: ✅ Self-checked | Từ: SPEC-002 | Ngày: 2026-08-30

## 1. Context

- Stack thực tế: Node 22.13+, Express 5, JavaScript backend, React 19 + TypeScript frontend, SQLite qua `node:sqlite`.
- BIZ-002/SPEC-002 đã Approved; active task là TASK-005.
- Slice chỉ bao phủ tin do bot gửi thành công, API tìm kiếm và UI kết quả tối thiểu.

## 2. Yêu cầu — một vertical slice

Sau khi `Forwarder` gửi thành công từng nhóm đích, ghi hồ sơ phòng + lần gửi vào SQLite. Cung cấp `GET /api/sent-rooms?q=...&limit=...`. Thêm panel UI “Kho tin đã gửi” để tìm bằng mã/địa chỉ và xem nguồn, các nhóm đích cùng lần gửi cuối.

## 3. Files IN/OUT

- IN: `src/forwarder.js`, `src/listener.js`, `src/server-api.js`, `src/index.js`, `web/src/App.tsx`, `web/src/api.ts`, `web/src/types.ts`, pattern test hiện có.
- OUT: `src/db/client.js`, `src/db/migrations/001_sent_message_index.sql`, `src/features/sent-message-index/*`, các file IN cần nối biên tối thiểu, `web/src/features/sent-message-index/*`, `web/src/index.css`, `package.json` engine.
- Cấm: đổi schema/config không liên quan, refactor forwarder/listener, thêm dependency, triển khai self-event/merge/backup.

## 4. Ví dụ I/O

```text
Ghi: source=A, destination=B, original="Mã R151...Trung Kính", sent="...", sentAt=...
GET /api/sent-rooms?q=trung%20kinh
→ 200 {ok:true, rooms:[{roomCode:"R151", sourceGroups:[A], destinations:[B]}]}

GET /api/sent-rooms?q=<201 ký tự>
→ 400 {ok:false,error:"Từ khóa tối đa 200 ký tự"}
```

## 5. Ràng buộc thợ code + kiến trúc sư

- TDD: test fail đúng lý do trước, rồi code tối thiểu để xanh.
- File ≤300 dòng, hàm ≤50 dòng và một việc; tên rõ nghĩa; constants có WHY; early return; DRY sau lần lặp thứ ba; YAGNI.
- Header 3 Biết: ai viết, tại sao chọn cấu trúc, link SPEC-002/PROMPT-005.
- Biên: Route validate → Service business rule → Repository SQLite; UI chỉ gọi typed API.
- SQL parameterized; query ≤200; limit 1-100; không log nội dung/số điện thoại/từ khóa tìm kiếm.
- Chỉ ghi `sent` sau lời gọi Zalo thành công; lỗi DB phải được log bằng ID kỹ thuật, không làm lộ nội dung.
- UI có loading, empty, error; form có label; semantic button; responsive.

## 6. Verify

- [ ] Focused backend RED → GREEN
- [ ] Focused frontend RED → GREEN
- [ ] `npm test`
- [ ] `npm run build`
- [ ] `npx tsc --noEmit -p web/tsconfig.json`
- [ ] security audit hoặc ghi rõ script không tồn tại
- [ ] Browser desktop/mobile với dữ liệu thật qua API

## Self-check

- [x] Một hành vi end-to-end, không lấn sang self-event/merge/backup
- [x] Files theo feature và tách biên Route → Service → DB
- [x] Có I/O pass/fail, giới hạn input và evidence đo được
- [x] Có thợ code, kiến trúc, security, test và header 3 Biết
