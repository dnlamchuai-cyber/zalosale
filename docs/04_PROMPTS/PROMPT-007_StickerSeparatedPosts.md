<!--
Ai viết: Codex
Tại sao: Prompt thực thi lát nhỏ, kiểm soát phạm vi thay vì đổi toàn bộ logic forward.
Link: docs/03_SPEC/SPEC-005_StickerSeparatedPosts.md
-->

# PROMPT-007 — Sticker-separated source posts

> Trạng thái: ✅ Self-checked | Từ: SPEC-005 | Ngày: 2026-09-07

## Context

Node.js bot và React web giữ stack hiện có. Thực hiện BIZ-004/SPEC-005.

## Scope

Ưu tiên sticker ở mọi nhóm nguồn; bỏ sticker nguồn và chỉ đưa tin dài mở cụm cuối đoạn lên đầu. Khi tin mở cụm nằm sau các phòng không có sticker, cũng chỉ đưa tin đó lên đầu. Không bao giờ dồn text thành một lượt riêng: nhãn phòng và ảnh phải giữ nguyên thứ tự nguồn. Sticker người dùng set phải được gửi sau delivery unit cuối cùng của mỗi cụm.

## Verify

- Unit: batcher realtime, segment lịch sử, mẫu `P101 → ảnh → P102 → ảnh → mở cụm`.
- Full: `npm test`, `npm run build`, `npx tsc --noEmit`.

## Constraints

File nhỏ, tên rõ nghĩa, không dependency mới, metadata sticker là boundary duy nhất, không log nội dung riêng tư.
