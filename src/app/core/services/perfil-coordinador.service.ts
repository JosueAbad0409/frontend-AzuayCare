import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, catchError, of, switchMap, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { PerfilCoordinador } from '../models/perfil-coordinador.model';
import { AyudaEstudianteResponse } from '../models/ayuda-estudiante.model';

@Injectable({
  providedIn: 'root'
})
export class PerfilCoordinadorService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/perfil-coordinador`;

  getPerfilByUsuario(usuarioId: string): Observable<PerfilCoordinador | null> {
    return this.http.get<PerfilCoordinador>(`${this.apiUrl}/usuario/${usuarioId}`).pipe(
      catchError((error: HttpErrorResponse) => {
        if (error.status === 404) {
          return of(null);
        }
        return throwError(() => error);
      })
    );
  }

  createPerfil(perfil: PerfilCoordinador): Observable<PerfilCoordinador> {
    return this.http.post<PerfilCoordinador>(this.apiUrl, perfil);
  }

  updatePerfil(usuarioId: string, perfil: Partial<PerfilCoordinador>): Observable<PerfilCoordinador> {
    return this.http.patch<PerfilCoordinador>(`${this.apiUrl}/usuario/${usuarioId}`, perfil);
  }

  saveOrUpdatePerfil(perfil: any): Observable<PerfilCoordinador> {
    const usuarioId = perfil.usuario_id || perfil.usuarioId;

    return this.getPerfilByUsuario(usuarioId).pipe(
      switchMap((perfilExistente) => {
        if (perfilExistente) {
          return this.updatePerfil(usuarioId, perfil);
        } else {
          return this.createPerfil(perfil);
        }
      })
    );
  }

  obtenerAyudaEstudiante(): Observable<AyudaEstudianteResponse> {
    return this.http.get<AyudaEstudianteResponse>(`${this.apiUrl}/ayuda-estudiante`);
  }
}