# Prompt Patterns - Locked Stack

Use these patterns as teaching examples. Every implementation prompt must name the current stack: TypeScript, React, Node.js/Express, PostgreSQL, and Prisma.

## Feature implementation

```text
Context: [project goal, current architecture, relevant files]
Goal: [one user-visible behavior]
Scope: [exact files and behavior allowed]
Out of scope: [explicitly excluded work]
Contract: [input, output, endpoint, data changes]
Acceptance criteria: [Given/When/Then cases]
Edge cases: [invalid, empty, duplicate, unauthorized, failure cases]
Security: [validation, auth, authorization, secrets, abuse limits]
Tests: [unit, API, component, or E2E cases]
Verification: npm test; npm run build; npx tsc --noEmit
Learning objective: [terms and technique the user should understand]
```

## Debugging

```text
Observed behavior: [what works and what fails]
Reproduction: [exact steps and input]
Evidence: [full error, stack trace, logs, screenshot]
Constraints: preserve locked stack and current API contract
Process: reproduce -> localize -> reduce -> fix -> regression test
Security: do not log secrets or personal data
Verification: [commands and expected result]
```

## Prompt coaching

After generating a prompt, explain why `Context`, `Scope`, `Out of scope`, `Acceptance criteria`, and `Verification` are present. Invite the user to write the next prompt using the same structure before providing a full answer.
