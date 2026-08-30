# PROMPT-002 — route POST /api/community/check (validate → gọi service)

> Trạng thái: ✅ Self-checked | Từ: SPEC-001 | Ngày: 2026-08-24

## 1. Context
- Stack: TypeScript 5 + Node 22 + Express 5 + zca-js@2.1.2 + file `data/history.jsonl`
- Dùng SPEC: `docs/03_SPEC/SPEC-001.md:3` (API contract POST /api/community/check)
- Đã có: `src/features/community-check/service.js` (TASK-001 Done, đã test), `src/store.js`, `src/history.js`
- Mục tiêu slice 2: chỉ làm **route** (chưa làm UI), để test E2E `curl` quét 3 ngày cho nhóm `[1]...`

## 2. Yêu cầu (1 việc duy nhất)
Viết `src/features/community-check/route.js` — hàm `communityCheckRoute(req, res)`:

1. Validate `req.body` bằng `CheckCommunitySchema` (từ `service.js`) — nếu lỗi thì `res.status(400).json({ok:false, error: e.message})`
2. Gọi `checkCommunity(parsed, {api: req.api ?? globalApi, areas: req.areas ?? []})` — `api` lấy từ `req.api` (do `server-api.js` gắn) hoặc `globalApi` (đã login)
3. Trả `res.json({ok:true, total, posts, range})` — `posts` đã có `clean.slice(0,400)`
4. Bắt lỗi `range.error` → 400, lỗi khác → 500

**Không làm:** service (đã xong), UI, DB, không tự thêm `GET` hay `DELETE`.

## 3. Files IN/OUT
- IN (chỉ đọc):
  - `docs/03_SPEC/SPEC-001.md:3`
  - `src/features/community-check/service.js:1`
  - `src/server-api.js:86` (xem cách gắn route `/api/community/check` — tham khảo, không sửa logic khác)
  - `src/config.js:11` (DEFAULT_FORWARD)
- OUT (được tạo/sửa):
  - `src/features/community-check/route.js` (mới, ≤50 dòng)
  - `src/features/community-check/route.test.js` (mới, colocated, 2 case)
  - `src/server-api.js` (chỉ thêm 1 dòng gắn route, không đụng route khác)
- CẤM sửa:
  - `src/features/community-check/service.js` (đã Done)
  - `web/*`, `prisma/*`
  - Không thêm dependency mới

## 4. Ví dụ I/O

**Ví dụ 1 — pass:**
```ts
Request: POST /api/community/check  Body: {groupId:"8089152704833938973", from:"2026-08-21", to:"2026-08-24"}
Mock: service.checkCommunity → {total:1, posts:[{clean:"Phòng Cầu Giấy", areaName:"cau giay"} ], range:"21/08/2026 → 24/08/2026 (3 ngày)"}
Response: 200 {ok:true, total:1, posts:[...], range:"21/08/2026 → 24/08/2026 (3 ngày)"}
```

**Ví dụ 2 — fail (from sai):**
```ts
Request: POST /api/community/check  Body: {groupId:"8089...", from:"abc"}
Response: 400 {ok:false, error:"Ngày bắt đầu không hợp lệ: \"abc\""}
```

## 5. Ràng buộc (thợ code + kiến trúc sư)

**Thợ:**
- File `route.js` ≤300 dòng, hàm `communityCheckRoute` ≤50 dòng & 1 việc (chỉ validate + gọi service + trả JSON)
- Tên rõ: `communityCheckRoute` — cấm `handler/tmp`
- Không magic number: dùng `CheckCommunitySchema` đã có, không hardcode `5` hay `30`
- Early return nếu `!req.body.groupId`
- Header 3 Biết bắt buộc:
  ```
  // Ai viết: AI PROMPT-002
  // Tại sao chọn POST thay vì GET: vì body có keyword dài, không idempotent
  // Link: docs/03_SPEC/SPEC-001.md + docs/04_PROMPTS/PROMPT-002.md
  ```

**Kiến trúc sư:**
- Tách biên: `route.js` chỉ `zod.parse` và `res.json`, không chứa BR (BR ở `service.js`)
- Chia theo feature: `src/features/community-check/` 1 folder, không để `src/routes/community.js` chung
- YAGNI: không làm auth, không làm pagination ở route (đã có ở service)
- Config bằng `req.api` (do server gắn), không hardcode `new Zalo()` trong route

## 6. Verify

- [ ] `npm test` — chạy `src/features/community-check/route.test.js` (2 ví dụ trên) xanh
- [ ] `npx tsc --noEmit` — không lỗi type
- [ ] `npm run build` — xanh
- [ ] Test thủ công: `curl -X POST http://localhost:3000/api/community/check -H "Content-Type: application/json" -d '{"groupId":"8089152704833938973","from":"2026-08-21","to":"2026-08-24"}'` trả `total` đúng
