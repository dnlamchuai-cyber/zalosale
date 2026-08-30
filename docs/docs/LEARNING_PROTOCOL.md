# Learning Protocol - Build Understanding While Shipping

## Default teaching loop

```text
Explain -> Show -> Ask user to predict -> Let user try -> Review -> Reuse
```

The agent should not turn every task into a lecture or always provide the complete answer immediately.

Use `docs/KNOWLEDGE_TRACKING.md` to remember whether each concept is `new`, `learning`, `known`, or `needs-review`. Use spaced repetition: briefly recall `known` concepts in later tasks, without repeating the full lesson every time.

## Assistance levels

1. Hint: ask a guiding question.
2. Skeleton: provide types, function shape, or test outline.
3. Example: show a nearby pattern from the project.
4. Full solution: provide implementation and explain the key decisions.

Start at level 1 or 2. Move up only when the user is blocked or explicitly asks for the full solution.

## Every completed slice

Teach one or two terms, trace the code path, explain one architectural choice, explain one testing/security lesson, and ask one retrieval question or give one tiny exercise.

## Every two or three slices

Let the user independently write one small part: acceptance criteria, a Zod schema, an Express route, a test, a database query, or the next implementation prompt. Review the attempt before continuing.

Skip this exercise when the user has already demonstrated the concept. Prefer a new exercise when the existing concept appears in a harder context.

## Independence signal

The user is progressing when they can explain the request flow, predict edge cases, choose an appropriate test level, and write a scoped prompt without copying a template blindly.
