Always respect rules defined in CONSTRAINTS.md

# AGENTS.md

## 🔴 Agent Priority Rules (Read First)

When working on this repository, always follow these rules strictly:

1. Always prefer **minimal safe change** over refactoring.
2. Never break existing API contracts, DTO shapes, route keys, claim names, or response envelopes unless explicitly requested.
3. Always inspect the current implementation before writing code.
4. Do not introduce new patterns, abstractions, or architectures unless explicitly requested.
5. Always preserve:
   - Arabic UI behavior
   - RTL layout
   - existing encoding behavior
   - route permission metadata (`func`, `configRouteKey`, `roleId` when present)
6. Never modify auto-generated files unless regeneration is part of the task.
7. Always report:
   - changed files
   - behavior impact
   - risks / assumptions
   - verification steps
8. If backend contract changes, update dependent frontend usage in the same task.
9. If unsure, do not guess. State the uncertainty clearly and verify from code first.
10. Never perform destructive actions without explicit approval.

---

## ⚡ Quick Context (TL;DR for Agents)

- Monorepo: Angular frontend + .NET backend
- Main domains in this branch: Control Center Catalog, Dynamic Subjects, Request Runtime Catalog, Summer Requests
- Frontend style: Arabic-first, RTL, PrimeNG-heavy
- Frontend auth/route protection: `AuthNewGuardService` + route metadata
- Backend API envelope: `CommonResponse<T>`
- Backend data: EF Core + SQL Server, plus Oracle context in selected areas
- Change strategy: minimal, surgical, compatibility-safe changes only
- Do not bypass cache invalidation, auth, or encoding safeguards

---

## Project Overview

- Monorepo for the `Connect` internal platform with:
  - Angular frontend (`ENPO.Connect.Frontend`)
  - ASP.NET Core backend (`ENPO.Connect.Backend`)
- Core active domains in this branch include:
  - Dynamic Subjects + Admin Control Center Catalog
  - Request Runtime Catalog
  - Summer Requests workflow
- Arabic-first UI and RTL layout are first-class concerns.

---

## Repository Structure Summary

- `ENPO.Connect.Frontend/`
  - `src/app/Modules/`: feature modules (`admin-control-center-catalog`, `dynamic-subjects`, `request-runtime-catalog`, `EmployeeRequests`, etc.)
  - `src/app/shared/services/BackendServices/`: frontend API clients + DTOs
  - `src/app/shared/services/helper/`: auth guard, interceptors, shared helpers
  - `tools/`: NSwag + service index + DTO shaping + encoding scripts
  - `ENCODING_GUIDELINES.md`: Arabic text/encoding guardrails

- `ENPO.Connect.Backend/`
  - `Api/`: controllers, auth wiring, startup, hosted services
  - `Persistence/`: DbContexts, services, repositories, migrations
  - `Models/`: entities and DTOs (`CommonResponse<T>`)
  - `Core/`: shared interfaces (including legacy `IUnitOfWork`)
  - `Tests/Persistence.Tests/`: xUnit backend tests
  - `scripts/`: test/diagnostic scripts

- `docs/architecture/`
  - active architectural guardrails for Control Center and Summer domains

---

## Frontend Conventions

### Stack and config
- Angular `15.x`, TypeScript strict mode enabled (`strict`, `strictTemplates`)
- SCSS styling
- Angular schematics default to `skipTests: true`
- Hash location strategy is enabled (`HashLocationStrategy` in `app.module.ts`)

### Routing and modules
- App-level lazy loading from `src/app/app-routing.module.ts`
- Feature modules under `src/app/Modules/*` with dedicated routing modules
- Route `data.func` and sometimes `data.configRouteKey` are used by guards/runtime config logic

### Auth and HTTP behavior
- `AuthNewGuardService` checks `ConnectToken` + `ConnectFunctions`
- Guard authorization is driven by route data (`func`, sometimes `roleId`)
- `BasicInterceptorService` handles:
  - bearer token attachment
  - skip-auth URL patterns
  - 401 token refresh via SignalR
  - auth redirect / signout flow
- `ApiResponseFeedbackInterceptor` surfaces backend `CommonResponse` and HTTP errors as Arabic notifications

