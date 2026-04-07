export type ControlCenterStepKey =
  | 'scope-definition'
  | 'subject-structure'
  | 'field-library-binding'
  | 'form-composition'
  | 'workflow-routing'
  | 'access-visibility'
  | 'validation-rules'
  | 'preview-simulation'
  | 'readiness-audit'
  | 'notifications-alerts'
  | 'publish-release';

export type ControlCenterFieldType = 'text' | 'textarea' | 'select' | 'switch';

export type ControlCenterStepStatus = 'draft' | 'ready' | 'blocked';

export type ControlCenterPublishState = 'draft' | 'blocked' | 'ready' | 'published';

export type ControlCenterTransitionReason = 'allowed' | 'invalid-step' | 'step-blocked';

export interface ControlCenterContextState {
  readonly applicationId: string | null;
  readonly categoryId: number | null;
  readonly routeKeyPrefix: string | null;
  readonly documentDirection: 'incoming' | 'outgoing' | null;
  readonly requestMode: string | null;
  readonly primaryConfigRouteKey: string | null;
  readonly createUnitScope: string | null;
  readonly readUnitScope: string | null;
  readonly creatorUnitDefault: string | null;
  readonly targetUnitDefault: string | null;
  readonly runtimeContextJson: string | null;
  readonly localizationProfile: string | null;
  readonly uiPreset: string | null;
}

export interface ControlCenterStepValidationState {
  readonly isValid: boolean;
  readonly mandatoryMissingFieldKeys: ReadonlyArray<string>;
  readonly mandatoryMissingFieldLabels: ReadonlyArray<string>;
  readonly issues: ReadonlyArray<string>;
}

export interface ControlCenterStepTransitionResult {
  readonly allowed: boolean;
  readonly reason: ControlCenterTransitionReason;
  readonly requestedStepKey: ControlCenterStepKey | null;
  readonly resolvedStepKey: ControlCenterStepKey;
  readonly blockingStepKey: ControlCenterStepKey | null;
  readonly message: string;
}

export interface ControlCenterFieldOption {
  readonly label: string;
  readonly value: string;
}

export interface ControlCenterFieldDefinition {
  readonly key: string;
  readonly label: string;
  readonly required: boolean;
  readonly type: ControlCenterFieldType;
  readonly placeholder?: string;
  readonly hint?: string;
  readonly options?: ReadonlyArray<ControlCenterFieldOption>;
}

export interface ControlCenterStepDefinition {
  readonly key: ControlCenterStepKey;
  readonly order: number;
  readonly title: string;
  readonly shortTitle: string;
  readonly description: string;
  readonly fields: ReadonlyArray<ControlCenterFieldDefinition>;
}

export interface ControlCenterStepState {
  readonly key: ControlCenterStepKey;
  readonly values: Record<string, unknown>;
  readonly requiredCompleted: number;
  readonly requiredTotal: number;
  readonly optionalCompleted: number;
  readonly optionalTotal: number;
  readonly status: ControlCenterStepStatus;
  readonly isUnlocked: boolean;
  readonly isCompleted: boolean;
  readonly isBlocked: boolean;
  readonly isVisited: boolean;
  readonly validation: ControlCenterStepValidationState;
}

export interface ControlCenterState {
  readonly context: ControlCenterContextState;
  readonly steps: ReadonlyArray<ControlCenterStepState>;
  readonly activeStepKey: ControlCenterStepKey;
  readonly completedStepKeys: ReadonlyArray<ControlCenterStepKey>;
  readonly blockedStepKeys: ReadonlyArray<ControlCenterStepKey>;
  readonly accessibleStepKeys: ReadonlyArray<ControlCenterStepKey>;
  readonly readinessPercentage: number;
  readonly blockingIssues: ReadonlyArray<string>;
  readonly publishState: ControlCenterPublishState;
  readonly isPublished: boolean;
  readonly hasUnsavedChanges: boolean;
  readonly draftRestoredAt: string | null;
  readonly draftErrorMessage: string | null;
  readonly lastSavedAt: string | null;
  readonly lastPublishedAt: string | null;
}

export const ADMIN_CONTROL_CENTER_STEP_ORDER: ReadonlyArray<ControlCenterStepKey> = [
  'scope-definition',
  'subject-structure',
  'field-library-binding',
  'form-composition',
  'workflow-routing',
  'access-visibility',
  'validation-rules',
  'preview-simulation',
  'readiness-audit',
  'notifications-alerts',
  'publish-release'
] as const;

