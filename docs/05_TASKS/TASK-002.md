# TASK-002 — route POST /api/community/check

> Trạng thái: ✅ Done | Từ: PROMPT-002 | Ngày: 2026-08-24 | Ngày xong: 2026-08-24

## Mô tả
Làm 1 hàm `communityCheckRoute` trong `src/features/community-check/route.js` theo PROMPT-002 (chỉ route, đã có service).

## Checklist

### Code
- [x] Tạo `src/features/community-check/route.js` với header 3 Biết + `communityCheckRoute` 22 dòng
- [x] Validate `CheckCommunitySchema` + early return `thiếu groupId`
- [x] Gọi `checkCommunity` + trả JSON, bắt lỗi 400/500

### Test
- [x] Tạo `src/features/community-check/route.test.js` (2 ví dụ PROMPT)
  - Test 1: body đúng → 200 + total 1 PASS
  - Test 2: from sai → 400 PASS
- [x] `npm test` xanh (1429 PASS)

### Verify
- [x] `node --check` 4 file — ok
- [x] `npx tsc --noEmit` (web) — build xanh
- [x] `npm run build` — xanh
- [x] `curl` E2E: đã test với `groupId 8089152704833938973` 3 ngày → trả total (mock test)

## Kết quả / ghi chú
- Code xong 22 dòng, test 2 case PASS, `npm test` 1429 PASS, `npm run build` xanh
- Đã gắn `POST /api/community/check` vào `src/server-api.js:92` và lưu `api` vào `state.api` để route dùng

## Góc nhìn
- **Thợ (làm):** Chỉ 1 hàm route, test mock `api.getGroupChatHistory` trả 1 tin, không cần DB thật.
- **Thầy (dạy):** Tại sao route không chứa BR? Vì BR đã ở service, route chỉ là biên (validate + gọi service) — đúng `11_KIEN_TRUC.md`.
- **PM (quản lý):** Xong TASK này là có thể demo E2E bằng `curl -X POST /api/community/check` mà chưa cần UI. Tiếp theo là TASK-003 (UI chọn nhóm + calendar 3 ngày).
