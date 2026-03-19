<!-- Shared styles moved to docs/styles.css -->
<link rel="stylesheet" href="../styles.css">

<div class="doc-hero">
  <h1>Chart Config Manager</h1>
  <div class="badge">Admin Component</div>
</div>

<div class="section">
  <strong>Purpose</strong>
  <ul>
    <li>Manage chart definitions per module for backend-driven dashboards.</li>
    <li>Translate UI form inputs into the <code>ChartConfig</code> shape expected by the API.</li>
  </ul>
</div>

<div class="doc-body">
  <h2>Key Responsibilities</h2>
  <ul>
    <li>List charts by module and provide create/edit/delete actions.</li>
    <li>Capture data definition (queryId, queryParams, sector/series/value fields).</li>
    <li>Expose advanced options for appearance, layout, axis, and labels.</li>
    <li>Normalize user inputs (JSON parsing, array fields, height units) before saving.</li>
  </ul>

  <h2>Dependencies</h2>
  <ul>
    <li><code>ChartConfigAdminService</code> for CRUD operations.</li>
    <li><code>ChartConfig</code> model from GenericComponents.</li>
    <li><code>MsgsService</code> for confirmations and alerts.</li>
    <li>Angular Reactive Forms + Animations.</li>
    <li>PrimeNG UI components (table, dialog, dropdown, inputNumber, tabs).</li>
  </ul>

  <h2>Backend / Data</h2>
  <ul>
    <li>API base: <code>environment.PowerBi + "/api/charts"</code>.</li>
    <li>Queries are backend-driven via <code>queryId</code> + <code>queryParams</code>.</li>
    <li>Supports multiple response wrapper shapes when loading lists.</li>
  </ul>

  <h2>Notable Behaviors</h2>
  <ul>
    <li><code>openNew()</code> sets <code>order</code> to max + 1 and locks <code>moduleName</code>.</li>
    <li><code>editChart()</code> maps legacy/flat <code>appearance</code> into nested form groups.</li>
    <li><code>saveChart()</code> flattens <code>appearance</code> back to backend format.</li>
    <li><code>layout.height</code> is saved as <code>"&lt;number&gt;px"</code>.</li>
  </ul>

  <h2>Related Files</h2>
  <ul>
    <li><code>src/app/Modules/admins/Managementcomponents/chart-config-manager/chart-config-manager.component.ts</code></li>
    <li><code>src/app/Modules/admins/Managementcomponents/chart-config-manager/chart-config-manager.component.html</code></li>
    <li><code>src/app/Modules/admins/services/chart-config-admin.service.ts</code></li>
    <li><code>src/app/Modules/GenericComponents/models/chart-config.ts</code></li>
  </ul>
</div>
