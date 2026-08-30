# 00 — WORKFLOW: Quy trinh Vibe Coding Chuan (5 Pha) — DB chon sau khi co nghiep vu

> Tai lieu bat buoc doc dau tien. Moi thanh vien, moi AI agent deu tuan workflow nay. Vi pham = khong merge.
> Thiet ke cho team 3-10 nguoi, ap dung cho moi du an (web/mobile).

## Tong quan (dan tuong) — DB khong khoa cung Pha 1

```
┌─────────────────────────────────────────────────────────────────────┐
│  Pha 1: CHON CONG NGHE NEN         → 01_TECH_STACK (FE/BE ngon ngu)  │
│         AI goi y 2-3 stack + ly do → Ban chon core (VD: TS+React+Node)│
│         DB chua chot — de sau khi co nghiep vu                      │
│                ↓                                                    │
│  Pha 2: NGHIEP VU + DAC TA         → 02_BUSINESS (lay-yeu-cau)      │
│         → 03_SPEC (types, API, ERD) → MOI CHON DB chi tiet         │
│         DB chon sau khi biet data model (VD: Postgres vs Mongo)     │
│         → Ghi ADR + User Review (khach duyet spec + DB)             │
│                ↓                                                    │
│  Pha 3: PROMPT + CODE LOGIC        → 04_PROMPTS (tao-prompt)        │
│         1 slice = 1 TASK (DB+API+test, chua UI) → TDD               │
│                ↓                                                    │
│  Pha 4: REVIEW + WORKLOG           → 06_REVIEW (5-axis) + 07_WORKLOG│
│                ↓                                                    │
│  Pha 5: UI/UX                      → 09_UIUX (chi sau khi logic xanh)│
└─────────────────────────────────────────────────────────────────────┘
         Moi pha co DoD. Khong dat DoD → khong sang pha sau.
         DB/tech chi tiet duoc chot o Pha 2 sau khi co BIZ/SPEC, khong khoa Pha 1.
```

## Pha 1: Chon cong nghe nen — 15 phut, chon nhe, khong khoa DB

**Muc tieu:** Chot ngon ngu + framework chinh de AI va nguoi cung noi 1 ngon ngu. DB de sau.

**Dau vao:** Y tuong so bo, team size, deadline, co can mobile/SEO khong.
**Dau ra:** `docs/_meta/PROJECT_CONTEXT.md` dien core (FE/BE), DB de `TBD — chon sau khi co SPEC`.
**DoD:**
- [ ] PROJECT_CONTEXT da dien core (FE/BE), DB ghi `TBD` hoac 2 lua chon dang can nhac
- [ ] PM duyet core stack (khong can duyet DB luc nay)

**Goc nhin:**
- *Dev:* Biet se dung TS+React+Node hay Dart, tranh AI bia lib.
- *Mentor:* Day "Chon pho bien truoc, DB de sau khi biet data" — tranh khoa som.
- *PM:* Khong ep chon DB khi chua biet app lam gi.

## Pha 2: Nghiep vu & Dac ta — MOI CHON DB (quan trong nhat)

**Muc tieu:** Tu y tuong mo ho → BIZ → SPEC → moi du co so chon DB dung.

**Luong:**
```
User noi "lam rut gon link"
  → lay-yeu-cau hoi Socratic (5 Whys, edge cases) → Sinh BIZ-xxx.md
  → Sinh SPEC-xxx.md (zod types, DB ERD, API contract)
  → SAU KHI CO ERD moi hoi: "Data nay quan he hay linh dong? Can transaction khong?"
  → AI goi y DB: Postgres (quan he, can join) vs Mongo (linh dong) vs SQLite (demo) + ly do
  → Ban chon DB → Ghi ADR vao DECISIONS.md → User Review duyet ca SPEC + DB
```

**DoD:**
- [ ] Moi BIZ co Actor, BR, Edge Cases, AC Given/When/Then
- [ ] Moi SPEC co zod + TS types + DB schema (ERD) + API contract + **DB da chon + ly do + ADR**
- [ ] Spec + DB duoc user duyet (Status: Approved)

**Quy tac vang:** Khong chon DB truoc khi co ERD. Neu chua co BIZ/SPEC → dung va hoi, khong tu bia DB.

**Vi du BeShort:**
* BIZ-001: Link co quan he 1-n (user → links → clicks), can unique slug, can transaction → chon Postgres+Prisma. Neu app chi luu JSON linh dong khong can join → chon Mongo. Demo solo → SQLite.

## Pha 3: Prompt + Code Logic (tao-prompt + TDD) — DB da chot tu Pha 2

**Luong cho 1 TASK:**
```
SPEC-xxx (da Approved, da co DB)
  → tao-prompt sinh PROMPT-xxx.md (context <2000 dong, files, pattern, acceptance, cau truc 11_KIEN_TRUC)
  → Dev/AI implement 1 slice (DB migration + API + test) — TOI DA 300 dong
  → TDD: RED → GREEN → REFACTOR
  → Verify: npm test + build + tsc + security-audit
  → Commit 1 commit / 1 slice
```

**DoD:** Co PROMPT truoc khi code, test do truoc xanh sau, file ≤300, chi cham files trong PROMPT, da git push + audit PASS.

## Pha 4: Review & Worklog

**DoD:** Co REVIEW 5-axis, 0 Critical, header 3 Biet, cau truc chuan 11_KIEN_TRUC, ghi WORKLOG + Board Done, git tag neu xong BIZ.

## Pha 5: UI/UX — Chi sau khi logic pass 100%

**DoD:** Logic cu van pass, co screenshot 3 breakpoint, khong co BR moi.

## Quy tac cho team/công ty

1. 1 TASK = 1 PR = 1 Review = 1 Merge.
2. Khong ai merge khi chua co REVIEW.
3. Worklog bat buoc.
4. Moi tuan demo 1 slice.
5. Retro 2 tuan/lan: doc DECISIONS.md, cap nhat workflow.

## Hoc trong luc lam

| Pha | Ban hoc gi | Prompt dan cho AI |
|-----|------------|-------------------|
| 1 | Tai sao chon core truoc, DB sau | `Giai thich tai sao DB nen chon sau khi co ERD? Trade-off Postgres vs Mongo?` |
| 2 | Khi nao chon DB | `Voi BIZ nay (mo ta), nen chon DB nao? Vi sao?` |
| 3 | Viet prompt 6 khoi | `Check prompt thieu khoi nao?` — xem 15_HOC_VIBE.md:2 |
| 4 | Bao mat + review | `Review S1-S8` |
| 5 | UI | `Tai sao UI de cuoi?` |

## Lennh nhanh cho AI

```
/lay-yeu-cau  → Bat dau Pha 2
/tao-prompt  → Sinh prompt tu spec da duyet (Pha 3)
/hoc-tap     → Giai thich tinh hoa vua lam
/review      → Chay review 5-axis (Pha 4)
Hoi bat ky: "Giai thich line by line: ```[code]```" → 15_HOC_VIBE.md:A
```

---
*Lien quan: 01_TECH_STACK.md:1 (AI goi y stack, DB chon sau) → 11_KIEN_TRUC.md:1 (cau truc) → 15_HOC_VIBE.md:1 (viet prompt).*
*DB khong khoa Pha 1 — chot o Pha 2 sau khi co BIZ/SPEC + ADR.*
