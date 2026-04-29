# ControlCenterCatalog Routing Targeting - Phase 1 Handoff

تاريخ التحديث: 2026-04-08  
الفرع: `ControlCenterCatalog` (بدون branch switching)

## حالة المرحلة
- PHASE 1 (Analysis + Model Refinement): **مكتمل**
- تم الالتزام بعدم البدء في Phase 2 قبل إغلاق تحليل Phase 1.

## 1) ما تم إنجازه في PHASE 1
- مراجعة نموذج البيانات الحالي في SQL/Backend/Frontend الخاص بـ Routing Targets/Steps/Preview/Validation.
- تحليل فجوة التصميم بين نموذج `TargetMode` الحالي وبين النموذج المطلوب (Node Selection + Audience + Distribution).
- توثيق خطة Refinement واضحة وقابلة للتنفيذ مع الحفاظ على التوافق الخلفي.
- تحليل APIs الحالية (ما يُمدد وما يُستبدل وما يُحافظ عليه).
- تحليل مصدر الشجرة التنظيمية من Oracle (وحدات/مناصب/أشخاص) وتحديد الفجوات الفعلية.

## 2) Model Refinement Summary

### 2.1 الوضع الحالي (As-Is)
- نموذج target الحالي يعتمد على:
  - `TargetMode`
  - `OracleUnitTypeId`
  - `OracleOrgUnitId`
  - `PositionId`
  - `PositionCode`
  - `AllowMultipleReceivers`
  - `SendToLeaderOnly`
- هذا ظاهر في:
  - `SubjectRoutingTarget` (Backend Entity)
  - `SubjectRoutingTargetDto` و `SubjectRoutingTargetUpsertRequestDto`
  - `targetForm` و `targetModeOptions` في واجهة Routing.

### 2.2 المشكلة المعمارية
- `TargetMode` الحالي يخلط بين 3 طبقات مختلفة في حقل واحد/منطق واحد:
  1. اختيار العقدة المستهدفة (Node Selection)
  2. دائرة المؤهلين (Eligibility / Audience)
  3. أسلوب توزيع العمل (Work Distribution)
- النتيجة: UI معقد، وصعب التوسع لاحقًا نحو Runtime Assignment بشكل نظيف.

### 2.3 النموذج المطلوب (To-Be)
يوصى بفصل الهدف إلى 3 طبقات صريحة:
1. **Target Node Selection**
   - `SelectedNodeType`: `OrgUnit | Position | SpecificUser`
   - `SelectedNodeNumericId` (لـ OrgUnit/Position)
   - `SelectedNodeUserId` (لـ SpecificUser)
2. **Audience Resolution**
   - `AudienceResolutionMode`: أمثلة
     - `OrgUnitAllMembers`
     - `OrgUnitLeaderOnly`
     - `PositionOccupants`
     - `SpecificUserOnly`
3. **Work Distribution**
   - `WorkDistributionMode`: أمثلة
     - `SharedInbox`
     - `AutoDistributeActive`
     - `ManualAssignment`

### 2.4 Mapping واضح بين القديم والمطلوب

| التصميم الحالي | التصميم المطلوب (داخلي) | ملاحظات التوافق |
|---|---|---|
| `SpecificUnit + OracleOrgUnitId + SendToLeaderOnly=false` | `SelectedNodeType=OrgUnit`, `SelectedNodeNumericId=OracleOrgUnitId`, `AudienceResolutionMode=OrgUnitAllMembers` | قابل للتحويل المباشر |
| `SpecificUnit + OracleOrgUnitId + SendToLeaderOnly=true` | `SelectedNodeType=OrgUnit`, `SelectedNodeNumericId=OracleOrgUnitId`, `AudienceResolutionMode=OrgUnitLeaderOnly` | قابل للتحويل المباشر |
| `Position + PositionId/PositionCode` | `SelectedNodeType=Position`, `SelectedNodeNumericId=PositionId` (أو fallback code) ، `AudienceResolutionMode=PositionOccupants` | قابل للتحويل غالبًا |
| `CommitteeMembers + PositionCode(userId)` | `SelectedNodeType=SpecificUser`, `SelectedNodeUserId=PositionCode`, `AudienceResolutionMode=SpecificUserOnly` | تحويل احتمالي، يحتاج تحقق من قيمة `PositionCode` |
| `UnitType / UnitLeader / ParentUnitLeader / ChildUnitByType` | لا تمثل اختيار Node ثابت مباشر | تبقى legacy-compatible في الباك إند أو تُحوّل عبر قواعد إضافية لاحقًا |

### 2.5 استراتيجية التوافق المقترحة
- **توصية**: الحفاظ على أعمدة legacy الحالية في `SubjectRoutingTargets` في Phase 2، وإضافة الأعمدة الجديدة بجانبها.
- الكتابة الجديدة من UI تكون على الأعمدة الجديدة أساسًا.
- يتم اشتقاق قيم legacy قدر الإمكان لضمان عدم كسر أي Consumer قديم.
- السجلات القديمة غير القابلة للتحويل المباشر تبقى مقروءة وتُعلّم كـ legacy fallback.

