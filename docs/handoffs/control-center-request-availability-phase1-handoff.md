# ControlCenterCatalog Request Availability - Phase 1 Handoff

تاريخ التحديث: 2026-04-08  
الفرع: `ControlCenterCatalog` (بدون branch switching)

## حالة المرحلة
- PHASE 1 (Analysis + Model Design): **مكتمل**
- لم يتم بدء PHASE 2 أو PHASE 3 التزامًا بالتسلسل المطلوب.

## 1) ما تم في PHASE 1
- مراجعة الموديلات الحالية الخاصة بإعدادات نوع الطلب داخل ControlCenterCatalog.
- تحليل موضع التخزين الحالي (`SubjectTypeAdminSettings.SettingsJson`) وتأثيره على الإتاحة.
- تحليل الشجرة التنظيمية الحالية ومصدرها من Oracle (وحدات/مناصب/مستخدمين).
- تحديد تصميم واضح لإضافة "إتاحة الطلب" كجزء مستقل قبل التوجيه.
- تحديد تأثير التعديل على APIs والـ DTOs والواجهة دون تنفيذ برمجي حتى الآن.

## 2) Model Design Summary

### 2.1 الهدف المعماري
فصل "من يحق له تسجيل الطلب" عن أي منطق خاص بـ:
- Routing Targeting
- الجهة المستهدفة لخطوة
- Work Distribution
- owner

يعني ذلك أن **Request Availability** ستكون طبقة مستقلة على مستوى **نوع الطلب** (`SubjectTypeId / CategoryId`) وتسبق التوجيه.

### 2.2 الوضع الحالي (As-Is)
- جدول `SubjectTypeAdminSettings` يحتوي:
  - `CategoryID`
  - `DisplayOrder`
  - `SettingsJson`
  - حقول audit
- `SettingsJson` يستخدم حاليًا لتخزين `requestPolicy` و`directionLifecycle`.
- `requestPolicy.accessPolicy` الحالي Unit-based بالأساس (`CreateScope.UnitIds`) ولا يمثل Position/SpecificUser بشكل موثوق كنموذج Availability مستقل.
- Routing Targeting موجود بالفعل في جدول منفصل `SubjectRoutingTargets` ويخدم خطوة التوجيه وليس إتاحة تسجيل الطلب.

### 2.3 التصميم المقترح (To-Be)
**التوصية الأساسية:** إنشاء كيان/جدول مستقل في SQL Server باسم:
- `SubjectTypeRequestAvailability`

مع علاقة `1:1` مع نوع الطلب (`CDCategory.CatId`).

#### الحقول الأساسية المقترحة
- `CategoryID` (PK + FK -> `CDCategory.CatId`)
- `AvailabilityMode` (`nvarchar(20)`, required)
  - `Public`
  - `Restricted`
- `SelectedNodeType` (`nvarchar(20)`, nullable)
  - `OrgUnit`
  - `Position`
  - `SpecificUser`
- `SelectedNodeNumericId` (`decimal(18,0)`, nullable)
  - يستخدم مع `OrgUnit` و`Position`
- `SelectedNodeUserId` (`nvarchar(20)`, nullable)
  - يستخدم مع `SpecificUser`
- `SelectionLabelAr` (`nvarchar(300)`, nullable) — snapshot اختياري لاسم الاختيار لحسن العرض
- `SelectionPathAr` (`nvarchar(1000)`, nullable) — snapshot اختياري لمسار الشجرة
- `LastValidatedAtUtc` (`datetime2`, nullable)
- `LastValidatedBy` (`nvarchar(64)`, nullable)
- `LastModifiedBy` (`nvarchar(64)`, required)
- `LastModifiedAtUtc` (`datetime2`, required, default `GETUTCDATE()`)

### 2.4 قواعد الاتساق المقترحة
- إذا `AvailabilityMode = Public`:
  - `SelectedNodeType/SelectedNodeNumericId/SelectedNodeUserId` يجب أن تكون `NULL`.
- إذا `AvailabilityMode = Restricted`:
  - `SelectedNodeType` required.
  - إذا `SelectedNodeType IN ('OrgUnit','Position')`:
    - `SelectedNodeNumericId` required.
    - `SelectedNodeUserId` must be `NULL`.
  - إذا `SelectedNodeType = 'SpecificUser'`:
    - `SelectedNodeUserId` required.
    - `SelectedNodeNumericId` must be `NULL`.

### 2.5 لماذا جدول مستقل وليس حقول داخل `SubjectTypeAdminSettings`
- `SettingsJson` payload متعدد الأغراض بالفعل، وزيادة منطق الإتاحة داخله تزيد coupling وصعوبة validation SQL-level.
- المتطلب يطلب Availability مستقلة عن التوجيه، والجدول المستقل يحقق الفصل الوظيفي بوضوح.
- يسهل إضافة قيود/check indexes صريحة وقراءة سريعة بدون parsing JSON.
- يبقي `requestPolicy` الحالي متاحًا للتوافق الخلفي، مع انتقال منظم لاحقًا إذا لزم.

