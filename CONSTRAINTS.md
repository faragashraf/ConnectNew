"}
# CONSTRAINTS.md

These rules are STRICT and must not be violated.

## Core Constraints

- No breaking API contracts (DTOs, responses, route keys)
- No refactoring unless explicitly requested
- No destructive database operations (DELETE, DROP, mass UPDATE)
- No auth bypass or disabling guards/interceptors
- No modification of auto-generated files without regeneration
- No removal of existing features or flows without approval

## Change Policy

- Always prefer minimal safe change
- Always preserve existing conventions
- Always verify impact before applying change

## Safety

- Always warn before any risky or destructive action
- Always highlight assumptions
- Always mention risks in output

Violation of these rules is not allowed