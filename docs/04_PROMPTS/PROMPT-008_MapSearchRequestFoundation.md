<!--
Ai viết: Codex
Tại sao: Giữ TASK-008 ở một vertical slice dữ liệu có test trước khi thêm bản đồ hoặc geocoding.
Link: docs/03_SPEC/SPEC-006_MapRadiusSearch.md
-->

# PROMPT-008 — Nền tảng khách và nhu cầu tìm trọ

> Trạng thái: ✅ Self-checked | Từ: SPEC-006, TASK-008 | Ngày: 2026-09-12

## 1. Context

App Node.js/Express dùng SQLite cục bộ và React/Vite. Thực hiện duy nhất phần dữ liệu khách + nhu cầu tìm trọ từ SPEC-006; chưa cài map dependency, chưa gọi geocoding và không sửa Zalo integration.

## 2. Yêu cầu

Tạo feature `customer-search`: khách có số điện thoại chuẩn hóa duy nhất, có thể tạo/liệt kê nhiều nhu cầu tìm trọ độc lập. Expose API cục bộ để UI sau này dùng được.

## 3. Files IN/OUT

- IN: `src/db/client.js`, `src/db/migrations/001_sent_message_index.sql`, `src/server-api.js`, `src/index.js`, pattern `src/features/sent-message-index/`.
- OUT: `src/features/customer-search/{schema,repository,service,route}.js` và tests colocated; migration, bootstrap/API wiring, `package.json`, TASK-008.
- Không sửa: forwarding, listener, classifier, config người dùng, map UI hay bất kỳ dữ liệu Zalo nào.

## 4. Ví dụ I/O

```text
POST /api/customers { name: "Lan", phone: "0901 234 567" }
→ 201 { ok: true, customer: { name: "Lan", phone: "0901234567" } }

POST /api/customers cùng số "(+84) 901234567"
→ 409 { ok: false, error: "Số điện thoại đã tồn tại" }, không ghi đè hồ sơ.

POST /api/customers/:id/search-requests { title: "Quanh Ga Hà Đông" }
→ 201 { ok: true, searchRequest: { customerId: id, title: "Quanh Ga Hà Đông", active: true } }
```

## 5. Ràng buộc thợ code + kiến trúc

- File ≤300 dòng; hàm ≤50 dòng và một việc; tên rõ nghĩa; early return; DRY/YAGNI.
- Tách boundary `route` → business rules `service` → SQLite `repository`; Zod chỉ validate ở boundary.
- Không magic number: giới hạn tên/điện thoại/tiêu đề là hằng số có WHY.
- Mỗi file mới có header: ai viết, lý do cấu trúc, link SPEC/PROMPT.
- Chuẩn hóa số Việt Nam đủ để nhận cùng số có khoảng trắng/dấu `+84`; không log tên/số/tiêu đề hoặc SQL error nội bộ.
- Migration phải tạo thêm bảng an toàn khi chạy lại database cũ; không thay đổi bảng hiện hữu.

## 6. Verify

- [ ] Viết test RED cho tạo/list customer, nhiều search request và trùng số.
- [ ] `node src/features/customer-search/service.test.js` xanh.
- [ ] `node src/features/customer-search/route.test.js` xanh.
- [ ] `npm test`, `npm run build`, `npx tsc --noEmit`, `node scripts/tests.mjs` và kiểm tra security liên quan.

## Self-check

- [x] Context chỉ gồm file liên quan.
- [x] Có input/output thành công và thất bại.
- [x] Có boundary, security, test và giới hạn scope.

> Bài học prompt: nêu rõ “chưa làm map/geocoding” giúp một slice dữ liệu không bị phình thành cả tính năng bản đồ.
