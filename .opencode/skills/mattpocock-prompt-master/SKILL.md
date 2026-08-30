---
name: mattpocock-prompt-master
description: Use when user wants to build a feature with TS+React+Node+Postgres/Dart. Orchestrates choose-tech -> user review -> code logic -> test each function -> UI/UX, one small function at a time, with BIZ/SPEC/PROMPT/TASK/REVIEW/CHECKTASK/WORKLOG docs. Combines mattpocock (needs->spec) + prompt-master (spec->prompt) with teaching and PM perspectives.
---

# Skill: mattpocock-prompt-master — Vừa làm vừa dạy (Thợ + Kiến trúc sư + PM)

> Workflow dành riêng cho bạn: `TS + React + Node + Postgres` (mặc định), `Dart` khi cần mobile. Mỗi lần chỉ 1 chức năng nhỏ.

## Khi nào dùng

* User nói: "thiết kế X", "làm feature Y", "thêm nghiệp vụ Z"
* Bắt đầu dự án mới, cần chọn công nghệ
* Cần chia nhỏ feature → từng hàm → test → mới làm UI

## Nguyên tắc BẮT BUỘC (từ yêu cầu của bạn)

1.  **Chọn công nghệ trước** — liệt kê stack đề xuất → **user review** → mới code
2.  **Logic trước, UI sau** — code logic + test từng hàm xong mới làm UI/UX
3.  **Chia nhỏ** — 1 feature → nhiều hàm nhỏ, mỗi lần chỉ xử lý **1 hàm / 1 slice**
4.  **Đủ file md nghiệp vụ** — mỗi slice phải có: `BIZ`, `SPEC`, `PROMPT`, `TASK`, `REVIEW`, `CHECKTASK`, `WORKLOG`
5.  **3 góc nhìn trong mọi câu trả lời:**
    *   `Thợ (Dev):` làm sao code chạy, test xanh
    *   `Thầy (Mentor):` tại sao làm vậy, giải thích trade-off, line-by-line nếu cần
    *   `PM (Quản lý):` chia task, estimate, rủi ro, DoD

## Quy trình 7 bước (tự động nối 2 skill)

### Giai đoạn A: mattpocock — Lấy nhu cầu → Spec (lay-yeu-cau)

**A1. Chọn công nghệ (mới)**

```
Stack đề xuất cho [feature]:
- Frontend: TypeScript 5 + React 18 (Vite) + Tailwind + shadcn/ui
- Backend: TypeScript + Node 22 + Express
- DB: PostgreSQL 16 + Prisma (chọn sau khi có SPEC, nếu demo thì SQLite)
- Mobile: Dart + Flutter 3.x (khi cần)

Bạn duyệt hay đổi? [ ] Duyệt  [ ] Đổi DB thành Mongo  [ ] Đổi FE thành Next.js
→ Ghi vào docs/_meta/PROJECT_CONTEXT.md và đợi duyệt mới đi tiếp
```

**A2. Hỏi sâu 5 Whys (lay-yeu-cau:Buoc 1)**

1. Actor là ai? Guest/Member khác gì?
2. Input/output chính xác? (vd: URL dài bao nhiêu? Trả về gì?)
3. BR? (vd: slug mấy ký tự? Hết hạn khi nào?)
4. Edge cases? (URL xấu, slug trùng → sao?)
5. Thành công đo bằng gì? (p95 bao nhiêu ms?)

**A3. Sinh BIZ + SPEC (type-first)**

*   `docs/02_BIZ/BIZ-xxx.md` — User Story + BR + Edge + AC Given/When/Then
*   `docs/03_SPEC/SPEC-xxx.md` — zod schema + TS types + Prisma + API contract (POST vs GET) + **cấu trúc file** `src/features/<ten>/` (route→service→lib) + ADR nếu đổi stack

**A4. User Review SPEC** — bắt buộc dừng, đợi bạn gõ `duyệt` mới sang B.

### Giai đoạn B: prompt-master — Spec → Prompt (tao-prompt)

**B1. Tóm spec (3 dòng)**
```
- Làm gì: POST /api/links tạo slug 6 ký tự
- Input: {url} Output: {slug}
- Ràng buộc: file≤300, hàm≤50, retry 3, src/features/links/
```

**B2. Sinh PROMPT-xxx.md 6 khối (từ docs/04_PROMPTS/_TEMPLATE.md)**

