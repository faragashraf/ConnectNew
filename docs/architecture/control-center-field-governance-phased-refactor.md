# Control Center Field Governance Refactor (Phased)
Date: 2026-04-12
Scope: `Admin/ControlCenterCatalog` (field-library, field-library-binding, request settings)

## 1) Final Architectural Decision (Adopted)
- `field-library` is the exclusive source of truth for field definition and field-level configuration.
- `field-library-binding` is link + display order only.
- request settings hold request-level rules/policies only.

## 2) Current vs Target Responsibility Map

### A) `field-library`
- Current:
  - Field CRUD from `CDMend` (key, label, type, datatype, default, required flags, options payload).
  - Some UI labels were mixed Arabic/technical English.
- Target:
  - Exclusive owner of:
    - field definition
    - field type/data type
    - options source
    - field-level config (required/visible/readonly/default/placeholder...)
  - Arabic-first labels in UI.

### B) `field-library-binding`
- Current (before hardening):
  - Link/order + also legacy field-level payload and runtime/config flows.
  - Included screens/forms for reference/presentation/new-field.
- Target:
  - Only:
    - bind field to category/request type
    - display order
    - binding metadata only
  - Must not own:
    - field definition
    - base required/visible
    - options source
    - field-level config

### C) request settings
- Current:
  - Routing, access policies, display settings, lifecycle/request policies.
  - No direct field-definition CRUD observed here.
- Target:
  - business rules
  - validation rules
  - request-level policies
  - organizational units/entities policies
  - operational policies at request level

## 3) What Was in the Wrong Place (Detected)
- `field-library-binding` was still able to carry field-level payload (`displaySettingsJson`, dynamic runtime, required/visible semantics).
- `field-library-binding` had legacy save expectations including `upsertSubjectTypeAdminConfig`.
- Binding validation logic still contained field behavior checks unrelated to pure link/order.
- Binding UI still exposed field-level controls (now suppressed/disabled).

## 4) Minimal Refactor Applied (No Big-Bang)

### Phase 1: Source-of-truth hardening
- Binding save path changed to persist link/order only.
- Backend binding upsert now canonicalizes incoming payload to binding-safe values.

### Phase 2: Move field settings ownership to field-library
- Field-library labels/type-data labels localized (Arabic-facing display).
- Binding screen guides user to field-library for field-level settings.

### Phase 3: Simplify binding to link/order
- Binding engine validation reduced to binding concerns.
- Binding page blocks new field creation locally and points to field-library.
- Non-binding controls in row UI disabled.

### Phase 4: Request settings policy-only review
- Confirmed request settings workspaces are policy/routing/display oriented; no direct field-definition CRUD moved there.

### Phase 5: Professional cleanup (planned next)
- Remove dormant binding-only legacy code paths and DTO fields after stabilization window.

## 5) Files Affected (Implemented in this stream)

### Backend
- `ENPO.Connect.Backend/Persistence/Services/DynamicSubjects/DynamicSubjectsAdminService.cs`
  - `UpsertAdminCategoryFieldLinksAsync` now ignores legacy field-level payload and updates order/link semantics only.

### Frontend (binding)
- `ENPO.Connect.Frontend/src/app/Modules/admin-control-center-catalog/pages/field-library-binding/field-library-binding-page.component.ts`
- `ENPO.Connect.Frontend/src/app/Modules/admin-control-center-catalog/pages/field-library-binding/field-library-binding-page.component.html`
- `ENPO.Connect.Frontend/src/app/Modules/admin-control-center-catalog/domain/field-library-binding/field-library-binding.engine.ts`
- `ENPO.Connect.Frontend/src/app/Modules/admin-control-center-catalog/pages/field-library-binding/field-library-binding-page.component.spec.ts`

### Frontend (field-library + navigation copy)
- `ENPO.Connect.Frontend/src/app/Modules/admin-control-center-catalog/pages/admin-control-center-catalog-field-library-page/admin-control-center-catalog-field-library-page.component.ts`
- `ENPO.Connect.Frontend/src/app/Modules/admin-control-center-catalog/pages/admin-control-center-catalog-field-library-page/admin-control-center-catalog-field-library-page.component.html`
- `ENPO.Connect.Frontend/src/app/Modules/admin-control-center-catalog/pages/admin-control-center-catalog-page/admin-control-center-catalog-page.component.html`

## 6) Minimal Patch Strategy by Release

### Patch A (already safe)
- Keep API contract shape unchanged.
- Ignore forbidden binding payload server-side.
- Persist only link/order from binding endpoint.

### Patch B (already safe)
- Hide/disable non-binding UI in binding screen.
- Redirect user intent to field-library.

### Patch C (after monitoring)
- Remove dead code paths in binding component (reference/presentation/new-field/dynamic runtime authoring in binding).
- Slim DTOs and request contracts gradually with versioning or additive replacement.

## 7) Migration Risks
- Legacy clients may still send field-level payload to binding endpoint.
- Cached drafts in browsers may contain old binding data shape.
- Existing tests tied to old behavior can fail until aligned.
- Hidden code paths can re-surface if templates are re-enabled unintentionally.

## 8) Backward Compatibility Controls
- Backend currently accepts old payload shape but ignores field-level parts (compat-safe).
- Existing DB columns remain intact; no destructive migration in this phase.
- Frontend success/failure messaging updated without API breaking changes.
- Test suite updated to assert new architecture behavior.

## 9) What to Stop/Remove After Stability Window
- Stop any use of binding endpoint for `displaySettingsJson` / required/visible semantics.
- Remove `upsertSubjectTypeAdminConfig` dependency from binding flows completely.
- Remove dormant UI/forms in binding component that author field-level behavior.
- Plan DTO cleanup:
  - deprecate field-level members from binding upsert contract
  - introduce explicit binding-only DTO contract if needed.

## 10) Validation Snapshot
- Frontend build: PASS (`npm run build`).
- Targeted binding specs: PASS (`field-library-binding-page.component.spec.ts`).
- All `p-dropdown` in updated field-library and binding pages use `appendTo="body"`.
