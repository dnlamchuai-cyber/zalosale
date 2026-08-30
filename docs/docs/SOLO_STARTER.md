# Solo Starter - 3 file la chay

> Dung khi ban lam 1 minh. Khong can install.ps1. Chi can 3 file toi thieu + global skills da co san.

## File 1: AGENTS.md

Copy tu kit nay sang du an moi. No la luat chung cho AI:

- tra loi ngan gon, uu tien hanh dong
- chon stack o Pha 1, DB chon sau BIZ/SPEC
- khong tu tien lay GitHub/API/thong tin ca nhan
- 1 TASK = 1 commit = 1 checkpoint

## File 2: docs/_meta/PROJECT_CONTEXT.md

Chi can dien:

- Ten du an
- 1 cau mo ta
- Muc tieu
- Core stack (FE/BE)
- DB de TBD luc dau, chon sau khi co BIZ/SPEC

## File 3: opencode.json

Noi voi OpenCode:

- dung 3 skill global: `/lay-yeu-cau`, `/tao-prompt`, `/hoc-tap`
- dung MCP `vibe-coding`

Mau toi thieu:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "skills": { "paths": ["C:/Users/Admin/.config/opencode/skills"] },
  "mcp": {
    "vibe-coding": {
      "type": "local",
      "command": ["node", "C:/Users/Admin/.config/opencode/mcp-server/dist/index.js"],
      "enabled": true
    }
  }
}
```

## Quy trinh solo

1. Tao repo moi
2. Copy `AGENTS.md`
3. Tao `docs/_meta/PROJECT_CONTEXT.md`
4. Tao `opencode.json`
5. Restart IDE
6. Go `/lay-yeu-cau` de bat dau feature dau tien

## Khong can lam

- Khong can copy toan bo docs neu chi lam solo nhanh
- Khong can cai skill lai neu da co global
- Khong can install.ps1 neu chi muon chay nhanh

## Khi nao can ban full kit

- Lam team
- Ban giao khach
- Can versioning + audit + handover day du
