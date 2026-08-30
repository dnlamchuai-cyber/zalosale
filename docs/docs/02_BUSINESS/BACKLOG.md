# BACKLOG — Danh sách chức năng (chia nhỏ để vibe code)

> Mỗi dòng là 1 BIZ. Mỗi BIZ sẽ tách thành nhiều TASK (1 TASK = 1 slice). PM sắp xếp ưu tiên, Dev chỉ làm theo thứ tự.
> Nguyên tắc: P0 trước, mỗi lần chỉ làm 1 BIZ, mỗi BIZ chỉ làm 1 TASK tại 1 thời điểm.

## BeShort — Backlog gợi ý (đã chia theo vertical slice)

| # | Mã | Chức năng | Mô tả 1 câu | Ưu tiên | Trạng thái | Spec |
|---|----|-----------|-------------|---------|------------|------|
| 1 | BIZ-001 | Rút gọn URL (Guest) | Dán link dài → nhận link ngắn 6 ký tự | P0 | Draft | SPEC-001 |
| 2 | BIZ-002 | Redirect + Click log | Truy cập slug → redirect + ghi analytics | P0 | Draft | SPEC-002 |
| 3 | BIZ-003 | Auth (Member) | Đăng ký/đăng nhập để quản lý link | P1 | Draft | SPEC-003 |
| 4 | BIZ-004 | Dashboard “Link của tôi” | List, search, xóa link | P1 | Draft | SPEC-004 |
| 5 | BIZ-005 | Thống kê click | Xem chart click theo ngày/device | P1 | Draft | SPEC-005 |
| 6 | BIZ-006 | Custom slug & Expiry | User tự đặt slug, đặt hạn | P2 | Idea | — |
| 7 | BIZ-007 | QR Code | Tạo QR cho link ngắn | P2 | Idea | — |
| 8 | BIZ-008 | Team workspace | Chia sẻ link trong team | P2 | Idea | — |

## Cách chia BIZ → TASK (ví dụ BIZ-001)

```
BIZ-001: Rút gọn URL
├── TASK-001: DB schema + migration (links table)
├── TASK-002: POST /api/links — tạo slug + validate zod (logic, chưa UI)
├── TASK-003: Rate limit + blacklist check
└── TASK-004: UI form rút gọn (Pha 5 — sau khi logic xanh)
```

Mỗi TASK ≤300 dòng, có test riêng, 1 PR riêng.

## Quy tắc cho team

1. **Không làm P1 khi P0 chưa Done.** PM chịu trách nhiệm sắp xếp.
2. **Mỗi BIZ phải có REVIEW trước khi sang BIZ mới.**
3. **Ước lượng:** Mỗi TASK = 0.5–1 ngày. Nếu >1 ngày → tách tiếp.
4. **Họp backlog 1 lần/tuần:** Cập nhật trạng thái, thêm/bớt scope có ADR.

## Template thêm BIZ mới

Copy `docs/02_BUSINESS/_TEMPLATE.md` → `BIZ-00X_Ten.md` → điền → chạy `/lay-yeu-cau` để refine → thêm vào bảng trên.

---
*Teams: Dán bảng này lên Notion/Linear/Jira nếu cần, nhưng file này là nguồn chân lý.*

