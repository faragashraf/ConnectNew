# ControlCenterCatalog Routing Targeting - Phase 3 Handoff

تاريخ التحديث: 2026-04-08  
الفرع: `ControlCenterCatalog` (بدون branch switching)

## حالة المرحلة
- PHASE 3 (Targeting UI Redesign with Tree Overlay): **مكتمل**
- تم استبدال تجربة Targeting المبنية على dropdowns legacy بتجربة Tree Overlay + Summary + Audience + Distribution.

## 1) ما الذي تم في PHASE 3

1. إعادة تصميم قسم **الجهات المستهدفة** في `Routing Workspace` ليصبح قائمًا على:
   - اختيار العقدة المستهدفة من شجرة تنظيمية عبر Dialog Overlay.
   - فصل واضح بين:
     - Target Node Selection
     - Audience Resolution
     - Work Distribution Mode
2. إضافة Dialog شجرة تنظيمية متكامل يتضمن:
   - Lazy loading (تحميل الجذور ثم الأبناء عند التوسيع)
   - Search داخل الشجرة
   - Toggle لإظهار/إخفاء المستخدمين (`includeUsers`)
   - Loading state + Empty state + رسائل أخطاء عربية
   - شارات تمييز نوع العقدة (وحدة/منصب/مستخدم) وقابلية الاستهداف
3. تحديث نموذج الـ target في الفرونت ليستخدم الحقول الجديدة:
   - `selectedNodeType`
   - `selectedNodeNumericId`
   - `selectedNodeUserId`
   - `audienceResolutionMode`
   - `workDistributionMode`
4. الحفاظ على التوافق الخلفي عبر اشتقاق قيم legacy عند الحفظ:
   - `targetMode` (SpecificUnit/Position/CommitteeMembers)
   - `oracleOrgUnitId` / `positionId` / `positionCode`
   - `allowMultipleReceivers` / `sendToLeaderOnly`
5. تحسين تجربة التحرير (Edit Target):
   - قراءة target الجديد أو legacy fallback
   - إعادة بناء model موحد للعرض والتحرير
6. تحديث جدول الجهات المستهدفة ليعرض ملخصًا أوضح:
   - الجهة المستهدفة
   - المؤهلون
   - التوزيع
   - الحالة

## 2) الملفات المعدلة

- `ENPO.Connect.Frontend/src/app/Modules/admin-control-center-catalog/pages/admin-control-center-catalog-routing-workspace/admin-control-center-catalog-routing-workspace.component.ts`
- `ENPO.Connect.Frontend/src/app/Modules/admin-control-center-catalog/pages/admin-control-center-catalog-routing-workspace/admin-control-center-catalog-routing-workspace.component.html`
- `ENPO.Connect.Frontend/src/app/Modules/admin-control-center-catalog/pages/admin-control-center-catalog-routing-workspace/admin-control-center-catalog-routing-workspace.component.scss`

## 3) ما تم على مستوى العقود/APIs

- لا توجد API backend جديدة في PHASE 3 (تم تجهيزها في PHASE 2).
- تم استهلاك API الشجرة الموحدة التي أضيفت في PHASE 2:
  - `GET /api/DynamicSubjectsAdminRouting/Oracle/TreeNodes`
- تم تفعيل تمرير خيارات:
  - `parentNodeType`
  - `parentNodeNumericId`
  - `parentNodeUserId`
  - `search`
  - `activeOnly`
  - `includeUsers`

## 4) ما تم في الـ UX / UI (متطلبات المرحلة)

1. **PrimeNG فقط**: تم استخدام `p-dialog`, `p-tree`, `p-dropdown`, `p-inputSwitch`, `p-tag`.
2. **RTL عربي بالكامل**: تم الحفاظ على `dir="rtl"` وصياغة عربية كاملة.
3. **appendTo="body" لكل dropdown**: مطبق في جميع dropdowns الجديدة بالقسم.
4. **Overlay/Dialog منظم**: تم اعتماد Dialog overlay-style قابل للتكبير (maximizable).
5. **Search + loading + empty states**: متوفر داخل Dialog الشجرة.
6. **ملخص واضح للاختيار الحالي**: نوع العقدة + الاسم + المؤهلون + التوزيع.
7. **إخفاء تعقيد TargetMode من الواجهة**: المستخدم يتعامل مع النموذج الجديد فقط.

## 5) التحقق والنتائج

- Frontend build: **ناجح**
  - الأمر: `npm run build`
  - النتيجة: 0 Errors
  - توجد warnings قديمة CommonJS غير مرتبطة بتعديلات Targeting.

## 6) ما تبقى

- PHASE 4 فقط:
  - تحسينات Visual Routing Preview Styling + Integration + Validation polish
  - عرض target/eligibility summary بشكل أوضح داخل graph nodes/tooltips/summary
  - معالجة أي alignment/responsive refinements في صفحة visual

## 7) الخطوة التالية مباشرة

1. بدء PHASE 4 على شاشة Visual Preview الحالية.
2. تحسين hierarchy والمساحات والوضوح البصري للنص العربي في المخطط.
3. ربط أقوى بين graph/summary/transition table.
4. التأكد من بقاء validation متسقًا مع الحقول الجديدة بعد التحسين البصري.

## 8) Blockers / Assumptions

- لا يوجد blocker يمنع بدء PHASE 4.
- مستوى المستخدمين في الشجرة يعتمد على بيانات Oracle المتاحة فعليًا؛ عند غياب بيانات تفصيلية يتم عرض fallback labels.
- runtime assignment الكامل ما زال خارج نطاق هذه المرحلة، مع بقاء التصميم الحالي جاهزًا للتكامل لاحقًا.

## Handoff Summary (جاهز للتسليم)

- **ما تم إنجازه:** Targeting UI جديد بالكامل قائم على Tree Overlay مع Audience/Distribution منفصلين بوضوح.
- **الملفات المعدلة:** 3 ملفات فرونت (TS/HTML/SCSS) موثقة أعلاه.
- **الـ APIs المعتمدة:** Oracle TreeNodes من PHASE 2.
- **ما تبقى:** PHASE 4 فقط.
- **الخطوة التالية:** Visual Routing Restyling + Integration + Validation النهائية.
- **Blockers/Assumptions:** موثقة في القسم (8).
