# PROJECT_CONTEXT � Template (copy khi t?o d? �n m?i)

> �i?n file n�y r?i copy th�nh `PROJECT_CONTEXT.md`. M?i agent s? d?c n� d?u ti�n.

## 1. Project Info
- **T�n d? �n:** {{PROJECT_NAME}}
- **One-liner:** {{ONE_LINER}} � m� t? 1 c�u d? �n l�m g�
- **M?c ti�u ch�nh:** {{GOAL}}
- **�?i tu?ng:** {{AUDIENCE}}

## 2. Tech Stack

- **Stack mode:** LOCKED � agent must not change the stack without explicit user approval

- **Frontend:** {{FRONTEND}} � recommended: TypeScript 5 + React 18 + Vite
- **Backend:** {{BACKEND}} � recommended: TypeScript + Node.js 22 + Express
- **Database:** {{DATABASE}} � recommended: PostgreSQL 16 + Prisma
- **Mobile:** {{MOBILE}} � vd: Dart + Flutter 3.x / ho?c N/A
- **Auth/Storage:** {{AUTH_STORAGE}}
- **Test:** {{TEST}}
- **Deploy:** {{DEPLOY}}

> G?i �: copy 1 preset t? `STACK_PRESETS/` cho nhanh.

## 3. Constraints & Quy u?c

- {{CONSTRAINT_1}}
- M?i l?n ch? l�m 1 ch?c nang nh?
- Kh�ng l�m UI khi logic chua pass
- Kh�ng t? � d?i framework, database, ORM, language ho?c deployment provider khi `Stack mode` l� `LOCKED`
- N?u c?n th�m dependency, gi?i th�ch l� do, trade-off, bundle/security impact v� ch? user duy?t

## 4. Li�n k?t

- Workflow: `docs/00_WORKFLOW.md`
- Tech chi ti?t: `docs/01_TECH_STACK.md`
- Learning map: `docs/LEARNING_MAP.md`
