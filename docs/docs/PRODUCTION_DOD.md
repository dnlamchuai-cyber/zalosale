# Production Definition of Done

The project is complete only when every applicable section passes and the user approves release.

## Product

- [ ] Approved requirements and acceptance criteria are satisfied.
- [ ] User flow covers success, loading, empty, validation, and failure states.
- [ ] Out-of-scope work is recorded, not silently added.

## Frontend

- [ ] React components are feature-oriented and typed.
- [ ] Responsive behavior and keyboard accessibility are checked.
- [ ] Component and browser tests cover critical flows.

## Backend

- [ ] Express routes validate input and delegate business rules.
- [ ] Services own use cases; persistence stays behind a boundary.
- [ ] PostgreSQL migrations, constraints, indexes, and transactions are reviewed.
- [ ] Errors are typed, safe, and observable without leaking internals.

## Security

- [ ] Authentication and authorization are explicit where required.
- [ ] Secrets are externalized; sensitive data is not logged.
- [ ] Input, output, dependency, CORS, headers, rate-limit, and abuse risks are assessed.
- [ ] Security tests and residual risks are documented.

## Delivery

- [ ] Production build, environment configuration, CI checks, and migration plan are verified.
- [ ] Staging smoke test, health check, monitoring, and rollback plan exist.
- [ ] Release is attributable, documented, and user-authorized.

## Learning

- [ ] Relevant glossary terms and architecture decisions are explained.
- [ ] Prompt structure and verification choices are understood.
- [ ] User completes a small retrieval exercise or writes the next prompt.
