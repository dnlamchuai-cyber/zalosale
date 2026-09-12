# PROMPT-006 — Hiển thị hoa hồng và ảnh trong bảng quét

> Trạng thái: ✅ Self-checked | Từ: TASK-006 | Ngày: 2026-09-04

## 1. Context

Node/Express backend và React/TypeScript frontend. Bảng hiện có `photos: number` nhưng chưa có URL, chưa có hoa hồng.

## 2. Một việc

Mở rộng kết quả scan và bảng `ScanReview` với cột hoa hồng `%` và thumbnail ảnh có lightbox.

## 3. Files IN/OUT

- IN: `src/processor.js`, `src/forwarder.js`, `src/listener.js`, community-check service, `web/src/components/ScanReview.tsx`.
- OUT: chỉ các file trên, test liên quan, `web/src/types.ts`, CSS và docs TASK/PROMPT.
- Cấm: đổi logic gửi, tải/lưu lại ảnh, thêm dependency.

## 4. I/O

```text
"HH: 20%. R79" → commissionPercent=20
item.normalUrl="https://.../a.jpg" → photoUrls=["https://.../a.jpg"]
```

## 5. Ràng buộc

- File ≤300 dòng, hàm ≤50 dòng; tên rõ; DRY/YAGNI; tách parse khỏi UI; header 3 Biết.
- URL chỉ `http/https`, dedupe, tối đa 8; ảnh lazy-load, no-referrer, alt text.
- Modal đóng bằng nút hoặc ESC; không thêm dependency.

## 6. Verify

- Focused RED/GREEN; full test; build/type-check; browser thật.
