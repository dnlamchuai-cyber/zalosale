# Learning Map - TypeScript + React + Node.js/Express + PostgreSQL

This map turns each implementation slice into a practical lesson. Teach only the concepts needed by the current task, then ask the user to recall or apply one small idea.

## Learning loop

```text
Explain -> Show in project -> Ask user to predict -> Let user try -> Review -> Reuse
```

The agent must not only provide a finished solution. Prefer hints, then a skeleton, then a full solution when the user is blocked.

## Curriculum

| Area | Concepts to learn | Practice output |
| --- | --- | --- |
| TypeScript | type, interface, union, generic, narrowing, async types, Result/error types | Type a function and explain its boundary |
| React | component, props, state, event, form, hook, loading/error/empty states | Build or modify one focused component |
| HTTP | request, response, method, status, headers, JSON | Write acceptance criteria for an endpoint |
| Express | route, middleware, controller, service, error handler | Trace one request from route to database |
| Architecture | feature boundary, dependency direction, DTO, validation boundary | Explain why a function belongs in its layer |
| PostgreSQL | table, row, key, relation, index, constraint, transaction | Draw the data model for the current slice |
| Prisma | schema, migration, query, relation, generated client | Create and verify one migration/query |
| Testing | unit, integration, API, component, E2E, regression | Write one test before or alongside behavior |
| Security | validation, hashing, auth, authorization, CORS, rate limit, secrets | Name one threat and its mitigation |
| Delivery | environment, build, CI/CD, migration, health check, rollback | Write a deploy and rollback checklist |
| Prompting | context, goal, scope, constraints, acceptance, verification | Write the next task prompt independently |

## Per-task teaching contract

For every completed task, provide:

1. One or two new terms in plain language.
2. The code path and the key design decision.
3. The test/security lesson.
4. Why the implementation prompt was structured that way.
5. One retrieval question or tiny exercise.

Every two or three tasks, let the user implement a small part without a full answer first. Review the attempt and correct misconceptions before continuing.
