import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CoordinadorCarreraAsignacion, CreateCoordinadorCarreraDto } from '../models/coordinador-carrera.model';

@Injectable({ providedIn: 'root' })
export class CoordinadorCarreraService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/coordinadores-carreras`;

  getAsignaciones(): Observable<CoordinadorCarreraAsignacion[]> {
    return this.http.get<CoordinadorCarreraAsignacion[]>(this.apiUrl);
  }

  asignarCoordinador(dto: CreateCoordinadorCarreraDto): Observable<CoordinadorCarreraAsignacion> {
    return this.http.post<CoordinadorCarreraAsignacion>(this.apiUrl, dto);
  }

  desasignarCoordinador(usuarioId: string, carreraId: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${usuarioId}/${carreraId}`);
  }
}
