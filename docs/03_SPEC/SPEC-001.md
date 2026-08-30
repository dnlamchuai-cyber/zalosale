# SPEC-001 — Check tin nhắn cũ Community (3 ngày)

> Trạng thái: 📝 Draft | Từ: BIZ-001 | Ngày: 2026-08-24

## 1. Kiểu dữ liệu (type-first)

```ts
import { z } from "zod";

// Request
export const CheckCommunitySchema = z.object({
  groupId: z.string().min(5).max(30), // vd "8089152704833938973"
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$|^\d{1,2}\/\d{1,2}(\/\d{4})?$/), // "2026-08-21" hoặc "21/08/2026"
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$|^\d{1,2}\/\d{1,2}(\/\d{4})?$/).optional(),
  keyword: z.string().max(50).optional(), // "cau giay"
  count: z.number().int().min(1).max(1500).default(500).optional(),
});
export type CheckCommunityInput = z.infer<typeof CheckCommunitySchema>;

// Response
export const CommunityPostSchema = z.object({
  id: z.string(), // "8089...:0"
  ts: z.number(),
  clean: z.string().max(400),
  areaName: z.string().nullable(),
  kw: z.string(),
  photos: z.number(),
  price: z.number().nullable(),
  raw: z.any(), // GroupMessage gốc
});
export type CommunityPost = z.infer<typeof CommunityPostSchema>;

export const CheckCommunityResponseSchema = z.object({
  ok: z.literal(true),
  total: z.number(),
  Posts: z.array(CommunityPostSchema), // alias posts
  range: z.string(), // "21/08/2026 → 24/08/2026 (3 ngày)"
});
```

## 2. DB schema

Không dùng Postgres cho slice này — dùng file `data/history.jsonl` đã có trong `src/store.js`:

```
data/history.jsonl — mỗi dòng 1 JSON:
{ ts: number, threadId: string, threadName: string, items: GroupMessage[] }
```

Giữ 30 ngày, 50k dòng, xoay vòng trong `store.js:rotate()`. Nếu sau này cần query phức tạp → thêm `Postgres + Prisma` (ghi ADR).

## 3. API contract

| Method | Endpoint | Body (zod) | Trả về | Lỗi |
|---|---|---|---|---|
| POST | /api/community/check | `CheckCommunitySchema` | `{ok:true, total, posts, range}` | 400 (from/to sai) / 404 (group không tồn tại) / 500 |

**Giải thích POST vs GET:**
- Dùng **POST** vì `keyword` và `groupId` là bộ lọc, không phải resource idempotent; GET sẽ lộ `groupId` dài trên URL và cache sai.

**Luồng service:**
```
route (validate CheckCommunitySchema)
  → service.checkCommunity({groupId, fromMs, toMs, keyword, count})
    → history.fetchRecentMessages(api, groupId, {fromMs,toMs}) // 3 tầng fallback
    → filter isExcluded/clean/keyword
    → map qua forwarder.describePost để lấy areaName/price
```

## 4. Kiến trúc file

```
src/features/community-check/
  route.ts      // POST /api/community/check — chỉ validate zod + gọi service
  service.ts    // BR2, BR3, BR4 — gọi history + filter + describe
  community.ts  // getCommunityHistoryFactory — POST tt-group-cm.../api/cm/getrecentv2 (đã có src/community.js, chuyển vào đây)
src/store.js    // đã có — query({fromMs,toMs,sourceIds,keyword})
src/history.js  // đã có fallback 404 → community → store
```

*Tuân `11_KIEN_TRUC.md:1` — feature 1 folder, tách biên: Route (validate) → Service (BR) → Lib (store/history thuần).*

**ADR (nếu đổi):** Chọn file local trước thay vì Postgres để không block slice 1; Postgres sẽ thêm ở slice 2 nếu cần search nhanh.

## 5. Edge cases / ràng buộc

- File ≤300 dòng, hàm ≤50 dòng, 1 hàm 1 việc, early return, không magic number (`MAX_DAYS=60`).
- Header 3 Biết bắt buộc cho mỗi file mới (Ai viết + Tại sao chọn tech/cấu trúc + Link SPEC/PROMPT).
- Test: `community.service.test.ts` cạnh `service.ts` — mock `api.getGroupChatHistory` 404 → mock `getCommunityHistory` trả 2 tin → assert filter keyword.
- Verify: `npm test` + `npx tsc --noEmit` + `npm run build` xanh.
