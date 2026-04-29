import { HTTP_INTERCEPTORS, HttpClient, HttpErrorResponse } from '@angular/common/http';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AppNotificationService } from '../notifications/app-notification.service';
import { ApiResponseFeedbackInterceptor } from './api-response-feedback.interceptor';

describe('ApiResponseFeedbackInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let notifications: jasmine.SpyObj<AppNotificationService>;

  beforeEach(() => {
    notifications = jasmine.createSpyObj<AppNotificationService>('AppNotificationService', [
      'success',
      'error',
      'warning',
      'info',
      'confirm',
      'showApiErrors',
      'extractApiErrorMessage',
      'normalizeMessage'
    ]);

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        { provide: AppNotificationService, useValue: notifications },
        { provide: HTTP_INTERCEPTORS, useClass: ApiResponseFeedbackInterceptor, multi: true }
      ]
    });

    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('shows backend business-failure message when isSuccess is false on HTTP 200', () => {
    let capturedError: unknown = null;

    http.get('/api/test/business-failure').subscribe({
      next: () => fail('Expected business failure to throw'),
      error: error => {
        capturedError = error;
      }
    });

    const request = httpMock.expectOne('/api/test/business-failure');
    request.flush({
      isSuccess: false,
      errors: [
        {
          code: '500',
          message: 'فشل الحفظ من الخادم'
        }
      ],
      data: null
    });

    expect(capturedError).toBeTruthy();
    expect(notifications.error).toHaveBeenCalledWith('فشل الحفظ من الخادم', 'فشل تنفيذ العملية');
  });

  it('shows transport/server error message for non-401 HttpErrorResponse', () => {
    let capturedError: unknown = null;

    http.get('/api/test/http-error').subscribe({
      next: () => fail('Expected http error'),
      error: error => {
        capturedError = error;
      }
    });

    const request = httpMock.expectOne('/api/test/http-error');
    request.flush(
      {
        errors: [{ code: '500', message: 'خطأ داخلي أثناء التنفيذ' }]
      },
      {
        status: 500,
        statusText: 'Server Error'
      }
    );

    expect(capturedError instanceof HttpErrorResponse).toBeTrue();
    expect(notifications.error).toHaveBeenCalledWith('خطأ داخلي أثناء التنفيذ', 'خطأ في الخادم');
  });
});