export const ADMIN_CONTROL_CENTER_DEFAULT_STEP: ControlCenterStepKey = 'scope-definition';

export const INITIAL_ADMIN_CONTROL_CENTER_CONTEXT: ControlCenterContextState = {
  applicationId: null,
  categoryId: null,
  routeKeyPrefix: null,
  documentDirection: null,
  requestMode: null,
  primaryConfigRouteKey: null,
  createUnitScope: null,
  readUnitScope: null,
  creatorUnitDefault: null,
  targetUnitDefault: null,
  runtimeContextJson: null,
  localizationProfile: null,
  uiPreset: null
};

export const ADMIN_CONTROL_CENTER_STEP_DEFINITIONS: ReadonlyArray<ControlCenterStepDefinition> = [
  {
    key: 'scope-definition',
    order: 1,
    title: 'تعريف نطاق الإدارة',
    shortTitle: 'النطاق',
    description: 'تحديد نطاق التكوين الأساسي وتشغيل قيود البداية قبل متابعة باقي الخطوات.',
    fields: [
      {
        key: 'applicationId',
        label: 'التطبيق المستهدف',
        required: true,
        type: 'select',
        options: [
          { label: 'كونكت - 60', value: '60' },
          { label: 'العمليات - 72', value: '72' }
        ]
      },
      {
        key: 'categoryId',
        label: 'الفئة / نوع الموضوع',
        required: true,
        type: 'select',
        options: [
          { label: '124 - الطلبات المركزية', value: '124' },
          { label: '125 - المتابعة والتدقيق', value: '125' },
          { label: '126 - الخدمات المشتركة', value: '126' }
        ]
      },
      {
        key: 'requestMode',
        label: 'نمط الطلب',
        required: true,
        type: 'select',
        options: [
          { label: 'طلب فردي', value: 'single' },
          { label: 'طلب متعدد الجهات', value: 'multi' },
          { label: 'طلب متسلسل', value: 'pipeline' }
        ]
      },
      {
        key: 'documentDirection',
        label: 'اتجاه المستند',
        required: true,
        type: 'select',
        options: [
          { label: 'وارد', value: 'incoming' },
          { label: 'صادر', value: 'outgoing' }
        ]
      },
      {
        key: 'routeKeyPrefix',
        label: 'Route Key Prefix',
        required: true,
        type: 'text',
        placeholder: 'مثال: connect.central.admin'
      },
      {
        key: 'primaryConfigRouteKey',
        label: 'Primary Config Route Key',
        required: true,
        type: 'text',
        placeholder: 'مثال: connect.central.admin.request-124'
      },
      {
        key: 'createUnitScope',
        label: 'نطاق وحدات الإنشاء',
        required: true,
        type: 'textarea',
        placeholder: 'أدخل Unit IDs مفصولة بفواصل (مثال: 60,62,78)'
      },
      {
        key: 'readUnitScope',
        label: 'نطاق وحدات القراءة',
        required: true,
        type: 'textarea',
        placeholder: 'أدخل Unit IDs مفصولة بفواصل (مثال: 60,61,62)'
      },
      {
        key: 'creatorUnitDefault',
        label: 'الوحدة الافتراضية للمنشئ',
        required: false,
        type: 'text',
        placeholder: 'مثال: 60'
      },
      {
        key: 'targetUnitDefault',
        label: 'الوحدة الافتراضية للجهة المستهدفة',
        required: false,
        type: 'text',
        placeholder: 'مثال: 148'
      },
      {
        key: 'runtimeContextJson',
        label: 'Runtime Context JSON',
        required: false,
        type: 'textarea',
        placeholder: '{\"requestSource\":\"central-admin\",\"locale\":\"ar\"}'
      },
      {
        key: 'localizationProfile',
        label: 'Localization Profile',
        required: false,
        type: 'select',
        options: [
          { label: 'عربي مؤسسي', value: 'ar-enterprise' },
          { label: 'عربي إداري مبسط', value: 'ar-admin-lite' },
          { label: 'ثنائي اللغة', value: 'ar-en-dual' }
        ]
      },
      {
        key: 'uiPreset',
        label: 'UI Preset',
        required: false,
        type: 'select',
        options: [
          { label: 'لوحة تشغيل قياسية', value: 'operations-standard' },
          { label: 'لوحة مراجعة مكثفة', value: 'audit-focused' },
          { label: 'لوحة نشر سريعة', value: 'release-quick' }
        ]
      }
    ]
  },
  {
    key: 'subject-structure',
    order: 2,
    title: 'هيكلة الموضوع',
    shortTitle: 'الهيكل',
    description: 'تصميم البنية الأساسية للموضوعات/الطلبات قبل ربط الحقول.',
    fields: [
      {
        key: 'rootSubjectLabel',
        label: 'العنوان الجذري للموضوع',
        required: true,
        type: 'text',
        placeholder: 'مثال: طلب خدمة مركزية'
      },
      {
        key: 'subjectPrefix',
        label: 'بادئة هيكل الموضوع',
        required: true,
        type: 'text',
        placeholder: 'مثال: CC'
      },
      {
        key: 'enableSubSubjectHierarchy',
        label: 'تفعيل الهيكل الفرعي المتدرج',
        required: false,
        type: 'switch'
      },
      {
        key: 'structureNotes',
        label: 'ملاحظات الهيكل',
        required: false,
        type: 'textarea',
        placeholder: 'أي ملاحظات تؤثر على تصميم الشجرة'
      },
      {
        key: 'structureNodesPayload',
        label: 'بيانات الهيكل',
        required: false,
        type: 'textarea',
        placeholder: 'يتم توليد هذه البيانات تلقائيًا من شاشة الإدارة'
      },
      {
        key: 'structureValidationToken',
        label: 'حالة صلاحية الهيكل',
        required: true,
        type: 'text',
        placeholder: 'valid'
      }
    ]
  },
  {
    key: 'field-library-binding',
    order: 3,
    title: 'ربط مكتبة الحقول',
    shortTitle: 'الحقول',
    description: 'تحديد استراتيجية الربط بين مكتبة الحقول وبنية الموضوع.',
    fields: [
      {
        key: 'libraryVersion',
        label: 'إصدار مكتبة الحقول',
        required: true,
        type: 'select',
        options: [
          { label: 'افتراضي', value: 'default' },
          { label: 'امتثال', value: 'compliance' },
          { label: 'تشغيلي', value: 'operations' }
        ]
      },
      {
        key: 'bindingStrategy',
        label: 'استراتيجية الربط',
        required: true,
        type: 'select',
        options: [
          { label: 'صارم', value: 'strict' },
          { label: 'مرن', value: 'flexible' }
        ]
      },
      {
        key: 'includeLegacyFields',
        label: 'تضمين الحقول القديمة المتوافقة',
        required: false,
        type: 'switch'
      },
      {
        key: 'bindingNotes',
        label: 'ملاحظات الربط',
        required: false,
        type: 'textarea',
        placeholder: 'تفاصيل حول قرارات الربط والتوافق'
      },
      {
        key: 'bindingPayload',
        label: 'بيانات الربط',
        required: false,
        type: 'textarea',
        placeholder: 'يتم توليد هذه البيانات تلقائيًا من شاشة ربط الحقول'
      },
      {
        key: 'bindingValidationToken',
        label: 'حالة صلاحية الربط',
        required: true,
        type: 'text',
        placeholder: 'valid'
      }
    ]
  },
  {
    key: 'form-composition',
    order: 4,
    title: 'تركيب نموذج الإدخال',
    shortTitle: 'النموذج',
    description: 'ضبط شكل النموذج وتجميع الأقسام الإلزامية والاختيارية.',
    fields: [
      {
        key: 'defaultGroupLabel',
        label: 'اسم المجموعة الأساسية',
        required: true,
        type: 'text',
        placeholder: 'مثال: بيانات الطلب الرئيسية'
      },
      {
        key: 'layoutDirection',
        label: 'اتجاه العرض',
        required: true,
        type: 'select',
        options: [
          { label: 'من اليمين لليسار (عربي)', value: 'rtl' },
          { label: 'من اليسار لليمين (لاتيني)', value: 'ltr' }
        ]
      },
      {
        key: 'allowInlineSections',
        label: 'السماح بأقسام Inline',
        required: false,
        type: 'switch'
      },
      {
        key: 'compositionNotes',
        label: 'ملاحظات التركيب',
        required: false,
        type: 'textarea',
        placeholder: 'تفاصيل تتعلق بتجربة المستخدم داخل النموذج'
      },
      {
        key: 'compositionLayoutPayload',
        label: 'بيانات تركيب النموذج',
        required: false,
        type: 'textarea',
        placeholder: 'يتم توليدها تلقائيًا من شاشة Form Composition'
      },
      {
        key: 'compositionValidationToken',
        label: 'حالة صلاحية تركيب النموذج',
        required: true,
        type: 'text',
        placeholder: 'valid'
      }
    ]
  },
  {
    key: 'workflow-routing',
    order: 5,
    title: 'التوجيه وسير العمل',
    shortTitle: 'التوجيه',
    description: 'ضبط نمط التوجيه والمسار الأساسي للطلبات.',
    fields: [
      {
        key: 'routingMode',
        label: 'نمط التوجيه',
        required: true,
        type: 'select',
        options: [
          { label: 'ثابت', value: 'static' },
          { label: 'يدوي', value: 'manual' },
          { label: 'هجين', value: 'hybrid' }
        ]
      },
      {
        key: 'defaultTargetUnit',
        label: 'الجهة الافتراضية',
        required: true,
        type: 'text',
        placeholder: 'مثال: 60'
      },
      {
        key: 'allowManualSelection',
        label: 'السماح بالاختيار اليدوي',
        required: false,
        type: 'switch'
      },
      {
        key: 'workflowNotes',
        label: 'ملاحظات التوجيه',
        required: false,
        type: 'textarea',
        placeholder: 'تفاصيل قواعد التوجيه التشغيلية'
      },
      {
        key: 'routeResolutionMode',
        label: 'آلية Route Resolution',
        required: true,
        type: 'select',
        options: [
          { label: 'Static', value: 'static' },
          { label: 'Pattern-based', value: 'pattern' },
          { label: 'Context-aware', value: 'context' }
        ]
      },
      {
        key: 'targetResolutionStrategy',
        label: 'استراتيجية Target Resolution',
        required: true,
        type: 'select',
        options: [
          { label: 'Default Target Unit', value: 'default-unit' },
          { label: 'Unit Scope Matching', value: 'scope-match' },
          { label: 'Manual with fallback', value: 'manual-fallback' }
        ]
      },
      {
        key: 'createConfigRouteKey',
        label: 'Create Config Route Key',
        required: true,
        type: 'text',
        placeholder: 'مثال: connect.central.admin.create'
      },
      {
        key: 'viewConfigRouteKey',
        label: 'View Config Route Key',
        required: true,
        type: 'text',
        placeholder: 'مثال: connect.central.admin.view'
      },
      {
        key: 'directionAwareBehavior',
        label: 'Direction-aware Behavior',
        required: true,
        type: 'select',
        options: [
          { label: 'نفس المسار للاتجاهين', value: 'shared' },
          { label: 'مسارات منفصلة لكل اتجاه', value: 'split' },
          { label: 'Fallback حسب الاتجاه', value: 'fallback' }
        ]
      },
      {
        key: 'workflowValidationToken',
        label: 'حالة صلاحية التوجيه',
        required: true,
        type: 'text',
        placeholder: 'valid'
      }
    ]
  },
  {
    key: 'access-visibility',
    order: 6,
    title: 'الصلاحيات والرؤية',
    shortTitle: 'الصلاحيات',
    description: 'تحديد نطاقات الإنشاء والقراءة والعمل لهذا المسار.',
    fields: [
      {
        key: 'createScope',
        label: 'نطاق الإنشاء',
        required: true,
        type: 'text',
        placeholder: 'IDs مفصولة بفواصل'
      },
      {
        key: 'readScope',
        label: 'نطاق القراءة',
        required: true,
        type: 'text',
        placeholder: 'IDs مفصولة بفواصل'
      },
      {
        key: 'workScope',
        label: 'نطاق التنفيذ',
        required: false,
        type: 'text',
        placeholder: 'IDs مفصولة بفواصل'
      },
      {
        key: 'visibilityNotes',
        label: 'ملاحظات الرؤية',
        required: false,
        type: 'textarea',
        placeholder: 'أي اشتراطات وصول إضافية'
      },
      {
        key: 'adminScope',
        label: 'نطاق الإدارة',
        required: true,
        type: 'text',
        placeholder: 'IDs مفصولة بفواصل'
      },
      {
        key: 'publishScope',
        label: 'نطاق النشر',
        required: true,
        type: 'text',
        placeholder: 'IDs مفصولة بفواصل'
      },
      {
        key: 'accessVisibilityToken',
        label: 'حالة صلاحية الصلاحيات',
        required: true,
        type: 'text',
        placeholder: 'valid'
      }
    ]
  },
  {
    key: 'validation-rules',
    order: 7,
    title: 'قواعد التحقق',
    shortTitle: 'التحقق',
    description: 'ضبط مستوى التحقق ومنع الإرسال عند وجود أخطاء.',
    fields: [
      {
        key: 'validationLevel',
        label: 'مستوى التحقق',
        required: true,
        type: 'select',
        options: [
          { label: 'أساسي', value: 'basic' },
          { label: 'صارم', value: 'strict' },
          { label: 'مؤسسي', value: 'enterprise' }
        ]
      },
      {
        key: 'submitBehavior',
        label: 'سلوك الإرسال عند التحذيرات',
        required: true,
        type: 'select',
        options: [
          { label: 'منع الإرسال', value: 'block' },
          { label: 'السماح بعد تأكيد', value: 'confirm' }
        ]
      },
      {
        key: 'enableCrossFieldValidation',
        label: 'تفعيل تحقق الترابط بين الحقول',
        required: false,
        type: 'switch'
      },
      {
        key: 'validationNotes',
        label: 'ملاحظات التحقق',
        required: false,
        type: 'textarea',
        placeholder: 'تفاصيل إضافية عن القواعد الحرجة'
      },
      {
        key: 'conditionalRulesPayload',
        label: 'قواعد التحقق الشرطية',
        required: false,
        type: 'textarea',
        placeholder: 'يتم توليدها تلقائيًا من شاشة Validation Rules'
      },
      {
        key: 'submissionBlockingPayload',
        label: 'قواعد منع الإرسال',
        required: false,
        type: 'textarea',
        placeholder: 'يتم توليدها تلقائيًا من شاشة Validation Rules'
      },
      {
        key: 'validationRulesToken',
        label: 'حالة صلاحية التحقق',
        required: true,
        type: 'text',
        placeholder: 'valid'
      }
    ]
  },
  {
    key: 'preview-simulation',
    order: 8,
    title: 'المعاينة والمحاكاة',
    shortTitle: 'المعاينة',
    description: 'مراجعة شكل النتيجة النهائية ومحاكاة سيناريوهات الإدخال.',
    fields: [
      {
        key: 'previewDirection',
        label: 'اتجاه المعاينة الافتراضي',
        required: true,
        type: 'select',
        options: [
          { label: 'وارد', value: 'incoming' },
          { label: 'صادر', value: 'outgoing' }
        ]
      },
      {
        key: 'previewMode',
        label: 'وضع المعاينة',
        required: true,
        type: 'select',
        options: [
          { label: 'Create', value: 'create' },
          { label: 'Edit', value: 'edit' },
          { label: 'View', value: 'view' }
        ]
      },
      {
        key: 'sampleReference',
        label: 'مرجع عينة للاختبار',
        required: false,
        type: 'text',
        placeholder: 'مثال: SIM-2026-001'
      },
      {
        key: 'enableSimulationTrace',
        label: 'تفعيل تتبع خطوات المحاكاة',
        required: false,
        type: 'switch'
      },
      {
        key: 'previewNotes',
        label: 'ملاحظات المعاينة',
        required: false,
        type: 'textarea',
        placeholder: 'ملاحظات جودة واجهة المستخدم أثناء المحاكاة'
      },
      {
        key: 'renderingMapPayload',
        label: 'خريطة المعاينة النهائية',
        required: false,
        type: 'textarea',
        placeholder: 'يتم توليدها تلقائيًا من شاشة Preview & Simulation'
      },
      {
        key: 'previewValidationToken',
        label: 'حالة صلاحية المعاينة',
        required: true,
        type: 'text',
        placeholder: 'valid'
      }
    ]
  },
  {
    key: 'readiness-audit',
    order: 9,
    title: 'تدقيق الجاهزية',
    shortTitle: 'التدقيق',
    description: 'تسجيل عناصر التدقيق قبل الإطلاق وإغلاق الملاحظات الحرجة.',
    fields: [
      {
        key: 'auditOwner',
        label: 'مسؤول التدقيق',
        required: true,
        type: 'text',
        placeholder: 'اسم المسؤول أو رقمه الوظيفي'
      },
      {
        key: 'auditChecklistVersion',
        label: 'نسخة قائمة التدقيق',
        required: true,
        type: 'text',
        placeholder: 'مثال: ACC-AUDIT-v1'
      },
      {
        key: 'blockOnCriticalIssues',
        label: 'منع النشر عند وجود مشاكل حرجة',
        required: true,
        type: 'select',
        options: [
          { label: 'نعم - منع كامل', value: 'true' },
          { label: 'لا - تحذير فقط', value: 'false' }
        ]
      },
      {
        key: 'auditNotes',
        label: 'ملاحظات التدقيق',
        required: false,
        type: 'textarea',
        placeholder: 'نتائج المراجعة النهائية'
      },
      {
        key: 'readinessScore',
        label: 'Readiness Score',
        required: false,
        type: 'text',
        placeholder: '100'
      },
      {
        key: 'auditBlockingPayload',
        label: 'قائمة المشاكل المانعة',
        required: false,
        type: 'textarea',
        placeholder: 'يتم توليدها تلقائيًا من شاشة Readiness Audit'
      },
      {
        key: 'auditWarningsPayload',
        label: 'قائمة التحذيرات',
        required: false,
        type: 'textarea',
        placeholder: 'يتم توليدها تلقائيًا من شاشة Readiness Audit'
      },
      {
        key: 'readinessAuditToken',
        label: 'حالة صلاحية التدقيق',
        required: true,
        type: 'text',
        placeholder: 'valid'
      }
    ]
  },
  {
    key: 'notifications-alerts',
    order: 10,
    title: 'الإشعارات والتنبيهات',
    shortTitle: 'الإشعارات',
    description: 'إدارة قواعد الإشعارات اللحظية (SignalR) لكل من الإنشاء والتعديل والتحويل.',
    fields: [
      {
        key: 'notificationsRulesPayload',
        label: 'بيانات قواعد الإشعارات',
        required: false,
        type: 'textarea',
        placeholder: 'يتم توليدها تلقائيًا من شاشة الإشعارات والتنبيهات'
      },
      {
        key: 'notificationsSyncToken',
        label: 'حالة مزامنة الإشعارات',
        required: false,
        type: 'text',
        placeholder: 'synced'
      }
    ]
  },
  {
    key: 'publish-release',
    order: 11,
    title: 'مركز النشر والإطلاق',
    shortTitle: 'النشر',
    description: 'تحديد بيانات الإطلاق الرسمي والانتقال إلى الحالة المنشورة.',
    fields: [
      {
        key: 'releaseTitle',
        label: 'عنوان الإصدار',
        required: true,
        type: 'text',
        placeholder: 'مثال: Release 2026.Q2'
      },
      {
        key: 'releaseChannel',
        label: 'قناة الإطلاق',
        required: true,
        type: 'select',
        options: [
          { label: 'تشغيل تجريبي', value: 'pilot' },
          { label: 'تشغيل كامل', value: 'full' }
        ]
      },
      {
        key: 'publishWindow',
        label: 'نافذة النشر',
        required: false,
        type: 'text',
        placeholder: 'مثال: 2026-04-15 10:00'
      },
      {
        key: 'releaseVersion',
        label: 'رقم النسخة',
        required: false,
        type: 'text',
        placeholder: 'مثال: v1.0.0'
      },
      {
        key: 'releaseNotes',
        label: 'ملاحظات الإصدار',
        required: false,
        type: 'textarea',
        placeholder: 'ملخص تغييرات الإصدار وتعليمات التشغيل'
      },
      {
        key: 'changeSummaryPayload',
        label: 'ملخص التغييرات',
        required: false,
        type: 'textarea',
        placeholder: 'يتم توليده تلقائيًا من شاشة Publish & Release'
      },
      {
        key: 'publishReadinessToken',
        label: 'حالة الجاهزية للنشر',
        required: true,
        type: 'text',
        placeholder: 'valid'
      }
    ]
  }
] as const;

const STEP_KEYS_SET = new Set<string>(ADMIN_CONTROL_CENTER_STEP_ORDER);

export function isControlCenterStepKey(value: string | null | undefined): value is ControlCenterStepKey {
  if (!value) {
    return false;
  }

  return STEP_KEYS_SET.has(value);
}
