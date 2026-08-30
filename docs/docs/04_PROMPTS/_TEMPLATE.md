# PROMPT-XXX: [Ten slice] — Template (tao-prompt phase)

> Copy thanh `PROMPT-001_TenSlice.md`. Day la prompt hoan chinh de dua cho AI code. Viet xong phai tu review truoc khi chay.
> **Triet ly:** Sau nay ban se tu viet prompt nay khong can template — hoc cau truc 6 khoi duoi day.

## 1. Meta

- **Ma:** PROMPT-XXX (map SPEC-XXX → TASK-XXX)
- **Muc tieu slice:** [1 cau — VD: Tao POST /api/links voi zod validate + DB save]
- **Scope:** Chi lam slice nay, khong cham UI, khong lam analytics

## 2. Cau truc prompt chuan (6 khoi — nho de tu viet sau nay)

```markdown
# Khoi 1: PROJECT CONTEXT (ai cung can)
Du an BeShort — rut gon URL. Stack: TS + React (Vite) + Fastify + Postgres + Prisma.
Doc docs/_meta/PROJECT_CONTEXT.md va SPEC-001.

# Khoi 2: YEU CAU CU THE (1 viec duy nhat)
Implement POST /api/links — nhan {url} → validate → tao slug 6 ky tu → luu DB → tra {slug, shortUrl}.
Khong lam GET redirect, khong lam UI.

# Khoi 3: FILES & SCOPE (chinh xac — kien truc chuan 11_KIEN_TRUC.md:1)
Sua/tao: src/features/links/links.route.ts, src/features/links/links.service.ts, src/features/links/links.schema.ts, src/lib/slug.ts, prisma/schema.prisma
Khong cham: src/features/auth/*, src/frontend/*
Tham khao pattern: src/features/links/links.route.ts:12 (route chi validate → goi service)

# Khoi 4: VI DU INPUT/OUTPUT (AI hoc qua vi du — tips #6)
Input: {url: "https://example.com/a"} → Output 201: {slug: "aB3x9Q", shortUrl: "https://beshort.ly/aB3x9Q"}
Input: {url: "not-a-url"} → Output 400: {error: "URL khong hop le", code: "INVALID_URL"}

# Khoi 5: RANG BUOC & ANTI-PATTERN (tho code + kien truc su — 20_CODE_CRAFTSMANSHIP.md:4)
- Them header 3 Biet o dau moi file moi (Ai viet + Tai sao + Link SPEC/PROMPT) — xem 14_CODE_READING_GUIDE:2
- Tho code: File ≤300 dong, ham ≤50 dong & 1 viec, ten ro nghia (khong data/tmp), khong magic number (dat const SLUG_LEN=6 + WHY), early return, DRY 3 lan → tach
- Kien truc su: Tach bien Route(validate) → Service(BR) → DB(Prisma), chia theo feature src/features/links/, YAGNI khong lam thua, config bang env
- Dung zod o boundary, khong tu regex URL; Slug dung nanoid(6), retry 3 lan neu trung; Khong throw string, dung AppError

# Khoi 6: ACCEPTANCE & VERIFY
- Test: POST /api/links voi url hop le → 201, voi url xau → 400 (viet test RED truoc)
- Verify: npm test + npx tsc --noEmit + npm run build phai xanh
```

**Bai hoc — Tai sao 6 khoi?**

| Khoi | Thieu se sao |
|------|--------------|
| 1 Context | AI doan stack, gen sai lib |
| 2 Yeu cau | AI lam thua/thieu |
| 3 Files | AI sua lung tung, conflict (vi pham 21_FILE_STRUCTURE) |
| 4 Vi du | AI hieu sai format |
| 5 Rang buoc | AI dung cach do, no ky thuat, code rac |
| 6 Verify | Ban khong biet xong chua |

## 3. Checklist truoc khi dua cho AI — Hoc de lan sau tu viet (15_HOC_VIBE.md:2)

- [ ] Khoi 1 Context: da doc SPEC + PROJECT_CONTEXT? (thieu → AI doan stack)
- [ ] Khoi 2 Yeu cau: chi 1 viec? (gop → AI lam do)
- [ ] Khoi 3 Files: liet ke IN/OUT ro + dung cau truc chuan 21_FILE_STRUCTURE? (thieu → AI sua lung tung)
- [ ] Khoi 4 Vi du: co 2 vi du pass/fail? (thieu → AI hieu sai format)
- [ ] Khoi 5 Rang buoc: co header 3 Biet + tho/kien truc su (≤300/≤50, ten ro, DRY/YAGNI, tach bien)? (thieu → code rac)
- [ ] Khoi 6 Verify: co test + lenh chay do duoc? (thieu → khong biet xong chua)
- [ ] Tong <2000 dong? (qua → AI loang)

## 4. Sau khi AI code xong

- [ ] Chay verify trong khoi 6
- [ ] Review 5-axis (`docs/06_REVIEW/_TEMPLATE.md`) + check cau truc `11_KIEN_TRUC.md:4`
- [ ] Ghi worklog
- [ ] Goi y buoc tiep theo cho user (xem 05_TASKS/BOARD.md)

---
<!-- HOC DE TU BAY: Sau 5 prompt, hay thu tu viet prompt khong nhin template — du 6 khoi la dat. -->
