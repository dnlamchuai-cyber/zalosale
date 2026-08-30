# zaloSALE

Bot Zalo tự động chuyển tiếp tin đăng phòng từ nhóm nguồn sang nhóm đích theo khu vực.

## Cài đặt

```bash
npm install        # cài dependency + tự động patch zca-js
cp config/config.example.json config/config.json  # PowerShell: Copy-Item config/config.example.json config/config.json
npm run build      # build giao diện web (chỉ cần 1 lần)
npm start          # chạy bot
```

Lần đầu: mở `http://localhost:3000`, quét QR đăng nhập Zalo.  
Lần sau: bot tự đăng nhập bằng phiên đã lưu.

## Giao diện web

Truy cập `http://localhost:3000` — dashboard 1 trang cuộn:

### Thanh trên cùng
- **Nút bật/tắt chế độ Auto** — góc phải, xanh = treo máy (tự chuyển tiếp realtime), xám = thủ công (quét → chọn → gửi). Mặc định là thủ công.

### 1. Thẻ trạng thái
Mode, bài đã forward, uptime, nhóm nguồn đã học, trạng thái đăng nhập.

### 2. Quét & chọn tin để gửi (chế độ thủ công)
1. Nhập **số ngày** muốn quét (vd: 3 ngày gần nhất)
2. (Tuỳ chọn) Nhập **tên nhóm nguồn** để lọc — bỏ trống = quét tất cả
3. Bấm **🔍 Quét tin** → bot đọc lịch sử, gom bài, phân loại khu vực
4. Bảng kết quả hiện: nhóm đích (Hà Đông/Ba Đình...), nhóm nguồn, nội dung preview, số ảnh, thời gian
5. **Tick chọn** từng tin hoặc tích header để chọn tất cả
6. Bấm **📤 Gửi tin đã chọn** hoặc **📤 Gửi tất cả** → bot xoá dòng, tải ảnh, gửi vào đúng nhóm khu vực

### 3. Phiên đăng nhập
- **🔄 Đăng nhập lại**: ưu tiên dùng phiên đã lưu, chỉ hiện QR khi phiên hết hạn
- **Đăng xuất**: xoá phiên + ngắt bot
- **🌐 Kiểm tra mạng Zalo**: chẩn đoán 6 host (wpa/api/id/jr/chat/stc), hiện host nào bị chặn

### 4. Nhóm nguồn
1 dòng = 1 nhóm. Điền **link** `zalo.me/g/...` hoặc **vài từ trong tên nhóm** (bỏ qua icon, emoji).  
VD: nhóm `🏠 CẦU GIẤY - PHÒNG TRỌ 🏠` chỉ cần ghi `cau giay`.

### 5. Khu vực → nhóm đích
Mỗi dòng = 1 khu vực: **từ khoá nhận diện** + **link nhóm đích**.  
Bot tự nhận diện: bài đăng chứa "hà đông" → vào đúng nhóm Hà Đông, không vào tất cả.  
Nút **🔎 Kiểm tra link → tên nhóm**: giải mã link thành tên nhóm thật + ID.

### 6. Forward lịch sử (khoảng ngày)
Chọn từ ngày/đến ngày → Quét & Forward tất cả nhóm nguồn (dùng khi đang ở chế độ auto).

### 7. Quét danh sách nhóm
Bấm **Tải danh sách** → hiện tất cả nhóm bot đang tham gia (tên + ID, phân trang 20).  
Tick chọn → **➕ Thêm vào nhóm nguồn** (không cần gõ tên).  
Nút **copy** để copy ID vào khu vực nếu cần.

### 8. Cài đặt xử lý tin
- **Xoá nguyên dòng** chứa chữ cấu hình (vd: 🌹, hoa hồng)
- **Loại trừ toàn bài** chứa từ khoá (vd: tìm phòng, hết phòng)
- **Lọc % hoa hồng** và **lọc dòng giá** (bật/tắt)
- **Khu vực dự phòng**: khi không nhận định được khu vực, gửi vào khu vực này
- **Thời gian & chống ban**: gom cửa sổ, delay gửi, retry, gap lịch sử

### 9. Nhật ký
Log realtime từ server — xem bot đang quét, forward, lỗi gì.

## Lệnh chat riêng với bot

Gõ trong **chat riêng với bot** (không gõ trong nhóm):

| Lệnh | Mô tả |
|---|---|
| `/status` | Trạng thái bot |
| `/groups` | Danh sách nhóm đang tham gia |
| `/forward 3` | Quét 3 ngày gần nhất |
| `/forward 15/08 20/08` | Quét từ 15/08 đến 20/08 |
| `/last 5` | 5 tin mới nhất |
| `/f 2` | Forward tin số 2 trong danh sách `/last` |
| `/mode auto` | Bật treo máy |
| `/mode manual` | Tắt treo máy |
| `/help` | Hướng dẫn |

## Cấu trúc file

```
zaloSALE/
├── config/config.json   ← cấu hình chính
├── config/session/      ← phiên đăng nhập (tự sinh)
├── src/                 ← lõi bot (JS)
│   ├── index.js         ← boot
│   ├── server-api.js    ← Express REST + SSE + serve frontend
│   ├── session.js       ← đăng nhập QR
│   ├── listener.js      ← xử lý tin nhắn, lệnh DM
│   ├── forwarder.js     ← gửi text + ảnh
│   ├── batcher.js       ← gom tin thành bài
│   ├── classifier.js    ← nhận định khu vực
│   ├── processor.js     ← xoá dòng, lọc
│   ├── history.js       ← quét lịch sử
│   └── logger.js
├── web/                 ← frontend React + TypeScript
│   └── src/
├── scripts/
│   ├── tests.mjs        ← 1402 case kiểm thử tự động
│   └── patch-zca.js     ← patch getAllGroups
└── public/              ←  (backup giao diện cũ)
```

## Chạy kiểm thử

```bash
npm test                 # 1402 case, tất cả PASS
```

## Lưu ý

- Bot dùng API unofficial của Zalo, cần đăng nhập qua QR
- Không đăng nhập bot trên nhiều thiết bị cùng lúc
- Nếu bị lỗi mạng: bấm 🌐 Kiểm tra mạng Zalo trên web để xem host nào bị chặn
- `api.zalo.me` là host quan trọng nhất — nếu chết thì không quét được nhóm, không forward được
