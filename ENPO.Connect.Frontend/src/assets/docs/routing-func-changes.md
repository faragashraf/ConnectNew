<!-- Shared styles moved to docs/styles.css for consistent Markdown preview -->
<link rel="stylesheet" href="./styles.css">

<div class="doc-hero">
  <h1>Routing func changes (latest commits)</h1>
  <div class="badge">Changelog</div>
</div>

<div class="doc-body">
- [src/app/Modules/admins/admins-routing.module.ts](src/app/Modules/admins/admins-routing.module.ts) — commit `df00a05829a15ef440e496938f279758b8d6bff5` | 2026-01-25 16:38:02 +0200
  - `RegistrationRequests` (RegistrationsRequestsComponent): `CORRAdmin` → `ConnectAdminFunc`
  - `GetSideBarHierarchy` (SideBarHierarchyComponent): `CORRAdmin` → `ConnectAdminFunc`
  - `GetRoleHierarchy` (RoleHierarchyComponent): `CORRAdmin` → `ConnectAdminFunc`
  - `DynamicFiledsManager` (DynamicFieldsManagerComponent): `CORRAdmin` → `ConnectAdminFunc`
  - `ResetPassword` (ResetUserPasswordComponent): `CORRAdmin` → `ConnectAdminFunc`
  - `OnlineUsers` (OnlinUsersComponent): `CORRAdmin` → `ConnectAdminFunc`
  - `ApplicationConfiguration` (ComponentConfigManagerComponent): `CORRAdmin` → `ConnectSupperAdminFunc`
  - `NswagConfiguration` (NswagEditorComponent): `CORRAdmin` → `ConnectSupperAdminFunc`
  - `ChartConfiguration` (ChartConfigManagerComponent): `CORRAdmin` → `ConnectSupperAdminFunc`

- [src/app/Modules/auth/auth-routing.module.ts](src/app/Modules/auth/auth-routing.module.ts) — commit `df00a05829a15ef440e496938f279758b8d6bff5` | 2026-01-25 16:38:02 +0200
  - `EncryptDecrypt` (EncryptDecryptComponent): `CORRAdmin` → `ConnectSupperAdminFunc`

- [src/app/Modules/AdminCertificates/Correspondances-routing.module.ts](src/app/Modules/AdminCertificates/Correspondances-routing.module.ts) — commit `a78028d891049f8a0f76197df09e79e6c4a546f2` | 2026-01-24 16:56:06 +0200
  - `Inbox` (TotalReuestsParentComponent): removed (prior func: `CorrInboxFunc`)
  - `OutBox` (TotalReuestsParentComponent): removed (prior func: `CorrOutboxFunc`)

- [src/app/Modules/top-maganement/top-maganement-routing.module.ts](src/app/Modules/top-maganement/top-maganement-routing.module.ts) — commit `786e99eb20ecf462773326e466d813298e364d20` | 2026-01-17 15:57:24 +0200
  - `ShowSubjects` (TotalReuestsParentComponent): `AddSubjectFunc` → `ViewSubjectFunc`

- [src/app/Modules/Correspondances/Correspondances-routing.module.ts](src/app/Modules/Correspondances/Correspondances-routing.module.ts) — commit `2dfa92aa444e2aecd2e0a2bb0e1fa858c1eddb13` | 2026-01-10 14:40:13 +0200
  - `AdminCer/Show` (AreaRequestsComponent): added — `AdminCerCSFunc`

- [src/app/Modules/enpopower-bi/enpopower-bi-routing.module.ts](src/app/Modules/enpopower-bi/enpopower-bi-routing.module.ts) — commit `b0aba21614cf7c8a8b10021bca81ff874705fdfc` | 2025-12-15 15:07:29 +0200
  - `MySelectStatements` (SelectGroupsComponent): added — `PowerBiFunc`

- [src/app/Modules/land-transport/land-transport-routing.module.ts](src/app/Modules/land-transport/land-transport-routing.module.ts) — commit `b0aba21614cf7c8a8b10021bca81ff874705fdfc` | 2025-12-15 15:07:29 +0200
  - `PrintTrafficLetter` (LettersPrintComponent): added — `CORR_landTransport_PrintLetter`
  - `RePrintTrafficLetter` (LettersPrintComponent): added — `CORR_landTransport_PrintLetter`
  - `LetraReplyUpload` (LetraReplyUploadComponent): added — `CORR_landTransport_UploadReply`
</div>
