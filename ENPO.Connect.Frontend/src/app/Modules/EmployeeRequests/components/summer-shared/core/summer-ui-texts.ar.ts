export const SUMMER_UI_TEXTS_AR = {
  errors: {
    generic: 'حدث خطأ غير متوقع.',
    requestSelectionRequired: 'يرجى اختيار طلب أولاً.',
    requestSelectionRequiredShort: 'يرجى اختيار طلب.',
    companionNameMinimumThreeParts: 'يجب إدخال اسم المرافق ثلاثي على الأقل.',
    paymentBeforeRequestCreation: 'لا يمكن إدخال تاريخ السداد قبل تاريخ إنشاء الطلب.',
    requestDetailsUnavailable: 'تعذر تحميل بيانات الطلب المختار حالياً.',
    destinationCatalogLoadFailed: 'تعذر تحميل إعدادات المصايف من الخدمة العامة.',
    destinationCatalogInvalid: 'تعذر تحميل إعدادات المصايف من CDMendTbl.',
    unsupportedAdminAction: 'نوع الإجراء الإداري غير مدعوم.',
    invalidAdminActionData: 'يرجى استكمال بيانات الإجراء الإداري.',
    invalidTransferData: 'بيانات التحويل غير مكتملة.',
    invalidWaveCapacityScope: 'يرجى اختيار المصيف والفوج أولاً.',
    attachmentDownloadFailed: 'تعذر تنزيل المرفق حالياً.',
    attachmentDownloadMissingId: 'لا يمكن تنزيل هذا المرفق لعدم توفر معرف صالح.'
  },
  success: {
    adminActionCompleted: 'تم تنفيذ الإجراء الإداري بنجاح',
    cancelCompleted: 'تم تنفيذ الاعتذار بنجاح',
    payCompleted: 'تم تسجيل السداد بنجاح',
    transferCompleted: 'تم تنفيذ التحويل بنجاح'
  },
  loading: {
    adminAction: 'جاري تنفيذ الإجراء الإداري ...',
    attachmentDownload: 'جاري تنزيل المرفق ...'
  },
  labels: {
    summerUpdateTitle: 'تحديث طلبات المصايف',
    adminConsoleTitle: 'إدارة طلبات المصايف',
    capacityTitle: 'تحديث سعات المصايف'
  }
} as const;
