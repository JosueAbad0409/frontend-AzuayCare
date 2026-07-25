import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { PeriodoMatricula, CreatePeriodoDto } from '../../models/periodo.model';

@Injectable({ providedIn: 'root' })
export class PeriodoService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/periodos-matricula`;

  getPeriodos(): Observable<PeriodoMatricula[]> {
    return this.http.get<PeriodoMatricula[]>(this.apiUrl);
  }

  createPeriodo(dto: CreatePeriodoDto): Observable<PeriodoMatricula> {
    return this.http.post<PeriodoMatricula>(this.apiUrl, dto);
  }

  updatePeriodo(id: string, dto: Partial<CreatePeriodoDto>): Observable<PeriodoMatricula> {
    return this.http.patch<PeriodoMatricula>(`${this.apiUrl}/${id}`, dto);
  }

  deletePeriodo(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}