# HD Treo Máy & Kiến Trúc Lưu Realtime

## 1. Vấn đề hiện tại

`getGroupChatHistory` (`GET https://tt-group-wpa.chat.zalo.me/api/group/history`) trả **404** cho cả nhóm thường (type 1) lẫn Community (type 2) trên tài khoản này. Đã test trực tiếp với `zca-js@2.1.2` cho 2 nhóm:

- `[1] NGUỒN HÀNG HHOUSE...` (type 2) → 404
- `Kyc` (type 1) → 404

→ Tính năng **Quét theo ngày** (đọc lịch sử) đang tê liệt, không phải do cấu hình sai.

## 2. Tại sao lưu realtime là giải pháp đúng lúc này

|  | Đọc lịch sử (cũ) | Lưu realtime (mới) |
|---|---|---|
| Nguồn dữ liệu | Gọi API Zalo mỗi lần quét | Ghi file local khi tin đến |
| Phụ thuộc Zalo | 100% (hỏng là chết) | Chỉ phụ thuộc `listener` (đang chạy tốt) |
| Tốc độ | Chậm (60 request/300 nhóm) | Nhanh (đọc file) |
| Tin cũ trước khi bật bot | Lấy được | Không lấy được |
| Tin mới khi treo máy | Phải quét lại | Có sẵn |

→ **Giữ cả 2**: Thử đọc API trước, nếu 404 thì fallback đọc file local. Khi Zalo sửa API, quét tin cũ sẽ tự hồi phục.

## 3. Kiến trúc đề xuất

```
[ Zalo ] ──listener──> batcher ──┬──> store.jsonl (append) ──┐
                                 │                           │
                                 ├──> [AUTO]  processor ──> classifier ──> forwarder ──> nhóm đích
                                 │
                                 └──> [MANUAL] scan API ──> đọc store.jsonl ──> preview ──> chọn ──> forwarder
```

### Module mới: `src/store.js`

- `appendBatch(threadId, items)` – được `batcher` gọi cho **mọi** tin (kể cả manual), ghi 1 dòng JSONL:
  `{ ts, threadId, threadName, items: [{data}], clean, areaName }`
- `query({ fromMs, toMs, sourceIds, keyword })` – đọc file, lọc theo ngày + nhóm nguồn + từ khóa chứa trong tin, trả về batches như `fetchRecentBatches`
- File: `data/history.jsonl` (không commit), xoay vòng: giữ 30 ngày, tối đa 50k dòng (tự xóa cũ)

### Thay đổi tối thiểu (không đụng lõi)

- `src/batcher.js` – giữ nguyên
- `src/processor.js`, `classifier.js`, `forwarder.js` – giữ nguyên (dùng chung cho cả 2 chế độ)
- `src/listener.js` – thêm 1 dòng sau `batcher.add(...)`: `store.appendBatch(...)`; giữ `if (mode === "manual") return` để chặn auto-forward, nhưng vẫn lưu
- `src/history.js` – thêm `try { return await fetchRecentBatches(...) } catch (e) { if (e 404) return store.query(...) }`
- `src/store.js` – mới, chỉ đọc/ghi file, không import `zca-js`

### 2 chế độ (giữ tách bạch)

- `config.mode = "auto"` – treo máy: tin mới → batcher → store + **forward ngay** (qua `processor`/`classifier`/`forwarder` như cũ)
- `config.mode = "manual"` – thủ công: tin mới → batcher → **chỉ store** (không forward); người dùng vào **Quét & chọn tin** → đọc từ store → tick chọn → forward

Nút Auto ở topbar đổi `config.mode` và `status.mode` như hiện tại, không cần restart.

## 4. HD Treo Máy (Windows)

### Chạy thường (để terminal mở)
```bash
npm run build
npm start
# giữ cửa sổ PowerShell mở, không tắt máy
```

### Chạy nền tự khởi động lại (khuyên dùng)
```bash
npm i -g pm2
pm2 start src/index.js --name zalosale
pm2 save
pm2 startup   # làm theo hướng dẫn hiện ra để tự chạy khi bật máy
pm2 logs zalosale --lines 50   # xem log
pm2 restart zalosale            # restart sau khi đổi config
```

### Kiểm tra
- Mở `http://localhost:3000` → **Đã đăng nhập** + **AUTO** xanh
- Gửi thử 1 tin vào nhóm nguồn → 3s sau xem **Nhật ký** có dòng `Forward ...`
- Nếu mất mạng: bot tự retry, khi mạng lại sẽ tiếp tục; file `data/history.jsonl` vẫn giữ tin đã lưu

### Lưu ý
- Đừng đăng nhập cùng tài khoản trên điện thoại + máy khác cùng lúc (dễ bị đá phiên)
- File `data/history.jsonl` và `config/session/` đã có trong `.gitignore`, không commit

## 5. Kế hoạch làm

1. Tạo `src/store.js` + `data/` + test `node --check`
2. Sửa `src/listener.js` (1 dòng append) + `src/history.js` (fallback)
3. Thêm `store.query` vào `scanRange` (đã có `fetchRecentBatches` fallback)
4. `npm test` (1429 case cũ phải pass)
5. `npm run build` + `npm start` thử treo máy 1 tin thật

Bạn duyệt kế hoạch này thì tôi làm ngay, không đụng lõi cũ.
