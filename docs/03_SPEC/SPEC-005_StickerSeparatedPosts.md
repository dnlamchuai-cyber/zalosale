<!--
Ai viết: Codex
Tại sao: Định nghĩa hợp đồng cấu hình và quy tắc sắp thứ tự, không đổi schema DB hay gọi thêm API Zalo.
Link: docs/02_BIZ/BIZ-004_StickerSeparatedPosts.md
-->

# SPEC-005 — Sticker-separated source posts

> Trạng thái: ✅ Approved | Từ: BIZ-004 | Ngày: 2026-09-07

## Contract

- `Batcher.add(threadId, item)` ưu tiên `chat.sticker`: flush đoạn trước, bỏ sticker và reset context.
- Tin mở cụm theo rule cũ đến sau prefix trong đoạn sticker sẽ được đặt trước prefix.
- Nếu tin mở cụm dài nằm ở cuối sau một hoặc nhiều phòng (không có sticker), gom các phòng đó thành một cụm và chỉ chuyển tin mở cụm lên đầu.
- Ngoài tin mở cụm được chuyển vị trí, không sắp xếp lại item: text/ảnh luôn giữ xen kẽ theo đúng thứ tự nguồn.
- Sau khi gửi hết các delivery unit của một cụm tới từng nhóm đích, gọi `sendClosingSticker` đúng một lần để gửi sticker người dùng đã set ở cuối.

## Files

```text
src/batcher.js                 segment and order source messages
src/history.js, src/listener.js use the shared segmentation rule
```

## Constraints

- Không migration, không dependency, không gửi reply giả sang Zalo.
- Chỉ dùng metadata `chat.sticker`, không OCR hoặc suy đoán ảnh.

## Bổ sung 2026-09-11 (vote user: gom chùm ảnh qua sticker)

- Sticker giữa các chùm **chỉ-có-ảnh** (active/pending/prefix đều không có chữ): bỏ qua sticker, gom tiếp thành một chùm.
- Sticker kề tin **có chữ** vẫn là ranh giới hết bài (giữ BR1).
- Sau sticker cắt cụm mở, `buildingContext` được giữ ở trạng thái stale: chùm ảnh sau sticker vẫn ăn theo nhóm đích của cụm mở; tin chữ tới sẽ chốt cụm cũ (giữ ngữ cảnh) rồi xử lý độc lập, nên mã phòng của tòa khác không lọt nhầm vào cụm cũ.
- Sau khi tách cụm, bước `attachOrphanPhotoBatches` gắn chùm chỉ-có-ảnh mồ côi (chỉ trong cùng run thời gian): tin mở reply trỏ ảnh nào thì ảnh về cụm mở đó (mở đứng đầu); ảnh lẻ cuối run gộp vào cụm có chữ trước nó; ảnh kẹp giữa 2 cụm chữ thì giữ nguyên để tránh gửi nhầm.
