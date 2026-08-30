---
name: tdd
description: Implement or change behavior using a red-green-refactor loop, choosing focused unit, integration, or end-to-end tests and reporting evidence. Use for new logic, bug fixes, and behavior changes.
---

# Skill: Test-Driven Development

1. State the behavior and the smallest failing case.
2. Write a focused test that fails for the expected reason.
3. Implement the smallest correct change.
4. Run the focused test, then the relevant suite.
5. Refactor only after green; preserve behavior and keep the diff focused.
6. Report what the test proves and what it does not prove.

Do not defer tests for logic that is being changed. Prefer deterministic tests and real boundaries where mocks would hide integration errors.
