<!-- Shared styles moved to docs/styles.css; wrappers added to apply shared doc styling -->
<link rel="stylesheet" href="./styles.css">

<div class="doc-hero">
  <h1>توثيق دالة processRequestsAndPopulate</h1>
  <div class="badge">دليل</div>
</div>

<div class="doc-body">

هذا المستند يشرح منطق ودور الدالة `processRequestsAndPopulate` في المكوّن `AddEditSubjectComponent` باللغة العربية، جاهز للمشاركة مع الفريق.

## الهدف
- تنفيذ مجموعة من طلبات البيانات المبنية من إعدادات المكوّن (`config.requestsarray`) بشكل متزامن، ثم معالجة كل استجابة لملء موارد واجهة المستخدم (مثل قوائم الاختيارات) واستدعاء `populateForm()` لتهيئة الـ form.

## متى تُستدعى
- تُنادى داخل `ngOnInit()` بعد تحميل metadata عندما `this.config.isNew`، أو مباشرة إذا كانت metadata جاهزة.

## خطوات التنفيذ (تفصيلي)
1. بناء الطلبات:
   - استدعاء `requestBuilder.buildRequestsFromConfig(this.config.requestsarray, this)` لإنتاج مصفوفة `Observable<any>[]` تمثل طلبات الـ API أو مصادر البيانات.
2. التحقق من وجود طلبات:
   - إذا كانت المصفوفة فارغة -> خروج مبكر (لا شيء للتنفيذ).
3. تنفيذ الطلبات دفعة واحدة:
   - استدعاء `getData(requests)` الذي يُرجع `forkJoin(requests)` كمراقب واحد ينتج مصفوفة `responses` بالترتيب.
4. الاشتراك على النتيجة ومعالجة الاستجابات:
   - عند الاستلام (`next: (responses) => { ... }`) يتم:
     - التكرار فوق `responses` مع الفهرس `idx` لربط كل استجابة بالـ `reqConfig` الموافق في `this.config.requestsarray[idx]`.
     - لكل استجابة `resp`:
      - إذا `resp.isSuccess === true` و`resp.data` موجود:
       - توحيد `resp.data` إلى مصفوفة (إن لم تكن مصفوفة) وتعيينها إلى `reqConfig.arrValue` (مصفوفة التشغيل المفضلة). يتم مزامنة `reqConfig.arr` القديم لأغراض التوافق.
         - إن وُجد `reqConfig.populateMethod`:
           - استدعاء `requestBuilder.getPopulateInvoker(reqConfig, this)` للحصول على `invoker` مخصص.
           - تشغيل `invoker(resp.data, reqConfig.populateArgs)` داخل `try/catch` حتى لا يتسبب فشل invoker في إيقاف باقي المعالجة.
         - لكل اسم حقل في `reqConfig.requestsSelectionFields`:
           - استدعاء `genericFormService.mapArrayToSelectionArray(fieldName, resp.data)` وإضافة الناتج إلى `genericFormService.selectionArrays`.
       - إذا `resp.isSuccess === false`:
         - جمع رسائل الأخطاء من `resp.errors` وعرضها عبر `msg.msgError(...)`.
     - بعد معالجة جميع الاستجابات يُستدعى `populateForm()` لملء النموذج بالبيانات المتاحة الآن.
   - عند وقوع خطأ عام في الطلبات (`error`) يتم عرض رسالة عامة عبر `msg.msgError`.

## الاعتمادات (Dependencies) ودور كلٍ منها
- `BuildRequestsFromConfigService.buildRequestsFromConfig(configArray, context)`:
  - يحوّل تكوينات الطلبات إلى `Observable` صالحة للإرسال (API calls أو مصادر أخرى).
- `getData(requests)` (دالة محلية):
  - يستخدم `forkJoin` لجمع نتائج جميع `Observable` ويُعيد observable واحد يحوي مصفوفة النتائج.
- `requestBuilder.getPopulateInvoker(reqConfig, this)`:
  - يستخرج دالة (invoker) مخصصة من `reqConfig.populateMethod` لعمليات ملء خاصة بكل طلب.
