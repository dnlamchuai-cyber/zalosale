# Copilot Instructions — Vibe Coding Kit (mirror AGENTS.md)

> GitHub Copilot / VS Code Chat đọc file này. Đồng bộ với AGENTS.md khi đổi.

**Stack:** Xem `docs/_meta/PROJECT_CONTEXT.md` + `docs/01_TECH_STACK.md` (TS+React+Fastify+Postgres+Dart)
**Workflow 5 pha:** `docs/00_WORKFLOW.md` — 1 TASK=1 slice=1 PR, logic trước UI (Pha 5)
**Context Loading (<2000 dòng):**
1. Đọc `PROJECT_CONTEXT.md` + `SPEC-xxx.md` liên quan
2. Đọc file sẽ sửa + 1 pattern mẫu
3. Thiếu spec → hỏi, không bịa
**Conventions:** Header 3 Biết bắt buộc (`docs/14_CODE_READING_GUIDE.md:2`), file ≤300 dòng, zod ở boundary, test colocated, commit `AI PROMPT-xxx` / `human @ten`
**Boundaries:** không đổi DB schema khi chưa review, không thêm dep khi chưa `npm audit`, không làm UI khi logic chưa xanh, KHÔNG tự tiện lấy GitHub/API/thông tin cá nhân — phải hỏi consent trước (docs/12_BAO_MAT.md:1)
**Skills:** `lay-yeu-cau` → BIZ+SPEC, `tao-prompt` → PROMPT 6 khối (xem `.opencode/skills/`)

