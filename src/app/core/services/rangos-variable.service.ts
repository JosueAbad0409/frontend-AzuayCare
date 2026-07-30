import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { RangoVariableCalculada, CreateRangoVariableDto } from '../models/rango-variable.model';

@Injectable({
  providedIn: 'root'
})
export class RangosVariableService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/rangos-variable-calculada`;

  getByFormulario(formularioId: string): Observable<RangoVariableCalculada[]> {
    return this.http.get<RangoVariableCalculada[]>(`${this.apiUrl}/formulario/${formularioId}`);
  }

  createRango(dto: CreateRangoVariableDto): Observable<RangoVariableCalculada> {
    return this.http.post<RangoVariableCalculada>(this.apiUrl, dto);
  }

  deleteRango(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}