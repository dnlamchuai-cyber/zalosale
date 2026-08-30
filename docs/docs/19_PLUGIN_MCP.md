# 19 — PLUGIN & MCP: 1 server cho mọi IDE/agent (Codex, Antigravity, OpenCode, Cursor, Windsurf)

> **Kết luận:** Không cần viết plugin riêng cho từng IDE. Viết **1 MCP server (TS)** — mọi agent hỗ trợ MCP đều gọi được. OpenCode/Cursor/Windsurf/Codex/Antigravity đều đã hỗ trợ MCP.

## Kiến trúc

```
be-short/mcp-server/          # MCP server TS — nguồn chân lý
  ├── src/index.ts            # stdio transport, expose 5 tools
  └── src/tools/*.ts          # biz, spec, prompt, review, handover

Any IDE/agent  ──MCP stdio──►  mcp-server  ──►  docs/ (BIZ/SPEC/PROMPT/REVIEW)
  Codex         config.toml      5 tools       đọc/ghi file trong repo
  Antigravity   mcp.json
  OpenCode      opencode.json
  Cursor        .cursor/mcp.json
  Windsurf      .windsurf/mcp.json
  Claude        claude_desktop_config.json
```

**Tại sao MCP thay vì plugin native?**
* Plugin native: mỗi IDE 1 SDK, 1 store, 1 ngôn ngữ → 5x công sức.
* MCP: 1 chuẩn mở (Anthropic), mọi agent mới đều hỗ trợ → 1x công sức, auto tương thích IDE ra mắt sau.

## 5 tools MCP (map thẳng vào workflow 5 pha)

| Tool | Việc | Input | Output | Gọi khi |
|------|------|-------|--------|---------|
| `vibe_biz` | lay-yeu-cau — hỏi Socratic → sinh BIZ | `idea: string` | `BIZ-xxx.md` path + 5 câu hỏi | Pha 2 |
| `vibe_spec` | type-first → sinh SPEC | `bizPath: string` | `SPEC-xxx.md` + zod types | Pha 2 |
| `vibe_prompt` | tao-prompt → sinh PROMPT 6 khối | `specPath: string, taskName: string` | `PROMPT-xxx.md` | Pha 3 |
| `vibe_review` | 5-axis review | `prPath: string` | `REVIEW-xxx.md` + findings | Pha 4 |
| `vibe_handover` | checklist bàn giao | `version: string` | `12_HANDOVER` report | Pha 5 |

Mỗi tool **đọc `docs/_meta/PROJECT_CONTEXT.md`** trước, thiếu thì trả `MISSING_REQUIREMENT` bắt user điền — đúng `12_BAO_MAT.md:1` (hỏi consent trước khi fetch GitHub/API).

## Cài cho từng IDE (1 dòng)

**OpenCode:**
```json
// opencode.json
{ "mcp": { "vibe-coding": { "command": "node", "args": ["./mcp-server/dist/index.js"] } } }
```

**Codex (codex CLI):**
```toml
# ~/.codex/config.toml
[mcp_servers.vibe-coding]
command = "node"
args = ["C:/path/to/beshort/mcp-server/dist/index.js"]
```

**Antigravity / Cursor / Windsurf:**
```json
// .cursor/mcp.json  hoặc  ~/.config/antigravity/mcp.json
{ "mcpServers": { "vibe-coding": { "command": "node", "args": ["./mcp-server/dist/index.js"] } } }
```

**Claude Desktop:**
```json
// claude_desktop_config.json
{ "mcpServers": { "vibe-coding": { "command": "node", "args": ["./mcp-server/dist/index.js"] } } }
```

## Bảo mật

MCP server **không tự đọc** GitHub/API — tool nào cần external sẽ trả `NEED_CONSENT: {ask: "Bạn cho GitHub URL?"}` để agent hỏi user trước (`12_BAO_MAT.md:1`).

## Lộ trình

* **v0.1 (hiện tại):** Scaffold `mcp-server/` + 5 tools stub, chạy `npm run mcp:build` là mọi IDE gọi được.
* **v0.2:** Thêm `npm publish` → `npx vibe-coding-mcp` cho cài 1 lệnh.
* **v0.3:** Plugin store native (nếu cần UI): OpenCode plugin `opencode plugin add vibe-coding`.

---
*Chi tiết scaffold: `mcp-server/package.json:1` và `mcp-server/src/index.ts:1`.*

