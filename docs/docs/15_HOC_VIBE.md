# 15 — HOC VIBE: Hoc trong luc code + Viet prompt chuan (1 file thay 4)

> **Gop tu:** `10_GUIDE (37 tips) + 15_LEARN_PROMPTS + 16_PROMPT_MASTERY + PROMPT_CHEATSHEET` → 1 file 150 dong, khong can doc 4 file.
> **Dung:** Copy 1 prompt trong bang duoi, dan cho AI la hoc ngay — khong can mo md.

## A. Hoc ngay luc code — Copy 1 dong la hoc

| Tinh huong | Prompt dan cho AI | Hoc gi |
|------------|-------------------|--------|
| Chua biet X | `Toi la new dev. Giai thich [X] don gian + vi du BeShort?` | Frontend/Backend/API/Endpoint/Database... (glossary 15 cu) |
| So sanh X vs Y | `Khac nhau giua [X] vs [Y]? Khi nao chon X hon Y? Vi du BeShort?` | Tai sao chon Fastify hon Express |
| Doc code khong hieu | `Giai thich code nay line by line: \`\`\`[code]\`\`\`` | Hieu tung dong de tu viet |
| Muon vi du chay | `Cho 1 vi du chay duoc cua [X] + giai thich tung dong` | Hoc qua vi du |
| Da biet A chua biet B | `Toi hieu [A] roi nhung chua ro [B] — noi giup?` | Noi kien thuc |

## B. Viet prompt chuan — 6 khoi (nho de tu viet)

| Khoi | Kien thuc can | Thieu se sao | Vi du BeShort |
|------|---------------|--------------|---------------|
| 1 Context | Stack + SPEC nao | AI doan sai lib | `Stack TS+Fastify+Prisma, doc SPEC-001` |
| 2 Yeu cau 1 viec | Chia slice nho | Gop 3 viec → rac 600 dong | `Chi POST /api/links, khong redirect` |
| 3 Files IN/OUT | Cau truc `21_FILE_STRUCTURE` | AI sua nham auth.ts | `Tao src/features/links/links.route.ts` |
| 4 Vi du I/O | Nghiep vu + edge case | AI hieu sai format | `Input {url:"..."} → 201 {slug}` |
| 5 Rang buoc | Tho + kien truc + bao mat S1-S8 | Code rac, lo bao mat | `zod, retry 3, header 3 Biet, ≤300/≤50` |
| 6 Verify | Test + lenh chay | Khong biet xong chua | `npm test + tsc + build xanh` |

**Mau full 6 khoi (tao moi):**
```
Tao [feature] bang [TS+Fastify+Prisma] theo SPEC-xxx.
Yeu cau: 1 viec — [1 cau].
Files: Tao [src/features/...], Khong cham [...], tham khao [file:line].
Vi du: Input [...] → 201 [...]; Input xau → 400 [...].
Rang buoc: zod o boundary, header 3 Biet, file ≤300, ham ≤50, bao mat S..
Verify: test RED truoc → npm test + tsc xanh.
```

**Cac TH khac:**
* **Sua code:** `Toi co code: \`\`\`[code]\`\`\` Hay [sua X], giu <300 dong, them test [case].`
* **Review:** `Review 5-axis + S1-S8 (12_BAO_MAT): [code/PR]`
* **Debug (Beaver):** `B1: Them log o moi buoc \`\`\`[code]\`\`\` → B2: Day la log \`\`\`[logs]\`\`\` tim cho vo?`
* **Hoc:** `Toi la new dev, giai thich [X] + vi du BeShort + line by line`

## C. Sau moi TASK AI se hoi ban 1 cau (tra loi la hoc)

* `Ban hieu tai sao chon [tech] nay khong? Can giai thich lai?`
* `Ban tu viet lai khoi 4 cho TASK tiep theo thu?`
* `Tai sao phai hash IP / retry 3 / validate o BE?`
* `Edge case nao lam code nay vo?`

## D. 37 tips + 8 bi quyet senior (tom tat)

* **Context <2000 dong** — flood → AI loang
* **Type la spec song** — viet zod + branded Slug truoc code
* **1 prompt 1 PR 1 review** — gop → review 2h
* **Prove-It truoc Fix** — viet test do truoc khi fix bug
* **Beaver co kiem soat** — chi log o boundary + requestId
* **Dong 3 vai moi review** — junior hieu? PM du? hacker khong?
* **Worklog la tai san** — ghi tai sao khong chon X
* **Verify 3 lenh:** `tsc + test + build` sau moi AI output

> Chi tiet day du truoc day o 4 file cu — nay gop 1 file de AI doc <500 dong. Can dao sau: `20_CODE_CRAFTSMANSHIP` (tho) + `21_FILE_STRUCTURE` (kientruc).
