# Integration Guide

The kit has two portable layers:

1. Always-loaded rules: copy `AGENTS.md` into the project root.
2. On-demand skills: expose `.opencode/skills/` through the agent's supported skills directory.

## Any project

Copy these items:

```text
AGENTS.md
docs/
.opencode/skills/
scripts/workflow-check.ps1
```

Then copy `docs/_meta/PROJECT_CONTEXT.template.md` to `docs/_meta/PROJECT_CONTEXT.md`, fill the project context, and choose `LEARNER`, `ENGINEER`, or `ADAPTIVE` mode.

## Tool adapters

- OpenCode: keep `.opencode/skills/` and `opencode.json`.
- Claude Code: keep `AGENTS.md`; expose skill folders through Claude's skills/plugin configuration.
- Codex: keep `AGENTS.md`; install the skill folders through the Codex skills/plugin mechanism.
- Cursor: keep `AGENTS.md`; map rules to `.cursor/rules/` and skills to `.cursor/skills/`.
- GitHub Copilot: keep `AGENTS.md`; mirror core rules into `.github/copilot-instructions.md`.
- Gemini CLI: keep `AGENTS.md`; expose the skill folders through Gemini project skills.
- Windsurf: keep `AGENTS.md`; map core rules into the project's Windsurf rules.
- Other agents: provide `AGENTS.md`, the relevant skill folders, and the relevant `docs/` files.

## Verify an installation

Give the agent a natural-language feature request and confirm that it:

- reads project context;
- identifies the current phase;
- recommends the next step;
- asks for approval at decision gates;
- works on one slice;
- reports test and security evidence;
- gives a short learning recap.
