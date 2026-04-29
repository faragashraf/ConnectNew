import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';
import {
  ApiCommonResponse,
  PowerBiStatementDeleteResultDto,
  PowerBiStatementLookupsDto,
  PredefinedSqlStatementDto,
  PredefinedSqlStatementUpsertRequestDto
} from '../models/power-bi-statements.models';

@Injectable({
  providedIn: 'root'
})
export class PowerBiStatementsApiService {
  private readonly baseUrl = `${environment.ConnectApiURL}/api/PowerBi/PredefinedStatements`;

  constructor(private readonly http: HttpClient) { }

  getStatements(): Observable<ApiCommonResponse<PredefinedSqlStatementDto[]>> {
    return this.http.get<ApiCommonResponse<PredefinedSqlStatementDto[]>>(this.baseUrl);
  }

  getStatementById(statementId: number): Observable<ApiCommonResponse<PredefinedSqlStatementDto>> {
    return this.http.get<ApiCommonResponse<PredefinedSqlStatementDto>>(`${this.baseUrl}/${statementId}`);
  }

  getLookups(): Observable<ApiCommonResponse<PowerBiStatementLookupsDto>> {
    return this.http.get<ApiCommonResponse<PowerBiStatementLookupsDto>>(`${this.baseUrl}/Lookups`);
  }

  createStatement(body: PredefinedSqlStatementUpsertRequestDto): Observable<ApiCommonResponse<PredefinedSqlStatementDto>> {
    return this.http.post<ApiCommonResponse<PredefinedSqlStatementDto>>(this.baseUrl, body);
  }

  updateStatement(
    statementId: number,
    body: PredefinedSqlStatementUpsertRequestDto
  ): Observable<ApiCommonResponse<PredefinedSqlStatementDto>> {
    return this.http.put<ApiCommonResponse<PredefinedSqlStatementDto>>(`${this.baseUrl}/${statementId}`, body);
  }

  deleteStatement(statementId: number): Observable<ApiCommonResponse<PowerBiStatementDeleteResultDto>> {
    return this.http.delete<ApiCommonResponse<PowerBiStatementDeleteResultDto>>(`${this.baseUrl}/${statementId}`);
  }
}
