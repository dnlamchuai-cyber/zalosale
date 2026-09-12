# SPEC-002 — Kho tra cứu tin phòng đã gửi

> Trạng thái: ✅ Approved | Từ: BIZ-002 | Ngày: 2026-08-30

## 1. Mục tiêu kỹ thuật

Lưu bền vững hồ sơ phòng và từng lần gửi; tìm nhanh bằng mã/địa chỉ/nội dung; biết nhóm nguồn, các nhóm đích, trạng thái gửi và mức độ đầy đủ của dữ liệu. Không dùng `data/history.jsonl` làm nguồn dữ liệu chính vì file đó xoay vòng và chỉ phục vụ fallback lịch sử ngắn hạn.

## 2. Kiểu dữ liệu (type-first)

```ts
import { z } from "zod";

export const RoomStatusSchema = z.enum(["unknown", "available", "reserved", "rented"]);
export const CaptureMethodSchema = z.enum(["bot_send", "self_event", "history_reconcile"]);
export const DeliveryStatusSchema = z.enum(["sent", "partial", "failed"]);

export const RoomCodeSchema = z.string().trim().min(1).max(50);

export const SearchSentMessagesSchema = z.object({
  query: z.string().trim().max(200).default(""),
  sourceGroupId: z.string().trim().max(40).optional(),
  destinationGroupId: z.string().trim().max(40).optional(),
  status: RoomStatusSchema.optional(),
  from: z.string().date().optional(),
  to: z.string().date().optional(),
  cursor: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const UpdateRoomSchema = z.object({
  roomCode: RoomCodeSchema.optional(),
  status: RoomStatusSchema.optional(),
  address: z.string().trim().max(500).optional(),
}).refine((value) => Object.keys(value).length > 0, "Cần ít nhất một thay đổi");

export type RoomStatus = z.infer<typeof RoomStatusSchema>;
export type SearchSentMessagesInput = z.infer<typeof SearchSentMessagesSchema>;
export type UpdateRoomInput = z.infer<typeof UpdateRoomSchema>;
```

## 3. Mô hình dữ liệu

### ERD

```text
RoomRecord 1 ─────── n SentMessage n ─────── 1 ZaloGroup (destination)
                              │
                              └──────────── 0..1 ZaloGroup (source)

SyncCoverage ghi các khoảng listener/quét bù hoạt động hoặc bị thiếu dữ liệu.
```

### SQLite schema đề xuất

```sql
CREATE TABLE room_records (
  id TEXT PRIMARY KEY,
  room_code TEXT NOT NULL UNIQUE COLLATE NOCASE,
  address TEXT NOT NULL DEFAULT '',
  normalized_address TEXT NOT NULL DEFAULT '',
  latest_content TEXT NOT NULL DEFAULT '',
  normalized_content TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'unknown'
    CHECK (status IN ('unknown', 'available', 'reserved', 'rented')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE zalo_groups (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL DEFAULT '',
  last_resolved_at INTEGER
);

CREATE TABLE sent_messages (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL REFERENCES room_records(id),
  source_group_id TEXT REFERENCES zalo_groups(id),
  destination_group_id TEXT NOT NULL REFERENCES zalo_groups(id),
  zalo_message_id TEXT,
  original_content TEXT NOT NULL DEFAULT '',
  sent_content TEXT NOT NULL DEFAULT '',
  content_hash TEXT NOT NULL,
  capture_method TEXT NOT NULL
    CHECK (capture_method IN ('bot_send', 'self_event', 'history_reconcile')),
  delivery_status TEXT NOT NULL
    CHECK (delivery_status IN ('sent', 'partial', 'failed')),
  sent_at INTEGER NOT NULL,
  captured_at INTEGER NOT NULL,
  image_total INTEGER NOT NULL DEFAULT 0,
  image_sent INTEGER NOT NULL DEFAULT 0,
  UNIQUE(destination_group_id, zalo_message_id)
);

CREATE INDEX sent_messages_room_time_idx
  ON sent_messages(room_id, sent_at DESC);
CREATE INDEX sent_messages_source_time_idx
  ON sent_messages(source_group_id, sent_at DESC);
CREATE INDEX sent_messages_destination_time_idx
  ON sent_messages(destination_group_id, sent_at DESC);

CREATE VIRTUAL TABLE room_search USING fts5(
  room_id UNINDEXED,
  room_code,
  address,
  content,
  tokenize = 'unicode61 remove_diacritics 2'
);

CREATE TABLE sync_coverage (
  id TEXT PRIMARY KEY,
  started_at INTEGER NOT NULL,
  ended_at INTEGER,
  method TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('covered', 'gap', 'partial')),
  detail TEXT NOT NULL DEFAULT ''
);
```

