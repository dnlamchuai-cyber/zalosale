# STACK PRESET: Next.js + Supabase (Fullstack nhanh)

> Khi c?n SSR/SEO ho?c mu?n fullstack trong 1 repo, �t t? qu?n infra.

## Khi n�o d�ng
- Marketing site, blog, landing c?n SEO
- Mu?n Supabase lo h?t Auth + DB + Storage + Realtime
- Team nh?, c?n ship <1 tu?n

## Stack

| L?p | Ch?n |
|-----|------|
| Frontend+Backend | **Next.js 14 (App Router) + TypeScript** |
| DB/Auth/Storage | **Supabase (Postgres + Auth + Storage)** |
| ORM | **Supabase JS + Prisma (optional)** |
| Styling | **Tailwind 4 + shadcn/ui** |
| Test | **Vitest + Playwright** |
| Deploy | **Vercel** |

## L?nh

```bash
npx create-next-app@latest --typescript --tailwind --app
npx supabase init
```

## Trade-off

* **Uu:** �t config, AI gen Next.js r?t t?t, Supabase free tier d? d�ng
* **Nhu?c:** Vendor lock-in Supabase, kh� custom s�u nhu t�ch FE/BE ri�ng

---
*N?u sau n�y scale l?n ? t�ch BE ra Fastify ri�ng, gi? Next ch? l�m BFF.*
