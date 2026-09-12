<!--
Ai viết: Codex
Tại sao: Chốt cách xử lý nhóm nguồn đăng ảnh trước hoặc đúng thứ tự nhưng dùng sticker làm ranh giới.
Link: docs/03_SPEC/SPEC-005_StickerSeparatedPosts.md
-->

# BIZ-004 — Gom bài nguồn tách bằng sticker

> Trạng thái: ✅ Approved | Ngày: 2026-09-07 | Người duyệt: User

## User story

Là người vận hành zaloSALE, tôi muốn bot ưu tiên sticker để nhận diện ranh giới bài phòng, sau đó dùng tin mở cụm dài khi không có sticker.

## Business rules

- BR1: Sticker là ranh giới ưu tiên, áp dụng cho mọi nhóm nguồn và không được forward như ảnh phòng.
- BR2: Nếu tin dài mở cụm cũ xuất hiện cuối đoạn sticker, chỉ tin đó được đưa lên đầu; mọi tin/ảnh khác giữ nguyên thứ tự nguồn, kể cả xen kẽ nhãn phòng → ảnh → nhãn phòng → ảnh.
- BR3: Nếu tin dài mở cụm xuất hiện sau các phòng nhưng không có sticker, cũng chỉ đưa tin đó lên đầu cụm; các phòng và ảnh trước đó giữ nguyên thứ tự nguồn.
- BR4: Reply nguồn là dữ liệu phụ, không phải điều kiện để gom cụm.
- BR5: Sticker do người dùng set luôn được gửi sau toàn bộ text/album của từng cụm ở mỗi nhóm đích; không gửi sticker trước hoặc chen giữa cụm.

## Acceptance criteria

- GIVEN sticker → ảnh → tin dài → sticker THEN nhóm đích nhận tin dài → ảnh và không nhận sticker.
- GIVEN `P101 → ảnh P101 → P102 → ảnh P102 → tin mở cụm` THEN nhóm đích nhận `tin mở cụm → P101 → ảnh P101 → P102 → ảnh P102`.
- GIVEN tin dài → ảnh → sticker THEN nhóm đích giữ đúng thứ tự nguồn và sticker kết thúc cụm.
