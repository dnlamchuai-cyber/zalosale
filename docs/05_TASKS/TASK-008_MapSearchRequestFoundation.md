<!--
Ai viết: Codex
Tại sao: Chia BIZ-005 thành các vertical slice, bắt đầu từ dữ liệu nhu cầu để vùng tìm trọ có chủ sở hữu rõ ràng.
Link: docs/03_SPEC/SPEC-006_MapRadiusSearch.md
-->

# TASK-008 — Nền tảng khách và nhu cầu tìm trọ

> Trạng thái: ✅ Reviewed | Từ: SPEC-006 | Ngày tạo: 2026-09-12

## Mô tả

Tạo dữ liệu cục bộ và API cho khách cùng nhiều nhu cầu tìm trọ độc lập. Slice này chưa có bản đồ, tọa độ hoặc geocoding.

## Input / output

- Input: tên, số điện thoại và tiêu đề nhu cầu.
- Output: hồ sơ khách chuẩn hóa số điện thoại; mỗi khách có thể tạo, xem, đổi trạng thái hoạt động của nhiều nhu cầu.

## Acceptance criteria

- GIVEN một số điện thoại đã có WHEN tạo khách mới THEN API trả lại lỗi trùng an toàn, không ghi đè dữ liệu.
- GIVEN một khách WHEN tạo hai nhu cầu THEN cả hai nhu cầu được lưu độc lập và trả đúng theo khách.
- GIVEN dữ liệu không hợp lệ WHEN gọi API THEN API trả 400, không thay đổi SQLite và không ghi PII vào log.

## Rủi ro / phụ thuộc

- Phụ thuộc migration SQLite phải idempotent với database người dùng đang có.
- Không nhập toàn bộ CRM BIZ-003 vào slice này để tránh mở rộng phạm vi.

## Definition of Done

- Test service/route cho tạo, liệt kê và validation xanh.
- `npm test`, `npm run build`, `npx tsc --noEmit`, `node scripts/tests.mjs` và audit bảo mật liên quan có bằng chứng.
- Review không còn phát hiện chặn; worklog và learning note được ghi.

## Checklist

- [x] Contract và test RED/GREEN
- [x] Migration, repository, service và route
- [x] Review (docs/06_REVIEW/REVIEW-008.md)
- [x] Checktask (docs/07_CHECKTASK/CHECK-008.md)
- [x] Ghi worklog (docs/08_WORKLOG/2026-09-12.md)

## Kế tiếp khi TASK-008 verified

TASK-009: CRUD vùng + Haversine. Sau đó mới thêm bản đồ và định vị phòng, giữ đúng thứ tự logic → UI.

## Evidence

- Focused service and route tests pass; `git diff --check` passes for this slice.
- Full `npm test` passes: 1,641 script cases and 43 React tests.
- `npm run build` passes, including the frontend TypeScript check; `git diff --check` passes.
- Root `npx tsc --noEmit` has no root `tsconfig.json` and only prints compiler help; the applicable TypeScript check is included in `npm run build`.
- `scripts/security-audit.ps1` does not exist. `npm audit --omit=dev` reports one existing Moderate dependency advisory (`qs`), with no High/Critical result.
