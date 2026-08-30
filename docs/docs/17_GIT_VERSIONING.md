# 17 � GIT VERSIONING: Sau m?i ch?c nang nh? pass ? push d? luu phi�n b?n

> **Nguy�n t?c th?y:** 1 TASK Done = 1 commit = 1 push = 1 checkpoint rollback du?c. Kh�ng push = chua luu, m?t m�y l� m?t h?t.
> D�nh cho team 1-10 ngu?i, �p d?ng trunk-based don gi?n � kh�ng ph?c t?p nhu GitFlow.

---

## 1. T?i sao ph?i push ngay khi pass?

| Kh�ng push | Push ngay |
|------------|-----------|
| M?t di?n, h?ng m�y ? m?t c? ng�y code | Remote d� c�, clone l?i l� xong |
| Mu?n th? � tu?ng m?i ? s? h?ng code cu, kh�ng d�m d?ng | Push r?i ? t? tin t?o branch th?, h?ng th� `git reset --hard` v? checkpoint |
| `git blame` kh�ng bi?t ai vi?t | `git log` ghi r� `AI PROMPT-xxx` hay `human @ten` � truy du?c prompt n�o gen ra bug |
| Kh�ch h?i "b?n h�m qua ch?y du?c d�u?" ? kh�ng c� | Tag `v0.1.0-BIZ-001` ? checkout l?i demo ngay |

---

## 2. Chu?n commit � 1 d�ng l� bi?t ai, l�m g�, t? d�u

```bash
# C� ph�p: <type>(scope): <AI|human> <PROMPT/TASK> � <m� t? 1 c�u>
# type: feat | fix | refactor | docs | chore

feat(links): AI PROMPT-001 � POST /api/links tao slug (TASK-002)
fix(links): human @tu � retry slug 3 lan (REVIEW-001:2)
docs(biz): human @pm � duyet BIZ-001 (Approved 2026-08-22)
chore(git): tag v0.1.0 � BIZ-001 Done, demo cho khach
```

**Quy t?c:**
* **1 TASK = 1 commit** � kh�ng g?p 3 TASK v�o 1 commit (`incremental-implementation` Rule 1)
* **Ghi r� ngu?n:** `AI PROMPT-xxx` hay `human @ten` � d? `git blame src/routes/links.ts:15` l� bi?t d�ng d� AI gen theo prompt n�o ? m? prompt s?a, kh�ng do�n
* **Kh�ng commit `.env`, `node_modules`, `dist`** � d� c� `.gitignore:1`

---

## 3. Workflow Git cho vibe code (trunk-based, don gi?n nh?t)

```
main (luon chay duoc, luon deploy duoc)
  �
  +- feat/BIZ-001-rut-gon (branch cho 1 BIZ, tach tu main)
  �     +- TASK-001 DB schema � commit ? push
  �     +- TASK-002 POST /api/links � commit ? push
  �     +- merge vao main (qua PR + REVIEW) ? tag v0.1.0
  �
  +- feat/BIZ-002-redirect (branch tiep theo)
  �     +- ...
  +- main ? deploy
```

**L?nh cho 1 TASK (copy d�n) � co security audit chan push neu ho:**

```bash
# 1. Bat dau TASK moi (tu main moi nhat)
git checkout main && git pull
git checkout -b feat/TASK-002-post-links  # ho?c dung chung feat/BIZ-001

# 2. Code + test xanh + security audit (BAT BUOC truoc push)
npm test && npx tsc --noEmit && npm run build
powershell -ExecutionPolicy Bypass -File scripts/security-audit.ps1  # S1-S8 + consent (12_HANDOVER + 18_PRIVACY)
# hoac: bash scripts/security-audit.sh
# ? FAIL thi sua theo S1-S8 roi chay lai, khong duoc --no-verify

# 3. Commit 1 TASK = 1 commit
git add src/features/links/links.route.ts src/features/links/links.service.ts src/lib/slug.ts prisma/schema.prisma
git commit -m "feat(links): AI PROMPT-001 � POST /api/links tao slug (TASK-002)"

# 4. Push ngay � checkpoint (pre-push hook se tu chay audit lai, FAIL thi chan push)
git push -u origin feat/TASK-002-post-links
# ? t?o PR, g?n REVIEW-002, worklog, ch? duy?t

# 5. Merge xong ? tag phi�n b?n (khi xong 1 BIZ)
git checkout main && git pull
git tag -a v0.1.0 -m "BIZ-001 rut gon URL � P0 Done, demo 2026-08-22"
git push origin v0.1.0
```

