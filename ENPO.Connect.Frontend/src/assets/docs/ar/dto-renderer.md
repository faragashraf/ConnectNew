<!-- Shared styles moved to docs/styles.css -->
<link rel="stylesheet" href="../styles.css">

<div class="doc-hero">
  <h1>مكوّن DTO Renderer</h1>
  <div class="badge">مكوّن مساعد</div>
</div>

<div class="section" dir="rtl">
  <strong>الهدف</strong>
  <ul>
    <li>عرض وتحرير أجسام الطلبات المعقدة (Objects/Arrays) داخل مدير إعدادات المكونات.</li>
  </ul>
</div>

<div class="doc-body" dir="rtl">
  <h2>المدخلات / المخرجات</h2>
  <ul>
    <li><code>@Input() value</code>: كائن أو مصفوفة كائنات ليتم تحريرها.</li>
    <li><code>@Output() valueChange</code>: يبث القيمة بعد التعديل.</li>
  </ul>

  <h2>السلوك الرئيسي</h2>
  <ul>
    <li>يعرض مفاتيح الكائنات بشكل تلقائي مع دعم التداخل.</li>
    <li>يدعم مصفوفات الكائنات عبر تحرير العنصر الأول.</li>
    <li>يحاول تحويل النص إلى boolean/number/JSON عند الإمكان.</li>
    <li>إضافة/حذف خصائص وعناصر مع قيم افتراضية آمنة.</li>
    <li>يبث نسخة عميقة لضمان تحديث واجهة Angular.</li>
  </ul>

  <h2>الاعتمادات</h2>
  <ul>
    <li>يُستخدم داخل تبويب Requests في <code>ComponentConfigManagerComponent</code>.</li>
    <li>يشترك في الأنماط مع <code>ccm-shared.scss</code>.</li>
  </ul>

  <h2>ملفات ذات صلة</h2>
  <ul>
    <li><code>src/app/Modules/admins/Managementcomponents/component-config-manager/dto-renderer/dto-renderer.component.ts</code></li>
    <li><code>src/app/Modules/admins/Managementcomponents/component-config-manager/dto-renderer/dto-renderer.component.html</code></li>
    <li><code>src/app/Modules/admins/Managementcomponents/component-config-manager/ccm-shared.scss</code></li>
  </ul>
</div>
