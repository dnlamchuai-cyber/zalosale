# 22 — TEAM GUIDE: Solo hom nay, team ngay mai (khong doi kit)

> Ban dang solo — dung kit nhu team 1 nguoi. Khi co team, chi bat them 4 quy tac duoi day, khong can doi cau truc.

## 1. Solo vs Team — Khac gi?

|  | Solo (ban hien tai) | Team 3-5 nguoi |
|---|---|---|
| **Vai** | Ban lam ca 3 vai: Dev + Mentor (tu hoc) + PM (tu chia task) | Chia vai: 1 PM giu BACKLOG/BOARD, 2-3 Dev lam TASK, 1 Reviewer doc lap |
| **Branch** | `main` thang, 1 TASK = 1 commit, push len main luon cung duoc | `feat/BIZ-xxx` branch, 1 TASK = 1 PR, phai co REVIEW moi merge |
| **Review** | Tu review theo `06_REVIEW` 5-axis + `audit PASS` | Bat buoc nguoi khac review, AI review truoc, nguoi duyet sau |
| **Họp** | Khong can, worklog la du | Daily 15p: moi nguoi noi TASK dang lam + blocker; Retro 2 tuan/lan doc DECISIONS.md |

**Kit da ho tro ca 2:** Solo thi ban tu duyet BIZ/SPEC/PROMPT (tick Approved), team thi PM duyet.

## 2. Quy tac team (bat khi co nguoi thu 2)

**1. 1 TASK = 1 PR = 1 Reviewer khac nguoi code:**
```bash
# Dev A:
git checkout -b feat/BIZ-001-rut-gon
# ... lam TASK-001 → commit → push → tao PR → gan REVIEW-001 → request Dev B review
# Dev B: doc 06_REVIEW 5-axis + S1-S8 + header 3 Biet + cau truc 11_KIEN_TRUC
# → Approved moi merge vao main, tag v0.1.0
```

**2. BOARD la su that duy nhat:**
* PM giu `05_TASKS/BOARD.md` — Todo/Doing/Review/Done, WIP Doing ≤2/nguoi. Khong lam ngoai BOARD.

**3. Worklog + DECISIONS la hop dong team:**
* Moi PR phai link `07_WORKLOG/YYYY-MM-DD.md` + `DECISIONS.md:ADR-xxx`. Khach hoi "sao chon Fastify?" → mo ra, khong cai nhau.

**4. Consent + audit bat buoc truoc push:**
* Moi `gh push` phai qua `scripts/security-audit.ps1` PASS + hoi consent truoc khi lay GitHub/API (`12_BAO_MAT.md:1`). Pre-push hook da chan tu dong.

## 3. Onboard thanh vien moi (30p)

1. Clone repo → `install.ps1` (neu chua co) → `docker compose up -d` → `npm install`
2. Doc `AGENTS.md:9` (3 vai) + `00_WORKFLOW.md:1` (5 pha) + `15_HOC_VIBE.md:1` (hoc trong hoi thoai)
3. Chon 1 TASK Todo nho nhat (0.5 ngay) lam dau tien, go `/lay-yeu-cau` neu chua co BIZ
4. Tao PR dau tien, nho dong nghiep review theo `06_REVIEW` — hoc quy trinh qua PR that

## 4. Khi nao tu solo chuyen sang team?

* Khi co ≥2 nguoi cung code, hoac can ban giao cho khach co team bao tri → bat 4 quy tac tren, khong doi kit.
* Solo van nen lam nhu team: 1 TASK 1 commit, tu review, ghi worklog — de sau co team khong phai hoc lai.

---
*Lien quan: `00_WORKFLOW.md:5` (1 TASK 1 PR) → `17_GIT_VERSIONING.md:3` (branch + tag) → `14_CODE_READING_GUIDE.md:5` (ai viet) → `12_BAO_MAT.md:1` (audit chan push).*
