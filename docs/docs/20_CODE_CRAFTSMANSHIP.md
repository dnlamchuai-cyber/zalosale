# 20 � CODE CRAFTSMANSHIP: Vibe code ng?n g?n, d? hi?u, d? scale (tu duy th? + ki?n tr�c su)

> **Ch�m ng�n th?:** �Code nhu vi?t cho ngu?i m?i v�o team 6 th�ng sau � ngu?i d� c� th? l� ch�nh b?n.� Code r�c ch?y du?c h�m nay, nhung 3 th�ng sau b?n t? ch?i m�nh.
> **Ch�m ng�n ki?n tr�c su:** �L�m d? cho h�m nay, m? c?a cho ng�y mai � kh�ng x�y th?a, kh�ng kh�a du?ng.�

---

## 1. T?i sao AI hay gen code r�c? V� c�ch ch?n

| AI hay l�m | T?i sao l� r�c | C�ch ch?n b?ng prompt (16_PROMPT_MASTERY) | Check ? d�u |
|------------|----------------|--------------------------------------------|-------------|
| 1 file 600 d�ng, 1 h�m 200 d�ng | Kh�ng review n?i, s?a 1 ch? v? 3 ch? | Kh?i 5: `File =300 d�ng, h�m =50 d�ng, vu?t ? t�ch` | `06_REVIEW: readability` |
| T�n `data`, `result`, `tmp` | �?c 10s kh�ng bi?t l� g� | Kh?i 5: `T�n ph?i n�i r� l� g� � slug, originalUrl` | `14_CODE_READING_GUIDE:3` |
| Copy-paste 3 l?n thay v� t�ch h�m | S?a 1 ch? qu�n 2 ch? | Kh?i 5: `DRY � tr�ng 3 l?n th� t�ch h�m` | Review |
| D?ng abstraction s?m (Factory, BaseClass) khi ch? c� 1 case | Th?a, kh� hi?u, kh�ng d�ng t?i | Kh?i 5: `YAGNI � kh�ng l�m th?a cho tuong lai, ch? l�m d? cho AC h�m nay` | ADR |
| `if` l?ng 4 c?p, `try/catch` b?c c? file | Bug ?n, test kh� | Kh?i 5: `Early return, guard clause, h�m ng?n` | Review |
| Magic number `6`, `30`, `429` kh�ng gi?i th�ch | �?c kh�ng bi?t 6 l� g� | Kh?i 5: `�?t const SLUG_LEN=6, GUEST_TTL_DAYS=30 + comment WHY` | Review |
| Throw string, kh�ng typed error | FE kh�ng bi?t b?t l?i g� | Kh?i 5: `D�ng AppError {code, status}` | `12_HANDOVER S1` |

**Prompt ch?n r�c (d�n v�o kh?i 5 m?i PROMPT):**
```
Rang buoc tho code:
- File =300 dong, ham =50 dong, vuot ? tach file/ham moi
- Ten ro nghia (slug, originalUrl), khong data/tmp/result
- DRY: trung 3 lan ? tach ham, khong copy-paste
- YAGNI: chi lam du cho AC hom nay, khong ve tuong lai
- Early return, it nhat nesting, khong magic number (dat const + WHY)
- Header 3 Biet + comment WHY, khong comment WHAT
```

---

## 2. Tu duy th? � 7 quy t?c vi?t code ng?n g?n, d? hi?u

### Quy t?c 1: H�m l�m 1 vi?c, t�n n�i vi?c d�

```typescript
// XAU � ham lam 3 viec, ten mo ho, 80 dong
function handleLink(data: any) { /* validate + tao slug + luu DB + gui email */ }

// TOT � 3 ham, moi ham 1 viec, ten ro, moi ham =30 dong
function parseCreateLinkInput(raw: unknown): CreateLinkInput { /* validate zod */ }
function generateUniqueSlug(prisma: Prisma): Promise<Slug> { /* retry 3 */ }
function saveLink(input: CreateLinkInput, slug: Slug): Promise<Link> { /* prisma.create */ }
```

**T?i sao d? scale?** Mai th�m `customSlug` ch? s?a `parseCreateLinkInput`, kh�ng d?ng DB.

### Quy t?c 2: Early return � �t l?ng, d? d?c

```typescript
// XAU � long 3 cap
if (url) {
  if (isValid(url)) {
    if (!isBlocked(url)) { /* ... */ }
  }
}

// TOT � guard, moi if la 1 canh bao
if (!url) throw new AppError("MISSING_URL", 400);
if (!isValid(url)) throw new AppError("INVALID_URL", 400);
if (isBlocked(url)) throw new AppError("DOMAIN_BLOCKED", 400);
// happy path o day � khong long
```

### Quy t?c 3: Kh�ng magic number

```typescript
// XAU
if (slug.length !== 6) ...

// TOT
const SLUG_LENGTH = 6; // WHY: BR1 � 6 ky tu du 56B to hop, vua ngan vua an toan
if (slug.length !== SLUG_LENGTH) ...
```

### Quy t?c 4: �?t t�n l� t�i li?u

```typescript
// XAU
const d = await getData(id); // d la gi?
const res = await fetch(url); // res cua ai?

// TOT
const link = await findLinkBySlug(slug);
const response = await fetchOriginalUrl(link.originalUrl);
```

### Quy t?c 5: File ng?n � t�ch theo tr?c thay d?i

