import { InjectionToken } from '@angular/core';
import { Observable, throwError as _observableThrow } from 'rxjs';




// Minimal, stable shared helpers for generated DTOs/services.
export const API_BASE_URL = new InjectionToken<string>('API_BASE_URL');

export class ApiException extends Error {
  override message: string;
  status: number;
  response: string;
  headers: { [key: string]: any; };
  result: any;

  constructor(message: string, status: number, response: string, headers: { [key: string]: any; }, result: any) {
    super();
    this.message = message;
    this.status = status;
    this.response = response;
    this.headers = headers;
    this.result = result;
  }

  protected isApiException = true;

  static isApiException(obj: any): obj is ApiException {
    return obj && obj.isApiException === true;
  }
}

export function makeApiError(message: string, status: number, response: string, headers: { [key: string]: any; }, result?: any): Error {
  const e: any = new Error(message);
  e.status = status;
  e.response = response;
  e.headers = headers;
  e.result = result;
  return e;
}

export function throwException(message: string, status: number, response: string, headers: { [key: string]: any; }, result?: any): Observable<any> {
  if (result !== null && result !== undefined) return _observableThrow(result);
  return _observableThrow(new ApiException(message, status, response, headers, null));
}

export function blobToText(blob: any): Observable<string> {
  return new Observable<string>((observer: any) => {
    if (!blob) {
      observer.next("");
      observer.complete();
    } else {
      const reader = new FileReader();
      reader.onload = (ev: any) => { observer.next(ev.target.result); observer.complete(); };
      reader.readAsText(blob);
    }
  });
}
export interface FileParameter {
    data: File;
    fileName: string;
    fileID?: number,
    originalSize?:number
}

export interface ErrorDto {
    code: string | undefined;
    message: string | undefined;
}


export interface StringCommonResponse {
    readonly isSuccess: boolean;
    errors: ErrorDto[] | undefined;
    data: string | undefined;
    totalCount: number;
    pageNumber: number;
    pageSize: number;
    readonly totalPages: number;
}
