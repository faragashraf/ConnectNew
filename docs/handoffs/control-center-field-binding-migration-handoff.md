# ControlCenterCatalog - Field Binding Migration Handoff (Post-Implementation)

## 0) Scope Confirmation
تم تنفيذ هذه المرحلة بنطاقها المحدد فقط:
- نقل مصدر ربط الحقول إلى بنية `AdminCatalogCategoryGroups` الجديدة.
- إنشاء persistence صريح للربط الجديد.
- Backfill آمن من الربط القديم.
- تحويل مسارات backend/frontend المطلوبة لتعمل على المصدر الجديد.
- إبقاء توافق legacy محدود وواضح دون البناء عليه كـ source of truth.

---

## 1) التصميم الجديد للربط

### المصدر المعماري المعتمد الآن
- `AdminCatalogCategoryGroups` هو المصدر الأساسي لشجرة الجروبات.
- جدول ربط جديد صريح للحقول تم إضافته:
  - `AdminCatalogCategoryFieldBindings`

### نموذج العلاقة الجديد
- `Field (MendField/MendSql)` ↔ `Group (GroupId)` ↔ `Category (CategoryId)`
- الربط يُحفظ مباشرة عبر:
  - `AdminCatalogCategoryFieldBindings.MendSQL` (PK)
  - `AdminCatalogCategoryFieldBindings.CategoryID` (FK -> `CDCategory.CatId`)
  - `AdminCatalogCategoryFieldBindings.GroupID` (FK -> `AdminCatalogCategoryGroups.GroupId`)
  - `AdminCatalogCategoryFieldBindings.MendField`
  - `AdminCatalogCategoryFieldBindings.MendStat`

### سبب الاختيار
- يمنع الاعتماد البنيوي على `MandGroups/CdCategoryMand` في ميزات البناء الجديدة.
- يوفر persistence مباشر وواضح بدل runtime bridge فقط.
- يسمح بتوافق legacy انتقالي عبر sync محدود فقط.

---

## 2) أين تُحفظ علاقة Field ↔ Group الآن
- الحفظ الرسمي أصبح في:
  - `AdminCatalogCategoryFieldBindings`
- هذا مطبق في:
  - `DynamicSubjectsAdminService.UpsertAdminCategoryFieldLinksAsync(...)`
- القراءة الجديدة في المسارات الحديثة أصبحت من نفس الجدول (وليس `CdCategoryMand`) في:
  - Dynamic subject definition loading
  - Access policy workspace metadata
  - Preview metadata/resolution context
  - Admin catalog counters/diagnostics

---

## 3) ترحيل البيانات القديمة (Migration / Backfill)

### Migration المنفذة
- `20260410013927_20260410_AddAdminCatalogCategoryFieldBindings`

### ما الذي تنفذه
1. إنشاء جدول `AdminCatalogCategoryFieldBindings` + الفهارس + العلاقات.
2. إنشاء جدول مراجعة migration issues:
   - `AdminCatalogCategoryFieldBindingMigrationIssues`
3. Backfill من `CdCategoryMand` إلى البنية الجديدة عبر mapping rules:
   - **Direct ID Match**: عند تطابق `MendGroup` مع `AdminCatalogCategoryGroups.GroupId` لنفس `Category`.
   - **Unique Name Match**: عند تطابق الاسم (normalized) وكان المرشح فريدًا.
   - **Ambiguous Name**: عند تعدد المرشحين بنفس الاسم.
   - **Missing Group**: لا direct id ولا unique name.
4. للحالات غير المحلولة (`Ambiguous/Missing`) يتم إنشاء canonical groups انتقالية في `AdminCatalogCategoryGroups` ثم إكمال الربط.
5. تسجيل الحالات غير النظيفة بوضوح في جدول issues.
6. تسجيل أي link غير قابل للحل كـ `UNRESOLVED_LINK` بدلاً من دفنه بصمت.

### قابلية المراجعة
- الحالات ambiguous/missing أصبحت قابلة للمراجعة عبر:
  - `AdminCatalogCategoryFieldBindingMigrationIssues`

---

## 4) ما الذي ما زال يعتمد على `MandGroups` مؤقتًا

### Legacy screens/services (توافق مؤقت)
ما زالت endpoints القديمة للجروبات تعتمد على legacy model:
- `GetAdminGroupsAsync`
- `CreateAdminGroupAsync`
- `UpdateAdminGroupAsync`
- `DeleteAdminGroupAsync`

### Compatibility sync (محدود وواضح)
- بعد حفظ الروابط الجديدة في `AdminCatalogCategoryFieldBindings`، يوجد sync محدود إلى القديم عبر:
  - `SyncLegacyCategoryFieldBindingsAsync(...)`
- الهدف: إبقاء الشاشات القديمة عاملة مؤقتًا فقط.
- ليس مصدر قرار للمسارات الجديدة.

### Bridge fallback في policy/resolution
- `SubjectCategoryGroupBridgeBuilder` ما زال يدعم قراءة legacy IDs **فقط** عند الحاجة لتحويل قواعد/locks/overrides القديمة.
- تم تقليل هذا الاعتماد:
  - لا يتم query على `MandGroups` إلا لمرشحات IDs legacy المستنتجة من rules/locks/overrides.

---

