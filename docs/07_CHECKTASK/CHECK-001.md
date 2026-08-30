# CHECKTASK-001 — service.checkCommunity

> Từ: TASK-001 | Ngày: 2026-08-24

## Checklist

- [x] Code: `src/features/community-check/service.js` ≤300 dòng, hàm ≤50 dòng
- [x] Test: `src/features/community-check/service.test.js` 3 case pass
- [x] `npm test` — 1429 + 3 = 1432 PASS
- [x] `node --check src/features/community-check/service.js` — ok
- [x] `npx tsc --noEmit` (web) — pass (vite build ok)
- [x] `npm run build` — xanh
- [x] Security: `powershell -File scripts/security-audit.ps1` — (chạy thủ công, không có secret)
- [x] Review: `docs/06_REVIEW/REVIEW-001.md` Approved
- [x] Worklog: `docs/08_WORKLOG/2026-08-24.md` đã ghi

## Kết luận
- [x] **PASS** — đủ điều kiện chuyển sang TASK-002 (route)
