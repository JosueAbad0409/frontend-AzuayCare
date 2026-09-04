import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Ciclo, CreateCicloDto, UpdateCicloDto } from '../models/ciclo.model';

@Injectable({
  providedIn: 'root'
})
export class CiclosService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/ciclos`;

  getCiclos(): Observable<Ciclo[]> {
    return this.http.get<Ciclo[]>(this.apiUrl);
  }

  getCicloById(id: string): Observable<Ciclo> {
    return this.http.get<Ciclo>(`${this.apiUrl}/${id}`);
  }

  getCiclosByCarrera(carreraId: string): Observable<Ciclo[]> {
    return this.http.get<Ciclo[]>(`${this.apiUrl}/carrera/${carreraId}`);
  }

  createCiclo(dto: CreateCicloDto): Observable<Ciclo> {
    return this.http.post<Ciclo>(this.apiUrl, dto);
  }

  updateCiclo(id: string, dto: UpdateCicloDto): Observable<Ciclo> {
    return this.http.patch<Ciclo>(`${this.apiUrl}/${id}`, dto);
  }

  reactivarCiclo(id: string): Observable<{ message: string }> {
    return this.http.patch<{ message: string }>(`${this.apiUrl}/${id}/reactivar`, {});
  }

  deleteCiclo(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}