### API client layer
- `shared/services/BackendServices/*` client classes commonly use `*Controller` naming
- `environment.ConnectApiURL` is the base API host for most clients
- `shared/services/BackendServices/index.ts` is auto-generated (`tools/generate-backendservices-index.js`)

### Encoding and localization
- Repo/editor config uses UTF-8 BOM + CRLF defaults
- Arabic UI strings are common; preserve encoding and existing phrasing
- For `EmployeeRequests` edits, run `npm run check:text-encoding`

---

## Backend Conventions

### Stack
- .NET `net6.0` solution with `Api`, `Persistence`, `Models`, `Repositories`, `Core`
- EF Core with SQL Server (`ConnectContext`, `Attach_HeldContext`) + Oracle (`GPAContext`)

### API behavior
- Global authorization filter is enabled in `Program.cs` (`AuthorizeFilter` on controllers)
- JWT auth configured centrally
- Auth error codes may be surfaced via `X-Auth-Error-Code`
- Most APIs return `Models.DTO.Common.CommonResponse<T>`
- Current user is commonly read from claim type `"UserId"`

### Domain service organization
- Dynamic Subjects uses split services under:
  - `Persistence/Services/DynamicSubjects/AdminCatalog`
  - `Persistence/Services/DynamicSubjects/AdminRouting`
  - `Persistence/Services/DynamicSubjects/AdminAccessPolicy`
  - `Persistence/Services/DynamicSubjects/RuntimeCatalog`
  - `Persistence/Services/DynamicSubjects/FieldAccess`
- Summer workflow orchestration is in `Persistence/Services/SummerWorkflowService.cs`
- Summer helpers exist under `Persistence/Services/Summer/*`

### Startup and infrastructure
- `Program.cs` applies pending `ConnectContext` migrations at startup using SQL app-lock
- Startup also runs schema compatibility checks for `SubjectReferencePolicies`
- Request preview caching exists via Redis (`AdminControlCenterRequestPreviewCache`)

---

## Routing And Guard Patterns

### Frontend
- Root routes lazy-load modules and include redirect aliases, including old `Admin/ControlCenter` aliases
- Common guard pattern:
  - `canActivate: [AuthNewGuardService]`
  - permission metadata in route `data`
- `Admin/ControlCenterCatalog` routes require `ConnectSupperAdminFunc`
- `DynamicSubjects` uses a shell route + child routes and route-level `configRouteKey`
- `EmployeeRequests` Summer paths come from `SUMMER_FEATURE_ROUTES` constants

### Backend
- Mixed route style exists:
  - legacy action-name routes (`[Route(nameof(Method))]`)
  - newer REST-like admin/runtime routes (`Applications`, `Categories/{id}`, etc.)
- Dynamic Subjects admin policy is centralized via:
  - `DynamicSubjectsAdminAuthorization`
  - `DynamicSubjectsAdminClaimGuard`

---

## UI/Component Conventions

- PrimeNG is centralized via `shared/Modules/primeng.module.ts`
- Control Center templates heavily use `p-dropdown` with `appendTo="body"` to avoid overlay clipping
- RTL is heavily enforced in global styles (`src/styles.scss`, `src/assets/styles/app.scss`)
- Arabic labels/messages are standard for user-facing text
- Reactive forms are widely used for admin/runtime workspaces
- In Summer feature docs, technical keys/tokens remain English; Arabic is for user-facing text

---

## Data/Database Safety Rules

- Do not assume hard-delete is safe
- Example: category delete in `DynamicSubjectsAdminService` soft-disables (`CatStatus = true`) when linked data exists
- Hard-delete paths exist only after dependency checks
- Prefer diagnostics-before-delete endpoints where available (`DeleteDiagnostics` patterns in admin catalog)
- Preserve cache invalidation behavior for admin catalog/routing/access policy changes (`IAdminControlCenterRequestPreviewCache.InvalidateAllAsync`)
- `ConnectContext.SaveChanges/SaveChangesAsync` tracks `Message` field changes into `MessageHistory`; do not bypass context save behavior casually

### Migration safety
- Treat migrations as high risk
- Startup auto-applies pending migrations
- Avoid destructive migrations without explicit approval and rollback plan

### Database action rules
- Prefer read-only investigation first
- Never run destructive SQL without explicit approval
- Never mass-update production-like data without strict filters and confirmation

---

## Change-Management Rules