```
src/routes/links.ts      ? chi route (validate ? goi service ? tra response)
src/services/linkService.ts ? logic tao slug + luu DB
src/lib/slug.ts          ? ham tao slug thuan (de test, de tai dung)
src/schemas/link.ts      ? zod schema
```

**T?i sao?** �?i DB (Prisma ? Drizzle) ch? s?a `linkService.ts`, kh�ng d?ng route.

### Quy t?c 6: Kh�ng comment WHAT, ch? WHY

```typescript
// XAU � lap lai code
// Tao slug
const slug = nanoid(6);

// TOT � giai thich quyet dinh
// WHY: nanoid 6 ky tu + retry 3 � du an toan, nhanh hon crypto.randomUUID (benchmark 2x)
const slug = nanoid(6);
```

### Quy t?c 7: Test l� v� d? s?ng

M?i h�m ph?c t?p c� test c?nh b�n � test ch�nh l� docs d? hi?u hon comment.

---

## 3. Tu duy ki?n tr�c su � L�m sao d? d? m? r?ng, d? scale

### Nguy�n t?c 1: �? cho h�m nay, m? cho ng�y mai (YAGNI + Open/Closed)

* **H�m nay (BIZ-001):** Guest t?o link 6 k� t? ? ch? l�m `generateSlug()` + `saveLink()`
* **Ng�y mai (BIZ-006):** Cho ph�p `customSlug` ? th�m param `customSlug?: string` v�o `CreateLinkInput`, kh�ng s?a h�m cu � m? r?ng b?ng th�m branch, kh�ng s?a logic cu.

```typescript
// Kien truc mo: them tinh nang bang them nhanh, khong sua ham cu
export async function createLink(input: CreateLinkInput) {
  const slug = input.customSlug ?? await generateUniqueSlug(prisma); // mo rong khong pha vo
}
```

### Nguy�n t?c 2: T�ch bi�n (Boundary) � FE kh�ng bi?t DB, Route kh�ng bi?t Prisma

```
[FE] --fetch--> [Route: validate zod] --goi--> [Service: business logic] --goi--> [DB: Prisma]
```

Route ch? l�m 3 vi?c: validate ? g?i service ? tr? response. Service ch?a BR. DB ch? luu. �?i DB kh�ng d?ng Route.

### Nguy�n t?c 3: C?u tr�c theo feature, kh�ng theo lo?i file

```
// XAU � chia theo loai file, tim 1 feature phai mo 5 folder
src/controllers/
src/models/
src/utils/

// TOT � chia theo feature (vertical slice), 1 TASK = 1 folder
src/features/links/
  +-- links.route.ts
  +-- links.service.ts
  +-- links.schema.ts
  +-- links.test.ts
```

**Scale:** Th�m feature `analytics` ? t?o `src/features/analytics/` m?i, kh�ng d?ng `links/`.

### Nguy�n t?c 4: Config, kh�ng hardcode

```typescript
// XAU � doi limit phai sua code
if (count > 10) throw ...

// TOT � doi bang env, khong deploy lai
const GUEST_RATE_LIMIT = Number(process.env.GUEST_RATE_LIMIT ?? 10);
if (count > GUEST_RATE_LIMIT) throw ...
```

### Nguy�n t?c 5: �o tru?c, t?i uu sau

Kh�ng t?i uu s?m. Vi?t code r� tru?c, khi n�o `p95 >300ms` m?i t?i uu (th�m index, cache). `12_HANDOVER_CHECKLIST:3` c� checklist performance d? do.

---

## 4. Prompt vibe code s?ch � D�n v�o kh?i 5

```
Tho code + kien truc su:
- File =300, ham =50, ten ro nghia, khong data/tmp, khong magic number (dat const + WHY)
- Moi ham 1 viec, early return, it nesting, DRY 3 lan ? tach, YAGNI khong lam thua
- Tach bien: Route (validate) ? Service (BR) ? DB (Prisma), chia theo feature (src/features/links/)
- Header 3 Biet + WHY, test colocated, AppError co code
- Config bang env, khong hardcode
```

AI gen xong, t? h?i: `Junior 1 tuan doc file 5p hieu khong? Mui them 1 field co phai sua 5 file khong? Neu co ? chua sach.`

---

## 5. Checklist �Th? & Ki?n tr�c su� tru?c khi merge (th�m v�o REVIEW)

- [ ] File =300, h�m =50, kh�ng h�m 100 d�ng?
- [ ] T�n r� nghia, kh�ng `data/tmp/result`, kh�ng magic number?
- [ ] M?i h�m 1 vi?c, early return, kh�ng l?ng 3 c?p?
- [ ] �� t�ch theo feature/bi�n, d?i 1 feature kh�ng d?ng 5 file?
- [ ] Kh�ng abstraction th?a (YAGNI), kh�ng copy-paste 3 l?n?
- [ ] Config b?ng env, kh�ng hardcode limit/URL?
- [ ] Header 3 Bi?t + WHY d?, junior d?c 5p hi?u?

N?u 7 c�u d?u c� ? code n�y **ng?n g?n, d? hi?u, d? scale** � th? duy?t, ki?n tr�c su duy?t.

---
*Li�n quan: `14_CODE_READING_GUIDE.md:1` (d?c) ? `06_REVIEW/_TEMPLATE.md:1` (check) ? `15_HOC_VIBE.md:2` (kh?i 5) ? `11_KIEN_TRUC.md:1` (c?u tr�c).*
