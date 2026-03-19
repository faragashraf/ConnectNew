import { mergeMap as _observableMergeMap, catchError as _observableCatch } from 'rxjs/operators';
import { Observable, throwError as _observableThrow, of as _observableOf } from 'rxjs';
import { Injectable, Inject, Optional } from '@angular/core';
import { HttpClient, HttpHeaders, HttpResponse, HttpResponseBase } from '@angular/common/http';
import { API_BASE_URL, StringCommonResponse } from './Domain_Auth.service';
import { blobToText, throwException } from 'src/app/shared/services/BackendServices/dto-shared';
import { environment } from 'src/environments/environment';

@Injectable({ providedIn: 'root' })
export class DomainCryptoController {
  private http: HttpClient;
  private baseUrl: string;
  protected jsonParseReviver: ((key: string, value: any) => any) | undefined = undefined;

  constructor(@Inject(HttpClient) http: HttpClient, @Optional() @Inject(API_BASE_URL) baseUrl?: string) {
    this.http = http;
    this.baseUrl = baseUrl !== undefined && baseUrl !== null ? baseUrl : environment.DomainAuthURL;
  }

  encrypt(userId: string): Observable<string> {
    let url_ = this.baseUrl + '/api/DomainAuthorization/Encrypt?userid=' + encodeURIComponent(userId);
    url_ = url_.replace(/[?&]$/, '');

    const options_: any = {
      observe: 'response',
      responseType: 'blob',
      headers: new HttpHeaders({
        'Accept': 'text/plain'
      })
    };

    return this.http.request('get', url_, options_).pipe(_observableMergeMap((response_: any) => {
      return this.processEncrypt(response_);
    })).pipe(_observableCatch((response_: any) => {
      if (response_ instanceof HttpResponseBase) {
        try {
          return this.processEncrypt(response_ as any);
        } catch (e) {
          return _observableThrow(e) as any as Observable<string>;
        }
      } else {
        return _observableThrow(response_) as any as Observable<string>;
      }
    }));
  }

  protected processEncrypt(response: HttpResponseBase): Observable<string> {
    const status = response.status;
    const responseBlob =
      response instanceof HttpResponse ? response.body :
      (response as any).error instanceof Blob ? (response as any).error : undefined;

    let _headers: any = {}; if (response.headers) { for (let key of response.headers.keys()) { _headers[key] = response.headers.get(key); } }
    if (status === 200) {
      return blobToText(responseBlob).pipe(_observableMergeMap((_responseText: string) => {
        let result200: any = null;
        try {
          result200 = _responseText === '' ? null : JSON.parse(_responseText, this.jsonParseReviver) as StringCommonResponse;
        } catch (error) {
           result200 = { isSuccess: true, data: _responseText, errors: [] } as any;
        }
        const encryptedValue = result200?.data ?? _responseText ?? '';
        return _observableOf(String(encryptedValue));
      }));
    } else if (status !== 200 && status !== 204) {
      return blobToText(responseBlob).pipe(_observableMergeMap((_responseText: string) => {
        return throwException('An unexpected server error occurred.', status, _responseText, _headers);
      }));
    }
    return _observableOf('');
  }

  decryptUserPassword(userId: string): Observable<string> {
    let url_ = this.baseUrl + '/api/DomainAuthorization/Decrypt?userid=' + encodeURIComponent(userId);
    url_ = url_.replace(/[?&]$/, '');

    const options_: any = {
      observe: 'response',
      responseType: 'blob',
      headers: new HttpHeaders({
        'Accept': 'text/plain'
      })
    };

    return this.http.request('get', url_, options_).pipe(_observableMergeMap((response_: any) => {
      return this.processDecryptUserPassword(response_);
    })).pipe(_observableCatch((response_: any) => {
      if (response_ instanceof HttpResponseBase) {
        try {
          return this.processDecryptUserPassword(response_ as any);
        } catch (e) {
          return _observableThrow(e) as any as Observable<string>;
        }
      } else {
        return _observableThrow(response_) as any as Observable<string>;
      }
    }));
  }

  protected processDecryptUserPassword(response: HttpResponseBase): Observable<string> {
    const status = response.status;
    const responseBlob =
      response instanceof HttpResponse ? response.body :
      (response as any).error instanceof Blob ? (response as any).error : undefined;

    let _headers: any = {}; if (response.headers) { for (let key of response.headers.keys()) { _headers[key] = response.headers.get(key); } }
    if (status === 200) {
      return blobToText(responseBlob).pipe(_observableMergeMap((_responseText: string) => {
        let result200: any = null;
        try {
          result200 = _responseText === '' ? null : JSON.parse(_responseText, this.jsonParseReviver) as StringCommonResponse;
        } catch (error) {
           result200 = { isSuccess: true, data: _responseText, errors: [] } as any;
        }
        const decryptedValue = result200?.data ?? _responseText ?? '';
        return _observableOf(String(decryptedValue));
      }));
    } else if (status !== 200 && status !== 204) {
      return blobToText(responseBlob).pipe(_observableMergeMap((_responseText: string) => {
        return throwException('An unexpected server error occurred.', status, _responseText, _headers);
      }));
    }
    return _observableOf('');
  }
}
