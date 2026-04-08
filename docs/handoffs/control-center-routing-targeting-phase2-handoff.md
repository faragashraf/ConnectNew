# ControlCenterCatalog Routing Targeting - Phase 2 Handoff

تاريخ التحديث: 2026-04-08  
الفرع: `ControlCenterCatalog` (بدون branch switching)

## حالة المرحلة
- PHASE 2 (Backend + SQL Adjustments): **مكتمل**
- تم الالتزام الكامل بأن Oracle يظل Read-Only Reference فقط.
- كل التعديلات الجديدة (Schema + منطق إعدادات) تمت على SQL Server وطبقة Backend/Frontend contracts.

## 1) ما الذي تم في PHASE 2

1. تم توسيع نموذج `SubjectRoutingTargets` لدعم التصميم الجديد القائم على:
   - `SelectedNodeType`
   - `SelectedNodeNumericId`
   - `SelectedNodeUserId`
   - `AudienceResolutionMode`
   - `WorkDistributionMode`
2. تم تنفيذ Migration SQL Server لإضافة الأعمدة الجديدة + Backfill من النموذج القديم + Check Constraints + Indexes.
3. تم تحديث Entity + EF Mapping + DTOs + Service Mapping بحيث القراءة/الحفظ يدعمان النموذج الجديد مع توافق خلفي مع `TargetMode` القديم.
4. تم تحديث منطق Create/Update Target ليتحقق من:
   - صلاحية نوع العقدة
   - وجود العقدة في Oracle (Unit/Position/User)
   - توافق Audience مع نوع العقدة
   - توافق Work Distribution مع Audience
5. تم إضافة API قراءة موحد للشجرة التنظيمية:
   - `GET /api/DynamicSubjectsAdminRouting/Oracle/TreeNodes`
   - يدعم Roots/Children/Search ويدمج وحدات + مناصب + مستخدمين (اختياريًا).
6. تم تعزيز Validation Endpoint لمسار التوجيه بحيث يتحقق أيضًا من targets الحالية داخل Workspace (بما فيها فحص وجود العقدة في Oracle والتحذير عند عدم النشاط).
7. تم تحديث Frontend API contracts (`dto.ts` و `service.ts`) لدعم الحقول الجديدة وواجهة الشجرة الموحدة.

## 2) الملفات المعدلة

### Backend
- `ENPO.Connect.Backend/Models/Connect/SubjectRoutingTarget.cs`
- `ENPO.Connect.Backend/Models/DTO/DynamicSubjects/DynamicSubjectsAdminRoutingDtos.cs`
- `ENPO.Connect.Backend/Persistence/Data/ConnectContext.cs`
- `ENPO.Connect.Backend/Persistence/Migrations/20260408_AddSubjectRoutingTargetingModel.cs`
- `ENPO.Connect.Backend/Persistence/Services/DynamicSubjects/AdminRouting/IDynamicSubjectsAdminRoutingRepository.cs`
- `ENPO.Connect.Backend/Persistence/Services/DynamicSubjects/AdminRouting/DynamicSubjectsAdminRoutingRepository.cs`
- `ENPO.Connect.Backend/Persistence/Services/DynamicSubjects/AdminRouting/IDynamicSubjectsAdminRoutingService.cs`
- `ENPO.Connect.Backend/Persistence/Services/DynamicSubjects/AdminRouting/DynamicSubjectsAdminRoutingService.cs`
- `ENPO.Connect.Backend/Api/Controllers/DynamicSubjectsAdminRoutingController.cs`

### Frontend (Contracts فقط ضمن Phase 2)
- `ENPO.Connect.Frontend/src/app/shared/services/BackendServices/DynamicSubjectsAdminRouting/DynamicSubjectsAdminRouting.dto.ts`
- `ENPO.Connect.Frontend/src/app/shared/services/BackendServices/DynamicSubjectsAdminRouting/DynamicSubjectsAdminRouting.service.ts`

## 3) الجداول / Migrations / DTOs المعدلة

### SQL Server
- جدول مستهدف: `SubjectRoutingTargets`
- Migration مضافة: `20260408_AddSubjectRoutingTargetingModel`

### Columns مضافة
- `SelectedNodeType` `nvarchar(30)`
- `SelectedNodeNumericId` `decimal(18,0)`
- `SelectedNodeUserId` `nvarchar(20)`
- `AudienceResolutionMode` `nvarchar(40)`
- `WorkDistributionMode` `nvarchar(40)`

### Constraints مضافة
- `CK_SubjectRoutingTargets_SelectedNodeType`
- `CK_SubjectRoutingTargets_AudienceResolutionMode`
- `CK_SubjectRoutingTargets_WorkDistributionMode`

### Indexes مضافة
- `IX_SubjectRoutingTargets_SelectedNodeType_SelectedNodeNumericId`
- `IX_SubjectRoutingTargets_SelectedNodeUserId`

