<!-- Shared styles moved to docs/styles.css -->
<link rel="stylesheet" href="../styles.css">

<div class="doc-hero">
  <h1>محرر NSwag</h1>
  <div class="badge">مكوّن إداري</div>
</div>

<div class="section" dir="rtl">
  <strong>الهدف</strong>
  <ul>
    <li>إدارة إعدادات NSwag لتوليد عملاء الـ API.</li>
  </ul>
</div>

<div class="doc-body" dir="rtl">
  <h2>المهام الأساسية</h2>
  <ul>
    <li>إضافة/تعديل/حذف عناصر NSwag (label, env property, URLs, output path).</li>
    <li>تفعيل وضع الإنتاج وخيار إعادة التوليد.</li>
    <li>تحميل وحفظ الإعدادات عبر خدمة محلية.</li>
  </ul>

  <h2>الاعتمادات</h2>
  <ul>
    <li><code>NswagEditorService</code> للعمليات الشبكية.</li>
    <li><code>environment</code> لاستخراج خصائص البيئة المتاحة.</li>
    <li>Reactive Forms + PrimeNG dropdown.</li>
  </ul>

  <h2>الخلفية / البيانات</h2>
  <ul>
    <li>الخادم المحلي: <code>http://localhost:3002/nswag</code>.</li>
  </ul>

  <h2>ملفات ذات صلة</h2>
  <ul>
    <li><code>src/app/Modules/admins/Managementcomponents/nswag-editor/nswag-editor.component.ts</code></li>
    <li><code>src/app/Modules/admins/Managementcomponents/nswag-editor/nswag-editor.component.html</code></li>
    <li><code>src/app/Modules/admins/services/nswag-editor.service.ts</code></li>
  </ul>
</div>
