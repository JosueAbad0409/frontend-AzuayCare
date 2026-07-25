import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { PerfilCoordinador } from '../models/perfil-coordinador.model';

@Injectable({
  providedIn: 'root'
})
export class PerfilCoordinadorService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/perfil-coordinador`;

  getPerfilByUsuario(usuarioId: string): Observable<PerfilCoordinador> {
    return this.http.get<PerfilCoordinador>(`${this.apiUrl}/usuario/${usuarioId}`);
  }

  saveOrUpdatePerfil(perfil: PerfilCoordinador): Observable<PerfilCoordinador> {
    return this.http.post<PerfilCoordinador>(this.apiUrl, perfil);
  }
}