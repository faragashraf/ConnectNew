import {
  HttpErrorResponse,
  HttpEvent,
  HttpHandler,
  HttpInterceptor,
  HttpRequest,
  HttpResponse
} from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { catchError, mergeMap } from 'rxjs/operators';
import { AppNotificationService } from '../notifications/app-notification.service';

type ApiErrorLike = {
  message?: string;
  code?: string;
};

type ApiCommonResponseLike = {
  isSuccess?: boolean;
  errors?: ApiErrorLike[] | string[];
  message?: string;
};

class ApiBusinessFailureError extends Error {
  constructor(message: string, public readonly body: unknown, public readonly requestUrl: string) {
    super(message);
    this.name = 'ApiBusinessFailureError';
  }
}

@Injectable({
  providedIn: 'root'
})
export class ApiResponseFeedbackInterceptor implements HttpInterceptor {
  constructor(private readonly notifications: AppNotificationService) {}

  intercept(request: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    if (this.shouldSkipRequest(request.url)) {
      return next.handle(request);
    }

    return next.handle(request).pipe(
      mergeMap((event: HttpEvent<unknown>) => {
        if (!(event instanceof HttpResponse)) {
          return of(event);
        }

        const response = this.readCommonResponse(event.body);
        if (!response || response.isSuccess !== false) {
          return of(event);
        }

        const backendMessage = this.extractBusinessFailureMessage(response);
        this.notifications.error(backendMessage, 'فشل تنفيذ العملية');
        return throwError(() => new ApiBusinessFailureError(backendMessage, event.body, request.url));
      }),
      catchError((error: unknown) => {
        if (error instanceof ApiBusinessFailureError) {
          return throwError(() => error);
        }

        if (error instanceof HttpErrorResponse) {
          if (error.status !== 401) {
            const backendMessage = this.extractHttpErrorMessage(error);
            this.notifications.error(backendMessage, this.resolveHttpErrorTitle(error.status));
          }
          return throwError(() => error);
        }

        this.notifications.error('تعذر إتمام العملية، يرجى المحاولة مرة أخرى.', 'خطأ');
        return throwError(() => error);
      })
    );
  }

  private shouldSkipRequest(url: string): boolean {
    const normalized = String(url ?? '').toLowerCase();
    if (normalized.length === 0) {
      return true;
    }

    if (normalized.includes('/assets/') || normalized.includes('assets/')) {
      return true;
    }

    return false;
  }

  private readCommonResponse(body: unknown): ApiCommonResponseLike | null {
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return null;
    }

    const candidate = body as Record<string, unknown>;
    if (!Object.prototype.hasOwnProperty.call(candidate, 'isSuccess')) {
      return null;
    }

    return candidate as ApiCommonResponseLike;
  }

  private extractBusinessFailureMessage(response: ApiCommonResponseLike): string {
    const messages = this.readErrorMessages(response.errors);
    if (messages.length > 0) {
      return messages[0];
    }

    const directMessage = this.normalizeText(response.message);
    if (directMessage) {
      return directMessage;
    }

    return 'تعذر إتمام العملية، يرجى المحاولة مرة أخرى.';
  }

  private extractHttpErrorMessage(error: HttpErrorResponse): string {
    const payload = error.error;
    if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
      const commonLike = payload as ApiCommonResponseLike & { title?: string; detail?: string };
      const messages = this.readErrorMessages(commonLike.errors);
      if (messages.length > 0) {
        return messages[0];
      }

      const directMessage = this.normalizeText(commonLike.message)
        ?? this.normalizeText(commonLike.detail)
        ?? this.normalizeText(commonLike.title);
      if (directMessage) {
        return directMessage;
      }
    }

    if (typeof payload === 'string') {
      const fromString = this.normalizeText(payload);
      if (fromString) {
        return fromString;
      }
    }

    const fallbackFromError = this.normalizeText(error.message);
    if (fallbackFromError) {
      return fallbackFromError;
    }

    return 'تعذر إتمام العملية، يرجى المحاولة مرة أخرى.';
  }

  private readErrorMessages(errors: ApiCommonResponseLike['errors']): string[] {
    if (!Array.isArray(errors) || errors.length === 0) {
      return [];
    }

    const messages: string[] = [];
    for (const entry of errors) {
      if (typeof entry === 'string') {
        const normalized = this.normalizeText(entry);
        if (normalized) {
          messages.push(normalized);
        }
        continue;
      }

      if (entry && typeof entry === 'object') {
        const normalized = this.normalizeText((entry as ApiErrorLike).message);
        if (normalized) {
          messages.push(normalized);
        }
      }
    }

    return messages;
  }

  private resolveHttpErrorTitle(status: number): string {
    if (status >= 500) {
      return 'خطأ في الخادم';
    }

    if (status >= 400) {
      return 'تعذر تنفيذ الطلب';
    }

    return 'خطأ';
  }

  private normalizeText(value: unknown): string | null {
    const normalized = String(value ?? '').trim();
    return normalized.length > 0 ? normalized : null;
  }
}