## 3) API Impact Summary

### 3.1 الوضع الحالي
- لا توجد APIs مخصصة لـ Request Availability داخل `DynamicSubjectsAdminRoutingController`.
- توجد APIs Oracle Tree جاهزة (`Oracle/TreeNodes`, `Oracle/Units`, `Oracle/Positions`, `Oracle/Users`) ويمكن إعادة استخدامها مباشرة.

### 3.2 APIs المقترحة للإضافة في Phase 2
ضمن Controller جديد أو ضمن `DynamicSubjectsAdminRoutingController` (الأقرب حاليًا لإعادة استخدام الشجرة):

1. `GET /api/DynamicSubjectsAdminRouting/Availability/{subjectTypeId}`
- يعيد إعدادات الإتاحة الحالية لنوع الطلب.

2. `PUT /api/DynamicSubjectsAdminRouting/Availability/{subjectTypeId}`
- حفظ/تحديث إعدادات الإتاحة.

3. `POST /api/DynamicSubjectsAdminRouting/Availability/{subjectTypeId}/ValidateNode`
- تحقق backend من العقدة المختارة (وجودها/توافق نوعها مع المرجع Oracle).

4. إعادة استخدام:
- `GET /api/DynamicSubjectsAdminRouting/Oracle/TreeNodes`
- مع `includeUsers=true/false` حسب دعم البيانات.

### 3.3 DTOs المقترحة
- `SubjectTypeRequestAvailabilityDto`
- `SubjectTypeRequestAvailabilityUpsertRequestDto`
- `SubjectAvailabilityNodeValidationRequestDto`
- `SubjectAvailabilityNodeValidationResultDto`

مع تمثيل واضح:
- `availabilityMode`
- `selectedNodeType`
- `selectedNodeNumericId`
- `selectedNodeUserId`
- `selectedNodeLabelAr`
- `descriptionAr` (نص عرض جاهز للواجهة)

## 4) DB Impact Summary

### 4.1 SQL Server only
- إضافة جدول جديد `SubjectTypeRequestAvailability` (SQL Server فقط).
- إضافة FK على `CDCategory`.
- إضافة check constraints لقواعد Public/Restricted.
- إضافة فهارس:
  - `IX_SubjectTypeRequestAvailability_AvailabilityMode`
  - `IX_SubjectTypeRequestAvailability_SelectedNodeType_SelectedNodeNumericId`
  - `IX_SubjectTypeRequestAvailability_SelectedNodeUserId`

### 4.2 Oracle
- لا يوجد أي تعديل على Oracle schema.
- Oracle يظل read-only reference للتحقق فقط.

### 4.3 Migration strategy
- Migration idempotent على نمط المشروع الحالي.
- ترتيبها بعد `20260408_AddSubjectRoutingTargetingModel`.
- لا يوجد `ModelSnapshot` في المشروع حاليًا، لذا فحص ordering يعتمد على أسماء migration + SQL guards.

## 5) Tree Source Analysis

### 5.1 المصادر الفعلية
من `GPAContext` (Oracle):
- `ORG_UNIT_TYPES` -> أنواع الوحدات
- `ORG_UNITS` -> الوحدات التنظيمية
- `USER_POSITIONS` -> المناصب/الوظائف وربطها بوحدة/مستخدم
- `CONNECT_USERS` -> بيانات المستخدمين (ArabicName, FirstName, LastName)

### 5.2 ما هو مدعوم اليوم
- الشجرة الموحدة `Oracle/TreeNodes` تدعم:
  - `OrgUnit`
  - `Position`
  - `SpecificUser` (عند توفر userId)
- مع metadata:
  - `nodeType`
  - `nodeNumericId` أو `nodeUserId`
  - `labelAr`
  - `secondaryLabelAr`
  - `parentNodeType/parentNodeNumericId`
  - `isSelectable`

### 5.3 ملاحظات الجودة
- `SpecificUser` مدعوم فعليًا، لكن جودة التسمية تعتمد على اكتمال `CONNECT_USERS`.
- `Position` يظهر غالبًا كـ `PositionId` (مثل: "منصب #123") وليس مسمى وظيفي domain title مستقل.
- هذا لا يمنع التنفيذ، لكنه مهم كـ assumption موثق.

## 6) موضع الواجهة المقترح (Phase 3)
- إضافة قسم مستقل داخل `admin-control-center-catalog-routing-workspace` قبل/بجانب قسم Routing Targets، بعنوان:
  - `إتاحة الطلب`
- مكونات القسم:
  - اختيار نمط الإتاحة: `عام` / `محدد`
  - عند `عام`: رسالة عربية توضيحية فقط
  - عند `محدد`: فتح Dialog لاختيار عقدة من الشجرة التنظيمية (إعادة استخدام tree dialog pattern)
  - Summary واضح للنمط + نوع العقدة + اسمها + معنى الإتاحة