## 3) API Impact Summary

### 3.1 APIs الحالية التي يجب الإبقاء عليها
- إدارة Profiles / Steps / Targets / Transitions / Bindings.
- Preview و Validation.
- Oracle read APIs (`UnitTypes`, `Units`, `Positions`, `Users`).

### 3.2 APIs تحتاج Extension (بدون كسر)
1. `POST/PUT Targets`
   - إضافة الحقول الجديدة:
     - `selectedNodeType`
     - `selectedNodeNumericId`
     - `selectedNodeUserId`
     - `audienceResolutionMode`
     - `workDistributionMode`
2. `GET Targets` ضمن Workspace
   - إعادة نفس الحقول الجديدة + fallback legacy info عند الحاجة.
3. `GET Profiles/{id}/Preview`
   - تحديث `TargetsSummaryAr` ليعكس:
     - نوع العقدة
     - أسلوب eligibility
     - أسلوب distribution
4. `GET Profiles/{id}/Validation`
   - إضافة قواعد تحقق مرتبطة بالحقلين الجديدين (`audienceResolutionMode`, `workDistributionMode`) ونوع العقدة.

### 3.3 APIs جديدة مطلوبة للشجرة الموحدة (Overlay)
- الوضع الحالي يقدّم قوائم مفصولة (Units/Positions/Users) وليس شجرة موحدة.
- مطلوب API قراءة فقط موحّد يدعم metadata لكل node (type/id/parent/isSelectable/hasChildren).
- يفضل إضافة نمط lazy loading للشجرة (Roots + Children + Search) لتفادي تحميل كبير دفعة واحدة.

## 4) DB Impact Summary (SQL Server فقط)

### 4.1 الوضع الحالي
- جدول `SubjectRoutingTargets` يحتوي أعمدة legacy فقط.
- لا توجد أعمدة صريحة لفصل Node/Audience/Distribution.

### 4.2 التعديل المطلوب (Phase 2)
إضافة أعمدة جديدة في **SQL Server** داخل `SubjectRoutingTargets`:
- `SelectedNodeType` (`nvarchar`)
- `SelectedNodeNumericId` (`decimal(18,0)` nullable)
- `SelectedNodeUserId` (`nvarchar(20)` nullable)
- `AudienceResolutionMode` (`nvarchar`)
- `WorkDistributionMode` (`nvarchar`)

### 4.3 قيود تحقق موصى بها
- Check constraints لضمان اتساق:
  - نوع العقدة مع نوع الـ ID المستخدم (numeric vs user).
  - توافق `AudienceResolutionMode` مع `SelectedNodeType`.
  - منع حالات توزيع غير منطقية حسب دائرة المؤهلين.

### 4.4 Migration / Backfill
- Migration SQL Server idempotent.
- Backfill للحقول الجديدة من legacy عند الإمكان.
- الإبقاء على legacy columns في نفس المرحلة لتفادي كسر التوافق.

### 4.5 Oracle
- لا تعديل على Oracle schema (ملتزم).
- Oracle يظل مصدر reference read-only للهيكل التنظيمي.

## 5) Tree Source Analysis (Oracle)

### 5.1 المصادر المتاحة حاليًا
- `ORG_UNITS` (هرمية عبر `PARENT_ID`).
- `ORG_UNIT_TYPES` (أنواع الوحدات).
- `USER_POSITIONS` (ربط user بالوحدة + manager flag + active window).
- `CONNECT_USERS` موجود في `GPAContext` ويحتوي أسماء (`ArabicName`, `FirstName`, `LastName`) لكنه غير مستخدم في AdminRouting API الحالي.

### 5.2 ما تدعمه APIs الحالية بالفعل
- `Oracle/Units`: يدعم `parentId` و `search` و `activeOnly` (مفيد لبناء شجرة وحدات).
- `Oracle/Positions`: يدعم filter بـ `unitId` (مفيد لإلحاق المناصب تحت الوحدة).
- `Oracle/Users`: يعيد `userId` + عدد المناصب النشطة فقط.

### 5.3 الفجوات
- لا يوجد endpoint واحد يعيد شجرة موحدة متعددة الأنواع (OrgUnit + Position + User) مع metadata موحد.
- user display الحالي بدون اسم عربي/إنجليزي (فقط `userId`) رغم توفر بيانات مستخدم في `CONNECT_USERS`.
- المناصب تعرض كـ `PositionId` دون مسمى وظيفي domain-friendly.
- لا يوجد تمييز server-side واضح لنوع node في payload موحد (مطلوب للـ Overlay الجديد).

### 5.4 الاستنتاج
- الوصول لمستوى الأشخاص **ممكن تقنيًا** من البيانات الحالية، لكن العرض الحالي ناقص (ID-only).
- مطلوب توسيع read model في Phase 2 لاستغلال `CONNECT_USERS` وتحسين labels.

