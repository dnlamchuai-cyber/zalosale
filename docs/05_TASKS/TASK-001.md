# TASK-001 — service.checkCommunity (3 ngày, fallback Community)

> Trạng thái: ✅ Done | Từ: PROMPT-001 | Ngày: 2026-08-24 | Ngày xong: 2026-08-24
> Estimate: 2h | Người làm: AI + @dinhnam

## Mô tả
Làm 1 hàm `checkCommunity` trong `src/features/community-check/service.ts` theo PROMPT-001 (chỉ service, chưa route). Dùng `history.fetchRecentMessages` đã có fallback 3 tầng.

## Checklist

### Code
- [x] Tạo `src/features/community-check/service.js` với header 3 Biết + `MAX_DAYS=60`
- [x] Implement `checkCommunity` 38 dòng, tách `kwNorm` riêng
- [x] Dùng `CheckCommunitySchema.parse` + `resolveRange` + `isExcluded` + `normalizeText`

### Test
- [x] Tạo `src/features/community-check/service.test.js` (3 case)
  - Test 1: filter `cau giay` → total 1 PASS
  - Test 2: không filter → total 2 PASS
  - Test 3: rỗng → total 0 PASS
- [x] `npm test` xanh (1429 PASS)

### Verify
- [x] `node --check src/features/community-check/service.js` — ok
- [x] `npx tsc --noEmit` (web) — build xanh
- [x] `npm run build` — xanh
- [x] Review `docs/06_REVIEW/REVIEW-001.md` Approved

## Kết quả / ghi chú
- Code xong 38 dòng, test 3 case PASS, `npm test` 1429 PASS, `npm run build` xanh
- Đã test với `groupId 8089152704833938973` thật, `group/history` 404 → fallback `store` OK

## Góc nhìn

- **Thợ (làm):** Chỉ 1 hàm, test trước (mock `fetchFn`), code sau — test xanh mới làm UI.
- **Thầy (dạy):** Tại sao phải mock `fetchFn` thay vì mock `api`? Vì `fetchRecentMessages` đã có fallback 404→store, mock `fetchFn` cho test nhanh hơn, không cần file thật.
- **PM (quản lý):** Xong TASK này là có thể demo quét 3 ngày cho nhóm `[1]...` bằng `node` mà chưa cần UI. Tiếp theo là TASK-002 (route).
