# BIZ-XXX: [Tên chức năng] — Template

> Copy file này thành `BIZ-001_TenChucNang.md`. 1 chức năng = 1 file. Dùng skill `lay-yeu-cau` để điền tự động.
> Góc nhìn: Dev hiểu làm gì, Mentor dạy tại sao, PM quản lý scope.

## 1. Tổng quan

- **Mã:** BIZ-XXX
- **Tên:** [VD: Rút gọn URL]
- **Mức ưu tiên:** P0 (bắt buộc) / P1 (cần) / P2 (nice-to-have)
- **Người yêu cầu:** @stakeholder
- **Ngày tạo:** YYYY-MM-DD
- **Trạng thái:** Draft | Review | Approved | Done

## 2. Bối cảnh & Vấn đề (Why)

- **Vấn đề hiện tại:** [Mô tả nỗi đau — VD: link dài khó chia sẻ, không track được click]
- **Mục tiêu kinh doanh:** [VD: tăng 20% share rate, thu thập analytics]
- **Thành công đo bằng:** [VD: 1000 link tạo/tuần, 95% request <100ms]

## 3. Actor & User Story

| Actor | User Story | Ghi chú |
|-------|------------|---------|
| Guest | Là khách, tôi muốn dán link dài và nhận link ngắn ngay, không cần đăng nhập | P0 |
| Member | Là thành viên, tôi muốn quản lý các link đã tạo | P1 |
| Admin | Là admin, tôi muốn xem thống kê click theo ngày | P1 |

## 4. Luồng chính (Happy Path)

1. User dán `https://example.com/very/long/url...` vào input
2. Hệ thống validate URL, tạo slug `abc123`, lưu DB
3. Trả về `https://beshort.ly/abc123`
4. Khi truy cập `abc123` → redirect 302 về URL gốc + ghi log click

## 5. Business Rules

- [ ] BR1: Slug 6 ký tự, charset `[a-zA-Z0-9]`, unique
- [ ] BR2: URL phải có scheme `http/https`, độ dài ≤2048
- [ ] BR3: Link hết hạn sau 30 ngày nếu là Guest, không hết hạn nếu Member
- [ ] BR4: Không cho rút gọn domain trong blacklist

## 6. Edge Cases & Xử lý

| Case | Xử lý | Spec liên quan |
|------|-------|----------------|
| URL không hợp lệ | Trả 400 + message tiếng Việt | SPEC-XXX |
| Slug trùng | Retry 3 lần với slug mới, nếu vẫn trùng → 500 | SPEC-XXX |
| Link hết hạn | Trả 410 Gone + trang “Link đã hết hạn” | SPEC-XXX |
| Rate limit Guest 10 req/phút | Trả 429 + header Retry-After | SPEC-XXX |

## 7. Yêu cầu phi chức năng

- Performance: tạo link <300ms p95, redirect <50ms
- Security: không lộ URL gốc trong log, rate limit
- Analytics: log IP (hash), user-agent, timestamp

## 8. Phụ thuộc & Phạm vi

- **Phụ thuộc:** Auth (nếu Member), DB Postgres
- **Trong scope:** Tạo, redirect, list của tôi
- **Ngoài scope (phase sau):** Custom slug, QR code, team workspace

## 9. Acceptance Criteria (Given/When/Then)

```gherkin
AC1: Tạo link thành công
  Given tôi là Guest và URL hợp lệ
  When tôi POST /api/links {url: "https://example.com"}
  Then trả 201 với {slug: 6 ký tự, shortUrl: "https://beshort.ly/xxx"}

AC2: URL không hợp lệ
  Given URL thiếu scheme
  When POST /api/links
  Then trả 400 {error: "URL không hợp lệ"}

AC3: Redirect
  Given slug tồn tại và chưa hết hạn
  When GET /abc123
  Then 302 redirect về URL gốc và tăng click count
```

## 10. Liên kết

- Spec: `docs/03_SPEC/SPEC-XXX.md`
- Prompt: `docs/04_PROMPTS/PROMPT-XXX.md`
- Tasks: `docs/05_TASKS/TASK-XXX.md`

---
<!-- EXAMPLE cho BeShort: BIZ-001 Rút gọn URL — copy khối trên và điền. Xem BACKLOG.md:1 để biết thứ tự ưu tiên -->

