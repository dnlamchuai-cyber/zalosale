---
name: prompt-coaching
description: Teach the user to write precise coding prompts with context, scope, contracts, acceptance criteria, security, tests, and verification. Use when creating an implementation prompt or when the user wants to improve prompt-writing skill.
---

# Skill: Prompt Coaching

Use `docs/PROMPT_PATTERNS.md` and explain the purpose of each prompt block. Keep the locked stack explicit: TypeScript, React, Node.js/Express, PostgreSQL, and Prisma.

After showing one prompt, ask the user to draft the next prompt or one section of it. Review for ambiguity, scope leakage, missing acceptance criteria, missing security constraints, and missing evidence. Prefer coaching over replacing the user's attempt.
