<!-- Shared styles moved to docs/styles.css -->
<link rel="stylesheet" href="../styles.css">

<div class="doc-hero">
  <h1>DTO Renderer</h1>
  <div class="badge">Subcomponent</div>
</div>

<div class="section">
  <strong>Purpose</strong>
  <ul>
    <li>Render and edit complex request body arguments (objects/arrays) inside the Component Config Manager.</li>
  </ul>
</div>

<div class="doc-body">
  <h2>Inputs / Outputs</h2>
  <ul>
    <li><code>@Input() value</code>: any object or array-of-objects to edit.</li>
    <li><code>@Output() valueChange</code>: emits updated value on edits.</li>
  </ul>

  <h2>Key Behaviors</h2>
  <ul>
    <li>Renders object keys dynamically and supports nested objects.</li>
    <li>Handles arrays-of-objects by editing the first element.</li>
    <li>Parses string input into boolean/number/JSON when possible.</li>
    <li>Adds/removes properties or array elements with safe defaults.</li>
    <li>Emits deep-cloned values to trigger Angular change detection.</li>
  </ul>

  <h2>Dependencies</h2>
  <ul>
    <li>Used by the Requests tab in <code>ComponentConfigManagerComponent</code>.</li>
    <li>Shares styling from <code>ccm-shared.scss</code>.</li>
  </ul>

  <h2>Related Files</h2>
  <ul>
    <li><code>src/app/Modules/admins/Managementcomponents/component-config-manager/dto-renderer/dto-renderer.component.ts</code></li>
    <li><code>src/app/Modules/admins/Managementcomponents/component-config-manager/dto-renderer/dto-renderer.component.html</code></li>
    <li><code>src/app/Modules/admins/Managementcomponents/component-config-manager/ccm-shared.scss</code></li>
  </ul>
</div>
