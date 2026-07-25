import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { PreguntaDependencia, CreateDependenciaDto } from '../models/dependencia.model';

@Injectable({ providedIn: 'root' })
export class DependenciasService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/preguntas-dependencias`;

  getDependenciasByFormulario(formularioId: string): Observable<PreguntaDependencia[]> {
    return this.http.get<PreguntaDependencia[]>(`${this.apiUrl}/formulario/${formularioId}`);
  }

  createDependencia(dto: CreateDependenciaDto): Observable<PreguntaDependencia> {
    return this.http.post<PreguntaDependencia>(this.apiUrl, dto);
  }

  deleteDependencia(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}