- `genericFormService.mapArrayToSelectionArray(fieldName, data)`:
  - يحوّل مصفوفة البيانات إلى صيغة مناسبة لقوائم الاختيار (select/radio) في الـ form.
- `genericFormService.selectionArrays`:
  - مخزن مركزي يجمع مصفوفات الاختيارات المستخدمة في الواجهة.
- `populateForm()` (محلية):
  - تملأ `ticketForm` اعتمادًا على `messageDto` ومخرجات `requestsarray` و`selectionArrays`.
- `msg.msgError(...)`:
  - عرض رسائل الخطأ للمستخدم.
- `forkJoin` (RxJS):
  - تنفيذ متماثل لعدة `Observable` والانتظار حتى تكتمل جميعها ثم تجميع النتائج.

## قواعد بيانات وملاحظات تصميمية داخلية
- الحفاظ على ترتيب النتائج: استخدام `idx` لربط كل `resp` بملف التكوين المقابل في `this.config.requestsarray[idx]`.
- توحيد `resp.data` إلى مصفوفة قبل التخزين في `reqConfig.arrValue` (وتزامن `reqConfig.arr` للوراثة).
- حماية المعالجات المخصصة: غلاف `try/catch` حول استدعاءات `invoker` لضمان استمرار المعالجة حتى لو فشل `invoker` واحد.
- عرض الأخطاء لكل استجابة بشكل منفصل بدلاً من إيقاف العملية بأكملها.
- استدعاء `populateForm()` فقط بعد انتهاء معالجة جميع الاستجابات لضمان توفر كل البيانات اللازمة للتهيئة.

## نموذج مبسّط لبنية `reqConfig` المتوقعة
```json
{
  "name": "someRequest",
  "url": "/api/...",
  "method": "GET",
  "requestsSelectionFields": ["FieldA", "FieldB"],
  "populateMethod": "populateUnitTree",
  "populateArgs": { "someArg": 1 },
  "arrName": "this.someArray"  // or use "arrValue": [] for inline arrays
}
```
- الحقول الأساسية:
  - `requestsSelectionFields` (اختياري): أسماء الحقول التي ستحول نتيجة الطلب إلى مصفوفات اختيار.
  - `populateMethod` (اختياري): مفتاح أو اسم دالة تعبئة مخصصة تُرجعها `getPopulateInvoker`.
  - `populateArgs` (اختياري): معاملات تُمرر إلى `invoker` عند التنفيذ.
  - `arr`: سيتم تعبئتها بنتيجة `resp.data` بعد التنفيذ.

## حالات الخطأ وكيفية التعامل
- استجابة فاشلة (`isSuccess: false`): عرض الأخطاء كما هو معمول (`msg.msgError`).
- فشل `invoker`: لا يقطع المعالجة لباقي الطلبات، يُسجّل تحذير في الكونسول، ويفضّل إضافة لوق أكثر تفصيلاً (reqConfig + idx).
- فشل عام في الاتصال: عرض رسالة عامة ويمكن إضافة منطق إعادة محاولة (retry) إن لزم.

## اقتراحات لتحسين العملية
- توثيق رسمي لبنية `this.config.requestsarray` بحيث يعرف كل من يكتب Config الحقول المتاحة وسلوكها.
- إضافة لوج تفصيلي عند فشل `invoker` مع طباعة `reqConfig` و`idx` لتسهيل التتبع.
- إظهار `spinner` أثناء تنفيذ `forkJoin` إذا كانت الطلبات ثقيلة.
- دعم `retry` أو `timeout` لطلبات معينة عبر تعديل `buildRequestsFromConfig` لإلحاق مشغلات RxJS.

---

إذا رغبت أستطيع:
- حفظ هذا الملف داخل المشروع كملف Markdown (أنشأته هنا في `docs/processRequestsAndPopulate-explained-ar.md`).
- تحضير نسخة إنجليزية أو نسخ مختصرة لكل قسم.
- إدراج مقتطفات الشيفرة مع ربط أسطر محددة لو أردتم توثيقًا أكثر تقنيًا.
