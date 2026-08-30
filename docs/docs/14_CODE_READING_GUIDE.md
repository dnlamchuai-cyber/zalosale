# 14 — CODE READING: Đọc code là hiểu ai viết, tại sao chọn vậy, từng dòng làm gì

> **Mục tiêu:** Mở bất kỳ file nào trong `src/` là bạn biết ngay: (1) ai viết (người hay AI), (2) tại sao dùng tech/cấu trúc đó, (3) từng dòng để làm gì, (4) liên kết tới spec nào.
> Dành cho người mới — đọc xong tự tin review code AI mà không sợ bị “ảo”.

---

## 1. Nguyên tắc “3 Biết” cho mọi file code

Mọi file do AI hoặc người tạo **phải** trả lời được 3 câu ngay ở đầu file:

| Biết gì | Xem ở đâu | Ví dụ |
|---------|-----------|-------|
| **Ai viết & khi nào** | Header comment + `git log` + `TASK-xxx.md` | `// AI: tao-prompt PROMPT-001, human review @tu, 2026-08-22` |
| **Tại sao chọn tech/cấu trúc này** | Header “WHY” + `DECISIONS.md` + `SPEC-xxx.md` | “Dùng Fastify thay Express vì benchmark 2x, xem ADR-001” |
| **Từng dòng làm gì** | Comment ngắn gọn dòng phức tạp + test cạnh bên | `// retry 3 lần vì slug có thể trùng (BR1)` |

**Nếu file nào thiếu 3 Biết → chưa đạt chuẩn bàn giao, phải bổ sung trước khi merge.**

---

## 2. Header mẫu — Copy dán vào đầu mỗi file do AI tạo

```typescript
/**
 * File: src/routes/links.ts
 * Feature: BIZ-001 Rut gon URL — POST /api/links
 * Spec: docs/03_SPEC/SPEC-001_RutGonURL.md:2 (CreateLinkSchema)
 * Prompt: docs/04_PROMPTS/PROMPT-001_TaoLink.md (6 khoi)
 * Task: docs/05_TASKS/TASK-002 (DB+API+test)
 * Author: AI (tao-prompt) + human review @tu — 2026-08-22
 * Tech chon: Fastify (ADR-001: nhanh hon Express 2x) + zod validate + Prisma
 * Cau truc: route handler -> validate -> generateSlug -> prisma.create -> return 201
 * Whitelist: endpoint public, co rate-limit (TASK-004 se lam)
 *
 * Doc header nay de biet tai sao file ton tai — xoa header = mat lich su.
 */

// WHY: Dung Fastify thay Express — xem docs/07_WORKLOG/DECISIONS.md:ADR-001
// WHY: Dung zod o boundary — fail nhanh, message ro, khong ton query DB
import { z } from "zod";
import { prisma } from "../db/client";

// WHY: Tach generateUniqueSlug ra src/lib/slug.ts — de test rieng, de mock khi test API
import { generateUniqueSlug } from "../lib/slug";

export const CreateLinkSchema = z.object({
  url: z.string().url({ message: "URL khong hop le" }).max(2048), // WHY: max 2048 de tranh DoS
});
```

**Bài học:** Header không phải để “trang trí”, header là **hợp đồng truy vết** — khách hỏi “sao dùng Fastify?” → trỏ ngay `ADR-001`. Dev mới đọc header 10s là hiểu file để làm gì, không phải đọc 200 dòng.

### Quy tắc header cho team

* AI **bắt buộc** gen header khi tạo file mới (ghi trong PROMPT khối 5: “them header 3 Biet”)
* Người review **bắt buộc** kiểm tra header trước khi approve (checklist REVIEW mục 3)
* Sửa file → cập nhật `Author` dòng cuối: `+ human fix @lan 2026-08-23: them retry`

---

## 3. Comment “WHY” trong code — Khi nào cần, khi nào không

**Cần comment WHY (tại sao, không phải làm gì):**

```typescript
// Good: WHY — giai thich quyet dinh kho hieu
// Retry 3 lan vi slug 6 ky tu co xac suat trung 1/56B, nhung van co the trung khi tai cao
for (let i = 0; i < 3; i++) {
  const slug = nanoid(6);
  const exists = await prisma.link.findUnique({ where: { slug } });
  if (!exists) return slug;
}
throw new AppError("SLUG_FAILED", 500); // WHY: throw AppError de tra JSON chuan, khong throw string

// Bad: WHAT — lap lai code
// Tao slug
const slug = nanoid(6); // thua — code da noi lam gi
```

**Quy tắc:** Comment WHAT là nợ, comment WHY là tài sản. AI hay gen comment WHAT → reviewer phải xóa.

---

## 4. Truy vết: Từ dòng code → Spec → Prompt → BIZ (để hiểu tại sao AI dùng cấu trúc đó)

