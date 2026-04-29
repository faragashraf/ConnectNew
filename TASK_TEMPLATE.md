# TASK_TEMPLATE.md

Use this template for future implementation tasks in this repository.

```md
Task: <describe the required change clearly>

Repository: Connect
Branch: <branch-name>

Before starting:
- Do NOT write code immediately.
- First explain your understanding of the current implementation.
- Then list impacted files.
- Then apply the minimal safe change.

Execution rules:
1. Understand current implementation first.
   - Inspect the real flow before editing.
   - Trace only the relevant path:
     - UI/component
     - frontend service/client
     - backend controller/service
     - persistence/repository
   - Reuse existing patterns in the touched module.

2. Identify impacted files before coding.
   - List exact files to change.
   - Call out contract-touching files explicitly:
     - DTOs
     - controllers
     - services
     - API clients
     - route metadata
     - guards
     - cache invalidation hooks
     - tests

3. Apply minimal safe change.
   - Keep modifications surgical and localized.
   - Preserve existing conventions:
     - Arabic/RTL behavior
     - route `data.func` / `configRouteKey`
     - `CommonResponse<T>`
     - auth / interceptor behavior
     - cache invalidation behavior
   - Do not introduce unrelated refactors.
   - Do not rename stable identifiers unless necessary.

4. Preserve repository conventions.
   - Keep technical identifiers in English.
   - Keep user-facing text consistent with existing Arabic UI style.
   - Keep encoding safe for Arabic text.
   - Do not hand-edit auto-generated files unless regeneration is part of the task.

5. Verification and risk reporting.
   - Run relevant build/tests for changed scope.
   - Provide a short report with:
     - changed files
     - behavior summary
     - risks/regressions to watch
     - assumptions
     - what was verified

Required output format:
1. Current understanding
2. Impacted files
3. Implemented change
4. Verification
5. Risks / assumptions