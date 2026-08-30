# REVIEW-001 — service.checkCommunity

> Từ: TASK-001 | Ngày: 2026-08-24 | Người review: AI + @dinhnam

## 1. Correctness
- [x] Đúng BR2 (3 tầng fallback) và BR3 (filter keyword) — test 1 và 2 pass
- [x] Edge EC1-5 đã xử lý (group không tồn tại → throw 400, không có tin → 0, chỉ ảnh → giữ)
- [x] Test cover 2 ví dụ PROMPT, 3 case trong service.test.js

## 2. Readability
- [x] Tên rõ: `checkCommunity`, `kwNorm`, `posts` — không `data/tmp`
- [x] Early return nếu `range.error`
- [x] ≤50 dòng (hiện 38 dòng)

## 3. Architecture
- [x] Nằm đúng `src/features/community-check/service.ts` (route→service→lib), không đụng `src/history.js`
- [x] Tách biên: service chỉ gọi `fetchRecentMessages` (boundary) và `classifyArea` (lib)
- [x] Dùng `deps.areas` để test không cần DB

## 4. Security
- [x] Validate `groupId` min 5 max 30, `keyword` max 50 (zod)
- [x] Không log `api` secret, chỉ log `groupId` và `range.label`
- [x] Không thêm dependency mới

## 5. Performance
- [x] Gọi `fetchRecentMessages` 1 lần với `count=500` (đủ 3 ngày), không N+1
- [x] Filter `isExcluded` và `keyword` O(n), n ≤ 500

## Verdict
- [x] **Approve** — Ready to merge

## Bài học
- Thợ: Tách `filterByKeyword` riêng sẽ dễ test hơn, nhưng hiện đã ≤50 dòng nên giữ.
- Kiến trúc: Để `src/features/community-check/` riêng giúp sau này thêm `route.ts` không phình `history.js`.