**Khi n�o tag?**
* `v0.1.0` � xong BIZ-001 (P0 d?u ti�n, demo du?c)
* `v0.2.0` � xong BIZ-002 (redirect)
* `v1.0.0` � xong h?t P0, b�n giao kh�ch (`12_BAO_MAT.md:1` pass)

---

## 4. Checklist sau khi 1 ch?c nang nh? pass (kh�ng ch? push)

> Sau khi `npm test` xanh cho 1 TASK, ch?y checklist n�y **tru?c khi** sang TASK m?i � tick h?t m?i t�nh Done.

- [ ] **Verify:** `npm test` + `npx tsc --noEmit` + `npm run build` xanh (00_WORKFLOW.md Pha 3 DoD)
- [ ] **Security audit:** `scripts/security-audit.ps1` PASS (S1-S8 + consent 18_PRIVACY) � pre-push hook se chan neu FAIL
- [ ] **Review:** `06_REVIEW/REVIEW-xxx.md` � 0 Critical, header 3 Bi?t d? (`14_CODE_READING_GUIDE.md:7`), cau truc chuan `11_KIEN_TRUC.md:4`
- [ ] **Worklog:** Ghi `07_WORKLOG/YYYY-MM-DD.md` � d� l�m/h?c du?c/quy?t d?nh + g?i � next step (AI h?i, b?n ch?n)
- [ ] **Board:** K�o `TASK-xxx` sang Done trong `05_TASKS/BOARD.md:1`
- [ ] **Commit:** 1 commit d�ng c� ph�p tr�n, `git log --oneline -5` th?y r� AI/human
- [ ] **Push:** `git push` ngay � ki?m tra GitHub d� c� commit
- [ ] **Tag (n?u xong BIZ):** `git tag -a vX.Y.Z -m "..."` + `git push origin vX.Y.Z`
- [ ] **Demo:** Quay m�n h�nh 30s ho?c `curl` demo cho PM/kh�ch (luu v�o `07_WORKLOG`)
- [ ] **D?n:** X�a branch d� merge n?u kh�ng c?n (`git branch -d feat/...`)

**C�n g� n?a ngo�i push?** 8 th? tr�n � push ch? l� 1 trong 9. Thi?u worklog/board th� 1 tu?n sau kh�ng nh? t?i sao ch?n v?y.

---

## 5. H?c d? t? qu?n Git sau n�y

| C�u h?i | Tr? l?i nhanh | H?c s�u |
|---------|---------------|---------|
| T?i sao 1 TASK 1 commit? | D? revert, d? blame, d? review 15p thay v� 2h | `incremental-implementation` Rule 1,5 |
| Khi n�o d�ng branch? | M?i BIZ 1 branch, m?i TASK c� th? chung branch BIZ � kh�ng c?n branch cho m?i TASK n?u TASK <1 ng�y | Trunk-based vs GitFlow � h?i AI `So s�nh trunk-based vs GitFlow khi n�o d�ng?` |
| M?t code th� sao? | `git reflog` ho?c checkout tag g?n nh?t | `15_HOC_VIBE.md:D` Beaver debug |
| Mu?n th? � tu?ng r?i ro? | T?o `wip/thu-nghiem` t? checkpoint d� push, h?ng th� b? | `git checkout -b wip/...` |

**B�i t?p:** Sau TASK-002, th? `git log --oneline --graph --all` v� `git blame src/lib/slug.ts:10` � th?y r� ai vi?t d�ng n�o?

---

## 6. C�i d?t 1 l?n cho repo m?i

```bash
git init
git config commit.template .gitmessage  # (optional) template commit
git config core.hooksPath .githooks     # bat pre-push audit S1-S8 (chan push neu ho bao mat)
echo "v0.1.0" > .gitignore  # d� c� � kh�ng commit .env
git add AGENTS.md docs/ .opencode/ scripts/ .githooks/ && git commit -m "chore(kit): cai Vibe Coding Kit v1.0"
git remote add origin https://github.com/you/beshort.git
git push -u origin main  # pre-push se chay audit, FAIL thi chan
```

*Kit d� c� `.gitignore:1` � ch? c?n `git init` nhu tr�n.*

---
*Li�n quan: `00_WORKFLOW.md:4` (Pha 4) ? `14_CODE_READING_GUIDE.md:5` (ai vi?t) ? `07_WORKLOG/2026-08-22.md:1` (ghi quy?t d?nh).*