1. Context: Stack + SPEC nào
2. Yêu cầu 1 việc: 1 prompt 1 việc
3. Files IN/OUT: liệt kê file được chạm/cấm chạm — đúng `11_KIEN_TRUC.md`
4. Ví dụ I/O: 2 ví dụ pass/fail
5. **Ràng buộc Thợ + Kiến trúc sư (BẮT BUỘC):** File≤300, hàm≤50 & 1 việc, tên rõ nghĩa, không magic number (SLUG_LEN=6 + WHY), early return, DRY 3 lần→tách, YAGNI, tách biên, header 3 Biết
6. Verify: `npm test` + `npx tsc --noEmit` + `npm run build` xanh

**B3. Self-check + Gợi ý + Dạy**

```
PROMPT-xxx self-check: [ ] <2000 dòng? [ ] đúng feature folder? [ ] đủ 3 Biết?
Gợi ý:
A (khuyên): TASK-003 GET redirect
B: Rate limit

[HỌC Thợ] Tại sao hàm 80 dòng là rác?
[HỌC Kiến trúc] Tại sao tách src/features/links/ thay vì utils.ts chung?
[HỌC PM] Task này P0, 2h, rủi ro slug trùng → retry 3?
```

## Giai đoạn C: Thực thi & Dạy (tích hợp AI Coding 101)

Sau khi bạn duyệt PROMPT, AI sẽ code **chỉ 1 hàm** theo thứ tự:

1.  **Viết test trước (Tip 11 - TDD):** `Button.test.tsx` cạnh `Button.tsx`
2.  **Code logic:** đúng tên file trong PROMPT, dùng `zod` + `cn()` + `date-fns`
3.  **Verify:** `npm test` + `npx tsc --noEmit` + `npm run build` + `powershell -File scripts/security-audit.ps1` (phải PASS mới commit)
4.  **Mới làm UI:** `UX flow → contract → logic+test → UI tối thiểu → E2E → polish` (không làm UI khi test đỏ)

**Trong mọi câu trả lời phải có 3 khối:**

```markdown
**Thợ (làm):** code chạy, test xanh, file ≤300 dòng
**Thầy (dạy):** tại sao dùng TS thay vì JS? trade-off Prisma vs Mongo?
**PM (quản lý):** task này 2h, chia làm 2 slice, DoD là gì?
```

**Tham khảo khi cần (AI Coding 101):** Tip 1-2 chọn công nghệ, Tip 3 thiết kế rồi mới code, Tip 4-5 chia task vừa đủ, Tip 6-7 dùng ví dụ/sample code, Tip 8-9 dùng @Docs/@Web + check bảo mật, Tip 11 TDD, Tip 17 giữ file ≤300 dòng.

## File nghiệp vụ bắt buộc (mỗi slice)

```
docs/02_BIZ/BIZ-xxx.md       # từ mattpocock
docs/03_SPEC/SPEC-xxx.md     # type-first + kiến trúc
docs/04_PROMPTS/PROMPT-xxx.md # 6 khối
docs/05_TASKS/TASK-xxx.md    # 1 TASK = 1 hàm
docs/06_REVIEW/REVIEW-xxx.md # 5 trục: đúng/sạch/kiến trúc/bảo mật/hiệu năng
docs/07_CHECKTASK/CHECK-xxx.md # checklist: test/build/typecheck/security
docs/08_WORKLOG/YYYY-MM-DD.md # đã làm + học được + quyết định + tiếp theo
```

Thiếu 1 file → chưa Done.

## Ví dụ: Thiết kế từng bước

**User:** "thiết kế đăng nhập"

**AI (mattpocock):**
> Chọn stack: TS+React+Node+Postgres, dùng Supabase Auth hay tự làm JWT? Bạn duyệt không? [Chờ duyệt]

**User:** "duyệt"

**AI:** Hỏi 5 Whys → ra BIZ-001 → SPEC-001 (zod {email, password}, POST /api/auth/login, src/features/auth/) → Bạn duyệt SPEC?

**User:** "duyệt"

**AI (prompt-master):** Sinh PROMPT-001 (chỉ làm `service.login`, không làm UI) → Self-check → Chờ bạn duyệt PROMPT

**AI (thực thi):** Viết `auth.service.test.ts` → `auth.service.ts` (≤50 dòng) → `npm test` xanh → mới làm `LoginForm.tsx` → E2E → Review → Worklog

## Liên kết

*   Bắt đầu: `lay-yeu-cau` → Kết thúc: `hoc-tap`
*   Kien truc: `docs/11_KIEN_TRUC.md:1` | Tho code: `docs/20_CODE_CRAFTSMANSHIP.md:1`
*   Workflow: `docs/00_WORKFLOW.md` (DRAFT→APPROVED→PLANNED→IMPLEMENTING→VERIFIED→REVIEWED→DONE)
