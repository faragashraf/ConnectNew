# ControlCenterCatalog — Request Availability
## Phase 3 Handoff (Frontend UI + Tree Selection + Save/Load Integration)

Date: 2026-04-08  
Branch: `ControlCenterCatalog`

## 1) What Was Completed
- Added a new independent section inside Routing Workspace named **إتاحة الطلب**.
- Added availability mode switching with two modes only:
  - `عام` (`Public`)
  - `محدد` (`Restricted`)
- Added standalone UI/logic so availability is configured **before and independent from routing targeting**.
- Added organizational tree selection dialog for restricted mode with node-type visual tags:
  - OrgUnit
  - Position
  - SpecificUser
- Added full save/load integration with backend availability APIs.
- Added client-side visual validation and disabled save behavior until required fields are complete.
- Added loading states and empty states in the new section and selection dialog.
- Preserved Arabic UI + RTL + PrimeNG, and retained `appendTo="body"` for dropdowns.

## 2) Files Modified
- `ENPO.Connect.Frontend/src/app/shared/services/BackendServices/DynamicSubjectsAdminRouting/DynamicSubjectsAdminRouting.dto.ts`
- `ENPO.Connect.Frontend/src/app/shared/services/BackendServices/DynamicSubjectsAdminRouting/DynamicSubjectsAdminRouting.service.ts`
- `ENPO.Connect.Frontend/src/app/Modules/admin-control-center-catalog/pages/admin-control-center-catalog-routing-workspace/admin-control-center-catalog-routing-workspace.component.ts`
- `ENPO.Connect.Frontend/src/app/Modules/admin-control-center-catalog/pages/admin-control-center-catalog-routing-workspace/admin-control-center-catalog-routing-workspace.component.html`
- `ENPO.Connect.Frontend/src/app/Modules/admin-control-center-catalog/pages/admin-control-center-catalog-routing-workspace/admin-control-center-catalog-routing-workspace.component.scss`

## 3) Frontend DTO / API Client Impact
### New DTO contracts
- `RequestAvailabilityMode`
- `SubjectTypeRequestAvailabilityDto`
- `SubjectTypeRequestAvailabilityUpsertRequestDto`
- `SubjectAvailabilityNodeValidationRequestDto`
- `SubjectAvailabilityNodeValidationResultDto`

### New API client methods
- `getRequestAvailability(subjectTypeId)`
- `upsertRequestAvailability(subjectTypeId, request)`
- `validateRequestAvailabilityNode(subjectTypeId, request)`
- `getAvailabilityTreeNodes(subjectTypeId, options)`

## 4) UI Behavior Delivered
- New section navigation item added as first mandatory step: `1) إتاحة الطلب`.
- Public mode:
  - hides tree requirement
  - shows clear Arabic explanation that request is available for all logged-in users.
- Restricted mode:
  - shows tree picker button + clear selection button
  - opens dialog/overlay with search, include-users toggle, and lazy child expansion
  - displays selected node summary (type, label, path, explanation)
  - validates selected node through backend endpoint before enabling save.
- Save button remains disabled until mandatory data is complete and validation is clean.
- Existing routing sections remain intact and functionally separate.

## 5) Save/Load Integration
- On request type context load:
  - availability is loaded using `GET Availability/{subjectTypeId}`.
  - fallback to default public mode if response fails.
- On select node in restricted mode:
  - frontend calls `POST Availability/{subjectTypeId}/ValidateNode`.
  - applies normalized labels/path/summary from response.
- On save:
  - frontend calls `PUT Availability/{subjectTypeId}` with proper shape for public/restricted.
  - UI state refreshes from returned DTO.

## 6) Build / Verification
- Command executed:
  - `npm --prefix ENPO.Connect.Frontend run build`
- Result:
  - Build succeeded.
  - No template/type errors for this phase.
  - Existing CommonJS warnings remain unrelated to this phase scope.

## 7) Issues Encountered and Resolution
- No blocking implementation issues in this phase.
- Minor UX hardening added:
  - Save is disabled while node validation request is in-flight.

## 8) Remaining Work
- End-to-end execution/verification pass across all ControlCenterCatalog setup phases.
- Final cross-feature validation with routing runtime behavior in downstream execution phase.

## 9) Blockers / Assumptions
### Assumptions
- Backend availability endpoints from Phase 2 are deployed and reachable.
- Oracle data remains reference-only and may vary by environment for user-level coverage.

### Blockers
- No direct blocker for frontend completion.

## 10) Mandatory Reminder
- Field Library Binding (ربط الحقول بالمجموعات) is still **not complete**.
- A full **Execution/Verification Pass** is still required before advanced rollout.
