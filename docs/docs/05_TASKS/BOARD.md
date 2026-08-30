# BOARD � Kanban theo d�i ti?n d?

> Ngu?n ch�n l� cho PM. M?i TASK l� 1 th?. Ch? k�o th? khi d?t DoD.
> Quy t?c: WIP =2 th? ? Doing � l�m �t, xong nhanh, demo s?m.

## C?t

| Todo | Doing (WIP =2) | Review | Done |
|------|----------------|--------|------|
| TASK chua l�m, d� c� spec Approved | �ang code + test | �ang review 5-axis | �� merge + worklog |
| | | | |

## BeShort � Board hi?n t?i (c?p nh?t m?i ng�y)

| M� | T�n | Uu ti�n | Tr?ng th�i | Ngu?i l�m | Ghi ch� |
|----|-----|---------|------------|-----------|---------|
| TASK-001 | DB schema links + migration | P0 | Done | AI + user review | Commit + migration da pass |
| TASK-002 | POST /api/links (t?o slug) | P0 | Done | AI + user review | 5 tests pass, tag v1.0 |
| TASK-003 | GET /:slug redirect + click log | P0 | Todo | � | Xong l� demo du?c lu?ng Guest |
| TASK-004 | Rate limit + blacklist | P1 | Todo | � | Hardening tru?c public |
| TASK-005 | Auth (register/login) | P1 | Todo | � | Sau P0 xong |
| TASK-006 | Dashboard list links | P1 | Todo | � | C?n Auth |
| TASK-007 | UI form r�t g?n (Pha 5) | P1 | Todo | � | Ch? sau khi logic xanh |
| TASK-008 | Click analytics chart | P2 | Idea | � | � |

## C�ch d�ng cho team

1. **Daily:** M?i dev ch?n 1 th? t? Todo ? k�o sang Doing, di?n `TASK-xxx.md`.
2. **Khi xong code:** K�o sang Review, g?n `REVIEW-xxx.md`.
3. **Khi review pass + worklog:** K�o sang Done, **git commit + git push ngay** (17_GIT_VERSIONING.md:3), AI g?i � next step (xem `TASK-_TEMPLATE.md:8`).
4. **Khi xong 1 BIZ:** `git tag -a v0.X.0 -m "BIZ-xxx Done"` + `git push origin v0.X.0` � demo cho kh�ch.
5. **PM:** Cu?i tu?n d?m th? Done + tags, c?p nh?t BACKLOG.

## G?i � next step t? d?ng (AI di?n khi 1 TASK Done)

> V� d? khi TASK-003 Done, AI s? g?i �:
> - A (khuy�n): TASK-004 Rate limit � v� P0 v?a xong, c?n hardening tru?c khi public
> - B: Nh?y sang Auth � n?u mu?n demo Member s?m
> - C: L�m UI form � n?u mu?n feedback UX s?m (nhung vi ph?m �logic tru?c UI�)
>
> **User quy?t d?nh cu?i c�ng** � AI ch? ph�n t�ch trade-off. ��y l� c�ch b?n h?c qu?n l� d? �n.

---
*Link: `BACKLOG.md:1` (danh s�ch BIZ) ? `BOARD.md` (danh s�ch TASK) ? `TASK-xxx.md` (chi ti?t)*
