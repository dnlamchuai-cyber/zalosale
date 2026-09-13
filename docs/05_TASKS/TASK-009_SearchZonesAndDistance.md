<!--
Ai viết: Codex
Tại sao: Đưa quy tắc bán kính vào service thuần có test trước khi phụ thuộc UI bản đồ.
Link: docs/03_SPEC/SPEC-006_MapRadiusSearch.md
-->

# TASK-009 — Vùng tìm trọ và tính khoảng cách

> Trạng thái: ✅ Reviewed | Từ: SPEC-006 | Phụ thuộc: TASK-008

## Mô tả

Lưu nhiều vùng cho một nhu cầu và kiểm chứng Haversine/matching; chưa cài Leaflet hay gọi geocoding.

## Acceptance criteria

- Tạo/sửa/tắt/xóa vùng hợp lệ 0,2–20 km; chặn quá 10 vùng hoặc vòng trùng.
- Hàm thuần trả phòng phù hợp khi điểm phòng nằm trong ít nhất một vùng đang bật.
- Một phòng khớp nhiều vùng chỉ xuất hiện một lần và giữ danh sách vùng khớp.

## Rủi ro / DoD

- Kiểm tra đơn vị meter/km và tọa độ biên bằng test xác định.
- Xong khi API/service tests, relevant suite, build, type-check, audit và review đều xanh.

## Evidence

- CRUD zones, quota/sở hữu và Haversine có test SQLite/pure function tại `src/features/customer-search/zones.test.js`.
- `npm test` passes: 1,641 script cases + 43 React tests; `npm run build` and `git diff --check` pass.
- Root `npx tsc --noEmit` has no root `tsconfig`; applicable TypeScript checking runs in `npm run build`.
- No dependency change in this slice; the current audit remains one Moderate advisory in `qs`, no High/Critical.
- Review: `docs/06_REVIEW/REVIEW-009.md`; checklist: `docs/07_CHECKTASK/CHECK-009.md`.
