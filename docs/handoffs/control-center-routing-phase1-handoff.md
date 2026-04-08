# ControlCenterCatalog Routing - Phase 1 Handoff

تاريخ التحديث: 2026-04-08  
الفرع: **الفرع الحالي (بدون أي branch switching)**

## نسبة الإنجاز
- Phase 1 (SQL Schema + Backend Domain): **100%**
- الإنجاز الكلي ضمن نطاق Routing (Phase 1-3): **33%**

## 1) ما تم إنجازه فعليًا
- تم إنشاء طبقة Routing مستقلة فوق الهيكل القديم باستخدام **SQL Server** فقط.
- تم إضافة 5 جداول Routing جديدة مع العلاقات والفهارس والقيود المطلوبة.
- تم إضافة Domain Models وربطها في `ConnectContext` (`DbSet` + Fluent Mapping).
- تم إضافة Migration جديدة idempotent لإنشاء schema بالكامل مع FKs/indexes/unique constraints.
- تم تنفيذ Backend APIs كاملة لـ:
  - إدارة Routing Profiles
  - إدارة Steps
  - إدارة Targets
  - إدارة Transitions
  - ربط المسار بنوع الطلب
  - Routing Preview
  - Routing Validation
- تم تنفيذ Oracle integration read-only للهيكل التنظيمي (UnitTypes / Units / Positions / Users).
- تم تنفيذ Build ناجح بدون أخطاء (`0 Error`) مع وجود warnings قديمة/بيئية بالمشروع.

## 2) الملفات التي تم تعديلها
- `ENPO.Connect.Backend/Api/Program.cs`
- `ENPO.Connect.Backend/Persistence/Data/ConnectContext.cs`

## 2.1) الملفات الجديدة
- `ENPO.Connect.Backend/Persistence/Migrations/20260408_AddSubjectRoutingFoundation.cs`
- `ENPO.Connect.Backend/Api/Controllers/DynamicSubjectsAdminRoutingController.cs`
- `ENPO.Connect.Backend/Models/DTO/DynamicSubjects/DynamicSubjectsAdminRoutingDtos.cs`
- `ENPO.Connect.Backend/Models/Connect/SubjectRoutingProfile.cs`
- `ENPO.Connect.Backend/Models/Connect/SubjectRoutingStep.cs`
- `ENPO.Connect.Backend/Models/Connect/SubjectRoutingTarget.cs`
- `ENPO.Connect.Backend/Models/Connect/SubjectRoutingTransition.cs`
- `ENPO.Connect.Backend/Models/Connect/SubjectTypeRoutingBinding.cs`
- `ENPO.Connect.Backend/Persistence/Services/DynamicSubjects/AdminRouting/IDynamicSubjectsAdminRoutingRepository.cs`
- `ENPO.Connect.Backend/Persistence/Services/DynamicSubjects/AdminRouting/DynamicSubjectsAdminRoutingRepository.cs`
- `ENPO.Connect.Backend/Persistence/Services/DynamicSubjects/AdminRouting/IDynamicSubjectsAdminRoutingService.cs`
- `ENPO.Connect.Backend/Persistence/Services/DynamicSubjects/AdminRouting/DynamicSubjectsAdminRoutingService.cs`

## 3) الجداول/الـ APIs التي أضيفت

### 3.1 SQL Tables (جديدة في SQL Server)
- `SubjectRoutingProfiles`
- `SubjectRoutingSteps`
- `SubjectRoutingTargets`
- `SubjectRoutingTransitions`
- `SubjectTypeRoutingBindings`

### 3.2 العلاقات والقيود المهمة
- `StepCode` فريد داخل نفس المسار (`UX_SubjectRoutingSteps_Profile_StepCode`)
- خطوة بداية واحدة فقط لكل مسار (`UX_SubjectRoutingSteps_Profile_Start` filtered unique)
- انتقال فريد حسب (`Profile + From + To + ActionCode`)
- ربط فريد بين (`SubjectType + Profile`)
- Default binding واحد فعال لكل SubjectType (filtered unique)

### 3.3 APIs (Controller: `DynamicSubjectsAdminRoutingController`)
- `GET    /api/DynamicSubjectsAdminRouting/Profiles/ByRequestType/{subjectTypeId}`
- `POST   /api/DynamicSubjectsAdminRouting/Profiles`
- `PUT    /api/DynamicSubjectsAdminRouting/Profiles/{profileId}`
- `POST   /api/DynamicSubjectsAdminRouting/Steps`
- `PUT    /api/DynamicSubjectsAdminRouting/Steps/{stepId}`
- `DELETE /api/DynamicSubjectsAdminRouting/Steps/{stepId}`
- `POST   /api/DynamicSubjectsAdminRouting/Targets`
- `PUT    /api/DynamicSubjectsAdminRouting/Targets/{targetId}`
- `DELETE /api/DynamicSubjectsAdminRouting/Targets/{targetId}`
- `POST   /api/DynamicSubjectsAdminRouting/Transitions`
- `PUT    /api/DynamicSubjectsAdminRouting/Transitions/{transitionId}`
- `DELETE /api/DynamicSubjectsAdminRouting/Transitions/{transitionId}`
- `POST   /api/DynamicSubjectsAdminRouting/Bindings`
- `GET    /api/DynamicSubjectsAdminRouting/Profiles/{profileId}/Preview`
- `GET    /api/DynamicSubjectsAdminRouting/Profiles/{profileId}/Validation`
- `GET    /api/DynamicSubjectsAdminRouting/Oracle/UnitTypes`
- `GET    /api/DynamicSubjectsAdminRouting/Oracle/Units`
- `GET    /api/DynamicSubjectsAdminRouting/Oracle/Positions`
- `GET    /api/DynamicSubjectsAdminRouting/Oracle/Users`

## 4) ما الذي تبقى
- **Phase 2 بالكامل** (واجهة إدارة Routing داخل ControlCenterCatalog - عربي RTL + PrimeNG + validations UX).
- **Phase 3 بالكامل** (Visual Routing Preview واجهة حيّة + Validation panel + Preview summary UI).

## 5) الخطوة التالية مباشرة
- بدء **Phase 2**: إضافة قسم Routing داخل ControlCenterCatalog وربط شاشة الإدارة بالـ APIs الجديدة.
- البدء بقسم “البيانات الأساسية” أولًا ثم Steps ثم Targets ثم Transitions (ترتيب إلزامي).

## 6) ملاحظات / blockers
- لا يوجد blocker يمنع الانتقال لـ Phase 2.
- Build ناجح لكن توجد warnings تاريخية/بيئية بالمشروع (حزم قديمة/nullability) وليست ناتجة عن Phase 1.
- Mapping المعتمد في هذه المرحلة:
  - `RequestTypeId` في المتطلبات = `SubjectTypeId` = `CDCategory.CatId`.
  - موثق داخل الـ APIs والـ schema.

## Mandatory vs Optional (Phase 1)

### Mandatory (مكتمل)
- إنشاء الجداول عبر migration صحيحة
- العلاقات والقيود والفهارس
- APIs الأساسية لإدارة Routing كاملة
- إنشاء/تعديل Profile
- إضافة/تعديل/حذف Steps
- إضافة/تعديل/حذف Targets
- إضافة/تعديل/حذف Transitions
- Binding نوع الطلب بالمسار
- Routing preview أولي
- Routing validation أولي
- Oracle read-only lookups للهيكل التنظيمي

### Optional (حاليًا غير منفذ)
- Audit enhancements إضافية متقدمة (غير الحقول الأساسية الحالية)
- Versioning متقدم متعدد النسخ
- Logging موسع تشخيصي
