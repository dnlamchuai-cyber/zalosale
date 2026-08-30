---
name: lay-yeu-cau
description: Clarify an underspecified product, feature, or technical request through focused questions, then produce reusable requirements and an implementation-ready specification. Use before planning or coding when scope, users, behavior, constraints, or acceptance criteria are unclear.
---

# Skill: Requirements Discovery

## Encoding bat buoc

Moi BIZ va SPEC phai duoc tao bang UTF-8; kiem tra khong co mojibake (`�`, `�`, `?`) truoc khi luu va ket luan.

## Khi nao dung

* User noi "lam feature X" nhung chua ro
* Bat dau mot san pham, feature, task, or change moi
* Khi spec thieu ? khong doan, phai hoi
* Khi can thong tin ngoai: GitHub link, API key -> phai hoi consent truoc

## Quy tac tra loi ngan

* Hoi tung nhom toi da 3-5 cau; khong hoi lai thong tin da co.
* Dung format: `Ket luan` ? `Can user chon` ? `Buoc tiep theo`.
* Khong dump template vao chat; sinh noi dung vao file can thiet.
* Neu thieu thong tin, hoi dung diem thieu; khong suy doan.

## Quy trinh 5 buoc (moi buoc deu day user + chuan tho/kien truc)

### Buoc 1: Hoi Socratic (5 Whys + edge cases)

```
1. Actor la ai? Guest vs Member khac gi?
2. Input/output chinh xac? (VD: URL bao nhieu ky tu? Tra ve gi?)
3. Business rules? (VD: slug may ky tu? Het han khi nao?)
4. Edge cases? (VD: URL xau, slug trung ? xu ly sao?)
5. Thanh cong do bang gi? (VD: bao nhieu link/ngay? p95 bao nhieu ms?)
```

**Day tho:** Moi cau hoi = 1 dong trong BIZ template. Sau nay tu hoi 5 cau nay truoc khi code.

### Buoc 2: Sinh BIZ (docs/02_BUSINESS/BIZ-xxx.md)

Dung _TEMPLATE.md, dien tu cau tra loi. Bat buoc co: User Story, BR1-BRn, Edge Cases, AC Given/When/Then.

### Buoc 3: Sinh SPEC (docs/03_SPEC/SPEC-xxx.md) � Type-first + Kien truc

Tu BIZ ? SPEC:

* Vit zod schema + TS types (branded types neu can)
* Ve DB schema (Prisma)
* Dinh API contract (method + endpoint + zod) + giai thich khi nao dung POST vs GET
* **Dinh cau truc file chuan** `11_KIEN_TRUC.md:1` � feature nay nam o `src/features/<ten>/`, tang Route/Service/DB
* Ghi ADR neu chon tech/cau truc khac preset

**Day kien truc su:** Spec la hop dong + ban ve tang � sau nay tu viet 10 dong types + 1 cay thu muc la du.

### Buoc 4: User Review (bat buoc)

```
Spec da xong. Ban duyet hay sua?
- [ ] Duyet ? chuyen tao-prompt
- [ ] Sua BR2: slug 8 ky tu thay vi 6
```

### Buoc 5: Goi y Next Step + Day

```
SPEC-001 Approved. Goi y:
A (khuyen): BIZ-002 Redirect � hoan thien P0 de demo
B: BIZ-003 Auth
Ban chon A/B/C?

[HOC] Tai sao Guest link het han 30 ngay (BR3) la quyet dinh bao mat + cost?
[HOC Kien truc] Tai sao tach src/features/links/ thay vi src/utils.ts chung? � 11_KIEN_TRUC.md:1
```

## Output

* `docs/02_BUSINESS/BIZ-xxx.md` (Approved)
* `docs/03_SPEC/SPEC-xxx.md` (Approved) � kem cau truc file
* Goi y next BIZ/TASK

## Lien ket

* Template BIZ: `docs/02_BUSINESS/_TEMPLATE.md:1`
* Template SPEC: `docs/03_SPEC/_TEMPLATE.md:1`
* Kien truc: `docs/11_KIEN_TRUC.md:1` | Tho code: `docs/20_CODE_CRAFTSMANSHIP.md:1`
* Tiep theo: `tao-prompt` skill
