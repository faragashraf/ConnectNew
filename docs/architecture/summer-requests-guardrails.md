# Summer Requests Guardrails

This document is the mandatory architectural reference for all Summer Requests changes (frontend + backend).
It must be applied in every future task touching this feature.

## 1) Architectural Principles
- Keep Summer Requests as a bounded feature with explicit entry points, contracts, and adapters.
- Preserve existing behavior unless fixing a verified bug.
- Prefer extraction over rewrite: isolate concerns incrementally with safe refactors.
- Domain rules must be centralized and testable; UI must not own business decisions.
- Real-time updates must be idempotent and deduplicated.

## 2) Naming Conventions
- Technical identifiers remain in English:
  class names, file names, keys, enums, DTOs, route keys, API contracts.
- Arabic is for user-facing text only:
  labels, messages, timeline descriptions, help text.
- Action codes are canonical uppercase tokens:
  `FINAL_APPROVE`, `MANUAL_CANCEL`, `COMMENT`, `APPROVE_TRANSFER`.
- Summer dynamic field aliases must map to canonical keys through dedicated adapters.

## 3) Feature Boundaries
- Feature root:
  `ENPO.Connect.Frontend/src/app/Modules/EmployeeRequests/components/*summer*`
  and `ENPO.Connect.Backend/*SummerWorkflow*`.
- EmployeeRequestsModule acts as shell/composition for Summer feature screens.
- Reusable Summer UI primitives live under `summer-shared`.
- Generic dynamic-form engine integration must stay separate from Summer domain mapping.

## 4) Folder Structure Rules
- Frontend:
  - `summer-shared/core`: feature constants, text resources, contracts/adapters.
  - `summer-shared/*`: presentational components only (no API calls).
  - workspace/admin screens: container orchestration only; delegate mapping/loading to services/adapters.
- Backend:
  - Keep controller thin.
  - Service layer owns use-cases, policies, mappings, and notifications orchestration.
  - Shared policies/mappers/constants must be in dedicated Summer service files (not duplicated per method).

## 5) State Management Rules
- Container components own view-state only.
- API interactions must be centralized in feature services/facades.
- Avoid broad full reloads when signal payload can patch row-level state.
- Preserve selected-request consistency after updates (upsert/remove logic must handle stale selection).
- Pagination/filter state must remain stable after realtime updates.
- Summer components must not subscribe directly to `SignalRService.Notification$`;
  they consume typed streams from `summer-shared/core/summer-requests-realtime.service.ts`.

## 6) API Contract Rules
- Keep `SummerWorkflowController` endpoints backward compatible unless all consumers are updated in the same change.
- Request/response DTO naming must be consistent between backend and frontend clients.
- Multipart endpoints must enforce extension + size validation in one backend validator path.
- Error contract uses `CommonResponse` + `errors[]` with actionable Arabic messages for UI.

## 7) Dynamic Field Mapping Rules
- Use canonical field groups for each domain attribute:
  owner id/name/national id/phones, wave code/label, destination id/name, family/extra counts.
- Frontend mapping keys must be sourced from:
  `components/summer-shared/core/summer-field-aliases.ts`.
- Alias resolution must be centralized (single source of truth), not spread across UI and backend.
- Business decisions must not depend on display labels; depend on canonical codes/keys.
- New metadata aliases must be added to the adapter map first, then consumed by screens/services.

## 8) Localization / Arabic Rules
- No Arabic in technical keys or route identifiers.
- No mojibake/escaped unreadable Arabic in source (`????`, corrupted UTF-8 artifacts).
- Arabic UI text should be sourced from feature constants/resources when reused.
- Keep layout-safe Arabic (short labels, consistent punctuation, no mixed-key wording).
- SignalR payload markers remain English machine tokens; UI title/message remains Arabic.

## 9) Refactoring Constraints
- No god component -> god facade migration.
- No duplicated business rule across component + util + backend.
- No partial migrations that run old and new logic in parallel without clear compatibility intent.
- No hardcoded season/application/catalog values scattered across files.
- Any breaking route/DTO/API change requires consumer updates in the same commit.

## 10) Anti-Patterns To Avoid
- Full component reload on every SignalR event.
- Direct SignalR payload parsing duplicated in multiple components.
- Parsing business state from free-text Arabic replies.
- Embedding domain logic directly in template expressions.
- Duplicated notification fan-out causing repeated UI notifications.
- Repeated copy/paste validation rules per endpoint/component.

## 11) Definition Of Done (DoD)
- Entry points, flows, and contracts are explicitly audited.
- Business rules are centralized and reused.
- Realtime updates are deduplicated and row-patched where possible.
- Hardcoded Summer constants are centralized.
- Arabic UI text is consistent and separated from technical identifiers.
- Build passes for:
  - `dotnet build ENPO.Connect.Backend/Persistence/Persistence.csproj --no-restore`
  - `npm run build` under `ENPO.Connect.Frontend`.
- Summary includes changed files, verified flows, risks, and follow-up actions.
