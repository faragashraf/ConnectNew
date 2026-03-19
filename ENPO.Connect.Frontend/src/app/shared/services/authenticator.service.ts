import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { PairRequestDto, PairResponseDto, ToggleResponse, TotpValidateRequest, TotpValidateResponse } from 'src/app/shared/models/authenticator.models';
import { throwError } from 'rxjs';
import { environment } from 'src/environments/environment';




@Injectable({ providedIn: 'root' })
export class AuthenticatorService {
  public static readonly issuer: string = environment.OTPApplicationName;
  constructor(private http: HttpClient) { }

  pair(dto: PairRequestDto): Observable<PairResponseDto> {
    console.debug('AuthenticatorService.pair() invoked', dto, new Error().stack);
    return this.http.post<PairResponseDto>(environment.DomainAuthURL + '/api/authenticator/pair', dto).pipe(
      catchError(err => {
        return throwError(() => err || new Error('Pairing failed'));
      })
    );
  }


  validate(req: TotpValidateRequest): Observable<TotpValidateResponse> {
    console.debug('AuthenticatorService.validate() invoked', req, new Error().stack);
    return this.http.post<TotpValidateResponse>(environment.DomainAuthURL + `/api/authenticator/validate`, req).pipe(
      catchError(err => {
        return throwError(() => err || new Error('Validation failed'));
      })
    );
  }

  toggle(): Observable<ToggleResponse> {
    return this.http.post<ToggleResponse>(environment.DomainAuthURL + `/api/authenticator/toggle`, {}).pipe(
      catchError(err => {
        return throwError(() => err || new Error('Toggle failed'));
      })
    );
  }
}
