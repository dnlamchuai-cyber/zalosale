---
name: debugging
description: Diagnose failing tests, builds, runtime behavior, API requests, or UI flows using evidence before changing code. Use when something is broken, unexpected, or unclear.
---

# Skill: Evidence-Driven Debugging

Follow `reproduce -> localize -> reduce -> fix -> regression test`.

Ask for or collect the exact reproduction, expected behavior, actual behavior, error output, stack trace, logs, and relevant environment. Use temporary structured logs when necessary, but never log secrets, tokens, passwords, or personal data. Remove or downgrade debug logging after the cause is fixed.

Do not guess, make unrelated refactors, or try random fixes. If the evidence is insufficient, state the missing evidence and recommend the smallest next diagnostic step.
