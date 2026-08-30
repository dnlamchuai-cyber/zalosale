# STACK PRESET: TS + React + Node + Postgres (Khuyên dùng — Vibe Coding)

> Preset mặc định cho 90% dự án web. Copy khối dưới vào `PROJECT_CONTEXT.md` khi khởi tạo.

## Khi nào dùng
- Web app CRUD, dashboard, SaaS, tool nội bộ
- Team thạo TypeScript, cần type-safe end-to-end
- Cần vibe code nhanh, AI hỗ trợ tốt (popular stack → AI biết rõ)

## Stack chi tiết

| Lớp | Chọn | Vì sao (trade-off) | Thay thế |
|-----|------|-------------------|----------|
| Frontend | **TypeScript 5 + React 18 (Vite) + Tailwind 4 + shadcn/ui** | Vite nhanh, Tailwind + shadcn cho UI nhất quán, AI gen tốt | Next.js nếu cần SSR/SEO nặng |
| Backend | **Node 22 + Fastify** (hoặc Express) | Fastify nhanh hơn Express 2x, schema validation built-in; Express phổ biến hơn cho AI | NestJS nếu cần structure lớn |
| DB | **PostgreSQL 16 + Prisma** | Prisma type-safe, migrate dễ; Drizzle nhẹ hơn nếu cần performance | MongoDB nếu schema linh động |
| Auth | **Supabase Auth** | Free, hỗ trợ OAuth, RLS; tự build JWT nếu cần control | Auth.js / Clerk |
| Storage | **S3-compatible (Supabase Storage / R2)** | Rẻ, CDN sẵn | — |
| Realtime | **WebSocket / Supabase Realtime** | — | SSE nếu 1 chiều |
| Test | **Vitest + Testing Library + Supertest** | Vitest nhanh, API tương thích Jest, AI quen | Jest |
| Deploy | **Vercel (FE) + Fly.io/Railway (BE) + Supabase (DB)** | Free tier hào phóng | Docker + VPS |

## Lệnh chuẩn (điền vào PROJECT_CONTEXT)

```bash
npm create vite@latest -- --template react-ts
npm install -D tailwindcss@4 vitest @testing-library/react zod prisma
npx prisma init
```

## Ràng buộc cho AI (đưa vào prompt)

> “Dùng stack TS+React+Node+Postgres này. Mọi API phải có zod schema ở boundary. DB thay đổi phải có migration. Không thêm lib khi chưa `npm audit`.”

---
*Preset v1.0 — Dùng cho BeShort và mọi dự án web tương tự. Xem `dart-flutter.md` nếu cần mobile.*