- لا يتم خلط هذا القسم مع targetForm الخاص بالخطوات.

## 7) الملفات التي تمت مراجعتها في التحليل

### Backend
- `ENPO.Connect.Backend/Models/Connect/SubjectTypeAdminSetting.cs`
- `ENPO.Connect.Backend/Persistence/Data/ConnectContext.cs`
- `ENPO.Connect.Backend/Persistence/Migrations/20260404_AddDynamicSubjectsAdminWorkspace.cs`
- `ENPO.Connect.Backend/Persistence/Services/DynamicSubjects/DynamicSubjectsService.cs`
- `ENPO.Connect.Backend/Persistence/Services/DynamicSubjects/RequestPolicyResolver.cs`
- `ENPO.Connect.Backend/Api/Controllers/DynamicSubjectsController.cs`
- `ENPO.Connect.Backend/Api/Controllers/DynamicSubjectsAdminRoutingController.cs`
- `ENPO.Connect.Backend/Persistence/Services/DynamicSubjects/AdminRouting/IDynamicSubjectsAdminRoutingService.cs`
- `ENPO.Connect.Backend/Persistence/Services/DynamicSubjects/AdminRouting/DynamicSubjectsAdminRoutingService.cs`
- `ENPO.Connect.Backend/Persistence/Services/DynamicSubjects/AdminRouting/IDynamicSubjectsAdminRoutingRepository.cs`
- `ENPO.Connect.Backend/Persistence/Services/DynamicSubjects/AdminRouting/DynamicSubjectsAdminRoutingRepository.cs`
- `ENPO.Connect.Backend/Persistence/Data/GPAContext.cs`
- `ENPO.Connect.Backend/Models/GPA/OrgStructure/OrgUnit.cs`
- `ENPO.Connect.Backend/Models/GPA/OrgStructure/UserPosition.cs`
- `ENPO.Connect.Backend/Models/GPA/PosUser.cs`

### Frontend
- `ENPO.Connect.Frontend/src/app/app-routing.module.ts`
- `ENPO.Connect.Frontend/src/app/Modules/admin-control-center-catalog/pages/admin-control-center-catalog-page/admin-control-center-catalog-page.component.html`
- `ENPO.Connect.Frontend/src/app/Modules/admin-control-center-catalog/pages/admin-control-center-catalog-routing-workspace/admin-control-center-catalog-routing-workspace.component.ts`
- `ENPO.Connect.Frontend/src/app/Modules/admin-control-center-catalog/pages/admin-control-center-catalog-routing-workspace/admin-control-center-catalog-routing-workspace.component.html`
- `ENPO.Connect.Frontend/src/app/shared/services/BackendServices/DynamicSubjectsAdminRouting/DynamicSubjectsAdminRouting.dto.ts`
- `ENPO.Connect.Frontend/src/app/shared/services/BackendServices/DynamicSubjectsAdminRouting/DynamicSubjectsAdminRouting.service.ts`
- `ENPO.Connect.Frontend/src/app/shared/services/BackendServices/DynamicSubjects/DynamicSubjects.dto.ts`

## 8) ما تبقى
- PHASE 2 بالكامل:
  - DB migration + entity + DTO + service + API + validations لإتاحة الطلب.
- PHASE 3 بالكامل:
  - واجهة عربية RTL مستقلة لـ "إتاحة الطلب" + tree selection + save/load.

## 9) الخطوة التالية مباشرة
- بدء PHASE 2 بتنفيذ جدول `SubjectTypeRequestAvailability` وواجهات API الخاصة به مع reuse لشجرة Oracle الحالية.

## 10) Blockers / Assumptions
- لا يوجد blocker تقني يمنع بدء PHASE 2.
- Assumption: `SpecificUser` مدعوم وظيفيًا من Oracle (`CONNECT_USERS` + `USER_POSITIONS`) لكن جودة display name تعتمد على اكتمال البيانات المرجعية.
- Assumption: الحفاظ على `requestPolicy` الحالي للتوافق، وعدم دمج Availability الجديدة داخله في هذه المرحلة.
- تذكير إلزامي: **Field Library Binding ما زالت غير مكتملة**.
- تذكير إلزامي: بعد هذه الإعدادات يوجد **Execution/Verification Pass** لاحق قبل أي مرحلة متقدمة.

## Handoff Summary
- **ما تم**: إغلاق تحليل وتصميم PHASE 1 بالكامل مع قرار نموذج بيانات مستقل لإتاحة الطلب قبل التوجيه.
- **الملفات المعدلة**: ملف توثيق Handoff فقط.
- **الجداول/DTOs/APIs**: تحديد تصميمها وتأثيرها (تحليل فقط، بدون تنفيذ بعد).
- **ما تبقى**: تنفيذ PHASE 2 ثم PHASE 3.
- **الخطوة التالية مباشرة**: بدء PHASE 2 (Backend + Database + API).
- **Blockers/Assumptions**: موثقة في القسم (10).
