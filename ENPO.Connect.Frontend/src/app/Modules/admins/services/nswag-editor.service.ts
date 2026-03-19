import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

export interface NswagEntry {
  label: string;
  envProperty?: string;
  url?: string;
  urlProduction?: string;
  isproduction?: boolean;
  output?: string;
  regenerate?: boolean;
  [key: string]: any;
}

@Injectable({ providedIn: 'root' })
export class NswagEditorService {
  private base = 'http://localhost:3002';
  constructor(private http: HttpClient) {}

  getConfigs(): Observable<NswagEntry[]> {
    return this.http.get<NswagEntry[]>(`${this.base}/nswag`);
  }

  saveConfigs(configs: NswagEntry[]) {
    return this.http.post(`${this.base}/nswag`, configs);
  }
}