### Backfill
- تم اشتقاق القيم الجديدة من الحقول legacy (`TargetMode`, `OracleOrgUnitID`, `PositionID`, `PositionCode`, `SendToLeaderOnly`, `AllowMultipleReceivers`) حيث أمكن.

### DTOs
- `SubjectRoutingTargetDto` + `SubjectRoutingTargetUpsertRequestDto` تم توسيعهما بالحقول الجديدة.
- `SubjectRoutingOrgPositionLookupDto` و `SubjectRoutingOrgUserLookupDto` تم توسيعهما بحقوق عرض أسماء المستخدم.
- إضافة DTO جديد: `SubjectRoutingOrgTreeNodeDto`.

## 4) الـ APIs الجديدة أو المعدلة

### APIs معدلة (نفس المسار مع payload جديد)
- `POST /api/DynamicSubjectsAdminRouting/Targets`
- `PUT /api/DynamicSubjectsAdminRouting/Targets/{targetId}`
- `GET /api/DynamicSubjectsAdminRouting/Profiles/{profileId}/Workspace`
- `GET /api/DynamicSubjectsAdminRouting/Profiles/{profileId}/Preview`
- `GET /api/DynamicSubjectsAdminRouting/Profiles/{profileId}/Validation`

### API جديدة
- `GET /api/DynamicSubjectsAdminRouting/Oracle/TreeNodes`
  - Query params:
    - `parentNodeType`
    - `parentNodeNumericId`
    - `parentNodeUserId`
    - `search`
    - `activeOnly`
    - `includeUsers`

## 5) ما تم في الـ Backend Validation

1. على Create/Update Target:
   - منع حفظ target ناقص.
   - التحقق من صحة العقدة المستهدفة ووجودها في Oracle.
   - التحقق من توافق `AudienceResolutionMode` مع نوع العقدة.
   - التحقق من توافق `WorkDistributionMode` مع audience أحادي/متعدد.
2. على Validate Routing Profile:
   - فحص كل target نشط داخل الـ Workspace بنفس منطق التوافق.
   - التحقق من صحة الربط مع الخطوة.
   - التحقق من وجود node في Oracle.
   - إصدار Warnings عند وجود node غير نشط بدل كسر كامل المسار حيث يلزم.

## 6) ما تم في الفرونت ضمن Phase 2

- تحديث عقود TypeScript لدعم النموذج الجديد (Node/Audience/Distribution).
- إضافة عقدة DTO خاصة بالشجرة الموحدة.
- إضافة method في service لاستدعاء `Oracle/TreeNodes` بالخيارات اللازمة للـ Overlay في المرحلة التالية.
- لم يتم تنفيذ UI النهائي الجديد في هذه المرحلة (هذا ضمن PHASE 3).

## 7) التحقق والنتائج

- Backend build: **ناجح** (`dotnet build ENPO.Connect.Backend/ENPO.Connect.Backend.sln`) مع warnings قديمة موجودة مسبقًا بالمشروع.
- Frontend build: **ناجح** (`npm run build`) مع warnings CommonJS قديمة وغير مانعة.
- لا يوجد Errors ناتج عن تعديلات PHASE 2.

## 8) ما تبقى

- PHASE 3: Targeting UI Redesign with Tree Overlay (PrimeNG + RTL + Arabic + appendTo="body").
- PHASE 4: Visual Routing Restyling + Integration + Validation النهائية.

## 9) الخطوة التالية مباشرة

1. بناء واجهة اختيار الجهة المستهدفة عبر Tree Overlay/Dialog موحد.
2. إخفاء تعقيد `TargetMode` legacy من UI مع الحفاظ على التكامل الخلفي.
3. ربط حفظ target من الواجهة الجديدة بالحقول الحديثة فقط (مع استمرار التوافق في الباك إند).

## 10) Blockers / Assumptions

- لا يوجد blocker تقني يمنع بدء PHASE 3.
- افتراض قائم: بعض records legacy قد لا تُحوّل 1:1 إلى Tree Node (خاصة أوضاع target القديمة غير المباشرة)، لذلك يظل fallback backend قائمًا لحين اكتمال الانتقال الكامل.
- Oracle يظل مصدر مرجعي read-only ولم يتم المساس بأي schema فيه.

## Handoff Summary (جاهز للتسليم)

- **ما تم إنجازه:** SQL + Backend + API + Validation + Frontend contracts للنموذج الجديد Target Node/Audience/Distribution.
- **الملفات المعدلة:** موثقة بالكامل في القسم (2).
- **الجداول/الـ APIs/الـ Models المضافة:** موثقة بالأسماء في القسمين (3) و(4).
- **ما تبقى:** PHASE 3 و PHASE 4 فقط.
- **الخطوة التالية المباشرة:** بدء Targeting UI Tree Overlay.
- **Assumptions/Blockers:** موثقة في القسم (10).
