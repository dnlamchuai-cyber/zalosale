# TASK-001: DB schema links + migration � V� d? slice d?u ti�n

> **Slice d?u ti�n � foundation.** Xong slice n�y m?i l�m API du?c.
> H?c: DB l� �m�ng nh�� � m�ng sai, nh� s?p.

## 1. Meta

- **M�:** TASK-001 (BIZ-001 / SPEC-001 / PROMPT-001 ph?n DB)
- **Tr?ng th�i:** Todo ? Doing ? Review ? Done
- **Estimate:** 0.5 ng�y

## 2. M?c ti�u

T?o b?ng `links` trong Postgres qua Prisma, c� migration, c� index, test du?c.

## 3. Scope

| IN | OUT |
|----|-----|
| `prisma/schema.prisma` model Link | API endpoint (TASK-002) |
| `prisma/migrations/*` | UI |
| Test: `prisma --validate` + `npm run build` pass | Seed data (d? TASK-002) |

## 4. Files

- S?a: `prisma/schema.prisma`
- T?o: `prisma/migrations/xxxx_create_links/migration.sql`
- Kh�ng ch?m: `src/*`

## 5. Prompt

Kh�ng c?n prompt AI ph?c t?p � ch? c?n:

```
T?o model Link trong prisma/schema.prisma theo SPEC-001:3 (slug unique, originalUrl 2048, ownerId?, clicks, createdAt, expiresAt, index slug+ownerId). Ch?y npx prisma migrate dev --name create_links. Verify npx prisma validate + npm run build.
```

## 6. Verify

- [ ] `npx prisma validate` pass
- [ ] `npx prisma migrate dev` t?o migration file
- [ ] `npx tsc --noEmit` pass
- [ ] `npm run build` pass

## 7. G?i � next (AI di?n khi Done, user ch?n)

- **A (khuy�n):** TASK-002 POST /api/links � c� DB r?i, l�m API ngay d? test du?c
- **B:** Vi?t seed script � n?u mu?n c� data m?u d? demo
- **C:** L�m lu�n redirect � nhung chua c� data n�n chua test du?c

**User ch?n: ___**

---
*Sau TASK-001 Done ? c?p nh?t BOARD.md:1 ? l�m TASK-002.*
