# ControlCenterCatalog — Request Availability
## Phase 2 Handoff (Backend + Database + API)

Date: 2026-04-08  
Branch: `ControlCenterCatalog`

## 1) What Was Completed
- Added backend persistence model for request availability as a standalone setting per request type.
- Added SQL Server migration for `SubjectTypeRequestAvailability` (SQL Server only, no Oracle write path).
- Added service/repository support to get, save/update, validate availability settings.
- Added dedicated availability APIs under `DynamicSubjectsAdminRoutingController`.
- Added backend validations for:
  - `Public` mode shape (no selected node fields).
  - `Restricted` mode shape (selected node required and consistent by node type).
  - selected node type whitelist (`OrgUnit`, `Position`, `SpecificUser`).
  - selected node existence and type compatibility against Oracle reference data.
- Reused Oracle read-only tree source through existing routing org tree service paths and added subject-type scoped availability tree endpoint.
- Build completed successfully for backend solution.

## 2) Files Modified
- `ENPO.Connect.Backend/Models/Connect/SubjectTypeRequestAvailability.cs`
- `ENPO.Connect.Backend/Persistence/Data/ConnectContext.cs`
- `ENPO.Connect.Backend/Persistence/Migrations/20260408_AddSubjectTypeRequestAvailability.cs`
- `ENPO.Connect.Backend/Models/DTO/DynamicSubjects/DynamicSubjectsAdminRoutingDtos.cs`
- `ENPO.Connect.Backend/Persistence/Services/DynamicSubjects/AdminRouting/IDynamicSubjectsAdminRoutingRepository.cs`
- `ENPO.Connect.Backend/Persistence/Services/DynamicSubjects/AdminRouting/DynamicSubjectsAdminRoutingRepository.cs`
- `ENPO.Connect.Backend/Persistence/Services/DynamicSubjects/AdminRouting/IDynamicSubjectsAdminRoutingService.cs`
- `ENPO.Connect.Backend/Persistence/Services/DynamicSubjects/AdminRouting/DynamicSubjectsAdminRoutingService.cs`
- `ENPO.Connect.Backend/Api/Controllers/DynamicSubjectsAdminRoutingController.cs`
- `ENPO.Connect.Backend/Api/Program.cs`

## 3) Database / Migration Impact
### New Table
- `dbo.SubjectTypeRequestAvailability`
  - `CategoryID` (PK, FK to `CDCategory.CatId`)
  - `AvailabilityMode` (`Public` / `Restricted`)
  - `SelectedNodeType` (`OrgUnit` / `Position` / `SpecificUser`, nullable)
  - `SelectedNodeNumericId` (nullable)
  - `SelectedNodeUserId` (nullable)
  - `SelectionLabelAr` (nullable)
  - `SelectionPathAr` (nullable)
  - `LastModifiedBy`
  - `LastModifiedAtUtc`

### Constraints
- `CK_SubjectTypeRequestAvailability_AvailabilityMode`
- `CK_SubjectTypeRequestAvailability_SelectedNodeType`
- `CK_SubjectTypeRequestAvailability_PublicShape`
- `CK_SubjectTypeRequestAvailability_RestrictedShape`

### Indexes
- `IX_SubjectTypeRequestAvailability_AvailabilityMode`
- `IX_SubjectTypeRequestAvailability_SelectedNodeType_SelectedNodeNumericId`
- `IX_SubjectTypeRequestAvailability_SelectedNodeUserId`

### Migration Added
- `20260408_AddSubjectTypeRequestAvailability`

## 4) DTO / Model / Mapping Impact
### New DTOs (Admin Routing DTO file)
- `SubjectTypeRequestAvailabilityDto`
- `SubjectTypeRequestAvailabilityUpsertRequestDto`
- `SubjectAvailabilityNodeValidationRequestDto`
- `SubjectAvailabilityNodeValidationResultDto`

### Service Logic Added
- Availability mode normalization (`Public`, `Restricted`).
- Node type normalization (`OrgUnit`, `Position`, `SpecificUser`).
- Node resolution and validation against Oracle reference source:
  - Org Unit via `OrgUnits`
  - Position via `UserPositions`
  - Specific User via `PosUsers` (with fallback presence check in `UserPositions`)
- Arabic summary resolution for each availability case.
- Label/path enrichment for selected node to support UI summary rendering.

## 5) API Impact
### New/Updated Endpoints
- `GET /api/DynamicSubjectsAdminRouting/Availability/{subjectTypeId}`
  - Loads request availability setting for a request type.
- `PUT /api/DynamicSubjectsAdminRouting/Availability/{subjectTypeId}`
  - Creates/updates availability setting.
- `POST /api/DynamicSubjectsAdminRouting/Availability/{subjectTypeId}/ValidateNode`
  - Validates selected tree node and returns resolved labels/summary.
- `GET /api/DynamicSubjectsAdminRouting/Availability/{subjectTypeId}/TreeNodes`
  - Loads organizational tree nodes for availability selection (subject-type guarded).

## 6) Validation Rules Implemented (Backend)
- If `AvailabilityMode = Public`:
  - `SelectedNodeType`, `SelectedNodeNumericId`, `SelectedNodeUserId` must be null/not sent.
- If `AvailabilityMode = Restricted`:
  - `SelectedNodeType` is required.
  - `OrgUnit`/`Position` require `SelectedNodeNumericId > 0` and no `SelectedNodeUserId`.
  - `SpecificUser` requires `SelectedNodeUserId` and no `SelectedNodeNumericId`.
- `SelectedNodeType` must be in supported list.
- Selected node must exist in Oracle reference source and match node type.

## 7) Build / Verification
- Command executed:
  - `dotnet build ENPO.Connect.Backend/ENPO.Connect.Backend.sln`
- Result:
  - Build succeeded.
  - Existing project warnings remain (package/framework/nullable warnings unrelated to this phase scope).

## 8) Migration Ordering / Snapshot Notes
- Migration ID is unique and ordered after existing 20260408 routing migrations.
- Project does not currently contain a checked-in `ModelSnapshot` in migrations folder for this context.
- `dotnet ef migrations list` could not be executed in this environment because `dotnet-ef` tool is not installed.

## 9) Remaining Work
- Phase 3 (Frontend): Arabic RTL PrimeNG availability UI, tree selector dialog/overlay, save/load integration, disable-save validation UX, and final visual validation states.
- Final integration pass later with routing workspace UX.
- Dedicated execution/verification pass still required after pending setup phases.

## 10) Blockers / Assumptions
### Assumptions
- Oracle remains read-only reference source for org structure and users.
- `SpecificUser` validation is considered supported when user exists in `PosUsers`, or at least appears in `UserPositions`.

### Blockers
- No functional blocker for backend delivery in this phase.
- Tooling note: `dotnet-ef` is unavailable locally for migration listing command.

## 11) Mandatory Reminder
- Field Library Binding (ربط الحقول بالمجموعات) is still **not complete**.
- A full Execution/Verification Pass is still required before advanced phase rollout.
