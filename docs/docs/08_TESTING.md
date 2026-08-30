# 08 — TESTING: Chiến lược TDD cho Vibe Coding

> Học để tự viết test xịn — sau này không cần file này vẫn biết khi nào viết test gì.

## Tư duy: Test là spec thứ 2

Code nói “làm thế nào”, test nói “phải làm gì”. Viết test trước = bạn nghĩ về yêu cầu trước khi nghĩ về giải pháp — ít bug hơn 40%.

## Vòng TDD 3 bước (RED-GREEN-REFACTOR)

```
1. RED: Viết test đỏ (chưa có code → test phải đỏ) → chạy npm test → thấy đỏ mới đúng
2. GREEN: Viết code tối thiểu cho test xanh — không làm thừa
3. REFACTOR: Dọn code, chạy lại test vẫn xanh
```

**Bài học:** Nếu test xanh ngay lần đầu → test sai, không bắt được gì.

## Tháp test (áp dụng cho BeShort)

```
        /\  E2E (5%) — Playwright: tạo link → redirect → check click count
       /--\  Integration (15%) — Supertest: POST /api/links với DB thật (test DB)
      /----\  Unit (80%) — Vitest: slug generation, URL validate, hash IP
```

* 80% unit → chạy <10ms, feedback nhanh khi vibe code
* Integration → test API + DB, dùng test DB riêng, không mock Prisma
* E2E → chỉ cho luồng P0 quan trọng

## Khi nào viết test gì? (học để tự quyết)

| Tình huống | Viết test gì | Ví dụ BeShort |
|------------|--------------|---------------|
| Hàm pure, không I/O | Unit | `generateSlug()` → phải 6 ký tự, không trùng |
| API endpoint | Integration | `POST /api/links` → 201 với DB check |
| Luồng user hoàn chỉnh | E2E | Tạo link → mở link rút gọn → redirect đúng |
| Bug report | Reproduce test (RED) trước khi fix | “Slug trùng không retry” → viết test cho case đó đỏ trước |

## Mẫu test chuẩn (Arrange-Act-Assert)

```typescript
// src/lib/slug.test.ts
import { generateSlug } from "./slug";

describe("generateSlug", () => {
  it("tạo slug 6 ký tự alphanumeric", () => {
    // Arrange — không cần
    // Act
    const slug = generateSlug();
    // Assert
    expect(slug).toMatch(/^[a-zA-Z0-9]{6}$/);
  });

  it("không tạo trùng khi gọi 1000 lần", () => {
    const slugs = new Set(Array.from({ length: 1000 }, () => generateSlug()));
    expect(slugs.size).toBe(1000); // nếu trùng → bug
  });
});
```

## Anti-pattern cấm

* Test implementation detail (check `db.query` được gọi) → test state (check DB có row mới)
* Duplicate setup rườm rà → DAMP: mỗi test tự chứa story, không share quá nhiều
* Mock hết DB → test pass nhưng prod fail — chỉ mock external API/email

## Lệnh verify (mỗi slice chạy)

```bash
npm test              # chạy tháp test
npx tsc --noEmit      # type check
npm run build         # build pass
```

---
*Tiếp theo: `09_UIUX.md:1` — chỉ làm sau khi test xanh.*
