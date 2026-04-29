import { Injectable } from '@angular/core';
import { MsgsService } from '../helper/msgs.service';

type ApiErrorLike = {
  message?: string;
  code?: string;
};

@Injectable({
  providedIn: 'root'
})
export class AppNotificationService {
  constructor(private readonly msgsService: MsgsService) {}

  success(message: string, milliseconds: number = 3500): void {
    this.msgsService.msgSuccess(this.normalizeMessage(message), milliseconds, true);
  }

  error(message: string, title: string = 'خطأ'): void {
    this.msgsService.msgError(title, this.normalizeMessage(message));
  }

  warning(message: string, title: string = 'تنبيه'): void {
    this.msgsService.msgInfo(this.normalizeMessage(message), title, 'warn');
  }

  info(message: string, title: string = 'معلومة'): void {
    this.msgsService.msgInfo(this.normalizeMessage(message), title, 'info');
  }

  confirm(message: string, confirmButtonText: string = 'تأكيد'): Promise<boolean> {
    return this.msgsService.msgConfirm(this.normalizeMessage(message), confirmButtonText);
  }

  showApiErrors(errors: ApiErrorLike[] | null | undefined, fallbackMessage: string): void {
    const message = this.extractApiErrorMessage(errors, fallbackMessage);
    this.error(message);
  }

  extractApiErrorMessage(errors: ApiErrorLike[] | null | undefined, fallbackMessage: string): string {
    const messages = (errors ?? [])
      .map(error => this.normalizeMessage(error?.message ?? ''))
      .filter(message => message.length > 0);

    if (messages.length === 0) {
      return this.normalizeMessage(fallbackMessage);
    }

    return messages.join('، ');
  }

  normalizeMessage(message: string): string {
    const trimmed = String(message ?? '').trim();
    if (!trimmed) {
      return 'تعذر إتمام العملية، يرجى المحاولة مرة أخرى.';
    }

    if (this.containsArabic(trimmed)) {
      return trimmed;
    }

    const exactMap: Record<string, string> = {
      'Unauthorized user.': 'المستخدم غير مصرح له. يرجى تسجيل الدخول مرة أخرى.',
      'Category is required.': 'يرجى اختيار نوع الموضوع/الطلب.',
      'Category not found.': 'نوع الموضوع/الطلب غير موجود.',
      'Category is inactive.': 'نوع الموضوع/الطلب غير مفعّل حالياً.',
      'Not allowed.': 'غير مسموح لك بتنفيذ هذا الإجراء.',
      'User cannot create requests for this category.': 'ليس لديك صلاحية إنشاء طلبات لهذا النوع.',
      'Subject not found.': 'الموضوع/الطلب غير موجود.',
      'Envelope not found.': 'الظرف الوارد غير موجود.',
      'Envelope reference is required.': 'رقم مرجع الظرف مطلوب.',
      'Incoming date is required.': 'تاريخ الورود مطلوب.'
    };

    if (exactMap[trimmed]) {
      return exactMap[trimmed];
    }

    const lower = trimmed.toLowerCase();
    if (lower.includes('required')) {
      return 'هناك حقول مطلوبة لم يتم استكمالها.';
    }
    if (lower.includes('not found')) {
      return 'العنصر المطلوب غير موجود.';
    }
    if (lower.includes('unauthorized')) {
      return 'المستخدم غير مصرح له. يرجى تسجيل الدخول مرة أخرى.';
    }
    if (lower.includes('not allowed') || lower.includes('forbidden')) {
      return 'ليس لديك الصلاحية الكافية لتنفيذ هذا الإجراء.';
    }
    if (lower.includes('invalid')) {
      return 'البيانات المدخلة غير صحيحة، يرجى المراجعة.';
    }
    if (lower.includes('timeout')) {
      return 'انتهت مهلة الاتصال بالخادم، يرجى إعادة المحاولة.';
    }

    return trimmed;
  }

  private containsArabic(text: string): boolean {
    return /[\u0600-\u06FF]/.test(text);
  }
}
