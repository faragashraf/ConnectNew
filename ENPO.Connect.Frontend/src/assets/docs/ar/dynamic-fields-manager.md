<!-- Shared styles moved to docs/styles.css -->
<link rel="stylesheet" href="../styles.css">

<div class="doc-hero">
  <h1>مدير الحقول</h1>
  <div class="badge">مكوّن إداري</div>
</div>

<div class="section" dir="rtl">
  <strong>الهدف</strong>
  <ul>
    <li>إدارة ميتاداتا الحقول التي تقود النماذج العامة المبنية على قاعدة البيانات.</li>
    <li>توفير أدوات للبحث والتجميع والتصدير للحقول.</li>
  </ul>
</div>

<div class="doc-body" dir="rtl">
  <h2>المهام الأساسية</h2>
  <ul>
    <li>تحميل الحقول الإلزامية والميتا والفئات من خدمات الخلفية.</li>
    <li>تجميع الحقول حسب التطبيق ونوع الحقل لتسهيل التصفح.</li>
    <li>إضافة/تعديل تعريفات الحقول وقوائم الخيارات (<code>cdmendTbl</code>).</li>
    <li>بحث وتصفية حسب التطبيق والحالة مع تصدير إلى Excel.</li>
    <li>حفظ تفضيلات الواجهة (داكن/مضغوط/تباين عالي) في localStorage.</li>
  </ul>

  <h2>الاعتمادات</h2>
  <ul>
    <li><code>DynamicFormController</code> للوصول إلى الخلفية.</li>
    <li><code>GenericFormsService</code> لتخزين وتحديث <code>CdmendDto</code>.</li>
    <li><code>MsgsService</code> و <code>SpinnerService</code> و <code>RedisHubService</code> و <code>GenerateQueryService</code>.</li>
    <li>أنواع DTO: <code>CdmendDto</code>, <code>CdcategoryDto</code>, <code>CdCategoryMandDto</code>.</li>
    <li>مكتبات التصدير: <code>xlsx</code> و <code>file-saver</code>.</li>
    <li>حوار التحرير: <code>app-generic-element-details</code>.</li>
  </ul>

  <h2>الخلفية / البيانات</h2>
  <ul>
    <li>التحميل عبر <code>getMandatoryAll</code> و <code>getMandatoryMetaDate</code> و <code>getAllCategories</code>.</li>
    <li>يستخدم <code>forkJoin</code> لجلب البيانات بشكل متزامن.</li>
    <li><code>cdmendTbl</code> محفوظ كنص JSON ويتم تحريره كمصفوفة.</li>
  </ul>

  <h2>سلوكيات مهمة</h2>
  <ul>
    <li>يبني هيكل هرمي: التطبيق → نوع الحقل → الحقل.</li>
    <li>عدادات إحصائية متحركة لعدد التطبيقات والأنواع والحقول النشطة/غير النشطة.</li>
    <li>التصفية تعيد بناء شجرة العرض تلقائياً.</li>
  </ul>

  <h2>ملفات ذات صلة</h2>
  <ul>
    <li><code>src/app/Modules/admins/Managementcomponents/dynamic-fields-manager/dynamic-fields-manager.component.ts</code></li>
    <li><code>src/app/Modules/admins/Managementcomponents/dynamic-fields-manager/dynamic-fields-manager.component.html</code></li>
    <li><code>src/app/Modules/admins/Managementcomponents/dynamic-fields-manager/dynamic-fields-manager.component.scss</code></li>
    <li><code>src/app/shared/services/BackendServices/DynamicForm/DynamicForm.service</code></li>
    <li><code>src/app/Modules/GenericComponents/GenericForms.service</code></li>
  </ul>
</div>