- Prefer minimal, surgical changes in existing modules/services
- Preserve existing route keys, claim names, DTO shapes, and `CommonResponse<T>` envelope contracts
- If backend contract changes, update dependent frontend API client(s) and usage in the same task
- Do not hand-edit files marked auto-generated without re-running the appropriate tool
- Keep Arabic text encoding-safe
- Run encoding check for `EmployeeRequests` changes

### Suggested verification commands
- Frontend:
  - `npm run build`
  - `npm run check:text-encoding` when relevant
- Backend:
  - `dotnet build ENPO.Connect.Backend/Persistence/Persistence.csproj --no-restore`
- Backend tests:
  - `ENPO.Connect.Backend/scripts/run-tests.sh all`
  - or targeted groups such as `pricing`, `lifecycle`, `filter`

---

## Refactoring Boundaries

### Control Center boundary
Documented in `docs/architecture/control-center-field-governance-phased-refactor.md`:

- `field-library`: source of truth for field definition/config
- `field-library-binding`: linking + display order
- request settings: request-level policies/rules

### Summer boundary
Documented in `docs/architecture/summer-requests-guardrails.md`:

- Keep business rules in backend/domain services, not ad-hoc UI logic
- Keep dynamic field alias mapping centralized
- Keep SignalR payload-to-display translation centralized

### Refactor policy
- Avoid broad rewrites
- Prefer extraction and compatibility-safe refactors
- Never mix unrelated cleanup into feature delivery unless explicitly requested

---

## Destructive Action Warnings

Always warn and get explicit approval before:

- destructive SQL (`DELETE`, broad `UPDATE`, schema drops)
- destructive migrations or data backfills
- removing endpoints or DTO members used by existing clients
- mass route or permission key renames
- deleting Docker images, containers, volumes, networks, or generated assets
- broad cleanup of legacy modules/components

Additional rules:
- Never commit secrets
- Never rotate config values in `appsettings*.json` unless explicitly requested
- Do not disable auth, guards, interceptors, or cache invalidation to “make it work”

---

## Task Execution Mode

When executing any task in this repository, follow this order strictly:

### Step 1: Understand current state
- Explain the current implementation briefly
- Read relevant module/component/service/controller flow first

### Step 2: Identify impacted files
- List exact files likely to change
- Mention DTOs, route metadata, guards, API clients, cache hooks, and tests if touched

### Step 3: Apply minimal change
- Keep changes localized
- Reuse existing patterns
- Avoid unrelated refactoring

### Step 4: Verify consistency
- Check routing, permissions, API contracts, Arabic text behavior, RTL behavior, and cache invalidation where relevant

### Step 5: Report outcome
- Summarize changed files
- Describe behavior impact
- Mention risks, assumptions, and verification steps

Never skip Step 1 or Step 2.

---

## How To Approach New Tasks In This Repo

1. Inspect current implementation first across frontend and backend as needed
2. Identify all impacted files before coding
3. Apply the smallest safe change that fits existing patterns
4. Preserve:
   - route permission data
   - DTO envelopes
   - Arabic/RTL behavior
   - cache invalidation hooks
5. Run targeted validation and report residual risks

---

## What To Avoid

- Avoid inventing new architecture when an existing feature slice already owns the behavior
- Avoid duplicating business rules in both UI and backend
- Avoid bypassing `AuthNewGuardService`, interceptors, or claim-based checks
- Avoid hardcoded season/app/catalog constants scattered across files; prefer existing constants or config
- Avoid changing encoding or newline defaults in Arabic-heavy files
- Avoid mixing unrelated refactors into feature/bug tasks
- Avoid editing generated files manually unless regeneration is intended
- Avoid destructive cleanup without explicit confirmation

---

## Expected Workflow (Short)

1. Read the relevant feature slice and its route/permission wiring
2. List impacted files
3. Patch minimal code in place
4. Update connected API/client/DTO pieces together when needed
5. Verify with focused build/tests
6. Summarize:
   - changed files
   - behavior impact
   - risks
   - assumptions
   - verification

---

## Observed Assumptions To Verify

- NSwag/tooling appears present, but some frontend API client files may also be manually maintained; confirm regeneration expectations per task before large client rewrites
- Swagger UI is enabled in both Development and Production in the current backend startup; confirm whether that is intentional before changing it
- Legacy and newer API route styles coexist; confirm target style before normalizing controller routes in large refactors