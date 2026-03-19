<!-- Shared styles moved to docs/styles.css -->
<link rel="stylesheet" href="../styles.css">

<div class="doc-hero">
  <h1>Dynamic Fields Manager</h1>
  <div class="badge">Admin Component</div>
</div>

<div class="section">
  <strong>Purpose</strong>
  <ul>
    <li>Manage dynamic field metadata that drives generic, database-backed forms.</li>
    <li>Provide admin tools for filtering, grouping, and exporting field definitions.</li>
  </ul>
</div>

<div class="doc-body">
  <h2>Key Responsibilities</h2>
  <ul>
    <li>Load mandatory fields, meta fields, and categories from backend services.</li>
    <li>Group fields by application and field type for navigation.</li>
    <li>Create/edit field definitions and option lists (<code>cdmendTbl</code>).</li>
    <li>Search/filter by app or status and export to Excel.</li>
    <li>Persist UI preferences (dark/compact/high-contrast) in localStorage.</li>
  </ul>

  <h2>Dependencies</h2>
  <ul>
    <li><code>DynamicFormController</code> for backend access.</li>
    <li><code>GenericFormsService</code> to store and update <code>CdmendDto</code> collections.</li>
    <li><code>MsgsService</code>, <code>SpinnerService</code>, <code>RedisHubService</code>, <code>GenerateQueryService</code>.</li>
    <li>DTO types: <code>CdmendDto</code>, <code>CdcategoryDto</code>, <code>CdCategoryMandDto</code>.</li>
    <li>Export libraries: <code>xlsx</code> and <code>file-saver</code>.</li>
    <li>UI dialog: <code>app-generic-element-details</code>.</li>
  </ul>

  <h2>Backend / Data</h2>
  <ul>
    <li>Loads via <code>getMandatoryAll</code>, <code>getMandatoryMetaDate</code>, and <code>getAllCategories</code>.</li>
    <li>Uses <code>forkJoin</code> to fetch all datasets concurrently.</li>
    <li><code>cdmendTbl</code> is stored as JSON string but edited as arrays.</li>
  </ul>

  <h2>Notable Behaviors</h2>
  <ul>
    <li>Builds a hierarchical view: Application → Field Type → Field.</li>
    <li>Animated statistics counters for apps, types, active/inactive fields.</li>
    <li>UI filters automatically rebuild the grouped tree view.</li>
  </ul>

  <h2>Related Files</h2>
  <ul>
    <li><code>src/app/Modules/admins/Managementcomponents/dynamic-fields-manager/dynamic-fields-manager.component.ts</code></li>
    <li><code>src/app/Modules/admins/Managementcomponents/dynamic-fields-manager/dynamic-fields-manager.component.html</code></li>
    <li><code>src/app/Modules/admins/Managementcomponents/dynamic-fields-manager/dynamic-fields-manager.component.scss</code></li>
    <li><code>src/app/shared/services/BackendServices/DynamicForm/DynamicForm.service</code></li>
    <li><code>src/app/Modules/GenericComponents/GenericForms.service</code></li>
  </ul>
</div>
