# 13 — SELF LEARNING: Từ Vibe Code → Tự Viết Prompt & Tự Làm Dự Án

> **Mục tiêu cuối cùng của kit này:** Bạn không cần kit nữa vẫn làm được.
> Lộ trình 4 tuần — mỗi tuần 1 nấc, vừa làm BeShort vừa học.

---

## Tuần 1: Hiểu luồng & Bắt chước (dùng kit 100%)

**Làm:** Dùng kit y nguyên cho BIZ-001 (rút gọn URL). Copy template, điền, chạy skill.

**Học:**

* Đọc `11_KIEN_TRUC.md:1` — vẽ lại sơ đồ FE→BE→DB bằng tay
* Trả lời: “Khi user bấm nút, hàm nào chạy đầu tiên? Ai tạo slug?”
* Bài tập: Thêm 1 field `title` cho link — tự viết migration + endpoint PATCH

**Thoát khi:** Tự kể được luồng tạo link mà không nhìn docs.

---

## Tuần 2: Hiểu “tại sao” & Tự quyết nhỏ

**Làm:** BIZ-002 (redirect) — lần này **tự viết PROMPT** trước, rồi so với tao-prompt sinh ra.

**Học:**

* Đọc `12_BAO_MAT.md:1` bảng Security — tự check S1→S4 cho code tuần 1
* Trả lời: “Tại sao validate ở BE dù FE đã validate? Tại sao hash IP?”
* Bài tập: Tự chọn giữa `nanoid` vs `crypto.randomUUID` cho slug — ghi ADR 1 đoạn, so với `DECISIONS.md:1`

**Thoát khi:** Tự viết được prompt 6 khối cho 1 endpoint mới mà không mở `_TEMPLATE.md`.

---

## Tuần 3: Tự thiết kế 1 feature nhỏ

**Làm:** BIZ-006 Custom slug — **không dùng skill**, tự viết BIZ + SPEC + PROMPT + TASK từ đầu.

**Học:**

* Đọc `01_TECH_STACK.md:1` — tự trả lời “nếu khách yêu cầu SEO, mình đổi gì?”
* Dạy lại cho người khác (hoặc ghi video 5p): “Frontend kết nối backend thế nào?”
* Bài tập: Thiết kế endpoint `POST /api/links/:id/qr` — chọn method, input/output, validate, test plan

**Thoát khi:** Người khác nghe bạn giải thích hiểu được 80%.

---

## Tuần 4: Tự làm dự án mini & Bàn giao thử

**Làm:** Dự án mới 1 ngày: “Todo app” hoặc “Bookmark manager” — **không copy kit**, tự tạo `docs/` tối giản (chỉ 3 file: BIZ, SPEC, TASK).

**Học:**

* Dùng `12_BAO_MAT.md:1` để tự audit dự án mini
* Thử `npm audit`, `npx tsc --noEmit`, `curl` test endpoint
* Viết README bàn giao 1 trang cho “khách giả định”

**Thoát khi:** Bạn tự tin nói “Em làm được dự án CRUD hoàn chỉnh và bàn giao được”.

---

## Bộ câu hỏi tự kiểm tra (dán tường)

1. **Cấu trúc:** FE, BE, DB nằm đâu? Nói chuyện qua gì?
2. **Endpoint:** Khi nào POST vs GET vs DELETE? Idempotent là gì?
3. **Tech:** Tại sao chọn TS/React/Prisma? Khi nào đổi sang Next/Mongo?
4. **Prompt:** 6 khối là gì? Thiếu khối 4 (ví dụ) sẽ sao?
5. **Bảo mật:** 3 lỗi nguy hiểm nhất nếu không validate input?
6. **Quy trình:** 5 pha là gì? Tại sao UI để cuối?
7. **Bàn giao:** Khách cần gì để tự vận hành? (README, .env.example, migration, worklog)

Trả lời được 7 câu → bạn đã “tốt nghiệp” kit.

---

## Sau khi tốt nghiệp — Kit còn cần không?

* Giữ `AGENTS.md` + `00_WORKFLOW.md` + `12_BAO_MAT.md` — 3 file lõi cho mọi dự án
* Bỏ BIZ/SPEC template dài, chỉ giữ checklist 5 câu hỏi Socratic (tự hỏi trong đầu)
* Dạy lại cho dev mới bằng chính kit này — đó là cách senior scale team.

> **Triết lý thầy:** “Thầy không cho con cá, thầy cho cần câu + chỉ chỗ cá + dạy cách tự làm cần mới. Sau này không có thầy, con vẫn câu được cá to hơn.”

---
*Lộ trình này gắn với `15_HOC_VIBE.md:1` (45 tips) — mỗi tuần áp dụng 10 tips.*

