---
name: hoc-tap
description: Teach the user what was built, why the design works, how the prompt and architecture shaped it, and what security and testing trade-offs remain. Use after implementation, debugging, review, or a completed milestone when the user wants durable understanding.
---

# Skill: Learn From the Work

Use automatically after every verified task or slice; do not wait for `/hoc-tap`. Default to `ADAPTIVE`: explain unfamiliar concepts simply, keep known concepts brief, and increase depth only when requested.

## Encoding bat buoc

Moi noi dung tao ra phai la UTF-8; khong de mojibake (`�`, `�`, `?`) trong Markdown, code block, ten file hoac vi du.

## Khi nao dung

* Vua xong mot task, bug fix, review, or milestone
* Muon on lai mot file, decision, pattern, or trade-off
* Nguoi moi muon hieu thay vi chi copy code

## Quy tac tra loi ngan

* Giai thich 5 tinh hoa, moi muc toi da 2 cau: `Lam gi` + `Tai sao`.
* Chi giai thich line-by-line khi user chi ro file/dong.
* Ket thuc bang 1 cau hoi hoc tap, khong viet bai giang dai.

## Khi KHONG dung

* Chua co TASK nao Done � hay chay `/lay-yeu-cau` truoc
* Chi muon fix bug nhanh � dung `tao-prompt` thay vi hoc

## Dau ra � 5 tinh hoa, moi cai 3 dong + 1 cau hoi de ban tu tra loi

AI phai tra loi dung 5 muc nay, moi muc co **Lam gi + Tai sao + Loi neu lam khac + 1 cau hoi**:

### 1. Tinh hoa Code (tho code � 20_CODE_CRAFTSMANSHIP.md:2)

```
- Lam: Ham generateUniqueSlug() tach rieng src/lib/slug.ts, =30 dong, early return
- Tai sao: De test khong can DB (5ms), ten ro, DRY � dung lai cho BIZ-006 customSlug
- Neu lam khac: De trong links.service.ts ? test phai mock Prisma, cham, kho tai dung
- Hoi ban: Ham nay neu dai 80 dong thi tach sao cho moi ham =50 va 1 viec? (thu tra loi)
```

### 2. Tinh hoa Kien truc (kientruc su � 11_KIEN_TRUC.md:1)

```
- Lam: Chia src/features/links/ (route?service?db), khong dung src/utils.ts chung
- Tai sao: Them analytics chi tao src/features/analytics/, khong dung 5 file cu; doi DB chi sua db/ + service
- Neu lam khac: src/controllers/ + src/models/ ? sua 1 feature mo 3 folder, de quen, kho xoa
- Hoi ban: Tai sao Route chi validate ma khong chua BR? (21:3)
```

### 3. Tinh hoa Prompt (15_HOC_VIBE.md:2)

```
- Lam: PROMPT-001 du 6 khoi � khoi 3 liet ke Files IN/OUT dung chuan 21, khoi 5 co tho+kien truc
- Tai sao: Thieu khoi 3 ? AI sua nham auth.ts; thieu khoi 5 ? AI gen file 600 dong rac
- Neu lam khac: Prompt 1 dong "lam web rut gon link" ? AI doan, sai 80%
- Hoi ban: Thu viet lai khoi 3 cho TASK-003 GET /:slug ma khong nhin template? (16:3)
```

### 4. Tinh hoa Nghiep vu (BIZ/SPEC)

```
- Lam: BIZ-001 BR3 Guest het han 30 ngay ? SPEC-001 expiresAt +30d
- Tai sao: Bao mat (han che link rac) + cost (DB khong phi`nh) � da ghi ADR
- Neu lam khac: Khong het han ? DB day, spam khong xoa duoc
- Hoi ban: Neu khach doi BR3 thanh 7 ngay, sua may file theo 21? (chi service + schema)
```

### 5. Tinh hoa Bao mat (12_HANDOVER S1-S8 + 18_PRIVACY)

```
- Lam: S1 zod o boundary + S4 hash IP + S5 rate-limit 10/phut + S3 khong lo secret
- Tai sao: Khong tin FE � hacker gui curl thang; hash IP de GDPR; rate-limit chong spam
- Neu lam khac: Bo zod ? injection; luu IP tho ? lo PII; khong hoi consent truoc khi lay GitHub ? breach
- Hoi ban: Tai sao phai validate o BE du FE da validate? (12:S1)
```

## Mau hoi thoai

```
User: /hoc-tap
AI: Ban vua xong TASK-002 POST /api/links. Giai thich 5 tinh hoa:
  1. Code: ...
  2. Kien truc: ...
  3. Prompt: ...
  4. Nghiep vu: ...
  5. Bao mat: ...
  -> Ban hieu chua? Muon minh giai thich line by line file nao? (/hoc-tap line by line src/lib/slug.ts:8)
User: giai thich line by line slug.ts
AI: [giai thich 15_HOC_VIBE.md:A]
```

## Hoc ma khong can doc md

Moi muc deu co cau hoi � ban tra loi la hoc. Tra loi duoc 5 cau ? da hieu slice nay, san sang tu viet slice tiep theo khong can template.

## Lien ket

* Tho code: `docs/20_CODE_CRAFTSMANSHIP.md:1` | Kien truc: `docs/11_KIEN_TRUC.md:1`
* Prompt: `docs/15_HOC_VIBE.md:1` | Bao mat: `docs/12_BAO_MAT.md:2` + `12_BAO_MAT.md:1`
* Luong: `lay-yeu-cau ? tao-prompt ? code ? /hoc-tap ? review ? worklog`
