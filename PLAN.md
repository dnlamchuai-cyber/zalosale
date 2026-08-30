# zaloSALE — Kế hoạch chi tiết & Nhật ký yêu cầu

> **Quy tắc**: khi chủ dự án đưa ra yêu cầu mới → **PHẢI** note vào mục "Nhật ký yêu cầu" bên dưới (ngày + mô tả + trạng thái), rồi triển khai và cập nhật trạng thái.

---

## 1. Mục tiêu

Bot Zalo tự động chuyển tiếp tin đăng phòng từ **nhóm nguồn (nhóm tổng)** sang **nhóm đích theo khu vực**:

- Nhận định khu vực qua **từ khoá** (vd: "Hà Đông", "Nguyễn Trãi" → nhóm Hà Đông)
- **Xoá nguyên dòng** chứa chữ cấu hình trước khi forward (vd dòng `🌹( 12t ) : 30%`)
- Chuyển tiếp đầy đủ **text + cụm ảnh**
- Nhóm đích do chủ dự án tự nhập **link zalo.me/g/...**

## 2. Từ khoá & nhóm đích (điền khi có link thật)

| Khu vực | Từ khoá nhận định | Link nhóm đích | Trạng thái |
|---|---|---|---|
| (ví dụ) Hà Đông | `ha dong`, `nguyen trai`, `van quan` | `https://zalo.me/g/....` | chờ nhập |
| (ví dụ) Ba Đình | `ba dinh`, `phan dinh phung`, `lang ha` | `https://zalo.me/g/....` | chờ nhập |

## 3. Cấu hình (config/config.json)

- `sourceGroups` (cột 1): tên các nhóm nguồn
- `areas` (cột 2): mỗi dòng = khu vực: `keywords` + `groupLink`
- `deleteLines`: mảng chữ → xoá nguyên dòng chứa chữ đó
- `filter.removePercentLines`: bật → xoá mọi dòng có dạng phần trăm hoa hồng (vd `30%`)
- `filter.removePriceLines`: bật → xoá dòng chứa "giá"
- `defaultArea`: khu vực dự phòng khi không nhận định được
- `forward`: cửa sổ gom tin, delay gửi, retry

## 4. Nhật ký yêu cầu (từ chủ dự án)

### 2026-08-20
- [x] Bot chuyển tiếp tin từ nhóm nguồn → nhóm đích theo khu vực, xoá dòng `🌹( 12t ) : 30%`
- [x] Nhóm nguồn không phân loại → bot tự nhận định khu vực qua từ khoá
- [x] Mỗi khu vực: chủ dự án tự nhập link nhóm đích
- [x] Config kiểu bảng 2 cột: cột 1 = nhóm nguồn, cột 2 = nhóm đích; thêm khu vực = thêm 1 dòng (từ khoá + link)
- [x] Xoá dòng chứa từ khoá, **nhập được nhiều từ khoá**
- [x] Lọc dòng hoa hồng theo **%** và lọc dòng **giá** (có thể bật/tắt trong config)
- [x] **Tin nhắn loại trừ**: cấu hình `excludeKeywords` — bài đăng chứa từ khoá nào đó (vd `tìm phòng`, `hết phòng`) sẽ KHÔNG chuyển tiếp toàn bộ
- [x] **Tự chọn tin nhắn**: lệnh `/last <số tin> [tên nhóm]` → `/f <số>` (chat riêng với bot)
- [x] **Chuyển tiếp theo khoảng ngày**: `/forward <từ ngày> <đến ngày> [tên nhóm]` (vd `/forward 15/08/2026 20/08/2026`), tối đa 60 ngày
- [x] **Chế độ hoạt động**: `mode: "auto"` (treo máy, forward realtime) hoặc `"manual"` (chỉ forward khi gõ lệnh); chuyển đổi lúc chạy bằng `/mode` hoặc qua UI
- [x] **Lệnh qua chat riêng với bot (DM)**, không gõ lệnh trong nhóm (tránh lộ lệnh + không biết lấy nguồn nhóm nào)
- [x] **Giao diện quản lý web** tại `http://localhost:3000`: tổng quan, sửa cấu hình trực quan (nhóm nguồn / khu vực / từ khoá / bộ lọc), **từng nhóm có nút "Chuyển tiếp ➜"** riêng theo khoảng ngày, danh sách nhóm kèm copy ID, nhật ký realtime, hiển thị QR đăng nhập
- [ ] (chờ verify thật) Chuyển tiếp đúng nhóm khu vực khi chạy thật

### 2026-08-21
- [x] **Nhóm nguồn hỗ trợ link HOẶC tên** (mỗi dòng 1 nhóm); link → resolve bằng `getGroupLinkInfo` lúc boot; tên → học khi nhận tin
- [x] **Đối chiếu tên nhóm thông minh**: bỏ emoji/icon/dấu câu, chỉ giữ chữ+số; khớp kiểu "chứa nhau" (gõ vài từ đặc trưng là được, không cần tên đầy đủ)
- [x] **Đăng xuất / Đăng nhập lại / Kiểm tra mạng Zalo** ở web; giữ phiên khi lỗi mạng (không xoá), tự chẩn đoán 6 host trong log
- [x] **Thiết kế lại giao diện** bằng **React + TypeScript + Vite + Express**: dashboard 1 trang cuộn (trạng thái, phiên đăng nhập, nhóm nguồn, khu vực, forward, quét nhóm, cài đặt, nhật ký realtime)
- [x] Server Express (`src/server-api.js`) thay `ControlServer`: REST `/api/*` + SSE + serve frontend build; lõi bot JS giữ nguyên (đã chạy thật)
- [x] Sửa bug: `listGroups` thiếu trong object return của `startBot` → web không tải được danh sách nhóm
- [x] Xác minh `getAllGroups` + `getGroupInfo` hoạt động (300 nhóm, không lỗi)
- [ ] (chờ verify thật) Forward thật trên nhóm Zalo sau khi rebuild giao diện