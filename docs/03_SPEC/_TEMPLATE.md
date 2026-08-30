# SPEC-XXX — [Tên feature]

> Trạng thái: 📝 Draft | ✅ Approved
> Từ: BIZ-XXX | Ngày:

## 1. Kiểu dữ liệu (type-first)
```ts
// zod schema + TS types
```

## 2. DB schema
```prisma
model X { ... }
```

## 3. API contract
| Method | Endpoint | Body | Trả về | Lỗi |
|---|---|---|---|---|
| POST | /api/x | {...} | {...} | 400/404 |

## 4. Kiến trúc file
```
src/features/<ten>/
  route.ts    // validate + call service
  service.ts  // business rules
  lib.ts      // thuần, không I/O
```

## 5. Edge cases / ràng buộc
