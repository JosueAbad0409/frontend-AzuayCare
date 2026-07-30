import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { FichaRevision } from '../models/revision-ficha.model';

@Injectable({ providedIn: 'root' })
export class RevisionService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/fichas-respondidas`;

  getTodasLasFichas(): Observable<FichaRevision[]> {
    return this.http.get<FichaRevision[]>(this.apiUrl);
  }

  getFichaDetalle(id: string): Observable<FichaRevision> {
    return this.http.get<FichaRevision>(`${this.apiUrl}/${id}`);
  }

  actualizarEstadoFicha(id: string, estado: string, comentario?: string): Observable<FichaRevision> {
    return this.http.patch<FichaRevision>(`${this.apiUrl}/${id}`, {
      estado_ficha: estado,
      comentario: comentario || null
    });
  }

  getRespuestasPorFicha(fichaId: string): Observable<any[]> {
    return this.http.get<any[]>(`${environment.apiUrl}/respuestas-formulario/ficha/${fichaId}`);
  }
}
