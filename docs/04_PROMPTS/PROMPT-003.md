# PROMPT-003 — UI CommunityCheckPanel (chọn nhóm + calendar 3 ngày → gọi API)

> Trạng thái: ✅ Self-checked | Từ: SPEC-001 | Ngày: 2026-08-24

## 1. Context
- Stack: **TypeScript 5 + React 18 (Vite) + Tailwind + shadcn/ui** (đã có `web/src/components/*`)
- Dùng SPEC: `docs/03_SPEC/SPEC-001.md:3` (API POST /api/community/check) + PROMPT-002 (route đã xong)
- Đã có: `src/features/community-check/route.js` (TASK-002 Done), `web/src/components/ScanReview.tsx` (tham khảo UI quét tin cũ)
- Mục tiêu slice 3: chỉ làm **UI** (chưa forward), để user chọn nhóm Community + ngày → thấy kết quả

## 2. Yêu cầu (1 việc duy nhất)
Viết `web/src/components/CommunityCheckPanel.tsx` — component:

1. Hiện **danh sách nhóm Community** (lấy từ `GET /api/groups`, lọc `g.type===2` hoặc `isCommunity`, hiện thumbnail + tên + checkbox + phân trang 12, chọn 1 nhóm)
2. Hiện **2 ô calendar** `Từ ngày` / `Đến ngày` (mặc định 3 ngày: `today-2 → today`, dùng `<input type="date">`, max 60 ngày)
3. Ô `keyword` (optional, placeholder "cau giay")
4. Nút `Quét` → gọi `POST /api/community/check {groupId: selectedId, from, to, keyword}` → hiện `total` + bảng `posts` (clean, areaName, photos, ts) + `range`
5. Bắt lỗi: nếu `!selectedId` → báo "Chọn 1 nhóm", nếu `from/to` sai → báo lỗi 400

**Không làm:** forward, pagination posts, filter giá (để slice sau).

## 3. Files IN/OUT
- IN (chỉ đọc):
  - `docs/03_SPEC/SPEC-001.md:3`
  - `web/src/components/ScanReview.tsx:1` (tham khảo UI)
  - `web/src/components/ConfigPanels.tsx:1` (thumbnail)
  - `web/src/api.ts:1` (api helper)
  - `web/src/types.ts:1` (GroupInfo)
- OUT (được tạo/sửa):
  - `web/src/components/CommunityCheckPanel.tsx` (mới, ≤150 dòng)
  - `web/src/components/CommunityCheckPanel.test.tsx` (mới, 2 case: render + click Quét)
  - `web/src/App.tsx` (chỉ thêm 1 dòng import + 1 dòng `<CommunityCheckPanel />` dưới `ScanReviewPanel`, không đụng logic khác)
- CẤM sửa:
  - `src/features/community-check/service.js` (đã Done)
  - `src/features/community-check/route.js` (đã Done)
  - Không thêm dependency mới (đã có `date-fns` nếu cần)

## 4. Ví dụ I/O

**Ví dụ 1 — pass:**
```tsx
// User chọn nhóm 8089..., from 2026-08-21, to 2026-08-24, keyword "cau giay", bấm Quét
// Mock POST /api/community/check → {ok:true, total:1, posts:[{clean:"Phòng Cầu Giấy 4tr5", areaName:"cau giay"}], range:"21/08/2026 → 24/08/2026 (3 ngày)"}
// UI hiện: "Quét xong: 1 bài (21/08 → 24/08)" + bảng 1 dòng
```

**Ví dụ 2 — fail:**
```tsx
// User không chọn nhóm, bấm Quét
// UI hiện: "Chọn 1 nhóm Community trước"
```

## 5. Ràng buộc (thợ code + kiến trúc sư)

**Thợ:**
- File `CommunityCheckPanel.tsx` ≤150 dòng (gọn hơn 300 vì chỉ UI), hàm ≤50 & 1 việc
- Tên rõ: `CommunityCheckPanel`, `selectedId`, `fromDate` — cấm `data/tmp`
- Không magic number: `const PAGE_SIZE=12; // WHY: 12 thumb vừa 1 trang`
- Early return nếu `!selectedId`
- Header 3 Biết bắt buộc:
  ```
  // Ai viết: AI PROMPT-003
  // Tại sao chọn thumbnail + calendar thay vì select text: vì UX giống ConfigPanels
  // Link: docs/03_SPEC/SPEC-001.md + docs/04_PROMPTS/PROMPT-003.md
  ```

**Kiến trúc sư:**
- Chia theo feature: `web/src/components/CommunityCheckPanel.tsx` riêng, không nhét vào `App.tsx`
- Tách biên: Component chỉ gọi `api.control`/`fetch`, không chứa BR (BR ở `service.js`)
- YAGNI: không làm forward, không làm filter giá ở UI này
- Config bằng props, không hardcode `groupId`

## 6. Verify

- [ ] `npm test` — chạy `CommunityCheckPanel.test.tsx` (2 ví dụ trên) xanh
- [ ] `npx tsc --noEmit` — không lỗi type
- [ ] `npm run build` (web) — xanh
- [ ] Test thủ công: chọn nhóm `[1]...`, để 3 ngày, bấm Quét → thấy `total` đúng (mock hoặc thật với api)
