import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { LogAuditoria } from '../models/auditoria.model';

@Injectable({
  providedIn: 'root'
})
export class AuditoriaService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/auditoria`;

  getLogs(): Observable<LogAuditoria[]> {
    return this.http.get<LogAuditoria[]>(this.apiUrl);
  }

  getLogById(id: number): Observable<LogAuditoria> {
    return this.http.get<LogAuditoria>(`${this.apiUrl}/${id}`);
  }
}