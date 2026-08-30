---
name: tao-prompt
description: Convert an approved specification into a concise, executable implementation prompt with context, scope, files, constraints, examples, and verification. Use before delegating a coding task to an AI agent.
---

# Skill: Implementation Prompting

## Encoding bat buoc

Moi PROMPT phai duoc tao bang UTF-8; khong de mojibake (`�`, `�`, `?`) trong noi dung hoac code block.

## Khi nao dung

* A requirements document or specification is approved
* Need to delegate a small, testable implementation slice
* Muon hoc cach tu viet prompt sau nay
* Can thong tin ngoai ? hoi consent truoc (12_BAO_MAT.md:1)

## Quy tac tra loi ngan

* Tom spec toi da 3 dong truoc khi sinh prompt.
* Chi liet ke file IN/OUT va rang buoc lien quan slice; khong dump ca repo.
* Noi dung day du nam trong PROMPT file; chat chi bao cao scope, verify, findings.
* Khong lap lai toan bo prompt sau khi da ghi file.

## Quy trinh 4 buoc � Vua lam vua day tho/kien truc su

### Buoc 1: Doc & Tom spec

Doc `SPEC-xxx.md` + `PROJECT_CONTEXT.md`, tom 3 dong:
```
- Lam gi: POST /api/links tao slug 6 ky tu
- Input: {url} Output: {slug, shortUrl}
- Rang buoc: retry 3, rate limit, cau truc src/features/links/
```

### Buoc 2: Sinh PROMPT-xxx.md 6 khoi (day cau truc + kien truc)

Dung `docs/04_PROMPTS/_TEMPLATE.md:1`, dien 6 khoi � **khoi 5 bat buoc co tho + kien truc su:**

```
1. Context: Stack + doc SPEC nao
2. Yeu cau 1 viec: 1 prompt 1 viec � gop la rac
3. Files IN/OUT: Liet ke file duoc cham + cam cham � dung chuan 11_KIEN_TRUC.md:1 (src/features/<ten>/, tach bien Route?Service?DB)
4. Vi du I/O: 2 vi du pass/fail � AI hoc qua vi du
5. Rang buoc tho + kien truc su: File =300, ham =50 & 1 viec, ten ro (khong data/tmp), khong magic number (SLUG_LEN=6 + WHY), early return, DRY 3 lan?tach, YAGNI, tach bien, header 3 Biet (14_CODE_READING_GUIDE:2)
6. Verify: npm test + tsc + build xanh
```

**Bai hoc endpoint/DB:**
```
- POST /api/links ? tao moi (khong idempotent)
- GET /:slug ? redirect (idempotent)
- Prisma schema la ban ve � doi phai migrate
- 21_FILE_STRUCTURE: Route chi validate, Service chua BR, Lib thuan
```

### Buoc 3: Self-check (day user tu check sau nay)

- [ ] Context <2000 dong?
- [ ] Files dung chuan 21_FILE_STRUCTURE (feature folder, tach bien)?
- [ ] Rang buoc co tho + kien truc su (=300/=50, ten ro, DRY/YAGNI)?
- [ ] Co header 3 Biet + WHY?
- [ ] Co 2 vi du I/O? Co verify do duoc?

### Buoc 4: Sau khi AI code xong � Goi y + Day

```
TASK-002 Done. Goi y:
A (khuyen): TASK-003 GET redirect � demo end-to-end
B: Rate limit (S5)
Ban chon?

[HOC Tho] Tai sao ham nay 80 dong la rac? Tach sao cho =50 va 1 viec? � 20_CODE_CRAFTSMANSHIP.md:2
[HOC Kien truc] Tai sao tach src/features/links/ thay vi src/utils.ts? � 11_KIEN_TRUC.md:1
[HOC Prompt] Khoi 5 thieu gi neu bo DRY/YAGNI?
```

Ghi 1 dong "Bai hoc tho/kien truc" vao worklog.

## Output

* `docs/04_PROMPTS/PROMPT-xxx.md` (da self-check)
* `docs/05_TASKS/TASK-xxx.md`
* Goi y next step + bai hoc tho/kien truc

## Lien ket

* Template: `docs/04_PROMPTS/_TEMPLATE.md:1`
* Tho code: `docs/20_CODE_CRAFTSMANSHIP.md:1` | Kien truc: `docs/11_KIEN_TRUC.md:1`
* Truoc do: `lay-yeu-cau` | Sau do: `05_TASKS/_TEMPLATE.md:1` + `06_REVIEW/_TEMPLATE.md:1`
