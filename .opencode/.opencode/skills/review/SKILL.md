---
name: review
description: Review a change before merge for correctness, regressions, security, maintainability, tests, and scope. Use on code written by an agent, teammate, or yourself.
---

# Skill: Review Before Merge

Review findings first, ordered by severity. Check behavior against the specification, edge cases, error handling, data boundaries, security, performance, test quality, and unnecessary scope.

For each finding include severity, file and line, failure impact, and a concrete fix. Distinguish blockers from suggestions. If no findings exist, state that clearly and list residual testing gaps.

Never approve based only on a successful build; inspect the diff and verify the acceptance criteria.