`room_search` được cập nhật trong cùng transaction với `room_records`. Hàm chuẩn hóa tiếng Việt vẫn tạo `normalized_address` và `normalized_content` để có fallback nhất quán, đặc biệt với `đ/d`.

## 4. Quy tắc nhận diện và gom phòng

```text
1. Trích mã từ nhãn rõ ràng: "mã", "mã phòng", "code".
2. Nếu mã đã tồn tại → gắn lần gửi vào đúng RoomRecord.
3. Nếu chưa có mã → tạo mã P-XXXXXX ổn định và RoomRecord mới.
4. Tính gợi ý tương đồng từ địa chỉ + nội dung để UI đề nghị gộp.
5. Không tự gộp chỉ dựa trên địa chỉ/nội dung; user phải xác nhận.
```

Mã sinh dùng sáu ký tự chữ-số ngẫu nhiên và retry khi trùng. Không dùng hash nội dung làm định danh vì chủ phòng có thể sửa giá hoặc câu chữ khi đăng lại.

## 5. Luồng ghi dữ liệu

### Bot gửi

```text
Forwarder gửi từng nhóm đích
  → Zalo trả thành công
  → SentMessageService.recordBotDelivery(...)
  → transaction: upsert group → resolve/create room → insert lần gửi → update FTS
```

Việc ghi DB xảy ra sau xác nhận gửi. Nếu Zalo đã gửi nhưng DB lỗi, ghi hàng đợi phục hồi cục bộ và cảnh báo nổi bật; không im lặng bỏ mất dấu vết.

### Người dùng tự gửi trực tiếp

```text
listener nhận message.isSelf
  → bỏ qua tin đã có zalo_message_id/content_hash phù hợp
  → recordSelfDelivery(captureMethod = self_event)

Khi khởi động/quét bù
  → lấy lịch sử nhóm trong giới hạn Zalo cho phép
  → đối chiếu id/hash
  → recordSelfDelivery(captureMethod = history_reconcile)
  → ghi SyncCoverage covered/partial/gap
```

Không thể cam kết lấy tin tự gửi trong thời gian bot tắt nếu API Zalo không trả lại lịch sử. UI bắt buộc thể hiện khoảng trống này.

## 6. API contract

| Method | Endpoint | Input | Trả về | Lỗi |
|---|---|---|---|---|
| GET | `/api/sent-rooms` | `SearchSentMessagesSchema` qua query | danh sách phòng gom + `nextCursor` | 400/500 |
| GET | `/api/sent-rooms/:roomId` | UUID/ID hợp lệ | hồ sơ + toàn bộ lịch sử gửi phân trang | 400/404/500 |
| PATCH | `/api/sent-rooms/:roomId` | `UpdateRoomSchema` | hồ sơ đã cập nhật | 400/404/409 |
| POST | `/api/sent-rooms/:roomId/merge` | `{targetRoomId}` | hồ sơ đích sau khi gộp | 400/404/409 |
| GET | `/api/sent-rooms/sync-coverage` | `from`, `to` | khoảng phủ và khoảng trống | 400/500 |

GET phù hợp cho tìm kiếm vì không thay đổi dữ liệu và có thể bookmark bộ lọc. PATCH chỉ cập nhật mã/địa chỉ/trạng thái. Merge dùng POST vì là thao tác nghiệp vụ có transaction, chuyển lịch sử và đóng hồ sơ nguồn.

### Kết quả danh sách

```ts
type SentRoomSummary = {
  id: string;
  roomCode: string;
  address: string;
  latestContent: string;
  status: "unknown" | "available" | "reserved" | "rented";
  sourceGroups: Array<{ id: string; name: string }>;
  destinations: Array<{
    group: { id: string; name: string };
    sentCount: number;
    lastSentAt: number;
    lastDeliveryStatus: "sent" | "partial" | "failed";
  }>;
  lastSentAt: number;
};
```

## 7. Kiến trúc file

