# 11 — KIEN TRUC: Frontend ↔ Backend + Cau truc file chuan

> Gop tu `11_ARCHITECTURE_GUIDE` + `21_FILE_STRUCTURE` → 1 file de AI doc <300 dong.
> Doc xong tu ve so do du an, biet tai sao chon tech, biet file nam dau.

## 1. So do tong + FE↔BE (BeShort: User dan link → nhan link ngan)

```
[1.User go] → [2.React ShortenForm] → [3.fetch POST /api/links] → [4.Fastify Route] → [5.Prisma] → [6.Postgres]
                                        {url}                    validate zod   generate slug  bang links
                                                                 → tra {slug} ← 201 JSON ← hien thi shortUrl
```

**Code 3 tang (doc tu duoi len):**

```typescript
// DB: prisma (src/db/client.ts)
await prisma.link.create({ data: { slug: "aB3x9Q", originalUrl: "https://example.com" } });

// Route: Fastify (src/features/links/links.route.ts) — chi validate → goi service
fastify.post("/api/links", async (req, reply) => {
  const { url } = CreateLinkSchema.parse(req.body);
  const link = await createLinkService({ url });
  return reply.code(201).send({ slug: link.slug, shortUrl: `https://beshort.ly/${link.slug}` });
});

// FE: React hook (src/frontend/hooks/useCreateLink.ts)
async function createLink(url: string) {
  const res = await fetch("/api/links", { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify({ url }) });
  return res.json();
}
```

**3 cau hoi tu kiem:** Ai validate? → BE bat buoc (khong tin FE). Ai tao slug? → BE. Ham dau chay khi bam nut? → mutate() o FE.

## 2. Endpoint — Khi nao dung gi

| Method | Dung khi | Vi du BeShort | Prompt ghi sao |
|--------|----------|---------------|----------------|
| POST | Tao moi, moi lan khac | POST /api/links | "tao slug 6 ky tu, retry neu trung" |
| GET | Doc, khong doi DB chinh | GET /:slug 302, GET /api/links?page=1 | "302 redirect, ghi click log phu" |
| PATCH | Sua 1 phan | PATCH /api/links/:id {expiresAt} | "chi owner sua expiry" |
| DELETE | Xoa | DELETE /api/links/:id | "chi owner, 204" |

BeShort can endpoint vi FE Vite va BE Fastify tach roi, Flutter sau cung goi chung.

## 3. Tai sao chon tech nay (de tra loi khach)

| Chon | Tai sao | Khi nao doi |
|------|---------|-------------|
| TypeScript | Bat loi truoc chay, giam 40% bug | Khong doi |
| React+Vite | Pho bien, AI ho tro tot, Vite nhanh 10x | Doi Next.js neu can SEO |
| Tailwind+shadcn | UI nhat quan, copy-paste | Doi MUI neu thich Material |
| Fastify | Nhanh hon Express 2x, co validate san | Doi Express neu team chi quen Express |
| Postgres+Prisma | Type-safe, doi schema biet vo cho nao | Doi Mongo neu schema linh dong |
| Dart Flutter | 1 code 2 platform, tiet kiem 50% | Khong dung neu chi web |

> Tra loi khach: "Em chon Fastify vi benchmark 2x + validate san, van tuong thich Express, da ghi ADR-001."

## 4. Cay thu muc chuan (TS+React+Node+Postgres)

```
beshort/
├── docs/ (BIZ/SPEC/PROMPT) + mcp-server/ (1 cho moi IDE)
├── src/
│   ├── features/links/          # 1 feature = 1 folder — KHONG chia theo loai file
│   │   ├── links.route.ts       # Route: validate → goi service (≤100 dong)
│   │   ├── links.service.ts     # Service: BR + retry + rate-limit
│   │   ├── links.schema.ts      # zod + types
│   │   └── links.test.ts        # colocated
│   ├── lib/slug.ts              # Ham thuan, khong DB — de test 5ms
│   ├── db/client.ts             # Chi noi nay import Prisma
│   └── frontend/features/links/ShortenForm.tsx # Pha 5 moi co, chi goi API
├── prisma/schema.prisma
└── .env.example
```

**Khong lam:** `src/controllers/ + src/models/ + src/utils.ts` chung chung → sua 1 feature mo 3 folder.

**Tang:** `FE --fetch--> Route(validate) --goi--> Service(BR) --goi--> DB(Prisma)` — doi DB chi sua db/ + service.

**Checklist truoc merge:**
- [ ] Moi feature 1 folder `src/features/<ten>/`, moi file ≤300, ham ≤50?
- [ ] Route chi validate, Lib thuan khong DB, test canh file goc?

---
*Lien quan: `20_CODE_CRAFTSMANSHIP.md:3` (tach bien) → `15_HOC_VIBE.md` (viet prompt) → `12_BAO_MAT.md:2` (bao mat).*
