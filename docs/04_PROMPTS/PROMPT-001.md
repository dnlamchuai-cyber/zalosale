# PROMPT-001 — service.checkCommunity (quét 3 ngày Community, fallback 3 tầng)

> Trạng thái: ✅ Self-checked | Từ: SPEC-001 | Ngày: 2026-08-24

## 1. Context
- Stack: **TypeScript 5 + Node 22 + Express 5 + zca-js@2.1.2** (đã patch getAllGroups) + file `data/history.jsonl` (không Postgres ở slice này)
- Dùng SPEC: `docs/03_SPEC/SPEC-001.md:1` + BIZ: `docs/02_BIZ/BIZ-001.md:1`
- Đã có sẵn: `src/store.js` (append/query), `src/history.js` (fetchRecentMessages đã có fallback 404→store), `src/community.js` (getCommunityHistoryFactory cho Community)
- Mục tiêu slice 1: chỉ làm **service** (chưa làm route), để test được logic 3 tầng mà không cần UI

## 2. Yêu cầu (1 việc duy nhất)
Viết `src/features/community-check/service.ts` — hàm `checkCommunity(input: CheckCommunityInput, deps: {api, store, history}) => Promise<{total, posts, range}>`:

1. Validate `input` bằng `CheckCommunitySchema` (SPEC-001:1) — nếu sai thì `throw` lỗi 400
2. Tính `fromMs/toMs` bằng `resolveRange({from, to})` — mặc định 3 ngày, max 60 → nếu lỗi thì throw
3. Gọi `history.fetchRecentMessages(api, groupId, {fromMs,toMs, count})` — hàm này đã tự fallback: `group/history` 404 → thử `community/cm/getrecentv2` → 404/fetch failed → đọc `store.query({fromMs,toMs,sourceIds:[groupId]})`
4. Lọc `isExcluded` (chứa "tìm phòng"/"hết phòng") → bỏ
5. Nếu có `keyword` thì chỉ giữ tin có `normalizeText(clean).includes(normalizeText(keyword))`
6. Map qua `forwarder.describePost(items)` để lấy `clean, areaName, kw, photos, price` — bỏ tin rỗng (`!clean && photos===0`)
7. Trả về `{total: posts.length, posts: [{id, ts, clean: slice(0,400), areaName, kw, photos, price}], range: "DD/MM/YYYY → DD/MM/YYYY (3 ngày)"}`

**Không làm:** route, UI, DB Postgres. Chỉ 1 hàm service.

## 3. Files IN/OUT
- IN (chỉ đọc, không sửa):
  - `docs/03_SPEC/SPEC-001.md:1`
  - `src/history.js:85` (fetchRecentMessages đã có fallback)
  - `src/community.js:1` (getCommunityHistoryFactory)
  - `src/store.js:1` (query)
  - `src/processor.js:1` (normalizeText, isExcluded)
  - `src/forwarder.js:15` (describePost logic tham khảo, nhưng không import forwarder)
  - `src/config.js:11` (DEFAULT_FORWARD)
- OUT (được tạo/sửa):
  - `src/features/community-check/service.ts` (mới)
  - `src/features/community-check/service.test.ts` (mới, colocated)
- CẤM sửa:
  - `src/listener.js`, `src/index.js`, `src/server-api.js`, `web/*`, `prisma/*`
  - Không tự thêm dependency mới (nếu cần `zod` đã có)

## 4. Ví dụ I/O

**Ví dụ 1 — pass (có tin, lọc keyword):**
```ts
Input: {groupId:"8089152704833938973", from:"2026-08-21", to:"2026-08-24", keyword:"cau giay", count:500}
Mock: api.getGroupChatHistory → 404, getCommunityHistory → [{data:{content:"Phòng trọ Cầu Giấy 4tr5", ts:1724200000000}}, {data:{content:"Phòng Hà Đông", ts:1724200000000}}]
Output: {total:1, posts:[{clean:"Phòng trọ Cầu Giấy 4tr5", areaName:"cau giay", photos:0, ts:1724200000000}], range:"21/08/2026 → 24/08/2026 (3 ngày)"}
```

**Ví dụ 2 — fallback store khi cả 2 API lỗi:**
```ts
Input: {groupId:"8089152704833938973", from:"2026-08-21", to:"2026-08-24"}
Mock: api.getGroupChatHistory → 404, getCommunityHistory → fetch failed, store.query → [{ts:1724200000000, threadId:"8089...", items:[{data:{content:"Tin cũ từ store"}}]}]
Output: {total:1, posts:[{clean:"Tin cũ từ store", areaName:null, photos:0}]}
```

## 5. Ràng buộc (thợ code + kiến trúc sư)

**Thợ (ngắn gọn, dễ hiểu):**
- File `service.ts` ≤300 dòng, hàm `checkCommunity` ≤50 dòng & 1 việc (nếu dài → tách `filterByKeyword`, `toPosts`)
- Tên rõ nghĩa: `checkCommunity`, `rangeMs`, `filteredPosts` — cấm `data/tmp/result`
- Không magic number: `const MAX_DAYS=60; // WHY: SPEC BR1` , `const DEFAULT_COUNT=500`
- Early return nếu `!groupId` hoặc `range.error`
- DRY 3 lần → tách (vd: `normalizeText(keyword)` lặp 2 lần thì tách `const kwNorm = normalizeText(keyword)`)
- YAGNI: không làm phân trang, không làm cache ở service (đã có ở history/store)
- Header 3 Biết bắt buộc đầu file `service.ts`:
  ```
  // Ai viết: AI PROMPT-001 + human @dinhnam
  // Tại sao chọn file local + community fallback: vì group/history 404 cho Community
  // Link SPEC/PROMPT: docs/03_SPEC/SPEC-001.md + docs/04_PROMPTS/PROMPT-001.md
  ```

**Kiến trúc sư (dễ mở rộng, dễ scale):**
- Tách biên: `route.ts` (sau này) chỉ validate zod → gọi `service.checkCommunity` → trả JSON. `service.ts` chứa BR2-BR4, không chứa `req/res`. `history.js`/`store.js` là boundary.
- Chia theo feature: `src/features/community-check/` 1 folder riêng, không để chung `src/utils.ts`
- Config bằng `store.query` param, không hardcode đường dẫn `data/history.jsonl` trong service (nhận qua `deps` để test không cần file thật)
- Đồ trước tối ưu sau: gọi `fetchRecentMessages` 1 lần với `count=500` (đủ cho 3 ngày), chưa cần parallel.

## 6. Verify

- [ ] `npm test` — chạy `src/features/community-check/service.test.ts` (2 ví dụ trên) xanh
- [ ] `npx tsc --noEmit` — không lỗi type
- [ ] `npm run build` — build web + server xanh (nếu có)
- [ ] Test thủ công: `node -e "import('./src/features/community-check/service.ts').then(m=>m.checkCommunity({groupId:'8089152704833938973',from:'2026-08-21',to:'2026-08-24'}, {api:mockApi}))"` trả `total` đúng
