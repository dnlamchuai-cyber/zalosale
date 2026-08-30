# vibe-coding-mcp — 1 MCP cho mọi IDE

## Cài (1 lần)

```bash
cd mcp-server && npm install && npm run build
# Test
node dist/index.js  # phai in "vibe-coding-mcp 0.1.0 running (stdio)"
```

## Nối với IDE

**OpenCode:** thêm vào `opencode.json`:
```json
{ "mcp": { "vibe-coding": { "command": "node", "args": ["./mcp-server/dist/index.js"] } } }
```

**Codex:** `~/.codex/config.toml`:
```toml
[mcp_servers.vibe-coding]
command = "node"
args = ["C:/path/to/beshort/mcp-server/dist/index.js"]
```

**Cursor / Windsurf / Antigravity:** `.cursor/mcp.json` hoặc `mcp.json`:
```json
{ "mcpServers": { "vibe-coding": { "command": "node", "args": ["./mcp-server/dist/index.js"] } } }
```

**Claude Desktop:** `claude_desktop_config.json` tương tự.

## Tools

`vibe_biz` (Pha 2) → `vibe_spec` → `vibe_prompt` (Pha 3) → `vibe_review` (Pha 4) → `vibe_handover` (Pha 5, có NEED_CONSENT cho GitHub)

Xem `docs/19_PLUGIN_MCP.md:1` và `docs/12_BAO_MAT.md:1`.
