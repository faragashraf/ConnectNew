# مكونات الإدارة (نظرة عامة)

هذا المجلد يحتوي أدوات إدارة للمشرفين تضبط سلوك الشاشات العامة المبنية على الخلفية. بدلاً من ترميز كل شاشة لكل وحدة، يتم تخزين الإعدادات والميتا داتا التي تتحكم في التوجيه والنماذج والقوائم والجداول والرسوم البيانية وربط الـ API.

## كيف يخدم تطبيقاً عاماً يعتمد على الخلفية وقاعدة البيانات
- شكل الشاشة وسلوكها يعتمد على الإعدادات (ComponentConfig + Dynamic Fields) وليس على كود ثابت.
- جلب البيانات مربوط بدوال/متحكمات الخلفية ومعاملاتها.
- الرسوم البيانية معرفة عبر استعلامات خلفية، لذا يمكن تطوير اللوحات دون تغيير الواجهة.

## المكونات

### ChartConfigManagerComponent (`chart-config-manager`)
الغرض: إدارة تعريفات الرسوم البيانية لكل Module (تحليلات ولوحات).

المسؤوليات الأساسية
- قائمة حسب الـ Module مع إنشاء/تعديل/حذف (key, moduleName, title, type, enabled, order).
- تعريف البيانات: queryId, queryParams (JSON), ربط الحقول sectorField/seriesField/valueField.
- إعدادات متقدمة: المظهر (stacked, labels, tooltip, colorMap)، التخطيط (width/height)، المحور، وخريطة التسميات.
- تحويلات البيانات قبل الإرسال للخلفية:
  - `labels` من FormArray إلى كائن `{ [key]: value }`.
  - `queryParams` و `colorMap` تُحلل من JSON.
  - `sectorField` يتحول إلى مصفوفة نصوص.
  - `layout.height` تُحفظ بصيغة `"<number>px"`.
  - `appearance` تُسطّح لتتطابق مع حقول الخلفية (`labelMode`, `position`, `legendPosition`, ...).

التكامل الخلفي
- `ChartConfigAdminService` يستدعي `environment.PowerBi + "/api/charts"`.

### ComponentConfigManagerComponent (`component-config-manager`)
الغرض: المحرر المركزي لـ `ComponentConfig` الذي يقود الشاشات العامة للقوائم/النماذج.

مصدر الإعدادات والحفظ
- تحميل من `assets/component-configs.json` مع قيم افتراضية عند الحاجة.
- يحتفظ بنسخة داخل الذاكرة؛ ويمكن تصدير التعديلات للقرص عبر خادم محلي عند العمل على `localhost`.

هيكل الواجهة
- قائمة بالإعدادات مع Edit/Delete.
- حوار كامل الشاشة بعلامات تبويب:
  - General: routeKey، العنوان، نمط العرض، اسم النموذج العام، menu/unit IDs، أحجام الصفحات، حقول الفلترة العامة، deadStatus، totalRecords، isNew، showFormSignature، submitButtonText.
  - List: listRequestModel (الصفحات والحالة والفئة والنوع والبحث).
  - Requests: ربط نداءات الخلفية (method, args, selection fields, mapping).
  - User: currentUser/currentUserName/userGroup.
  - Fields: سلوك التاريخ/الوقت، الإلزام، sticky للجدول.
  - Table & Categories: tkCategoryCds، أعمدة الجدول، وحقول الجدول (header/field/width/sortable/visible/status).
  - Attachments: الامتدادات المسموحة، الحجم/العدد، الإلزام، allowMultiple.

تفاصيل عميقة لربط الطلبات
- اكتشاف المتحكمات تلقائياً عبر `CONTROLLER_CLASSES` و `Injector`.
- تحليل تواقيع الدوال وقت التشغيل لمعرفة المعاملات وتمييز body عن query.
- إنشاء placeholders للوسائط في كل طلب.
- تحميل أشكال DTO من ملفات TS مولدة أو JSON (مثل `assets/dto-shapes/combined-dto-shapes.json`) وملء body تلقائياً.
- دعم `wrapBodyAsArray`, `requestsSelectionFields`, وخرائط `arrName`/`arrValue`، مع `populateMethod` و `populateArgs`.
- معالجة خاصة لبعض الدوال (مثل `publicationsController.getDocumentsList_user`) لتطبيع شكل الوسائط.

المكون المساعد: `DtoRendererComponent`
- يُستخدم في تبويب Requests لتحرير أجسام الطلبات المعقدة.
- يعرض مفاتيح الكائنات بشكل متداخل، ويدعم مصفوفات الكائنات، ويحوّل النص إلى boolean/number/JSON عند الإمكان.
- يبث نسخة عميقة جديدة لضمان تحديث الواجهة.

### DynamicFieldsManagerComponent (`dynamic-fields-manager`)
الغرض: إدارة ميتاداتا الحقول الديناميكية التي تقود النماذج العامة.

تدفق البيانات
- تحميل الحقول الإلزامية والميتا والفئات عبر `DynamicFormController` (الخلفية).
- التخزين والعمل على `CdmendDto` داخل `GenericFormsService`.
- التجميع حسب: Application (`applicationId`) -> نوع الحقل (`cdmendType`) -> الحقل.

القدرات الأساسية
- إضافة/تعديل تعريفات الحقول (مصدر SQL، التسميات، التحقق، العرض/الارتفاع، الأعلام).
- تحرير `cdmendTbl` كقائمة خيارات JSON للـ dropdown/tree.
- بحث وتصفية حسب التطبيق والحالة، مع توسيع/طي الهيكل.
- لوحة إحصاءات متحركة.
- تصدير إلى Excel عبر `xlsx` + `file-saver`.
- تفضيلات واجهة (داكن/مضغوط/تباين عالي) محفوظة في `localStorage`.
- استخدام حوار `app-generic-element-details` للتحرير التفصيلي.

الأهمية
- تسمح بتطور مخطط الحقول المعتمد على قاعدة البيانات دون تعديل كود الواجهة.

### NswagEditorComponent (`nswag-editor`)
الغرض: واجهة لإدارة إعدادات NSwag (توليد عملاء الـ API).

السلوك الرئيسي
- CRUD لقائمة الخدمات: label، env property، روابط التطوير/الإنتاج، مسار الإخراج، regenerate.
- قراءة خصائص البيئة من `environment`.
- تحميل/حفظ الإعدادات عبر خادم NSwag المحلي.

## دورة البيانات والإعدادات (ملخص)
- إعدادات الرسوم -> API الرسوم في الخلفية (PowerBi).
- إعدادات المكونات -> ملف JSON بالأصول مع إمكانية تصدير محلي.
- الحقول الديناميكية -> خدمات DynamicForm في الخلفية؛ تُجمع وتُدار في الواجهة.
- إعدادات NSwag -> خادم محلي.

## مسارات ذات صلة
- `src/app/Modules/admins/Managementcomponents/chart-config-manager`
- `src/app/Modules/admins/Managementcomponents/component-config-manager`
- `src/app/Modules/admins/Managementcomponents/component-config-manager/dto-renderer`
- `src/app/Modules/admins/Managementcomponents/dynamic-fields-manager`
- `src/app/Modules/admins/Managementcomponents/nswag-editor`
- `src/app/Modules/admins/services/*`
- `src/assets/component-configs.json`
- `src/assets/dto-shapes/*`
- `src/assets/attachment-options.json`