## 6) ملخص الملفات التي تمت مراجعتها في Phase 1

### Backend
- `ENPO.Connect.Backend/Models/Connect/SubjectRoutingTarget.cs`
- `ENPO.Connect.Backend/Models/DTO/DynamicSubjects/DynamicSubjectsAdminRoutingDtos.cs`
- `ENPO.Connect.Backend/Persistence/Services/DynamicSubjects/AdminRouting/DynamicSubjectsAdminRoutingService.cs`
- `ENPO.Connect.Backend/Persistence/Services/DynamicSubjects/AdminRouting/DynamicSubjectsAdminRoutingRepository.cs`
- `ENPO.Connect.Backend/Persistence/Services/DynamicSubjects/AdminRouting/IDynamicSubjectsAdminRoutingService.cs`
- `ENPO.Connect.Backend/Persistence/Services/DynamicSubjects/AdminRouting/IDynamicSubjectsAdminRoutingRepository.cs`
- `ENPO.Connect.Backend/Api/Controllers/DynamicSubjectsAdminRoutingController.cs`
- `ENPO.Connect.Backend/Persistence/Data/ConnectContext.cs`
- `ENPO.Connect.Backend/Persistence/Migrations/20260408_AddSubjectRoutingFoundation.cs`
- `ENPO.Connect.Backend/Persistence/Data/GPAContext.cs`
- `ENPO.Connect.Backend/Models/GPA/OrgStructure/OrgUnit.cs`
- `ENPO.Connect.Backend/Models/GPA/OrgStructure/OrgUnitType.cs`
- `ENPO.Connect.Backend/Models/GPA/OrgStructure/UserPosition.cs`
- `ENPO.Connect.Backend/Models/GPA/PosUser.cs`

### Frontend
- `ENPO.Connect.Frontend/src/app/shared/services/BackendServices/DynamicSubjectsAdminRouting/DynamicSubjectsAdminRouting.dto.ts`
- `ENPO.Connect.Frontend/src/app/shared/services/BackendServices/DynamicSubjectsAdminRouting/DynamicSubjectsAdminRouting.service.ts`
- `ENPO.Connect.Frontend/src/app/Modules/admin-control-center-catalog/pages/admin-control-center-catalog-routing-workspace/admin-control-center-catalog-routing-workspace.component.ts`
- `ENPO.Connect.Frontend/src/app/Modules/admin-control-center-catalog/pages/admin-control-center-catalog-routing-workspace/admin-control-center-catalog-routing-workspace.component.html`
- `ENPO.Connect.Frontend/src/app/Modules/admin-control-center-catalog/pages/admin-control-center-catalog-routing-workspace/admin-control-center-catalog-routing-workspace.component.scss`

## 7) ما تبقى (قبل Phase 2)
- تنفيذ تعديل SQL + Entity/DTO/API حسب نموذج Node/Audience/Distribution.
- إضافة/توسيع APIs لشجرة Overlay الموحدة.
- إضافة Validation قواعد التوافق الجديدة.
- تجهيز Preview summary ليعكس النموذج الجديد.

## 8) الخطوة التالية مباشرة (Phase 2)
1. تعديل schema `SubjectRoutingTargets` في SQL Server وإضافة القيود.
2. تحديث Backend Entities/DTOs/Mappings/Validation.
3. توسيع APIs الحالية + API tree موحد read-only.
4. تنفيذ migration + backfill + build verification.

## 9) Blockers / Assumptions
- **Blocker قرار معماري**: كيفية التعامل مع أوضاع legacy غير القابلة للتمثيل المباشر (`UnitLeader`, `ParentUnitLeader`, `ChildUnitByType`).
  - الافتراض في هذه المرحلة: نُبقيها legacy-compatible على مستوى الباك إند، بينما UI الجديد يبنى على النموذج الجديد فقط.
- **Assumption**: لا يوجد runtime engine production يعتمد اليوم على `TargetMode` خارج AdminRouting (الاستهلاك الظاهر الحالي إداري/Preview/Validation).
- **Assumption**: يمكن اعتماد `UserId` كمرجع شخصي في `SpecificUser` مع تحسين label لاحقًا عبر `CONNECT_USERS`.

## Handoff Summary (جاهز للتسليم)
- **ما تم**: إغلاق التحليل المعماري والفجوات وتحديد نموذج البيانات المستهدف + خطة التوافق + تأثير APIs + تأثير DB + تحليل مصادر Oracle tree.
- **ملفات معدلة في Phase 1**: هذا الملف فقط (توثيق handoff).
- **جداول/APIs/Models أضيفت فعليًا**: لا يوجد تنفيذ برمجي في Phase 1 (تحليل فقط).
- **ما تبقى**: التنفيذ الفعلي لـ Backend + SQL في Phase 2.
- **الخطوة التالية المباشرة**: بدء Phase 2 بالموديل المقترح أعلاه.
- **Blockers/Assumptions**: موثقة في قسم (9).
