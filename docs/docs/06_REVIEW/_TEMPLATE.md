# REVIEW-XXX: [T�n slice] � Template 5-axis

> Copy th�nh `REVIEW-001_Ten.md`. Review tru?c khi merge � kh�ng review = kh�ng merge.
> D�nh cho reviewer (ngu?i ho?c AI). M?i l?i g?n nh�n: Critical / Important / Nit / FYI.

## 1. Meta

- **M�:** REVIEW-XXX (map TASK-XXX)
- **PR/Commit:** #link
- **Ngu?i review:** @reviewer
- **Ng�y:** YYYY-MM-DD
- **K?t qu?:** Approved | Request Changes

## 2. Context

- [ ] �� d?c SPEC v� PROMPT li�n quan
- [ ] �� hi?u y�u c?u business (d?c BIZ)
- [ ] �� ch?y `npm test` + `build` local

## 3. Checklist 5-axis

### Correctness � C� d�ng spec kh�ng?
- [ ] Match acceptance criteria trong SPEC
- [ ] Edge cases c� test (null, empty, qu� d�i, tr�ng slug)
- [ ] Error paths c� x? l� (kh�ng ch? happy path)
- [ ] Test th?c s? test d�ng th? (kh�ng mock qu� d�)
- **L?i:** _ghi v�o m?c 4_

### Readability � Ngu?i m?i d?c hi?u kh�ng? (xem 14_CODE_READING_GUIDE:7)
- [ ] Header 3 Bi?t c� d?? (Ai vi?t + T?i sao + Link SPEC/PROMPT)
- [ ] M?i quy?t d?nh kh� hi?u c� comment WHY + link ADR/SPEC? (kh�ng comment WHAT)
- [ ] T�n bi?n/h�m r� nghia (kh�ng `data`, `tmp`, `result`)
- [ ] H�m =50 d�ng, file =300 d�ng
- [ ] Kh�ng c� �clever code� kh� hi?u
- [ ] Dead code d� x�a
- **B�i h?c:** Code cho ngu?i d?c, kh�ng cho m�y � 6 th�ng sau ch�nh b?n l� ngu?i d?c. Thi?u header = junior m?t 30p do�n, c� header = 10s hi?u.

### Architecture � C� h?p structure kh�ng? (11_KIEN_TRUC.md:4)
- [ ] ��ng c?u tr�c chu?n: `src/features/<ten>/` (chia theo feature, kh�ng `utils.ts` chung), Route?Service?DB t�ch bi�n, `lib/` thu?n kh�ng DB
- [ ] ��ng pattern d? �n (xem `AGENTS.md:6`)
- [ ] Kh�ng circular dependency
- [ ] Kh�ng duplicate logic (n?u c� ? t�ch shared util)
- [ ] DB migration c� rollback

### Security � C� l? h?ng kh�ng?
- [ ] Input validate b?ng zod ? boundary
- [ ] SQL parameterized (kh�ng n?i chu?i)
- [ ] Kh�ng l? secret trong code/log � check `.env.example:1` kh�ng c� gi� tr? th?t
- [ ] C� rate limit / auth check noi c?n
- [ ] Kh�ng t? ti?n l?y GitHub/API/th�ng tin c� nh�n � m?i external fetch d� h?i consent tru?c (12_BAO_MAT.md:1)
- **B�i h?c:** M?i input t? user l� untrusted � validate tru?c khi d�ng. Secret ph?i h?i m?i d�ng.

### Performance � C� ch?m kh�ng?
- [ ] Kh�ng N+1 query
- [ ] C� pagination cho list
- [ ] Kh�ng fetch unbounded
- [ ] Kh�ng t?o object l?n trong hot path

## 4. Findings (ghi r� file:d�ng)

| # | M?c | File:d�ng | V?n d? | G?i � fix |
|---|-----|-----------|--------|-----------|
| 1 | Critical | `src/routes/links.ts:42` | Kh�ng validate URL, c� th? injection | D�ng `CreateLinkSchema.parse` |
| 2 | Important | `src/lib/slug.ts:15` | Kh�ng retry khi slug tr�ng | Th�m loop retry 3 |
| 3 | Nit | `src/routes/links.ts:10` | T�n `data` mo h? | �?i th�nh `createLinkInput` |
| 4 | FYI | � | C� th? th�m index cho `slug` | �� c� trong SPEC |

## 5. Verification

- [ ] `npm test` xanh (ghi s? test pass)
- [ ] `npm run build` pass
- [ ] `npx tsc --noEmit` pass
- [ ] Manual test (ghi curl command d� ch?y)

## 6. G?i � c?i thi?n cho l?n sau (d?y h?c)

> Sau review, reviewer ghi 1-2 b�i h?c d? dev ti?n b?:
> - VD: �L?n sau nh? vi?t test RED tru?c � l?n n�y code tru?c test n�n test kh�ng b?t du?c bug retry logic.�
> - VD: �Prompt thi?u v� d? output n�n AI gen sai format � nh? kh?i 4 trong PROMPT template.�

## 7. Quy?t d?nh

- [ ] **Approved** � merge du?c
- [ ] **Request Changes** � ph?i fix Critical/Important tru?c

---
<!-- EXAMPLE BeShort REVIEW-001: Review cho POST /api/links. Sau Approved ? c?p nh?t BOARD.md ? g?i � next TASK -->
