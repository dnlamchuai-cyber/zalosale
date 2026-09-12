<!--
Ai viết: Codex
Tại sao: Định nghĩa hợp đồng dữ liệu CRM cục bộ trước khi thay đổi SQLite và luồng forward.
Link: docs/02_BIZ/BIZ-003_CRM_KhachHang.md
-->

# SPEC-004 — CRM khách hàng và nhu cầu phòng

> Trạng thái: 📝 Draft | Từ: BIZ-003 | Ngày: 2026-09-06

## 1. Quyết định kỹ thuật

Dùng SQLite hiện có của zaloSALE, Node.js/Express và React/Vite. Không thêm dependency, không thay đổi Zalo integration ở slice dữ liệu CRM. SQLite chỉ bind qua app local `127.0.0.1` như hiện tại.

## 2. Kiểu dữ liệu

```ts
const CareStatus = z.enum([
  "new", "consulting", "viewing_scheduled", "reserved",
  "rented", "follow_up", "not_suitable",
]);

const CustomerInput = z.object({
  name: z.string().trim().min(1).max(100),
  phone: z.string().trim().min(6).max(30),
});

const CustomerRoomCaseInput = z.object({
  roomId: z.string().uuid(),
  salesGroupId: z.string().uuid().nullable(),
  status: CareStatus,
  viewingAt: z.number().int().positive().nullable(),
  nextFollowUpAt: z.number().int().positive().nullable(),
  note: z.string().trim().max(1000).default(""),
});
```

## 3. Dữ liệu SQLite

```sql
CREATE TABLE IF NOT EXISTS room_details (
  room_id TEXT PRIMARY KEY REFERENCES room_records(id),
  address TEXT NOT NULL DEFAULT '',
  price_text TEXT NOT NULL DEFAULT '',
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone_normalized TEXT NOT NULL UNIQUE,
  phone_display TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sales_groups (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE COLLATE NOCASE,
  template TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS customer_room_cases (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(id),
  room_id TEXT NOT NULL REFERENCES room_records(id),
  sales_group_id TEXT REFERENCES sales_groups(id),
  care_status TEXT NOT NULL,
  viewing_at INTEGER,
  next_follow_up_at INTEGER,
  note TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS customer_room_cases_follow_up_idx
  ON customer_room_cases(next_follow_up_at);
```

`room_details` giữ địa chỉ/giá tách khỏi nội dung tin gốc. Migration chỉ thêm bảng mới, vì vậy vẫn chạy an toàn với database zaloSALE hiện có.

## 4. API contract

| Method | Endpoint | Mục đích |
|---|---|---|
| GET | `/api/customer-cases` | Danh sách CRM, ưu tiên nhu cầu đến hạn chăm sóc |
| POST | `/api/customers` | Tạo hoặc trả về khách có số điện thoại đã tồn tại |
| POST | `/api/customer-cases` | Tạo nhu cầu khách cho một phòng |
| PATCH | `/api/customer-cases/:caseId` | Đổi trạng thái, lịch chăm sóc, ghi chú |
| PATCH | `/api/sent-rooms/:roomId/details` | Cập nhật địa chỉ và giá phòng |
| GET/POST/PATCH | `/api/sales-groups` | Quản lý mẫu bắn khách theo nhóm sale |

Tất cả body được validate bằng Zod, giới hạn độ dài và trả lỗi đã làm sạch. API không ghi thông tin khách vào logger.

## 5. UI và luồng

```text
Kho tin đã gửi → chọn phòng → cập nhật địa chỉ/giá
  → tạo khách hoặc chọn khách cũ → tạo nhu cầu
  → Bảng CRM: lọc theo trạng thái và “Cần chăm sóc”
  → chọn nhóm sale → preview form bắn khách → sửa → sao chép

Chi tiết phòng: [Nhóm nguồn mới nhất] [Sao chép địa chỉ]
```

Nút sao chép chỉ đặt `room_details.address` vào clipboard. Nút bị vô hiệu hóa khi địa chỉ rỗng.

## 6. Bảo mật và giới hạn

- Không log tên, số điện thoại, địa chỉ hoặc nội dung mẫu khách.
- App chỉ nghe `127.0.0.1`; nếu mở LAN phải bổ sung xác thực trước.
- Phone được chuẩn hóa chỉ cho kiểm tra trùng; bản người dùng nhập vẫn được giữ để hiển thị.
- Chưa có gửi Zalo tự động; sao chép là thao tác có người kiểm soát.

## 7. Thứ tự triển khai

1. Slice 1: bảng/tạo/sửa CRM và địa chỉ phòng, với test service + API.
2. Slice 2: cập nhật trạng thái phòng và chặn forward theo mã phòng.
3. Slice 3: mẫu nhóm sale và preview/sao chép form bắn khách.
4. Slice 4: xuất Excel một chiều.
