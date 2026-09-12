<!--
Ai viết: Codex
Tại sao: Theo dõi một vertical slice có thể kiểm chứng độc lập.
Link: docs/04_PROMPTS/PROMPT-007_StickerSeparatedPosts.md
-->

# TASK-007 — Tách bài nguồn bằng sticker

> Trạng thái: ✅ Reviewed | Từ: PROMPT-007 | Ngày bắt đầu: 2026-09-07

## Checklist

- [x] Contract và test RED/GREEN cho batcher, gồm thứ tự xen kẽ text/ảnh.
- [x] Lịch sử và realtime cùng ưu tiên sticker làm ranh giới.
- [x] Full verification và review.

## Verify

- `npm test` PASS trước bổ sung footer regression; `node scripts/tests.mjs` PASS: 1563/1563.
- `npm run build` PASS: TypeScript check trong `web/` và Vite production build.
- `git diff --check` PASS.
- Root không có `tsconfig.json`; `npx tsc --noEmit` chỉ in trợ giúp và thoát mã 1. Kiểm tra TypeScript hợp lệ đã nằm trong `npm run build`.
- Không có `scripts/security-audit.ps1` trong repository để chạy audit script của kit.
- Không chạy thử Zalo thật và không thay đổi config/session người dùng.
