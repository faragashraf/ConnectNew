import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ChartConfig } from '../../GenericComponents/models/chart-config';
import { environment } from 'src/environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ChartConfigAdminService {
  // Updated base URL to match the backend controller [Route("api/charts")]
  private baseUrl =  environment.PowerBi +'/api/charts';

  constructor(private http: HttpClient) { }

  getChartsByModule(moduleName: string): Observable<any> {
    // Matches [HttpGet] GetCharts([FromQuery] string moduleName)
    return this.http.get<any>(`${this.baseUrl}?moduleName=${moduleName}`);
  }

  createChart(config: ChartConfig): Observable<any> {
    // Matches [HttpPost] CreateChart([FromBody] ChartConfig chart)
    return this.http.post<any>(`${this.baseUrl}`, config);
  }

  updateChart(key: string, config: ChartConfig): Observable<any> {
    // Matches [HttpPut("{key}")] UpdateChart(...)
    return this.http.put<any>(`${this.baseUrl}/${key}`, config);
  }

  deleteChart(key: string): Observable<any> {
    // Matches [HttpDelete("{key}")] DeleteChart(...)
    return this.http.delete<any>(`${this.baseUrl}/${key}`);
  }
}
