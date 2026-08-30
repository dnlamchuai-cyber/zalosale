# Phase Gates - Mandatory Delivery Protocol

This protocol applies to every project and every feature. BeShort files are examples only.

Use `docs/workflow-state.example.json` as the shape for a task state file and run `npm run workflow:check` when a state file exists.

## State machine

```text
DRAFT -> APPROVED -> PLANNED -> IMPLEMENTING -> VERIFIED -> REVIEWED -> DONE
  ^         |            |           |              |           |
  +---------+------------+-----------+--------------+-----------+
                         BLOCKED / NEEDS-DECISION
```

An agent may not skip a state. A feature must be complete at one state before it moves to the next.

## Gates

| State | Required evidence | Who decides |
| --- | --- | --- |
| `DRAFT` | Problem, users, desired outcome, constraints, open questions | Agent facilitates |
| `APPROVED` | User-approved requirements, scope, and success criteria | User |
| `PLANNED` | Ordered tasks, one active task, dependencies, risks, acceptance criteria | User approves plan |
| `IMPLEMENTING` | Only the active task is changed; no unrelated refactor or next task | Agent executes |
| `VERIFIED` | Focused tests, relevant suite, build, type-check, lint, security, manual evidence | Agent reports evidence |
| `REVIEWED` | Review has no unresolved blocking findings; diff and scope are clean | User or authorized reviewer |
| `DONE` | Worklog, learning note, commit, and release decision recorded | User authorizes ship |

## One-task rule

Only one task may be `IMPLEMENTING` at a time. The task must describe one user-visible behavior or one enabling technical slice. Do not start the next task until the current task is `VERIFIED` and its user decision is recorded.

## Approval checkpoints

Stop and ask the user before changing product scope, architecture, database/data contracts, security posture, external access, destructive state, or release target. The agent may recommend one option, but the user owns the decision.

## Required checkpoint message

At every gate, report:

```text
State: DRAFT | APPROVED | PLANNED | IMPLEMENTING | VERIFIED | REVIEWED | DONE
Evidence: what was inspected or passed
Next step: the recommended action and why
User decision: the exact approval or choice required
Blocked by: missing information, if any
```

## Learning gate

After `VERIFIED` and before `DONE`, teach the completed task in three short parts: code behavior, architecture decision, and testing/security lesson. Ask one retrieval question or offer a tiny exercise so the user practices instead of only reading.

## Failure handling

If a test, build, review, or security check fails, move back to `IMPLEMENTING` for the active task. Do not hide failures, widen scope, or proceed to the next task. If a decision is missing, use `BLOCKED / NEEDS-DECISION` and ask one focused question.
