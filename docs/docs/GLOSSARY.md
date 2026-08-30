# Practical Engineering Glossary

Use the smallest explanation needed for the current task. For each term, connect the definition to this project's TypeScript, React, Express, PostgreSQL stack.

## Endpoint

- Simple meaning: a specific API address and method that performs an operation.
- Example: `POST /api/links`.
- Prompt usage: name the method, path, input, output, status codes, and failure cases.
- Check: what validates the request, and which service handles the business rule?

## Route

- Simple meaning: Express code that maps an HTTP method and path to a handler.
- Prompt usage: specify whether the route only validates/delegates or contains business logic.

## Middleware

- Simple meaning: code that runs during the request pipeline before the final handler.
- Examples: authentication, request logging, error normalization.

## Service

- Simple meaning: code that owns a business rule or use case.
- Prompt usage: state the rule the service must enforce and how it reports failure.

## Migration

- Simple meaning: a versioned, reviewable change to the PostgreSQL schema.
- Prompt usage: describe the schema change, constraints, indexes, data safety, and rollback concern.

## Authentication vs authorization

- Authentication asks: who is this user?
- Authorization asks: may this user perform this action?
- Check: a valid login does not automatically grant access to every resource.

## Unit, integration, and E2E test

- Unit: one function or module in isolation.
- Integration: multiple real boundaries working together, such as Express plus PostgreSQL.
- E2E: a user flow through the browser and backend.
- Prompt usage: choose the smallest test level that proves the behavior without hiding boundary failures.

## Acceptance criteria

- Simple meaning: observable conditions that define when a behavior is correct.
- Format: `Given [context], When [action], Then [observable result]`.

## Context, scope, and verification

- Context tells the agent what already exists.
- Scope tells it what it may change.
- Verification tells it how to prove the change works.
- Missing any one of these increases guessing and uncontrolled changes.
