# Admin Management Components (Overview)

This folder contains admin-facing tools that configure how generic, backend-driven UI screens behave. Instead of hardcoding per-module UI, these tools store configuration and metadata that drive routing, forms, lists, tables, charts, and API wiring.

## How this supports a backend/database-driven app
- Screen layout and behavior are driven by configuration (ComponentConfig + Dynamic Fields), not static code.
- Data retrieval is wired to backend controller methods and query parameters.
- Analytics/charts are defined by backend queries, so dashboards evolve without UI code changes.

## Components

### ChartConfigManagerComponent (`chart-config-manager`)
Purpose: Manage chart definitions per module (analytics/dashboard configuration).

Key responsibilities
- Module-scoped list + CRUD dialog (key, moduleName, title, type, enabled, order).
- Data Definition: queryId, queryParams (JSON), sectorField/seriesField/valueField mapping.
- Advanced settings: appearance (stacked, labels, tooltip, colorMap), layout (width/height), axis, labels map.
- Normalization logic that translates UI inputs to backend-friendly shape:
  - `labels` FormArray -> `{ [key]: value }` object.
  - `queryParams` / `colorMap` parsed from JSON strings.
  - `sectorField` split into string array.
  - `layout.height` saved as `"<number>px"`.
  - `appearance` flattened to match backend fields (`labelMode`, `position`, `legendPosition`, etc.).

Backend integration
- `ChartConfigAdminService` calls `environment.PowerBi + "/api/charts"`.

### ComponentConfigManagerComponent (`component-config-manager`)
Purpose: Central editor for `ComponentConfig`, the configuration that drives generic list/form screens.

Config source & persistence
- Loads configs from `assets/component-configs.json` with fallback defaults.
- Keeps an in-memory cache; updates are optionally exported to disk via the local save server when running on `localhost`.

UI structure
- List of configs with Edit/Delete.
- Full-screen dialog with tabs:
  - General: route key, title, display mode, generic form, menu/unit IDs, pagination sizes, global filter fields, deadStatus, totalRecords, isNew, showFormSignature, submitButtonText.
  - List: listRequestModel (page settings, status/category/type, search).
  - Requests: backend endpoint wiring (method, args, selection fields, mapping).
  - User: currentUser/currentUserName/userGroup.
  - Fields: date/time behavior, required flags, sticky table options.
  - Table & Categories: tkCategoryCds, tableColumns, tableFields (header/field/width/sortable/visible/status).
  - Attachments: allowed extensions, size/count limits, mandatory/allowMultiple.

Backend-driven request wiring (deep behavior)
- Discovers backend controllers dynamically using `CONTROLLER_CLASSES` + Angular `Injector`.
- Parses method signatures at runtime to infer parameters and which param is body vs query.
- Builds argument placeholders for each request row.
- Loads DTO shapes from generated TS modules or JSON assets (e.g. `assets/dto-shapes/combined-dto-shapes.json`) and auto-populates body arguments.
- Supports `wrapBodyAsArray`, `requestsSelectionFields`, `arrName`/`arrValue` mapping, and `populateMethod` + `populateArgs` defaults.
- Special-cases certain methods (e.g. `publicationsController.getDocumentsList_user`) to normalize arg shapes.

Supporting subcomponent: `DtoRendererComponent`
- Used in Requests tab to edit complex body args.
- Renders object keys recursively, supports arrays-of-objects, and converts string inputs to boolean/number/JSON when possible.
- Emits deep-cloned values to trigger change detection.

### DynamicFieldsManagerComponent (`dynamic-fields-manager`)
Purpose: Manage dynamic field metadata that drives generic forms.

Data flow
- Loads mandatory fields, meta fields, and categories via `DynamicFormController` (backend).
- Stores/operates on `CdmendDto` collections in `GenericFormsService`.
- Groups fields as: Application (`applicationId`) -> Field Type (`cdmendType`) -> Field.

Key capabilities
- Add/edit dynamic field definitions (SQL source, labels, validation, width/height, flags).
- Edit `cdmendTbl` as JSON-backed option lists for dropdowns/trees.
- Search & filter by app and status; expand/collapse hierarchy.
- Animated statistics dashboard.
- Export to Excel via `xlsx` + `file-saver`.
- UI preferences (dark/compact/high-contrast) persisted to `localStorage`.
- Uses `app-generic-element-details` dialog for detailed editing.

Why it matters
- Allows the database-driven field schema to evolve without frontend code changes.

### NswagEditorComponent (`nswag-editor`)
Purpose: Admin UI for NSwag service configuration (API client generation).

Key behavior
- CRUD list of NSwag entries: label, environment property, dev/prod URLs, output path, regenerate flag.
- Environment properties are discovered from Angular `environment`.
- Configs are loaded/saved via the local NSwag editor server.

## Data & configuration lifecycle (at a glance)
- Chart configs -> backend chart API (PowerBi domain).
- Component configs -> assets JSON + optional local export to disk.
- Dynamic fields -> backend DynamicForm endpoints; stored and grouped on the client for admin editing.
- NSwag configs -> local editor server.

## Related paths
- `src/app/Modules/admins/Managementcomponents/chart-config-manager`
- `src/app/Modules/admins/Managementcomponents/component-config-manager`
- `src/app/Modules/admins/Managementcomponents/component-config-manager/dto-renderer`
- `src/app/Modules/admins/Managementcomponents/dynamic-fields-manager`
- `src/app/Modules/admins/Managementcomponents/nswag-editor`
- `src/app/Modules/admins/services/*`
- `src/assets/component-configs.json`
- `src/assets/dto-shapes/*`
- `src/assets/attachment-options.json`