```
BIZ-001 (de bai: can rut gon link, slug 6 ky tu)
  → SPEC-001:2 (quy dinh type Slug + CreateLinkSchema + DB index)
    → PROMPT-001 khoi 3 (chi duoc cham src/routes/links.ts, src/lib/slug.ts)
      → src/routes/links.ts:15 (dong validate) — tai sao dung zod? Vi SPEC-001:2 bao vay
      → src/lib/slug.ts:8 (ham generate) — tai sao tach file? Vi PROMPT khoi 5 bao file ≤300 dong
```

**Cách tự truy vết khi đọc code lạ:**

1. Mở header → lấy `Spec: docs/03_SPEC/SPEC-xxx.md:2`
2. Mở SPEC dòng đó → thấy zod schema + lý do
3. Mở `DECISIONS.md` nếu thấy `ADR-001` → hiểu trade-off
4. Mở `TASK-xxx.md` → biết estimate, scope IN/OUT
5. Mở `PROMPT-xxx.md` khối 4 → thấy ví dụ input/output AI dựa vào

**Bài tập:** Mở `src/routes/links.ts:15` (dòng validate), thử truy về `SPEC-001:2` mà không nhìn guide này — nếu làm được → bạn đã nắm cấu trúc.

---

## 5. Ai viết? — Phân biệt AI vs Người & trách nhiệm

| Dấu hiệu | AI viết | Người viết/sửa |
|----------|---------|----------------|
| Commit message | `feat(links): AI PROMPT-001 — POST /api/links` | `fix(links): human @tu — them retry 3` |
| Header Author | `AI (tao-prompt) + human review @tu` | `human @tu — fix edge case` |
| Git blame | Dòng do AI gen, người review | Dòng do người sửa sau |
| Worklog | `AI gen 120 dong, human review 15p` | `Human them test 20 dong` |

**Quy ước commit cho team (để `git log` là biết ai):**

```bash
# AI gen (tao-prompt)
feat(links): AI PROMPT-001 — POST /api/links (TASK-002)

# Human fix sau review
fix(links): human @tu — retry slug 3 lan (REVIEW-001:2)

# Human tu viet (khong AI)
feat(auth): human @lan — them JWT middleware
```

**Tại sao cần?** Khi bug, `git blame` biết ngay dòng đó AI gen theo prompt nào → mở prompt ra sửa, không phải đoán. Bàn giao cho khách, khách thấy log rõ ràng → tin tưởng.

---

## 6. Ví dụ hoàn chỉnh — File dễ đọc nhất có thể

```typescript
/**
 * File: src/lib/slug.ts
 * Feature: BIZ-001 — tao slug duy nhat
 * Spec: SPEC-001:5 (retry 3)
 * Prompt: PROMPT-001 khoi 2+5
 * Author: AI (tao-prompt) + human review @tu — 2026-08-22
 * Tech: nanoid (nhanh, khong phu thuoc crypto) — da check npm audit
 * Test: src/lib/slug.test.ts (2 test: 6 ky tu + khong trung 1000 lan)
 */
import { customAlphabet } from "nanoid";

// WHY: customAlphabet chi lay a-zA-Z0-9 — de slug gon, khong co _- (BR1)
const nanoid = customAlphabet("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789", 6);

/**
 * Tao 1 slug 6 ky tu. Khong dam bao duy nhat — caller phai check DB.
 * WHY tach ham nay? De test rieng, khong can DB.
 */
export function generateSlug(): string {
  return nanoid(); // 6 ky tu, 56B to hop, xac suat trung cuc thap
}

/**
 * Tao slug duy nhat, retry 3 lan neu trung DB.
 * WHY retry 3? Du de tranh trung khi tai cao, khong loop vo han gay treo.
 */
export async function generateUniqueSlug(prisma: PrismaClient): Promise<string> {
  for (let i = 0; i < 3; i++) {
    const slug = generateSlug();
    const exists = await prisma.link.findUnique({ where: { slug } });
    if (!exists) return slug; // WHY: check DB truoc khi tra — dam bao unique
  }
  throw new AppError("SLUG_FAILED", 500, "Khong tao duoc slug sau 3 lan thu");
}
```

Mở file này, junior 1 tuần cũng hiểu: ai viết, tại sao dùng nanoid, tại sao retry 3, test ở đâu.

---

## 7. Checklist “Rõ ràng” trước khi merge (dán vào REVIEW)

- [ ] Mọi file mới có header 3 Biết?
- [ ] Mọi quyết định khó hiểu có comment WHY + link ADR/SPEC?
- [ ] `git log` ghi rõ AI vs human?
- [ ] Mở header → truy được về BIZ/SPEC/PROMPT trong 30s?
- [ ] Junior đọc file 5 phút hiểu được luồng chính?

Nếu 5 câu đều “có” → file này **rõ ràng nhất có thể** — bàn giao không sợ khách hỏi “đoạn này để làm gì?”.

---
*Lien quan: `AGENTS.md:4` (conventions) → `11_KIEN_TRUC.md:2` (FE↔BE) → `06_REVIEW/_TEMPLATE.md:3` (review header).*

