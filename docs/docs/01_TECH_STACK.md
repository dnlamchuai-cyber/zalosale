# 01 — TECH STACK: AI goi y stack, DB chon sau khi co nghiep vu

> Core (FE/BE) co the goi y o Pha 1, DB chot o Pha 2 sau khi co BIZ/SPEC (ERD) — khong khoa cung tu dau. Doc xong go 1 cau cho AI.
> Quyet dinh o day anh huong 6 thang sau.

## Cach dung (2 phut)

**Ban chi can go 1 cau cho AI:**
```
Toi muon lam [mo ta 1 cau du an, vd: web rut gon link + dashboard + sau co app Flutter].
Team [1 nguoi / 3 nguoi], can ship trong [2 tuan / 2 thang], co can SEO/mobile khong?
Hay goi y 2-3 stack + ly do chon + trade-off de toi chon.
```

**AI se tra loi dang nay (vi du BeShort):**
```
A (khuyen): TS + React(Vite) + Fastify + Postgres+Prisma — Pho bien, AI gen chuan, type-safe, de tuyen dev. Trade-off: khong SSR.
B: Next.js + Supabase — Co SSR/SEO, Supabase lo Auth/DB nhanh. Trade-off: vendor lock-in.
C: TS + React + MongoDB — Linh dong schema. Trade-off: mat type-safe.
→ Ban chon A/B/C? (AI goi y, ban quyet cuoi)
```

Ban chon A → AI tu dien `docs/_meta/PROJECT_CONTEXT.md` + ghi `ADR-001` vao `DECISIONS.md:1` — ban chi can duyet.

## Nguyen tac chon (AI phai giai thich)

1. **Pho bien > Xin:** AI biet ro, tuyen de, docs nhieu (tips #2)
2. **Type-safe:** TS + zod + Prisma giam 40% bug
3. **AI-friendly:** Nhieu example tren GitHub → AI gen chuan hon
4. **1 thay doi 1 ly do:** Doi stack phai co ADR ghi trade-off

## Ma tran AI dung de goi y

| Cau hoi AI se hoi ban | Neu YES → AI goi y | Neu NO → AI goi y |
|---------|----------------------|---------------|
| Can SEO/SSR manh? | Next.js (preset `next-supabase`) | Vite + React (preset `ts-react-node-postgres`) |
| Can app mobile? | Flutter (preset `dart-flutter`) | Chi web |
| Schema hay doi? | MongoDB | Postgres + Prisma |
| Team <3 nguoi, ship nhanh? | Supabase all-in-one | Tach BE Fastify |
| Realtime 2 chieu? | WebSocket | SSE/polling |

## Preset de AI copy sau khi ban chon

| Du an | Preset | File |
|-------|--------|------|
| Web CRUD/SaaS (BeShort) | `ts-react-node-postgres` | `docs/_meta/STACK_PRESETS/ts-react-node-postgres.md:1` |
| Mobile | `dart-flutter` | `docs/_meta/STACK_PRESETS/dart-flutter.md:1` |
| Marketing/SEO | `next-supabase` | `docs/_meta/STACK_PRESETS/next-supabase.md:1` |

## Checklist truoc khi duyet (AI tu check)

- [ ] AI da goi y 2-3 stack kem ly do + trade-off
- [ ] Ban da chon A/B/C (ghi vao PROJECT_CONTEXT)
- [ ] AI da ghi ADR-001 vao `DECISIONS.md` — mau:
```md
## ADR-001: Chon Fastify thay vi Express cho BeShort
- Ngay: 2026-08-22 — Quyet dinh: Fastify — Ly do: nhanh hon 2x, co validate san
- Trade-off: Community nho hon 10% — Nguoi duyet: @tech-lead
```
- [ ] `PROJECT_CONTEXT.md` khong con {{PLACEHOLDER}} → moi duoc sang Pha 2

## Khi nao duoc doi stack?

Chi o dau Pha 1 hoac co ADR moi duoc duyet. Doi = PR rieng, cap nhat `PROJECT_CONTEXT.md` + `DECISIONS.md`.

---
*Tiep theo: Go 1 cau goi y o tren cho AI → chon A/B/C → AI tu dien PROJECT_CONTEXT → chay `/lay-yeu-cau`.*