```text
src/features/sent-message-index/
  schema.js              # zod request/response
  normalize.js           # hàm thuần: bỏ dấu, trích mã, tạo hash
  repository.js          # biên SQLite, transaction và FTS
  service.js             # gom phòng, ghi lần gửi, search, merge
  route.js               # validate rồi gọi service
  service.test.js
  route.test.js
src/db/
  client.js              # duy nhất nơi mở DB + pragma/migration
  migrations/001_sent_message_index.sql
web/src/features/sent-message-index/
  SentRoomSearch.tsx
  SentRoomDetail.tsx
  SentRoomSearch.test.tsx
```

Tầng gửi Zalo chỉ phát sự kiện giao hàng đã xác nhận sang service; không viết SQL trong `forwarder.js`. Listener chỉ chuyển self-event sang service. Cách này giữ biên Zalo, nghiệp vụ và persistence tách rời.

## 8. Giao diện

```text
[ Tìm mã phòng hoặc địa chỉ... ] [Nhóm nguồn] [Nhóm đích] [Ngày] [Trạng thái]

P-101 · 25 Trần Duy Hưng                         [Còn phòng]
Nội dung gần nhất...
Nguồn: Kho phòng Cầu Giấy
Đã gửi: Nhóm A (2 lần) · Nhóm B (1 lần) · lần cuối 30/08/2026
[Xem lịch sử]
```

Chi tiết hiển thị timeline từng lần gửi, nội dung thực gửi, nguồn, đích, thời gian, phương thức thu thập và trạng thái. Nếu có `SyncCoverage=gap`, đặt cảnh báo ngay trên kết quả liên quan.

## 9. Bảo mật, vận hành và hiệu năng

- API chỉ bind `127.0.0.1` như hiện tại; nếu sau này mở LAN phải bổ sung xác thực trước.
- Không log nội dung phòng, số điện thoại hoặc truy vấn tìm kiếm; log chỉ dùng ID và lỗi kỹ thuật đã làm sạch.
- Query luôn parameterized; giới hạn `query=200`, `limit<=100`, cursor pagination.
- DB bật WAL, foreign keys và `busy_timeout`; một writer tuần tự phù hợp bot local.
- Không tự xóa nhưng cần sao lưu tự động theo ngày, giữ nhiều phiên bản và có thao tác kiểm tra phục hồi. Chính sách backup chi tiết là một task riêng trước khi coi tính năng production-ready.
- Mục tiêu 100.000 lần gửi: tìm mã p95 dưới 500 ms; truy vấn chung trả tối đa 100 kết quả/trang.

## 10. Chọn DB và ADR đề xuất

**Đề xuất:** SQLite + FTS5 cho bản một máy/một tài khoản.

- Phù hợp app local, cài đặt nhẹ, transaction tốt và sao lưu một file.
- Nhanh hơn quét JSONL, hỗ trợ index/quan hệ/FTS và không có giới hạn lưu 30 ngày của store hiện tại.
- Trade-off: không phù hợp nhiều máy ghi đồng thời; khi cần đồng bộ nhiều máy sẽ chuyển repository sang PostgreSQL.
- Dùng `node:sqlite` có sẵn từ Node 22.13+; không thêm dependency native. Máy triển khai hiện tại đã xác minh Node 24.19.0 hỗ trợ module này. Trade-off: dự án không còn hỗ trợ Node 18-21.

## 11. Thứ tự triển khai sau khi được duyệt

1. DB migration + repository + test.
2. Ghi chính xác các lần bot gửi thành công + cơ chế phục hồi khi DB lỗi.
3. API tìm kiếm và cập nhật trạng thái.
4. UI tìm kiếm/danh sách/chi tiết.
5. Thu tin `isSelf`, quét bù và hiển thị độ phủ đồng bộ.
6. Backup/restore và kiểm thử hiệu năng.

Mỗi mục là một vertical slice riêng, qua đủ gate trước khi sang mục tiếp theo.

## 12. Điều kiện duyệt

- User duyệt BIZ-002 và nguyên tắc hai lớp `RoomRecord` / `SentMessage`.
- User duyệt SQLite + FTS5 cho mô hình một máy/một tài khoản và runtime Node 22.13+.
- User duyệt mã tự sinh `P-XXXXXX` và việc chỉ gợi ý, không tự gom khi thiếu mã.
- User chấp nhận giới hạn kỹ thuật của tin tự gửi trong lúc bot tắt.
- User xác nhận cho phép lưu nội dung có số điện thoại, nhưng không đưa dữ liệu đó vào log.
