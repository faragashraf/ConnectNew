# ControlCenterCatalog — Request Availability (Final Handoff)

Date: 2026-04-08  
Branch: `ControlCenterCatalog`

## Scope Completed
This handoff closes the 3 requested phases for introducing **Request Availability** as an independent configuration before routing:
- PHASE 1: Analysis + Model Design
- PHASE 2: Backend + Database + API
- PHASE 3: Frontend UI + Tree Selection + Save/Load Integration

## Phase Artifacts
- Phase 1: `docs/handoffs/control-center-request-availability-phase1-handoff.md`
- Phase 2: `docs/handoffs/control-center-request-availability-phase2-handoff.md`
- Phase 3: `docs/handoffs/control-center-request-availability-phase3-handoff.md`

## Final Delivered Outcome
- Request Availability is now configured independently from routing targeting.
- Two supported modes are active end-to-end:
  - `Public`
  - `Restricted`
- Restricted mode supports selecting node types from organizational tree:
  - OrgUnit
  - Position
  - SpecificUser (when reference data supports it)
- Backend and DB constraints enforce valid payload shapes.
- Frontend Arabic RTL PrimeNG section is integrated with save/load and validation UX.

## Backend / DB Summary
- SQL Server table added: `SubjectTypeRequestAvailability`.
- Migration added with constraints and indexes:
  - `20260408_AddSubjectTypeRequestAvailability`.
- Availability APIs added and wired.
- Build status:
  - Backend solution build passed in Phase 2.

## Frontend Summary
- New mandatory section added in routing workspace navigation:
  - `1) إتاحة الطلب`.
- Public mode hides tree selection and shows Arabic explanation.
- Restricted mode opens organizational tree dialog, validates selected node, and shows Arabic summary.
- Save button remains disabled until required state is complete.
- Build status:
  - Frontend build passed in Phase 3.

## Remaining / Next Step
- Execute a dedicated end-to-end **Execution/Verification Pass** across setup phases.
- Validate runtime integration of availability with downstream requester execution flow.

## Blockers / Assumptions
### Assumptions
- Oracle remains read-only reference source.
- User-level availability depends on environment data quality for person/user references.

### Blockers
- No functional blocker for this scope closure.
- Local `dotnet-ef` tooling was unavailable for migration list command, but migration/build integrity checks were handled via code/build verification.

## Mandatory Reminder
- Field Library Binding (ربط الحقول بالمجموعات) is still **not complete**.
- Do not treat setup journey as finalized until the dedicated Execution/Verification Pass is completed.
