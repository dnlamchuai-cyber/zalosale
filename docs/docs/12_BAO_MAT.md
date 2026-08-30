# 12 — BAO MAT: Checklist ban giao + Consent (1 file thay 2)

> Gop tu `12_HANDOVER_CHECKLIST` + `18_PRIVACY_CONSENT` + `scripts/security-audit` → 1 file de nho.
> Khong dat S1-S8 + consent thi khong duoc push (pre-push hook se chan).

## 1. Bao mat S1-S8 — Khong de lo, khong de hack

| # | Check | Tai sao | Cach lam | Prompt ghi sao |
|---|-------|---------|----------|----------------|
| S1 | Moi input validate zod o BE | Khong tin FE — hacker gui curl | `CreateLinkSchema.parse(req.body)` | "Validate moi input zod, 400 neu fail" |
| S2 | SQL khong noi chuoi | Tranh injection | Dung Prisma, khong `queryRaw("..."+slug)` | "Prisma parameterized" |
| S3 | Khong lo secret + co consent | `.env` khong commit, moi GitHub/API phai hoi truoc | `.env` trong `.gitignore`, `.env.example` rong, hoi user truoc khi lay (xem muc 3) | "Khong log secret, thieu dung MOCK" |
| S4 | Hash IP | GDPR | `sha256(ip+salt)` | "Hash IP truoc khi luu" |
| S5 | Rate limit | Chong spam | `@fastify/rate-limit` 10/phut | "Them rate limit POST /api/links" |
| S6 | Auth check moi endpoint private | Khong de Guest xem link nguoi khac | `if (!user) 401; if (ownerId!==id) 403` | "Check auth + ownership" |
| S7 | Helmet/CORS | Chong XSS | `@fastify/helmet`, CORS allow FE domain | "Them helmet" |
| S8 | npm audit pass | CVE = cua hacker | `npm audit --audit-level=high` pass | "Chay audit truoc merge" |

**Verify:**
```bash
npm run security:audit          # chay S1-S8 tu dong
grep -r "process.env" --include="*.ts" | grep -v ".env.example"
curl -i http://localhost:3000/api/links  # expect 401
```

## 2. Consent — Khong tu tien lay thong tin user

**Bat buoc hoi truoc khi lay:** GitHub link, API key, email, link private, deploy token.

**Mau hoi:**
```
[CONSENT] Minh can [GitHub URL / API key X] de [lam gi].
Ban dan truc tiep (minh khong log) hoac tao .env.local: X=...
Chua co thi noi "chua co" — minh dung mock de demo, ghi MOCK trong SPEC.
```

**Sai vs Dung:**
* SAI: "Thay repo github.com/you/beshort nen minh push luon" → tu tien!
* DUNG: "Can GitHub URL de push tag v0.1.0, ban dan URL? Chua co thi chi commit local."

**Khi chua co:** Dung `https://example.com`, `demo-key`, ghi `MOCK — cho real key truoc khi deploy production`.

## 3. Checklist truoc khi push/ban giao

- [ ] S1-S8 PASS (`scripts/security-audit.ps1` PASS — pre-push hook se chan neu FAIL)
- [ ] Khong secret nao trong `git log` / `docs/` / `worklog`, chi o `.env.local`
- [ ] Moi WebFetch/gh da hoi consent truoc, co dong hoi trong chat
- [ ] `npm audit --audit-level=high` pass
- [ ] Test coverage ≥70%, moi BIZ P0 co demo video/curl
- [ ] Board Done het P0, con lai ghi phase 2

## 4. Hoc de tu bao ve

* Dung dan key len chat cong khai — bot scan 5p la lo
* Dung `.env.local` + `.gitignore` — push nham la lo vinh vien
* Hoi "scope toi thieu cua token nay la gi?"

---
*Lien quan: `17_GIT_VERSIONING.md:4` (push) → `14_CODE_READING_GUIDE.md:5` (ai viet) → `scripts/security-audit.ps1:1`*
