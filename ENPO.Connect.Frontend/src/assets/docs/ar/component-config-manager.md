<!-- Shared styles moved to docs/styles.css -->
<link rel="stylesheet" href="../styles.css">

<div class="doc-hero">
  <h1>مدير إعدادات المكونات</h1>
  <div class="badge">مكوّن إداري</div>
</div>

<div class="section" dir="rtl">
  <strong>الهدف</strong>
  <ul>
    <li>المحرر المركزي لـ <code>ComponentConfig</code> الذي يقود شاشات القوائم/النماذج العامة.</li>
    <li>ربط سلوك الواجهة بنقاط النهاية الخلفية دون ترميز مخصص لكل وحدة.</li>
  </ul>
</div>

<div class="doc-body" dir="rtl">
  <h2>المهام الأساسية</h2>
  <ul>
    <li>عرض الإعدادات وتحريرها عبر حوار كامل الشاشة متعدد التبويبات.</li>
    <li>إدارة إعدادات القوائم، البحث، الأعمدة، الحقول، والمرفقات.</li>
    <li>تكوين مسارات الطلبات (endpoint + args + selection mapping).</li>
    <li>حفظ الإعدادات وتصديرها محلياً عند العمل على localhost.</li>
  </ul>

  <h2>الاعتمادات</h2>
  <ul>
    <li>نموذج <code>ComponentConfig</code> مع المساعدات (<code>defaultGlobalFilterFields</code>, <code>parseToDate</code>).</li>
    <li><code>ComponentConfigService</code> للكاش والقيم الافتراضية والتصدير.</li>
    <li><code>MsgsService</code> للتأكيد والتنبيهات.</li>
    <li><code>CONTROLLER_CLASSES</code> + <code>Injector</code> لاكتشاف متحكمات الخلفية.</li>
    <li><code>HttpClient</code> لتحميل ملفات الأصول وأشكال DTO.</li>
    <li><code>DtoRendererComponent</code> لتحرير body args المعقدة.</li>
    <li>مكونات PrimeNG (dialog, tabView, calendar, dropdown).</li>
  </ul>

  <h2>الخلفية / البيانات</h2>
  <ul>
    <li>المصدر الأساسي: <code>assets/component-configs.json</code> (مع قيم افتراضية).</li>
    <li>تصدير اختياري: <code>http://localhost:3001/save-configs</code> (يعمل فقط على localhost).</li>
    <li>تحميل أشكال DTO من:
      <ul>
        <li><code>src/app/shared/services/BackendServices/DtoShapes/combined-dto-shapes</code></li>
        <li><code>assets/dto-shapes/combined-dto-shapes.json</code></li>
        <li>قديمة: <code>assets/publications-dto-shapes.json</code></li>
      </ul>
    </li>
    <li>خيارات المرفقات من <code>assets/attachment-options.json</code>.</li>
  </ul>

  <h2>سلوكيات مهمة</h2>
  <ul>
    <li>اكتشاف المتحكمات ديناميكياً وبناء قائمة بالـ endpoints ومعاملاتها.</li>
    <li>تمييز معاملات الـ body عن معاملات الـ query لبناء placeholders.</li>
    <li>تطبيق أشكال DTO تلقائياً لتمكين تحرير أجسام الطلبات.</li>
    <li>دعم <code>wrapBodyAsArray</code> و <code>populateMethod</code> و <code>populateArgs</code>.</li>
    <li>التصدير للقرص يتطلب تأكيد المستخدم ويعمل فقط على localhost.</li>
  </ul>

  <h2>ملفات ذات صلة</h2>
  <ul>
    <li><code>src/app/Modules/admins/Managementcomponents/component-config-manager/component-config-manager.component.ts</code></li>
    <li><code>src/app/Modules/admins/Managementcomponents/component-config-manager/component-config-manager.component.html</code></li>
    <li><code>src/app/Modules/admins/Managementcomponents/component-config-manager/ccm-shared.scss</code></li>
    <li><code>src/app/Modules/admins/Managementcomponents/component-config-manager/dto-renderer/dto-renderer.component.ts</code></li>
    <li><code>src/app/Modules/admins/services/component-config.service.ts</code></li>
    <li><code>src/app/shared/models/Component.Config.model</code></li>
  </ul>
</div>
