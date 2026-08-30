# TASK-XXX: [T�n slice] � Template (1 slice = 1 PR = 1 ng�y)

> Copy th�nh `TASK-001_TenSlice.md`. M?i TASK l� 1 vertical slice nh? nh?t m� v?n demo du?c.
> Nguy�n t?c: Dev ch? l�m 1 TASK t?i 1 th?i di?m, xong m?i sang TASK m?i.

## 1. Meta

- **M�:** TASK-XXX (map BIZ-XXX / SPEC-XXX / PROMPT-XXX)
- **T�n:** [VD: POST /api/links � t?o link v?i slug]
- **Tr?ng th�i:** Todo | Doing | Review | Done
- **Ngu?i l�m:** @dev
- **Estimate:** 0.5�1 ng�y (n?u >1 ng�y ? t�ch ti?p)
- **Ng�y t?o / Done:** YYYY-MM-DD / YYYY-MM-DD

## 2. M?c ti�u (1 c�u, do du?c)

[VD: Guest c� th? POST 1 URL h?p l? v� nh?n link ng?n 6 k� t?, c� test xanh]

## 3. Scope � IN / OUT (r?t quan tr?ng d? AI kh�ng l�m l?)

| IN (l�m) | OUT (kh�ng l�m � d? TASK kh�c) |
|----------|-------------------------------|
| DB migration links table | Auth, ownerId logic |
| POST /api/links + zod validate | GET redirect, click log |
| Unit test cho slug + API test cho endpoint | UI form, rate limit |

## 4. Files s? ch?m

- T?o: `src/schemas/link.ts`, `src/lib/slug.ts`, `prisma/migrations/...`
- S?a: `src/routes/links.ts`, `prisma/schema.prisma`
- Test: `src/routes/links.test.ts`, `src/lib/slug.test.ts`
- Kh�ng ch?m: `src/components/*`, `src/routes/auth.ts`

## 5. Prompt link

`docs/04_PROMPTS/PROMPT-XXX.md`

## 6. Test plan (TDD)

- [ ] RED: Vi?t test `POST /api/links ? 201` v� `? 400` tru?c khi code
- [ ] GREEN: Code cho test xanh
- [ ] REFACTOR: T�ch h�m, d?t t�n l?i, ch?y l?i test

```typescript
// V� d? test RED (ph?i d? tru?c)
it("POST /api/links v?i URL h?p l? ? 201", async () => {
  const res = await app.inject({ method: "POST", url: "/api/links", payload: { url: "https://example.com" } });
  expect(res.statusCode).toBe(201);
  expect(JSON.parse(res.body).slug).toMatch(/^[a-zA-Z0-9]{6}$/);
});
```

## 7. Verify checklist (ch?y sau khi code)

- [ ] `npm test` xanh
- [ ] `npx tsc --noEmit` kh�ng l?i
- [ ] `npm run build` pass
- [ ] Manual test b?ng curl/Postman (ghi l?i command)

## 8. G?i � bu?c ti?p theo (AI di?n sau khi Done, user quy?t)

> Sau khi TASK n�y Done, AI g?i � 2-3 hu?ng di ti?p, user ch?n:
>
> **G?i � A (khuy�n):** TASK-002 � GET /:slug redirect + click log (ho�n thi?n lu?ng P0, demo du?c end-to-end)
> **G?i � B:** TASK-003 � Rate limit + blacklist (tang robustness tru?c khi public)
> **G?i � C:** BIZ-003 Auth � n?u mu?n l�m Member ngay
>
> **B�i h?c cho b?n:** Th? t? uu ti�n = P0 tru?c, vertical tru?c, hardening sau. Sau n�y kh�ng c?n file n�y b?n v?n t? s?p x?p du?c.

## 9. Worklog link

`docs/07_WORKLOG/YYYY-MM-DD.md` � ghi 3 d�ng: d� l�m, h?c du?c, quy?t d?nh

---
<!-- EXAMPLE BeShort TASK-001: �i?n kh?i tr�n cho POST /api/links. Xem BOARD.md:1 d? bi?t v? tr� tr�n kanban -->
