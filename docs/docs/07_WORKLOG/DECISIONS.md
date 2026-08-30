# DECISIONS � Architecture Decision Records (ADR)

> Ghi m?i quy?t d?nh �t?i sao ch?n X kh�ng ch?n Y�. Sau n�y ngu?i m?i d?c l� hi?u, kh�ng ph?i h?i l?i.
> M?u: M?i ADR 10 d�ng, c� ng�y + ngu?i duy?t + trade-off.

## ADR-001: Ch?n stack TS + React + Node + Postgres cho BeShort

- **Ng�y:** 2026-08-22
- **Tr?ng th�i:** Approved
- **B?i c?nh:** C?n stack ph? bi?n d? AI gen t?t, team d? tuy?n, vibe code nhanh.
- **Quy?t d?nh:** TS 5 + React 18 (Vite) + Tailwind 4 + Fastify + Postgres 16 + Prisma
- **L� do:** Vite nhanh, Fastify schema validation, Prisma type-safe, Supabase Auth s?n
- **Trade-off:** Kh�ng SSR (ch?p nh?n v� BeShort kh�ng c?n SEO n?ng), n?u sau c?n SEO ? th�m Next.js BFF
- **Ngu?i duy?t:** @tech-lead

## ADR-002: 1 TASK = 1 slice vertical (DB+API+test, chua UI)

- **Ng�y:** 2026-08-22
- **Tr?ng th�i:** Approved
- **B?i c?nh:** Team hay g?p nhi?u vi?c 1 PR ? review l�u, kh� revert
- **Quy?t d?nh:** M?i TASK =300 d�ng, 1 PR, 1 review 5-axis, 1 worklog
- **L� do:** Incremental-implementation + tips #5 � d? test, d? demo, d? h?c
- **Trade-off:** Nhi?u PR hon, nhung m?i PR review 15p thay v� 2h

## ADR-003: Logic tru?c UI (Pha 5 sau c�ng)

- **Ng�y:** 2026-08-22
- **Tr?ng th�i:** Approved
- **Quy?t d?nh:** Kh�ng l�m UI khi logic chua 100% pass test
- **L� do:** UI d?i nhi?u khi logic d?i � l�m UI s?m = l�m l?i
- **Ngo?i l?:** C� th? l�m wireframe low-fi ? pha 2 d? l?y feedback UX, nhung kh�ng code UI.

---
*Th�m ADR m?i khi c� quy?t d?nh quan tr?ng. ��nh s? tang d?n.*
