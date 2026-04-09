# ControlCenterCatalog - Field/Group Access Policy (Pre-Implementation Analysis)

## 1) الوضع الحالي (As-Is)

### Backend metadata الحالية
- **الطلبات**
  - `Messages` (request header: `MessageId`, `CategoryCd`, `Status`, `CreatedBy`, `AssignedSectorId`, `CurrentResponsibleSectorId`, ...).
  - القيم الديناميكية للحقول محفوظة في `TKMendFields` (`FildRelted`, `FildKind`, `FildTxt`, `InstanceGroupId`).
- **الحقول**
  - مكتبة الحقول: `CDMend` (type/label/default/required/isDisabledInit/options).
- **المجموعات**
  - `AdminCatalogCategoryGroups` (group metadata المعتمد حاليًا لمسار ControlCenterCatalog).
- **ربط الحقول بالمجموعات/الطلب**
  - `CdCategoryMand` يربط الحقل (`MendField`) بالنوع (`MendCategory`) ومعرّف المجموعة (`MendGroup`)،
    ويتم جلب بيانات الجروب الفعلية عبر `AdminCatalogCategoryGroups`.
  - `SubjectCategoryFieldSettings` يدير `DisplayOrder` و`IsVisible` و`DisplaySettingsJson` لكل رابط.
- **المراحل/الإجراءات/التوجيه**
  - `SubjectRoutingProfiles`, `SubjectRoutingSteps`, `SubjectRoutingTransitions`, `SubjectRoutingTargets`, `SubjectTypeRoutingBindings`.
  - لا يوجد حتى الآن ربط تشغيلي مباشر يفرض صلاحيات Field/Group حسب `Stage/Action` عند الحفظ.

### Frontend rendering الحالية
- مسار تشغيل الطلبات الديناميكية للمستخدم النهائي موجود في:
  - `Modules/dynamic-subjects/components/subject-editor/*`
  - `Modules/dynamic-subjects/components/subject-detail/*`
- تحميل المجموعات/الحقول يتم عبر `GET api/DynamicSubjects/FormDefinition/{categoryId}`.
- `required/readOnly/hidden` الحالي يعتمد أساسًا على metadata و`RequestPolicy` (Presentation Rules) وليس Access Matrix مستقل.
- الحفظ يتم عبر:
  - `POST/PUT api/DynamicSubjects/Subjects` مع `dynamicFields`.
- لا يوجد حتى الآن حسم backend صارم لمنع تعديل field hidden/readonly حسب Stage+Action policy مستقل.

### Admin UI الحالية
- في `Admin/ControlCenterCatalog` يوجد Workspace متقدم بالفعل لـ:
  - Applications/Category Tree/Groups.
  - Routing workspace (Steps/Targets/Transitions/Preview/Validation) عربي RTL PrimeNG.
- يوجد Preview إداري عام في مسارات admins القديمة، لكن لا يوجد Access Preview مخصص لـ Field/Group policy الجديدة.

## 2) الفجوات (Gaps)

1. لا توجد جداول Access Policy مستقلة (rules/locks/overrides).
2. لا يوجد Resolver backend موحد لحسم `Field > Group > Request` مع أولوية `Override > Action > Stage > Default`.
3. التحقق قبل الحفظ لا يمنع محاولات تعديل غير مصرح بها على مستوى field/group.
4. لا توجد شاشة إدارة متكاملة Access Policy بالـ tabs المطلوبة (Overview / Default / Stage-Action Rules / Locks / Preview).
5. لا يوجد Preview Policy يوضح `Visible/Editable/Required/Locked` لكل group/field تحت سياق `RequestType + Stage + Action + Subject`.

## 3) أقل تصميم آمن للتنفيذ (MVP-safe design)

### قاعدة البيانات
- إضافة الجداول:
  - `FieldAccessPolicies`
  - `FieldAccessPolicyRules`
  - `FieldAccessLocks`
  - `FieldAccessOverrides` (تصميم جاهز، تنفيذ override engine محدود في MVP)
- ربطها بـ `RequestType (CDCategory)` وبـ `Stage/Action` عبر routing ids عند الحاجة.

### Backend
- بناء **FieldAccess Resolver Service** يعيد حالة واضحة لكل Group/Field:
  - `CanView`, `CanEdit`, `CanFill`, `IsHidden`, `IsReadOnly`, `IsRequired`, `IsLocked`, `LockReason`.
- دمج resolver في:
  - تحميل FormDefinition (لتنعكس الحالة في UI).
  - التحقق قبل الحفظ (server-side enforcement).
  - منع أي تعديل غير مصرح حتى لو الطلب مرسل يدويًا.
- إبقاء RequestPolicy الحالي (presentation/workflow) متوافق، مع إضافة طبقة Access جديدة فوقه.

### Frontend
- إنشاء/دمج شاشة Access Policy متكاملة داخل `Admin/ControlCenterCatalog` (RTL + PrimeNG + appendTo='body').
- tabs إلزامية:
  - `Overview`
  - `Default Policy`
  - `Stage/Action Rules`
  - `Locks`
  - `Preview`
- Preview يعتمد على backend resolver ويعرض per group/field:
  - visible/hidden
  - editable/readOnly
  - required/optional
  - lock state

## 4) ما سيتم تنفيذه الآن (MVP scope)

1. جداول policy/rules/locks/overrides + migration مرتبة.
2. Resolver backend مع subjects:
  - `OrgUnit`, `Position`, `User`, `RequestOwner`, `CurrentCustodian`.
3. تطبيق policy على **Group + Field** فقط في MVP (مع بنية قابلة لتوسعة Request-level لاحقًا).
4. ربط Stage + Action في rules/preview/resolution.
5. Enforcement صارم قبل الحفظ (create/update).
6. Admin UI tabbed كاملة + Preview Policy فعلي.
7. تمرير أثر policy للواجهة النهائية (hidden/readOnly/required/lock) من backend.

## 5) ما سيتم تأجيله intentionally

1. override engine متقدم (multi-grant workflow, approvals, audit trail موسع)؛ سيبقى MVP محدود.
2. إدارة استثناءات متقدمة على مستوى request instance مع UX كامل للصلاحيات العالية.
3. محرك conflict-resolution متقدم متعدد الأبعاد beyond MVP precedence الحالي.
4. أي refactor كبير شامل لمسار RequestPolicy القديم.

## 6) ملاحظات تقنية مهمة قبل التنفيذ

- غياب `ModelSnapshot` في migrations الحالية هو **Red Flag**.
- سيتم التعامل معه ضمن التنفيذ بما يضمن استقرار migration path للميزة الجديدة.
