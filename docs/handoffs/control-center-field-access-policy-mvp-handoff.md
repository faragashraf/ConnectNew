# ControlCenterCatalog - Field/Group Access Policy (MVP Handoff)

## 1) ملخص التحليل قبل التنفيذ
- تم تحليل الوضع الحالي في `DynamicSubjects` و`ControlCenterCatalog`.
- تم اعتماد `AdminCatalogCategoryGroups` كمصدر Metadata للجروبات في التعديل الجديد (بدل الاعتماد على `MandGroups`).
- تم تحديد فجوة أساسية: لا توجد طبقة Access Resolver موحدة تربط Stage/Action مع صلاحيات Group/Field وتطبق الحسم قبل الحفظ.

## 2) ما تم تنفيذه فعليًا (MVP)
### قاعدة البيانات
- إضافة جداول جديدة:
  - `FieldAccessPolicies`
  - `FieldAccessPolicyRules`
  - `FieldAccessLocks`
  - `FieldAccessOverrides`
- إضافة migration:
  - `ENPO.Connect.Backend/Persistence/Migrations/20260409222435_20260409_AddFieldAccessPolicyMvp.cs`
- إضافة `ModelSnapshot`:
  - `ENPO.Connect.Backend/Persistence/Migrations/ConnectContextModelSnapshot.cs`

### Backend
- إضافة Access Resolver:
  - `IFieldAccessResolutionService`
  - `FieldAccessResolutionService`
  - `FieldAccessResolutionModels`
- إضافة Admin Access Policy Service + API:
  - `IDynamicSubjectsAdminAccessPolicyService`
  - `DynamicSubjectsAdminAccessPolicyService`
  - `DynamicSubjectsAdminAccessPolicyController`
- ربط Resolver داخل:
  - تحميل `FormDefinition`
  - التحقق قبل الحفظ (`Create/Update`) لمنع تعديل الحقول المخفية/المقفولة/للقراءة فقط
- إضافة Stage/Action context إلى:
  - `GetFormDefinition`
  - `SubjectUpsertRequest`
- تحويل تحميل جروبات الـ metadata في المسار الجديد إلى `AdminCatalogCategoryGroups`.

### Frontend
- إضافة Admin Workspace جديد متكامل tabbed:
  - `admin-control-center-catalog-field-access-policy-workspace.component.*`
- tabs المنفذة:
  - `Overview`
  - `Default Policy`
  - `Stage/Action Rules`
  - `Locks`
  - `Preview`
- ربط الشاشة داخل صفحة `ControlCenterCatalog` الرئيسية كجزء integrated management.
- إنشاء Backend service + DTOs للـ Access Policy:
  - `DynamicSubjectsAdminAccessPolicy.service.ts`
  - `DynamicSubjectsAdminAccessPolicy.dto.ts`
- تحديث DynamicSubjects frontend service لدعم `stageId/actionId/requestId`.
- جميع dropdown/overlay في شاشة Access Policy تستخدم `appendTo="body"`.

## 3) الحسم النهائي للصلاحيات
- أولوية الحسم المنفذة:
  - `Override > Action Rule > Stage Rule > Default`
- التوريث المنفذ:
  - `Field > Group > Request`
- الفصل المفاهيمي:
  - `Visibility` (CanView/IsHidden)
  - `Editability` (CanEdit/IsReadOnly)
  - `Input Requirement` (IsRequired)
  - `Lock State` (IsLocked/LockReason)

## 4) الجداول/APIs/الشاشات المعدلة
### جداول
- `FieldAccessPolicies`
- `FieldAccessPolicyRules`
- `FieldAccessLocks`
- `FieldAccessOverrides`

### APIs
- `GET /api/DynamicSubjectsAdminAccessPolicy/Workspace/{requestTypeId}`
- `PUT /api/DynamicSubjectsAdminAccessPolicy/Workspace/{requestTypeId}`
- `POST /api/DynamicSubjectsAdminAccessPolicy/Preview/{requestTypeId}`
- تحديث:
  - `GET /api/DynamicSubjects/FormDefinition/{categoryId}` (يدعم stage/action/request)
  - Create/Update dynamic subject requests (يدعم stage/action)

### الشاشات
- شاشة إدارة Access Policy داخل:
  - `Admin/ControlCenterCatalog` (Integrated)
- شاشة Preview ضمن نفس workspace لإظهار حالة كل group/field للمستخدم النهائي.

## 5) ما تم تأجيله intentionally
- محرك overrides متقدم (approval workflow / audit موسع / صلاحيات عليا متعددة المستويات).
- إدارة استثناءات instance-level كاملة UX.
- conflict-resolution متقدم beyond MVP.

## 6) سيناريوهات التحقق التي تم اختبارها
- Build backend: ناجح.
- Build frontend: ناجح.
- تم التحقق من مسارات الحسم برمجيًا داخل resolver:
  - Hidden/ReadOnly/Editable/RequiredInput.
  - Stage-only rule مقابل Stage+Action rule.
  - Lock modes (`NoEdit`, `NoInput`, `FullLock`).
- تم التحقق من server-side enforcement:
  - رفض تعديل حقول `Hidden`.
  - رفض تعديل حقول `ReadOnly`.
  - رفض تعديل حقول `Locked` مع سبب واضح.

## 7) ديون تقنية وملاحظات متبقية
- البيئة الحالية لا تحتوي اختبارات تكامل تلقائية تغطي UI+API+DB end-to-end للميزة الجديدة؛ يلزم إضافة test suite لاحق.
- توجد warnings قديمة في الحل (NuGet/TFM/CS1591) خارج نطاق هذه المهمة.
- ما زال جزء من النظام التاريخي يستخدم `MandGroups` في مسارات legacy غير مستهدفة في هذا MVP؛ المسار الجديد للميزة يعتمد على `AdminCatalogCategoryGroups`.
