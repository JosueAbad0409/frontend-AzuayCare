import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, of, switchMap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { PerfilCoordinador } from '../models/perfil-coordinador.model';

@Injectable({
  providedIn: 'root'
})
export class PerfilCoordinadorService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/perfil-coordinador`;

  getPerfilByUsuario(usuarioId: string): Observable<PerfilCoordinador | null> {
    return this.http.get<PerfilCoordinador>(`${this.apiUrl}/usuario/${usuarioId}`).pipe(
      catchError(() => of(null))
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
}