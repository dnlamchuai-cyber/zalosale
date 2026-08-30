# SPEC-XXX: [Tên chức năng] — Template (lay-yeu-cau phase)

> Copy thành `SPEC-001_Ten.md`. Điền sau khi BIZ đã Approved. Đây là “hợp đồng” giữa người và AI — AI chỉ code theo spec này.
> Góc Mentor: Spec tốt = code ít bug, prompt ngắn, không phải đoán.

## 1. Meta

- **Mã:** SPEC-XXX (map tới BIZ-XXX)
- **Trạng thái:** Draft | Review | Approved
- **Tác giả:** @dev + lay-yeu-cau skill
- **Ngày duyệt:** YYYY-MM-DD (user ký duyệt mới được code)

## 2. Types (Type-driven — học từ Matt Pocock)

```typescript
// Branded types giúp AI không nhầm lẫn
type Slug = string & { readonly __brand: "Slug" };
type Url = string & { readonly __brand: "Url" };

// Zod schema = validation + type + docs 3 trong 1
import { z } from "zod";

export const CreateLinkSchema = z.object({
  url: z.string().url().max(2048),
  customSlug: z.string().regex(/^[a-zA-Z0-9_-]{3,20}$/).optional(),
  expiresAt: z.coerce.date().optional(),
});

export type CreateLinkInput = z.infer<typeof CreateLinkSchema>;

export interface Link {
  id: string;
  slug: Slug;
  originalUrl: Url;
  ownerId: string | null; // null nếu Guest
  clicks: number;
  createdAt: Date;
  expiresAt: Date | null;
}
```

**Bài học:** Viết type trước code — compiler sẽ bắt lỗi thay bạn. Khi nào dùng `zod`? Mọi chỗ nhận input từ user/API.

## 3. Database Schema (Prisma)

```prisma
model Link {
  id          String   @id @default(cuid())
  slug        String   @unique @db.VarChar(20)
  originalUrl String   @db.VarChar(2048)
  ownerId     String?
  clicks      Int      @default(0)
  createdAt   DateTime @default(now())
  expiresAt   DateTime?
  @@index([ownerId])
  @@index([slug])
}
```

**Khi nào cần migration?** Mỗi lần thay đổi model → `npx prisma migrate dev --name add_expires_at`.

## 4. API Contract (OpenAPI-lite)

| Method | Endpoint | Input | Output | Auth | Ghi chú |
|--------|----------|-------|--------|------|---------|
| POST | `/api/links` | `CreateLinkInput` | `201 {slug, shortUrl}` | Optional | Rate limit 10/phút nếu Guest |
| GET | `/:slug` | — | `302 redirect` | No | Ghi click log |
| GET | `/api/links` | `?q=&page=` | `200 {links[], total}` | Required | List của tôi |
| DELETE | `/api/links/:id` | — | `204` | Required | Chỉ owner |

**Bài học — Khi nào dùng endpoint nào?**

* **POST** = tạo mới (không idempotent, mỗi lần tạo slug mới)
* **GET** = đọc, không đổi DB (trừ analytics — vẫn là GET vì client chỉ đọc)
* **DELETE** = xóa, idempotent (xóa 2 lần vẫn 204)
* **PUT/PATCH** = cập nhật — dùng PATCH nếu chỉ đổi 1 phần (vd: đổi expiry)

**Quy tắc cho AI:** Mọi endpoint phải có zod validate ở boundary, trả lỗi chuẩn `{error: string, code: string}`, không throw string.

## 5. Logic & State

```
[Input URL] → validate → check blacklist → generate slug → check unique (retry 3) → save DB → return shortUrl
                ↓ fail
              400 + message VN
```

## 6. Edge Cases (từ BIZ)

| Case | Spec xử lý |
|------|------------|
| URL blacklist | 400 `DOMAIN_BLOCKED` |
| Slug collision 3 lần | 500 `SLUG_GENERATION_FAILED` |
| Expired link | GET /:slug → 410 Gone |

## 7. Liên kết

- BIZ: `docs/02_BUSINESS/BIZ-XXX.md`
- Prompt: `docs/04_PROMPTS/PROMPT-XXX.md`
- Task: `docs/05_TASKS/TASK-XXX.md`

---
<!-- EXAMPLE BeShort SPEC-001: Điền khối trên cho rút gọn URL. Sau khi user duyệt → chạy /tao-prompt -->

