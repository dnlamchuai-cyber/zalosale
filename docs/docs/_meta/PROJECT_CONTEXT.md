# PROJECT_CONTEXT � �i?n 1 l?n khi t?o d? �n

> File duy nh?t B?T BU?C di?n khi copy kit sang d? �n m?i. M?i spec/prompt d?u d?c t? d�y.
> �? tr?ng ? agent ph?i h?i user (kh�ng du?c t? b?a) � theo `context-engineering` MISSING REQUIREMENT.

## 1. Project Info
- **T�n d? �n:** BeShort
- **One-liner (1 c�u m� t?):** R�t g?n URL + qu?n l� link ng?n c� th?ng k� click (ki?u bit.ly)
- **M?c ti�u ch�nh:** Cho ph�p user t?o link ng?n, qu?n l�, xem analytics, chia s?
- **�?i tu?ng:** Ngu?i d�ng c� nh�n + team marketing

## 2. Tech Stack (ch?n 1 preset trong STACK_PRESETS/ ho?c t? di?n)

- **Stack mode:** LOCKED � kh�ng d?i stack n?u chua du?c user duy?t

- **Frontend:** TypeScript 5, React 18 (Vite), Tailwind CSS 4, shadcn/ui
- **Backend:** TypeScript, Node.js 22, Express
- **Database:** PostgreSQL 16 + Prisma
- **Mobile (n?u c�):** Dart + Flutter 3.x
- **Auth/Storage:** Supabase Auth + S3-compatible
- **Test:** Vitest + Testing Library + Supertest
- **Deploy:** Vercel (FE) + Railway/Fly (BE) / Supabase

## 3. Constraints & Quy u?c

- M?i l?n ch? l�m 1 ch?c nang nh? (1 slice = DB+API+test)
- Kh�ng l�m UI khi logic chua pass test
- Kh�ng t? � d?i framework, database, ORM, language ho?c deployment provider
- M?i thay d?i DB ph?i c� migration + review
- Ng�n ng? docs: Ti?ng Vi?t (nghi?p v?/worklog), code/spec: Ti?ng Anh

## 4. Li�n k?t

- Workflow: `docs/00_WORKFLOW.md`
- Tech chi ti?t: `docs/01_TECH_STACK.md`
- Backlog: `docs/02_BUSINESS/BACKLOG.md`

---
*C�ch d�ng ? d? �n m?i: copy file n�y t? `PROJECT_CONTEXT.template.md` v� di?n. Xem `STACK_PRESETS/` d? ch?n nhanh.*
