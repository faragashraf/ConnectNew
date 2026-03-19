<!-- Shared styles moved to docs/styles.css -->
<link rel="stylesheet" href="../styles.css">

<div class="doc-hero">
  <h1>مدير إعدادات الرسوم البيانية</h1>
  <div class="badge">مكوّن إداري</div>
</div>

<div class="section" dir="rtl">
  <strong>الهدف</strong>
  <ul>
    <li>إدارة تعريفات الرسوم لكل Module لدعم لوحات مبنية على الخلفية.</li>
    <li>تحويل مدخلات الواجهة إلى شكل <code>ChartConfig</code> المطلوب من الـ API.</li>
  </ul>
</div>

<div class="doc-body" dir="rtl">
  <h2>المهام الأساسية</h2>
  <ul>
    <li>عرض الرسوم حسب الـ Module مع إنشاء/تعديل/حذف.</li>
    <li>تعريف البيانات (queryId, queryParams, sector/series/value fields).</li>
    <li>خيارات متقدمة للمظهر والتخطيط والمحاور والتسميات.</li>
    <li>تطبيع المدخلات (تحليل JSON، حقول المصفوفات، وحدات الارتفاع).</li>
  </ul>

  <h2>الاعتمادات</h2>
  <ul>
    <li><code>ChartConfigAdminService</code> لعمليات CRUD.</li>
    <li>نموذج <code>ChartConfig</code> من GenericComponents.</li>
    <li><code>MsgsService</code> للتأكيد والتنبيهات.</li>
    <li>Reactive Forms + Animations في Angular.</li>
    <li>مكونات PrimeNG (table, dialog, dropdown, inputNumber, tabs).</li>
  </ul>

  <h2>الخلفية / البيانات</h2>
  <ul>
    <li>مسار الـ API: <code>environment.PowerBi + "/api/charts"</code>.</li>
    <li>الاستعلامات مبنية على الخلفية عبر <code>queryId</code> و <code>queryParams</code>.</li>
    <li>يدعم عدة أشكال لاستجابة القائمة أثناء التحميل.</li>
  </ul>

  <h2>سلوكيات مهمة</h2>
  <ul>
    <li><code>openNew()</code> يضبط <code>order</code> على أكبر قيمة + 1 ويثبت <code>moduleName</code>.</li>
    <li><code>editChart()</code> يعيد تشكيل <code>appearance</code> القديمة/المسطحة داخل نموذج متداخل.</li>
    <li><code>saveChart()</code> يسطّح <code>appearance</code> بالشكل المناسب للخلفية.</li>
    <li><code>layout.height</code> تُحفظ بصيغة <code>"&lt;number&gt;px"</code>.</li>
  </ul>

  <h2>ملفات ذات صلة</h2>
  <ul>
    <li><code>src/app/Modules/admins/Managementcomponents/chart-config-manager/chart-config-manager.component.ts</code></li>
    <li><code>src/app/Modules/admins/Managementcomponents/chart-config-manager/chart-config-manager.component.html</code></li>
    <li><code>src/app/Modules/admins/services/chart-config-admin.service.ts</code></li>
    <li><code>src/app/Modules/GenericComponents/models/chart-config.ts</code></li>
  </ul>
</div>
