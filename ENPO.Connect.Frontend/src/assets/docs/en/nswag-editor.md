<!-- Shared styles moved to docs/styles.css -->
<link rel="stylesheet" href="../styles.css">

<div class="doc-hero">
  <h1>NSwag Editor</h1>
  <div class="badge">Admin Component</div>
</div>

<div class="section">
  <strong>Purpose</strong>
  <ul>
    <li>Manage NSwag service configurations for API client generation.</li>
  </ul>
</div>

<div class="doc-body">
  <h2>Key Responsibilities</h2>
  <ul>
    <li>Create/edit/delete NSwag entries (label, env property, URLs, output path).</li>
    <li>Toggle production mode and regeneration flags.</li>
    <li>Load and save configurations through a local editor service.</li>
  </ul>

  <h2>Dependencies</h2>
  <ul>
    <li><code>NswagEditorService</code> for HTTP operations.</li>
    <li><code>environment</code> to discover available env properties.</li>
    <li>Angular Reactive Forms + PrimeNG dropdown.</li>
  </ul>

  <h2>Backend / Data</h2>
  <ul>
    <li>Local editor server: <code>http://localhost:3002/nswag</code>.</li>
  </ul>

  <h2>Related Files</h2>
  <ul>
    <li><code>src/app/Modules/admins/Managementcomponents/nswag-editor/nswag-editor.component.ts</code></li>
    <li><code>src/app/Modules/admins/Managementcomponents/nswag-editor/nswag-editor.component.html</code></li>
    <li><code>src/app/Modules/admins/services/nswag-editor.service.ts</code></li>
  </ul>
</div>
