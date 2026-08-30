# PROMPT-001: POST /api/links � T?o link r�t g?n (m?u)

> **Prompt m?u d� di?n s?n � copy c�ch vi?t 6 kh?i n�y cho prompt sau.**
> Map SPEC-001 ? TASK-002. D�ng d? giao AI code slice n�y.

## 1. Meta

- **M�:** PROMPT-001 (SPEC-001 ? TASK-002)
- **M?c ti�u:** Guest POST URL h?p l? ? nh?n slug 6 k� t? + shortUrl, c� test xanh
- **Scope:** Ch? POST /api/links, kh�ng l�m redirect/UI/rate limit

## 2. Prompt 6 kh?i (copy dua cho AI)

```markdown
# Kh?i 1: CONTEXT
D? �n BeShort � r�t g?n URL. Stack: TS + Fastify + Prisma + Postgres (xem docs/_meta/PROJECT_CONTEXT.md).
�?c docs/03_SPEC/SPEC-001_RutGonURL.md. Pattern tham kh?o: src/routes/health.ts (Fastify route chu?n).

# Kh?i 2: Y�U C?U
Implement POST /api/links � nh?n {url} ? validate b?ng CreateLinkSchema ? check blacklist (m?ng r?ng t?m) ? t?o slug 6 k� t? b?ng nanoid ? retry 3 l?n n?u tr�ng ? luu Prisma ? tr? 201 {slug, shortUrl: "https://beshort.ly/${slug}"}.
Kh�ng l�m GET redirect, kh�ng l�m UI.

# Kh?i 3: FILES
T?o: src/schemas/link.ts (ch?a CreateLinkSchema), src/lib/slug.ts (generateUniqueSlug)
S?a: src/routes/links.ts, prisma/schema.prisma
Test: src/routes/links.test.ts, src/lib/slug.test.ts
Kh�ng ch?m: src/routes/auth.ts, src/components/*

# Kh?i 4: V� D?
Input {url: "https://example.com"} ? 201 {slug: "aB3x9Q", shortUrl: "https://beshort.ly/aB3x9Q"} (slug 6 k� t? a-zA-Z0-9)
Input {url: "not-a-url"} ? 400 {error: "URL kh�ng h?p l?", code: "INVALID_URL"}
Input {} ? 400 {code: "MISSING_URL"}
Input {url: "https://phishing.com/bad"} (n?u blacklist ch?a phishing.com) ? 400 {code: "DOMAIN_BLOCKED"}

# Kh?i 5: R�NG BU?C
- D�ng zod ? boundary, kh�ng t? regex URL
- Slug nanoid(6), retry 3 l?n, n?u v?n tr�ng ? 500 SLUG_FAILED
- D�ng AppError {code, status}, kh�ng throw string
- File =300 d�ng, h�m =50 d�ng

# Kh?i 6: VERIFY
- Vi?t test RED tru?c (2 test: 201 v� 400), r?i code cho xanh
- Ch?y: npm test + npx tsc --noEmit + npm run build ph?i xanh
```

## 3. Self-check

- [x] Context <2000 d�ng (ch? 1 spec + 1 pattern)
- [x] C� 3 v� d? (pass + 2 fail)
- [x] Files IN/OUT r�
- [x] C� verify do du?c

## 4. Sau khi AI xong

- [ ] Ch?y verify kh?i 6
- [ ] Review 5-axis (`docs/06_REVIEW/_TEMPLATE.md`)
- [ ] Ghi worklog
- [ ] G?i � next: A) TASK-003 GET redirect (khuy�n � d? demo end-to-end) B) Rate limit C) Auth ? user ch?n

---
*H?c: Prompt n�y l� �d? thi� � AI l� �th?�. �? r� th� th? l�m chu?n, kh�ng ph?i do�n.*
