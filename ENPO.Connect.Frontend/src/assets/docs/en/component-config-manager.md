<!-- Shared styles moved to docs/styles.css -->
<link rel="stylesheet" href="../styles.css">

<div class="doc-hero">
  <h1>Component Config Manager</h1>
  <div class="badge">Admin Component</div>
</div>

<div class="section">
  <strong>Purpose</strong>
  <ul>
    <li>Central editor for <code>ComponentConfig</code>, which drives generic list/form screens.</li>
    <li>Wire UI behavior to backend endpoints without hardcoding per-module screens.</li>
  </ul>
</div>

<div class="doc-body">
  <h2>Key Responsibilities</h2>
  <ul>
    <li>List configs and provide full-screen edit dialog with multi-tab settings.</li>
    <li>Manage list paging, search model, table columns/fields, and attachments.</li>
    <li>Configure request pipelines (endpoint + args + selection mapping).</li>
    <li>Persist configs and optionally export to disk in dev mode.</li>
  </ul>

  <h2>Dependencies</h2>
  <ul>
    <li><code>ComponentConfig</code> model + helpers (<code>defaultGlobalFilterFields</code>, <code>parseToDate</code>).</li>
    <li><code>ComponentConfigService</code> for caching, defaults, and export.</li>
    <li><code>MsgsService</code> for confirmations and alerts.</li>
    <li><code>CONTROLLER_CLASSES</code> + <code>Injector</code> to discover backend endpoints.</li>
    <li><code>HttpClient</code> for asset JSON and DTO shape loading.</li>
    <li><code>DtoRendererComponent</code> for editing body args.</li>
    <li>PrimeNG UI components (dialog, tabView, calendar, dropdown).</li>
  </ul>

  <h2>Backend / Data</h2>
  <ul>
    <li>Primary source: <code>assets/component-configs.json</code> (with defaults fallback).</li>
    <li>Optional export: <code>http://localhost:3001/save-configs</code> (only on localhost).</li>
    <li>DTO shape discovery from:
      <ul>
        <li><code>src/app/shared/services/BackendServices/DtoShapes/combined-dto-shapes</code></li>
        <li><code>assets/dto-shapes/combined-dto-shapes.json</code></li>
        <li>Legacy: <code>assets/publications-dto-shapes.json</code></li>
      </ul>
    </li>
    <li>Attachment options from <code>assets/attachment-options.json</code>.</li>
  </ul>

  <h2>Notable Behaviors</h2>
  <ul>
    <li>Dynamic controller discovery builds a list of methods and their parameters.</li>
    <li>Parameter parsing distinguishes body vs query params to build placeholders.</li>
    <li>DTO shapes are applied to body args to render editable object forms.</li>
    <li>Supports <code>wrapBodyAsArray</code>, <code>populateMethod</code>, and <code>populateArgs</code> defaults.</li>
    <li>Export to disk is gated by a user confirmation and localhost check.</li>
  </ul>

  <h2>Related Files</h2>
  <ul>
    <li><code>src/app/Modules/admins/Managementcomponents/component-config-manager/component-config-manager.component.ts</code></li>
    <li><code>src/app/Modules/admins/Managementcomponents/component-config-manager/component-config-manager.component.html</code></li>
    <li><code>src/app/Modules/admins/Managementcomponents/component-config-manager/ccm-shared.scss</code></li>
    <li><code>src/app/Modules/admins/Managementcomponents/component-config-manager/dto-renderer/dto-renderer.component.ts</code></li>
    <li><code>src/app/Modules/admins/services/component-config.service.ts</code></li>
    <li><code>src/app/shared/models/Component.Config.model</code></li>
  </ul>
</div>
