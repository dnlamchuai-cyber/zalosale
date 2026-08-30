# PROMPT-XXX — [Mô tả ngắn 1 việc]

> Trạng thái: ✅ Self-checked | Từ: SPEC-XXX | Ngày:

## 1. Context
Stack: TS + React + Node (Express) + Postgres | Dùng `@file` để gắn SPEC/TASK.

## 2. Yêu cầu (1 việc duy nhất)
...

## 3. Files IN/OUT
- IN (chỉ đọc): `src/...`
- OUT (được sửa): `src/features/...`
- CAM sửa: không đụng file ngoài danh sách.

## 4. Ví dụ I/O
```
Input: ...
Output: ...
```

## 5. Ràng buộc (thợ code + kiến trúc)
- File ≤ 300 dòng, hàm ≤ 50 dòng, 1 hàm 1 việc
- Tên biến/hàm rõ nghĩa (không data/tmp)
- Không magic number (hằng số + WHY)
- Early return, DRY (3 lần lặp → tách), YAGNI
- Header 3 Biet: file này làm gì / nhận gì / trả gì

## 6. Verify
- [ ] `npm test` xanh
- [ ] `npx tsc --noEmit`
- [ ] `npm run build`