## 5) ما الذي أصبح يعتمد على `AdminCatalogCategoryGroups` + الربط الجديد فقط

### Backend
- Form/definition loading في `DynamicSubjectsService`:
  - groups من `AdminCatalogCategoryGroups`
  - field links من `AdminCatalogCategoryFieldBindings`
- Access policy workspace metadata في `DynamicSubjectsAdminAccessPolicyService`:
  - groups/fields من البنية الجديدة.
- Preview resolution context:
  - metadata مبني على البنية الجديدة.
- Field link counters/usage في admin catalog repository:
  - من `AdminCatalogCategoryFieldBindings`.
- category dynamic-field checks:
  - تعتمد على `AdminCatalogCategoryFieldBindings`.

### Frontend (Control Center)
- Field Library Binding page:
  - تحميل الجروبات من `AdminCatalog` group tree (`getGroupsByCategory`).
  - إنشاء مجموعة افتراضية عبر `AdminCatalog` (`createGroup`).
  - حفظ روابط الحقول يذهب إلى backend الذي يحفظ على الجدول الجديد.

---

## 6) التحقق المنفذ

### Build/compile
- Backend:
  - `dotnet build ENPO.Connect.Backend/Persistence/Persistence.csproj` ✅
  - `dotnet build ENPO.Connect.Backend/ENPO.Connect.Backend.sln` ✅
- Frontend:
  - `npm run build` داخل `ENPO.Connect.Frontend` ✅

### سيناريوهات المرحلة
تم التحقق برمجيًا (code-path verification) أن:
1. ربط الحقل بالجروب يعتمد على `AdminCatalogCategoryFieldBindings` + `AdminCatalogCategoryGroups`.
2. تغيير الربط يمر عبر save path الجديد ويصل لمسارات preview metadata.
3. policy targeting على group يتم تطبيعه إلى canonical group IDs قبل resolution.
4. لا يوجد mismatch معماري بين tree المصدر والfield membership المصدر في المسارات الجديدة.
5. الشاشات الجديدة لا تتخذ قرارها من `MandGroups`.

ملاحظة: لم يتم تنفيذ تشغيل end-to-end على قاعدة بيانات تشغيلية فعلية ضمن هذه البيئة، لذلك تحقق السيناريوهات تم عبر مراجعة مسارات التنفيذ + build ناجح.

---

## 7) المخاطر/الديون التقنية المتبقية
1. وجود legacy APIs للجروبات ما زال مطلوبًا مؤقتًا لتوافق الشاشات القديمة.
2. جدول `AdminCatalogCategoryFieldBindingMigrationIssues` يحتاج متابعة بعد تطبيق migration على البيئة الفعلية.
3. المجموعات auto-created للحالات ambiguous/missing قد تحتاج تنظيف/دمج تشغيلي بعد المراجعة.
4. يمكن لاحقًا تقليل compatibility sync أكثر عند إيقاف المسارات القديمة بالكامل.

---

## 8) أمثلة عملية (على البنية الجديدة)

### Group hierarchy
- المصدر: `AdminCatalogCategoryGroups`.
- أي tree تُعرض في الشاشات الجديدة تأتي من هذا الجدول مباشرة.

### Field binding
- المثال: ربط field X مع group G في category C.
- الحفظ يتم في `AdminCatalogCategoryFieldBindings` (`CategoryID=C`, `GroupID=G`, `MendField=X`).

### Preview
- Preview metadata يحمّل fields من `AdminCatalogCategoryFieldBindings` وgroups من `AdminCatalogCategoryGroups`.
- بالتالي field يظهر تحت نفس canonical group المستخدم في الشجرة.

### Policy inheritance/targeting
- إذا كانت قاعدة قديمة تستهدف legacy group id، يتم canonicalization عبر bridge إلى group id الجديد قبل تطبيق القاعدة.
- القواعد الجديدة المستخرجة من workspace تعمل مباشرة على canonical groups.

---

## 9) ملفات التنفيذ الأساسية
- Model + DbContext:
  - `Models/Connect/AdminCatalogCategoryFieldBinding.cs`
  - `Persistence/Data/ConnectContext.cs`
- Migration + Snapshot:
  - `Persistence/Migrations/20260410013927_20260410_AddAdminCatalogCategoryFieldBindings.cs`
  - `Persistence/Migrations/20260410013927_20260410_AddAdminCatalogCategoryFieldBindings.Designer.cs`
  - `Persistence/Migrations/ConnectContextModelSnapshot.cs`
- Backend services:
  - `Persistence/Services/DynamicSubjects/DynamicSubjectsService.cs`
  - `Persistence/Services/DynamicSubjects/DynamicSubjectsAdminService.cs`
  - `Persistence/Services/DynamicSubjects/AdminAccessPolicy/DynamicSubjectsAdminAccessPolicyService.cs`
  - `Persistence/Services/DynamicSubjects/FieldAccess/FieldAccessResolutionService.cs`
  - `Persistence/Services/DynamicSubjects/SubjectCategoryGroupBridge.cs`
  - `Persistence/Services/DynamicSubjects/AdminCatalog/DynamicSubjectsAdminCatalogRepository.cs`
- Frontend:
  - `ENPO.Connect.Frontend/src/app/Modules/admin-control-center/pages/field-library-binding/field-library-binding-page.component.ts`
