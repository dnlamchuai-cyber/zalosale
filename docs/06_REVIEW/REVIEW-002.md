# REVIEW-002 — route POST /api/community/check

> Từ: TASK-002 | Ngày: 2026-08-24 | Người review: AI + @dinhnam

## 1. Correctness
- [x] Đúng SPEC-001:3 (POST, body CheckCommunitySchema, trả total/posts/range)
- [x] Early return thiếu groupId → 400, ZodError → 400, range.error → 400
- [x] Test 2 ví dụ pass (200 và 400)

## 2. Readability
- [x] Tên rõ: `communityCheckRoute` — không `handler`
- [x] Early return, không nested
- [x] 22 dòng < 50

## 3. Architecture
- [x] Nằm đúng `src/features/community-check/route.js` (feature folder), không đụng `src/history.js`
- [x] Tách biên: route chỉ validate + gọi service, không chứa BR
- [x] Dùng `CheckCommunitySchema` từ service, không duplicate

## 4. Security
- [x] Validate `groupId` min 5 max 30, `keyword` max 50 (zod)
- [x] Không log `api` secret, chỉ log `groupId`
- [x] Không thêm dependency

## 5. Performance
- [x] Không N+1, chỉ gọi `checkCommunity` 1 lần
- [x] Không tạo object lớn trong hot path

## Verdict
- [x] **Approve** — Ready to merge
