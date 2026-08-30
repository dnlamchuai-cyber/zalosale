# BIZ-001: R�t g?n URL (Guest) � V� d? m?u

> **��y l� BIZ m?u d� di?n s?n d? b?n h?c.** Copy c�ch vi?t n�y cho BIZ m?i.
> Tr?ng th�i: Approved � d� s?n s�ng sang SPEC-001.

## 1. T?ng quan

- **M�:** BIZ-001
- **T�n:** R�t g?n URL cho Guest (kh�ng c?n dang nh?p)
- **M?c uu ti�n:** P0 � ph?i c� m?i demo du?c
- **Ngu?i y�u c?u:** PM BeShort
- **Ng�y t?o:** 2026-08-22
- **Tr?ng th�i:** Approved

## 2. B?i c?nh & V?n d?

- **V?n d?:** Link g?c d�i 100-200 k� t?, kh� chia s? qua chat/QR, kh�ng track du?c ai click.
- **M?c ti�u:** Guest d�n link ? nh?n link ng?n `beshort.ly/abc123` trong <1s, c� th? chia s? ngay.
- **Th�nh c�ng:** 1000 link/ng�y, p95 <300ms, l?i <1%.

## 3. Actor & User Story

| Actor | User Story | Uu ti�n |
|-------|------------|---------|
| Guest | L� kh�ch chua dang nh?p, t�i mu?n d�n link d�i v� nh?n link ng?n ngay | P0 |
| Member | L� th�nh vi�n, t�i mu?n c�c link t�i t?o du?c luu v�o �Link c?a t�i� | P1 (BIZ-003) |

## 4. Lu?ng ch�nh

1. Guest d�n `https://example.com/very/long/url?with=params` v�o input
2. H? th?ng validate URL (c� http/https, =2048), check blacklist
3. T?o slug 6 k� t? `[a-zA-Z0-9]`, d?m b?o unique (retry 3 l?n)
4. Luu DB: `{slug, originalUrl, ownerId: null, expiresAt: +30 ng�y}`
5. Tr? v? `{slug: "aB3x9Q", shortUrl: "https://beshort.ly/aB3x9Q"}`

## 5. Business Rules

- BR1: Slug 6 k� t?, charset `a-zA-Z0-9`, unique
- BR2: URL ph?i c� scheme `http/https`, d? d�i =2048, kh�ng trong blacklist
- BR3: Guest link h?t h?n 30 ng�y, Member kh�ng h?t h?n (BIZ-003)
- BR4: Kh�ng cho r�t g?n domain `beshort.ly` (tr�nh loop)

## 6. Edge Cases

| Case | X? l� |
|------|-------|
| URL thi?u scheme (`example.com`) | 400 `INVALID_URL` � �URL ph?i b?t d?u b?ng http:// ho?c https://� |
| URL trong blacklist (`phishing.com`) | 400 `DOMAIN_BLOCKED` |
| Slug tr�ng (hi?m) | Retry 3 l?n v?i slug m?i, v?n tr�ng ? 500 `SLUG_FAILED` |
| Body thi?u `url` | 400 `MISSING_URL` |
| Rate limit Guest 10 req/ph�t vu?t | 429 + `Retry-After: 60` |

## 7. Y�u c?u phi ch?c nang

- T?o link p95 <300ms, redirect <50ms
- Rate limit + hash IP (b?o m?t)
- Kh�ng l? URL g?c trong log

## 8. Ph? thu?c & Ph?m vi

- **Ph? thu?c:** DB Postgres + Prisma
- **Trong scope:** T?o link, validate, slug, luu DB
- **Ngo�i scope:** Redirect (BIZ-002), Auth (BIZ-003), UI (Pha 5)

## 9. Acceptance Criteria

```gherkin
AC1: Guest t?o link th�nh c�ng
  Given URL h?p l? "https://example.com"
  When POST /api/links {url: "https://example.com"}
  Then 201 {slug: 6 k� t?, shortUrl: "https://beshort.ly/xxx"}

AC2: URL x?u
  Given URL "not-a-url"
  When POST /api/links
  Then 400 {error: "URL kh�ng h?p l?", code: "INVALID_URL"}

AC3: Thi?u url
  Given body {}
  When POST /api/links
  Then 400 {code: "MISSING_URL"}
```

## 10. Li�n k?t

- Spec: `docs/03_SPEC/SPEC-001_RutGonURL.md` (t?o ti?p)
- Prompt: `docs/04_PROMPTS/PROMPT-001_TaoLink.md`
- Tasks: `TASK-001` (DB) + `TASK-002` (POST API)

---
*H?c: BIZ n�y l� �d? b�i� � SPEC s? l� �b?n v?�, PROMPT l� �l?nh thi c�ng�.*
