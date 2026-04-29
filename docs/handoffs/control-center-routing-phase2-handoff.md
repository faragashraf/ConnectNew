# ControlCenterCatalog Routing - Phase 2 Handoff

تاريخ التحديث: 2026-04-08  
الفرع: **الفرع الحالي (بدون أي branch switching)**

## نسبة الإنجاز
- Phase 1 (SQL Schema + Backend Domain): **100%**
- Phase 2 (Admin UI داخل ControlCenterCatalog): **100%**
- الإنجاز الكلي ضمن نطاق Routing (Phase 1-3): **66%**

## 1) ما تم إنجازه فعليًا
- تم دمج قسم إدارة Routing داخل شاشة `ControlCenterCatalog` الحالية (نفس السياق، بدون صفحة منفصلة مشتتة).
- تم إنشاء Workspace إداري متكامل للتوجيه يتضمن الأقسام:
  1. البيانات الأساسية
  2. الخطوات
  3. الجهات المستهدفة
  4. الانتقالات والإجراءات
  5. المخطط المرئي (Preview أولي)
  6. المعاينة والتحقق
- تم تطبيق RTL عربي داخل واجهة Routing.
- جميع عناصر الاختيار `dropdown` في واجهة Routing تستخدم PrimeNG مع `appendTo="body"`.
- تم تطبيق قواعد تعطيل أزرار الحفظ حتى اكتمال الحقول الإلزامية لكل قسم.
- تم إضافة تمييز واضح Mandatory vs Optional مع مؤشرات تقدم:
  - نسبة إلزامي
  - نسبة اختياري
  - نسبة كلية لنطاق Routing داخل الـ Workspace
- تم إضافة قيود UI مهمة:
  - منع حفظ خطوة بداية ثانية إذا كانت هناك خطوة بداية مفعلة بالفعل.
  - منع انتقال من خطوة إلى نفسها.
- تم ربط واجهة الـ Targets ببيانات Oracle المرجعية (UnitTypes/Units/Positions/Users) عبر APIs الـ backend.
- تم تعزيز backend لدعم سيناريوهات UI بشكل أفضل عبر:
  - قائمة Profiles حسب نوع الطلب
  - تحميل Workspace مباشرة بواسطة ProfileId
- تم تنفيذ Build ناجح للـ Frontend والـ Backend (0 Errors) مع warnings قديمة بالمشروع.

## 2) الملفات التي تم تعديلها
- `ENPO.Connect.Frontend/src/app/Modules/admin-control-center-catalog/admin-control-center-catalog.module.ts`
- `ENPO.Connect.Frontend/src/app/Modules/admin-control-center-catalog/pages/admin-control-center-catalog-page/admin-control-center-catalog-page.component.ts`
- `ENPO.Connect.Frontend/src/app/Modules/admin-control-center-catalog/pages/admin-control-center-catalog-page/admin-control-center-catalog-page.component.html`
- `ENPO.Connect.Frontend/src/app/Modules/admin-control-center-catalog/pages/admin-control-center-catalog-page/admin-control-center-catalog-page.component.scss`

## 2.1) ملفات جديدة ضمن Phase 2
- `ENPO.Connect.Frontend/src/app/Modules/admin-control-center-catalog/pages/admin-control-center-catalog-routing-workspace/admin-control-center-catalog-routing-workspace.component.ts`
- `ENPO.Connect.Frontend/src/app/Modules/admin-control-center-catalog/pages/admin-control-center-catalog-routing-workspace/admin-control-center-catalog-routing-workspace.component.html`
- `ENPO.Connect.Frontend/src/app/Modules/admin-control-center-catalog/pages/admin-control-center-catalog-routing-workspace/admin-control-center-catalog-routing-workspace.component.scss`
- `ENPO.Connect.Frontend/src/app/shared/services/BackendServices/DynamicSubjectsAdminRouting/DynamicSubjectsAdminRouting.dto.ts`
- `ENPO.Connect.Frontend/src/app/shared/services/BackendServices/DynamicSubjectsAdminRouting/DynamicSubjectsAdminRouting.service.ts`

## 2.2) ملفات Backend تم تمديدها لدعم UI
- `ENPO.Connect.Backend/Api/Controllers/DynamicSubjectsAdminRoutingController.cs`
- `ENPO.Connect.Backend/Persistence/Services/DynamicSubjects/AdminRouting/IDynamicSubjectsAdminRoutingService.cs`
- `ENPO.Connect.Backend/Persistence/Services/DynamicSubjects/AdminRouting/DynamicSubjectsAdminRoutingService.cs`

## 3) الجداول/الـ APIs التي أضيفت

### 3.1 SQL Tables
- لا توجد جداول جديدة في Phase 2.
- تم الاعتماد على جداول Phase 1:
  - `SubjectRoutingProfiles`
  - `SubjectRoutingSteps`
  - `SubjectRoutingTargets`
  - `SubjectRoutingTransitions`
  - `SubjectTypeRoutingBindings`

### 3.2 APIs إضافية لدعم تجربة Phase 2
- `GET /api/DynamicSubjectsAdminRouting/Profiles?subjectTypeId={id}`
  - جلب كل Profiles المرتبطة بنوع الطلب.
- `GET /api/DynamicSubjectsAdminRouting/Profiles/{profileId}/Workspace`
  - جلب Workspace كامل بالاعتماد على ProfileId محدد.

## 4) ما الذي تبقى
- **Phase 3 بالكامل** كمرحلة رسمية مستقلة:
  - Visual Routing Preview حي (Nodes/Edges) أكثر وضوحًا وتفاعلية.
  - Validation Engine أعمق مع قواعد إضافية ورسائل عربية مفصلة.
  - Preview Panel نصي توضيحي متقدم لمسار الطلب.

## 5) الخطوة التالية مباشرة
- بدء **Phase 3** من نفس الشاشة الحالية (`Routing Workspace`) بدون تغيير هيكل Phase 2:
  1. تحسين المخطط المرئي ليكون تمثيلًا أوضح للعقد والروابط.
  2. رفع تغطية قواعد الـ validation (reachability/loop/final-state logic وغيرها).
  3. توسيع Preview summary العربي ليشرح رحلة الطلب خطوة بخطوة.

## 6) ملاحظات / blockers
- لا يوجد blocker يمنع بدء Phase 3.
- نسخة PrimeNG الحالية لا تدعم خاصية `loading` داخل `p-dropdown`؛ تم التعامل معها برسائل تحميل نصية بديلة داخل الفورم.
- توجد warnings بيئية قديمة أثناء البناء (packages/compatibility) لكنها ليست ناتجة عن تغييرات Routing الحالية.

## Mandatory vs Optional (Phase 2)

### Mandatory (مكتمل)
- ظهور قسم Routing داخل ControlCenterCatalog
- إنشاء/تعديل RoutingProfile
- إدارة Steps (إضافة/تعديل/حذف)
- إدارة Targets (إضافة/تعديل/حذف)
- إدارة Transitions (إضافة/تعديل/حذف)
- ربط المسار بنوع الطلب
- تعطيل الحفظ قبل استيفاء الإلزامي
- واجهة RTL عربية
- PrimeNG components
- `appendTo="body"` لكل Dropdown داخل واجهة Routing
- Build ناجح بدون أخطاء

### Optional (منجز جزئيًا في Phase 2 تمهيدًا لـ Phase 3)
- Preview بصري أولي (غير drag-and-drop)
- Validation panel أولي
- تحسينات UX إضافية ممكنة في Phase 3
