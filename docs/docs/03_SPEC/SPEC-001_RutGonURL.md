# SPEC-001: Rút gọn URL — Spec mẫu (Approved)

> Map BIZ-001. Đã Approved — sẵn sàng cho tao-prompt.
> Đọc để học cách viết spec type-driven.

## 1. Meta

- **Mã:** SPEC-001 (BIZ-001)
- **Trạng thái:** Approved
- **Ngày duyệt:** 2026-08-22

## 2. Types

```typescript
import { z } from "zod";

type Slug = string & { readonly __brand: "Slug" };
type Url = string & { readonly __brand: "Url" };

export const CreateLinkSchema = z.object({
  url: z.string().url({ message: "URL không hợp lệ" }).max(2048),
});

export type CreateLinkInput = z.infer<typeof CreateLinkSchema>;

export interface Link {
  id: string;
  slug: Slug;
  originalUrl: Url;
  ownerId: string | null;
  clicks: number;
  createdAt: Date;
  expiresAt: Date | null;
}

export interface CreateLinkResponse {
  slug: string;
  shortUrl: string; // https://beshort.ly/${slug}
}
```

**Tại sao zod?** Validate + type + message VN 3 trong 1, AI không phải đoán.

## 3. DB Schema

```prisma
model Link {
  id          String   @id @default(cuid())
  slug        String   @unique @db.VarChar(20)
  originalUrl String   @db.VarChar(2048)
  ownerId     String?
  clicks      Int      @default(0)
  createdAt   DateTime @default(now())
  expiresAt   DateTime?
  @@index([slug])
  @@index([ownerId])
}
```

Migration: `npx prisma migrate dev --name create_links`

## 4. API Contract

| Method | Endpoint | Input | Output | Auth |
|--------|----------|-------|--------|------|
| POST | `/api/links` | `CreateLinkInput` | `201 {slug, shortUrl}` | Optional |

**Errors:**

| Code | Status | Khi nào |
|------|--------|---------|
| INVALID_URL | 400 | zod fail |
| MISSING_URL | 400 | thiếu field url |
| DOMAIN_BLOCKED | 400 | blacklist |
| RATE_LIMITED | 429 | vượt 10/phút |
| SLUG_FAILED | 500 | retry 3 vẫn trùng |

## 5. Logic

```
POST /api/links {url}
  → CreateLinkSchema.parse (400 nếu fail)
  → check blacklist (400 nếu blocked)
  → check rate limit (429 nếu vượt)
  → generate slug (nanoid 6) → check unique → retry 3
  → prisma.link.create({slug, originalUrl, expiresAt: now+30d})
  → return 201 {slug, shortUrl}
```

## 6. Liên kết

- BIZ: `docs/02_BUSINESS/BIZ-001_RutGonURL.md`
- Prompt: `docs/04_PROMPTS/PROMPT-001_TaoLink.md`
- Tasks: `TASK-001` (DB), `TASK-002` (API)

