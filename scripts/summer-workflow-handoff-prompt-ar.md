# Prompt Handoff - Summer Workflow (Connect)

أنت Agent جديد مكلف بإكمال تطوير Workflow المصايف في مشروع Connect بدون كسر الطبيعة الديناميكية للنظام.

## 1) الهدف
إكمال شاشة المصايف الجديدة (Admin Module) + قواعد الباك/التحقق + real-time capacity + seed/testing، مع الالتزام الصارم بالـ dynamic core.

## 2) قيود إلزامية (غير قابلة للكسر)
1. لا تضف جداول أعمال ثابتة جديدة تخص المصايف (Business Tables) طالما ممكن استخدام `Messages` + `TkmendFields` + `Replies` + `AttchShipments`.
2. لا تعدل `form-details` بشكل يجعله خاص بالمصايف؛ أي منطق مصايف يجب أن يبقى داخل Workspace الجديد.
3. أي تعديل DB لازم يكون عبر Migration داخل الباك + يشتغل تلقائيًا عند startup.
4. كل الرسائل الظاهرة للمستخدم أو المسجلة كسجل تحديث تكون بالعربي.
5. المرفقات المسموح بها فقط: PDF + Images.

## 3) الوضع الحالي (ملخص منجز)
- فرونت شاشة جديدة: `Admins/SummerRequests` داخل:
  - `ENPO.Connect.Frontend/src/app/Modules/admins/components/summer-requests-workspace/`
- باك API مخصص:
  - `api/SummerWorkflow/*` (GetMyRequests / GetWaveCapacity / Cancel / Pay / Transfer)
- قواعد متحققة:
  - منع الحجز لنفس الموظف في نفس المصيف+الفوج أكثر من مرة.
  - التحقق من السعات حسب familyCount.
  - lock عند الحفظ المتزامن باستخدام `sp_getapplock`.
  - التحويل مرة واحدة في الموسم.
  - الاعتذار مرة واحدة + منع الاعتذار قبل الفوج بأقل من 14 يوم.
  - السداد يتطلب مرفقات، ومنع السداد بعد المهلة.
- real-time:
  - بث تحديث سعات عبر SignalR برسالة marker:
    - `SUMMER_CAPACITY_UPDATED|{categoryId}|{waveCode}|{action}|{utc}`
- auto-cancel:
  - Hosted service لتشغيل إلغاء تلقائي عند انتهاء مهلة السداد (يوم عمل).
- DB migration:
  - إضافة sequences مستقلة للمصايف:
    - `Seq_Summer_M`, `Seq_Summer_R`, `Seq_Summer_B`
- Seed script API-based موجود:
  - `scripts/summer-seed-api.ps1`
  - ينشئ 120 طلب + تقرير سعات قبل/بعد.

## 4) ملفات حرجة راجعها قبل أي تعديل
- Backend:
  - `ENPO.Connect.Backend/Persistence/Services/HandlleEmployeeCategories.cs`
  - `ENPO.Connect.Backend/Persistence/Services/SummerWorkflowService.cs`
  - `ENPO.Connect.Backend/Persistence/Services/Summer/SummerCalendarRules.cs`
  - `ENPO.Connect.Backend/Api/HostedServices/SummerPaymentAutoCancellationHostedService.cs`
  - `ENPO.Connect.Backend/Api/Program.cs`
  - `ENPO.Connect.Backend/Persistence/Migrations/20260321_AddSummerResortSequences.cs`
- Frontend:
  - `ENPO.Connect.Frontend/src/app/Modules/admins/components/summer-requests-workspace/*`
  - `ENPO.Connect.Frontend/src/app/shared/services/BackendServices/SummerWorkflow/*`
  - `ENPO.Connect.Frontend/src/app/app.component.ts`
  - `ENPO.Connect.Frontend/src/app/app.component.html`

## 5) تعديلات تمت مؤخرًا (مهمة)
1. إصلاح نصوص عربية مشوهة (encoding) في `app.component.ts/html`.
2. إضافة banner عالمي لحالة SignalR (disconnect/reconnect) في `AppComponent`.
3. إضافة حالة اتصال SignalR ديناميكية داخل Hero badges في summer workspace.
4. تقوية بيانات صاحب الطلب عبر fallback:
   - backend summary DTO أصبح يرجع: `employeeName`, `employeeNationalId`, `employeePhone`, `employeeExtraPhone`.
   - frontend owner panel يستخدم fields + summary fallback.

## 6) المطلوب من Agent الجديد مباشرة
1. مراجعة end-to-end على بيئة تشغيل فعلية:
   - إنشاء طلب
   - عرض تفاصيل الطلب
   - اعتذار
   - سداد بمرفقات
   - تحويل
   - تحديث السعات لحظيًا
2. تأكيد أن بيانات صاحب الطلب تظهر كاملة دائمًا (الاسم/الملف/القومي/الهاتف/الإضافي).
3. التأكد أن سجل التحديثات يظهر الأحدث فالأقدم، وأن أسماء المرسلين غير مشوهة.
4. تشغيل seed script (120 request) وإخراج تقرير capacity delta.
5. عدم كسر أي شاشة ديناميكية أخرى خارج المصايف.

## 7) أوامر تشغيل مفيدة
### Frontend build
```powershell
cd D:\Repo\Connect\ENPO.Connect.Frontend
npm run build
```

### Backend migration auto-apply
- مطبق داخل `Program.cs` عبر `Database.Migrate()` عند startup.

### Seed 120 request
```powershell
cd D:\Repo\Connect
.\scripts\summer-seed-api.ps1 -ApiBaseUrl "http://localhost:8888" -SeasonYear 2026 -TotalRequests 120
```

## 8) مشكلات بيئة متوقعة
- `dotnet build` قد يفشل بسبب NuGet private feed (401):
  - `https://pkgs.dev.azure.com/Egyptpost/_packaging/Egyptpost/nuget/v3/index.json`
- في هذه الحالة، تحقق وظيفيًا عبر تشغيل API الحالي + اختبارات endpoint بدل الاعتماد على restore/build الكامل.

## 9) تعريف نجاح المهمة
1. لا توجد جداول أعمال جديدة مكسرة للديناميكية.
2. كل قواعد الحجز/السداد/الاعتذار/التحويل تعمل على الباك والفرونت.
3. SignalR واضح للمستخدم عند الانقطاع والعودة.
4. تقارير seed قبل/بعد السعات دقيقة.
5. واجهة عربية سليمة بدون نصوص مشوهة.

ابدأ التنفيذ فورًا على نفس الـ branch الحالي، مع الحفاظ على التعديلات السابقة وعدم إعادة التصميم من الصفر.
