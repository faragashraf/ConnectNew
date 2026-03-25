# Summer Requests Deep Audit
Date: 2026-03-25

This audit was executed against the current codebase before and during refactor hardening.
It is aligned with `docs/architecture/summer-requests-guardrails.md`.

## 1) Current Entry Points

### Frontend routes (EmployeeRequests)
- `SummerRequests` -> request owner workspace (create/view/pay/cancel/transfer).
- `SummerRequests/edit/:id` -> same workspace in edit mode.
- `SummerRequestsManagement` -> admin console.
- `Chart` -> module charts.

### Main frontend containers
- `summer-requests-workspace.component.ts` (owner flows + realtime + details + transfer capacity).
- `summer-requests-admin-console.component.ts` (admin dashboard + filters + actions + details + realtime).
- `summer-dynamic-booking-builder.component.ts` (create/edit dynamic form integration).

### Main backend API endpoints
- `GetMyRequests`
- `GetWaveCapacity`
- `GetAdminRequests`
- `GetAdminDashboard`
- `Cancel`
- `Pay`
- `Transfer`
- `ExecuteAdminAction`

### Main backend service entry methods
- `GetMyRequestsAsync`
- `GetAdminRequestsAsync`
- `GetAdminDashboardAsync`
- `GetWaveCapacityAsync`
- `CancelAsync`
- `PayAsync`
- `TransferAsync`
- `ExecuteAdminActionAsync`
- `AutoCancelExpiredUnpaidRequestsAsync`

## 2) Verified Flows and State Paths
- Load owner requests: UI -> `SummerWorkflowController.GetMyRequests` -> summaries mapping.
- Load selected details: UI -> `DynamicFormController.GetRequestById` + fallback to my feed.
- Cancel request: validation -> reply/attachments -> status/payment updates -> capacity + request realtime update.
- Pay request: attachment required -> due-date policy -> payment updates -> request realtime update.
- Transfer request: one-time policy + capacity lock + duplicate booking protection + workflow state/repayment flags.
- Load admin requests: scope by admin unit ids + filtering + paging.
- Load admin dashboard: aggregated from admin requests.
- Load wave capacity: by destination + wave + family capacity usage.
- Execute admin comment/final approve/manual cancel/approve transfer via action code normalization.
- Edit/view route behavior: `SummerRequests/edit/:id` resolves target and edit-state.
- Attachments validation: size + extension checks in backend + extension checks in frontend.
- SignalR realtime: machine payload markers `SUMMER_REQUEST_UPDATED` + `SUMMER_CAPACITY_UPDATED`.

## 3) Problem Classification (Observed)

### Architecture
- God-class/service concentration (`SummerWorkflowService` large mixed responsibilities).
- Two very large container components (workspace/admin) with orchestration + API + mapping + UI-state mixed.

### Module boundaries
- Summer feature logic previously declared directly in `EmployeeRequestsModule` without a dedicated feature boundary.

### Routing
- Route paths were string literals in routing without feature-level constants.
- Backward-compatible aliases existed but naming governance was weak.

### State management
- Realtime updates previously relied on broad keyword matching and global reload patterns.
- Risk of stale selection and unnecessary rerender/load churn.

### API contract
- Request-level refresh required fetching full list in multiple cases.
- `messageId` scoped retrieval was not consistently available for list patching.

### Domain modeling
- Dynamic fields consumed directly in many places without an explicit domain representation layer.

### Dynamic field coupling
- Alias logic existed but was spread across files and not fully codified as a clear adapter boundary.

### Validation
- Attachment validation existed, but centralized governance for allowed keys/codes/config was weak.

### Error handling
- Repeated inline Arabic messages in TS files (duplicate literals).

### Naming
- Hardcoded season/application/catalog identifiers repeated in multiple files.

### Localization / Arabic
- Arabic messages were mostly correct but scattered.
- Risk of mixed technical and display concerns in the same logic blocks.

### Constants / configuration
- Season-year and dynamic IDs had duplication across frontend/back-end surfaces.

### Reusability / Testability / Maintainability
- High friction to test or extend because rule extraction and feature boundaries were incomplete.

## 4) Refactor Scope Applied in This Pass
- Added mandatory guardrails document.
- Introduced `SummerRequestsFeatureModule` to make EmployeeRequests act as composition shell.
- Centralized Summer feature config constants (season/app/catalog/routes) in frontend core.
- Added frontend domain contracts + adapter layer for Summer request mapping.
- Centralized admin action normalization codes in frontend core.
- Centralized reusable Arabic UI messages in frontend core resource file.
- Centralized dynamic field aliases in frontend core (`summer-field-aliases.ts`) and rewired
  engine + details + edit harmonization + adapter to consume it.
- Introduced backend Summer domain constants + backend admin action catalog.
- Rewired key frontend components and backend service to consume centralized constants/catalogs.

## 5) Non-goals in This Pass
- Full handler-per-usecase extraction from `SummerWorkflowService` (still pending staged decomposition).
- Complete migration of all UI literals to centralized resources (high priority follow-up, partially started).
- Full replacement of all 2026 date calendars by externalized metadata source.
