# ControlCenterCatalog - Field Binding Migration Analysis (Pre-Implementation)

## 1) الحالة الحالية بدقة (As-Is)

### أين يتم تخزين ربط الحقول بالمجموعات الآن
- الربط الفعلي الحالي محفوظ في:
  - `CdCategoryMand`
  - الحقول الأساسية: `MendSQL`, `MendCategory`, `MendField`, `MendStat`, `MendGroup`
- `MendGroup` يشير عمليًا إلى `MandGroups.GroupID` (Legacy model).

### أين تعمل شجرة الجروبات الآن
- شجرة الجروبات الجديدة تعمل على:
  - `AdminCatalogCategoryGroups`
- هذا يعني أن لدينا اليوم انفصالًا بنيويًا:
  - Group Tree من الجدول الجديد
  - Field Binding من الجدول القديم

### منطق الـ bridge الانتقالي
- موجود في:
  - `Persistence/Services/DynamicSubjects/SubjectCategoryGroupBridge.cs`
- يستخدم تحويل legacy↔canonical عبر:
  - direct ID match
  - name match
- يتم استدعاؤه في مسارات:
  - `DynamicSubjectsService`
  - `DynamicSubjectsAdminService`
  - `DynamicSubjectsAdminAccessPolicyService`
  - `FieldAccessResolutionService`

## 2) الجداول المستخدمة فعليًا في المسارات المطلوبة

### تحميل الحقول / preview definition
- يعتمد على `CdCategoryMand` + `SubjectCategoryFieldSettings` + `CDMend`
- مع ترجمة group ids عبر `SubjectCategoryGroupBridge`.
- ملفات رئيسية:
  - `DynamicSubjectsService.cs`
  - `DynamicSubjectsAdminService.cs`

### تحميل المجموعات
- المسار الجديد (ControlCenterCatalog):
  - `AdminCatalogCategoryGroups`
  - عبر `DynamicSubjectsAdminCatalogService/Repository`
- المسار القديم (Admin/Groups):
  - `MandGroups`
  - عبر `DynamicSubjectsAdminService.GetAdminGroupsAsync`

### حفظ الربط
- حاليًا يتم الحفظ في `CdCategoryMand` (وليس جدول جديد) داخل:
  - `DynamicSubjectsAdminService.UpsertAdminCategoryFieldLinksAsync`
- مع محاولات bridge/create fallback legacy groups في `MandGroups`.

### Access Policy / Preview Resolution
- Metadata (groups/fields) يتم تحميلها من `CdCategoryMand`.
- ثم يتم canonicalization عبر bridge.
- ملفات رئيسية:
  - `DynamicSubjectsAdminAccessPolicyService.cs`
  - `FieldAccessResolutionService.cs`

## 3) أقل طريقة آمنة للنقل (Target Migration Strategy)

### القرار البنيوي المقترح
- إضافة جدول ربط جديد صريح مرتبط مباشرة بالبنية الجديدة:
  - `AdminCatalogCategoryFieldBindings`
- يكون هو Source of Truth لمسار البناء الجديد.

### التصميم المقترح للجدول الجديد
- `MendSQL` (PK, non-identity) للحفاظ على استقرار IDs الحالية المستخدمة في settings/policy targeting.
- `CategoryID` (FK -> `CDCategory.CatId`)
- `MendField` (field key)
- `MendStat` (active/inactive)
- `GroupID` (FK -> `AdminCatalogCategoryGroups.GroupId`)
- فهارس تغطي:
  - `CategoryID + MendStat + GroupID`
  - `CategoryID + MendField`

### لماذا جدول جديد وليس تعديل القديم
- يمنع استمرار الاعتماد البنيوي على `MandGroups`.
- يسمح بقراءة/حفظ مباشر من النموذج الجديد بدون bridge runtime كآلية أساسية.
- يحافظ على التوافق المؤقت عبر sync محدود إلى القديم بدل البناء فوقه.

## 4) خطة ترحيل البيانات (Backfill)

### قواعد الـ mapping المطلوبة
- direct id match:
  - لو `CdCategoryMand.MendGroup` يطابق group موجودًا في `AdminCatalogCategoryGroups` لنفس category.
- unique name match:
  - مطابقة اسم legacy group مع اسم admin group داخل نفس category عندما تكون النتيجة فريدة.
- ambiguous cases:
  - عند وجود أكثر من candidate باسم مطابق.
- missing groups:
  - عند غياب أي candidate.

### معالجة آمنة للحالات غير النظيفة
- لا يتم دفن ambiguous بصمت.
- سيتم تسجيل الحالات غير النظيفة بشكل قابل للمراجعة (migration log/review markers).
- في missing/ambiguous سيتم إنشاء canonical groups انتقالية (auto-migrated) عند الحاجة للحفاظ على أكبر قدر من البيانات الصالحة.

## 5) أثر النقل على الشاشات والـ APIs والبيانات

### الشاشات الجديدة
- يجب أن تعتمد على:
  - `AdminCatalogCategoryGroups` للشجرة
  - `AdminCatalogCategoryFieldBindings` للربط
- بدون decision-making على `MandGroups`.

### الشاشات القديمة
- يمكن الإبقاء على compatibility مؤقت عبر:
  - sync write محدود من الجديد إلى `CdCategoryMand`/`MandGroups` عند الحاجة.

### APIs الحالية
- نفس العقود (DTOs) يمكن الإبقاء عليها غالبًا.
- التنفيذ الداخلي سيتحول إلى الجدول الجديد.

### البيانات الحالية
- سيتم backfill من legacy إلى الجديد.
- بعد الترحيل، القراءة الأساسية ستكون من الجدول الجديد.

## 6) نقاط Red Flag التي تم رصدها قبل التنفيذ
- `ConnectContextModelSnapshot` يجب تحديثه بدقة مع أي كيان/FK/Indexes جديدة.
- أي migration SQL يجب أن يأتي بعد schema creation (لا data SQL قبل إنشاء الجداول/القيود المطلوبة).
- مسارات `DynamicSubjectsService` و`DynamicSubjectsAdminAccessPolicyService` تقرأ الآن من `CdCategoryMand`، ويجب نقلها إلى المصدر الجديد مباشرة.

## 7) ما سيتم تنفيذه في المرحلة التالية مباشرة
1. إضافة الكيان والـ mapping في EF + migration للجدول الجديد.
2. تنفيذ backfill مع قواعد direct/name/ambiguous/missing + تسجيل الحالات غير النظيفة.
3. تحويل load/save لمسارات field links إلى الجدول الجديد.
4. تحويل preview/policy metadata loading إلى الجدول الجديد.
5. إبقاء compatibility sync محدود للقديم فقط عند الحاجة.
6. تحديث الواجهات المتأثرة لضمان عدم mismatch بين group tree وfield membership.
