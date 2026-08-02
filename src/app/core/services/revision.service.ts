import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { FichaRevision, FichasPaginadasResponse, EstadoFicha } from '../models/revision-ficha.model';

@Injectable({ 
  providedIn: 'root' 
})
export class RevisionService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/fichas-respondidas`;

  /** Obtiene listado paginado con filtros de búsqueda y estado */
  getFichasPaginadas(
    skip: number = 0, 
    take: number = 10, 
    search: string = '', 
    estado: string = 'TODOS'
  ): Observable<FichasPaginadasResponse> {
    const params = new HttpParams()
      .set('skip', skip.toString())
      .set('take', take.toString())
      .set('search', search)
      .set('estado', estado);

    return this.http.get<FichasPaginadasResponse>(`${this.apiUrl}/paginadas`, { params });
  }

  /** Obtiene todas las fichas (sin paginar) */
  getTodasLasFichas(): Observable<FichaRevision[]> {
    return this.http.get<FichaRevision[]>(this.apiUrl);
  }

  /** Obtiene el detalle completo de una ficha */
  getFichaDetalle(id: string): Observable<FichaRevision> {
    return this.http.get<FichaRevision>(`${this.apiUrl}/${id}`);
  }

  /** Cambia el estado de la ficha (Aceptado / Rechazado / etc.) */
  actualizarEstadoFicha(id: string, estado: EstadoFicha, comentario?: string): Observable<FichaRevision> {
    return this.http.patch<FichaRevision>(`${this.apiUrl}/${id}/estado`, {
      estado_ficha: estado,
      comentario: comentario || null
    });
  }

  /** Consulta el desglose de respuestas enviadas en el formulario */
  getRespuestasPorFicha(fichaId: string): Observable<any[]> {
    return this.http.get<any[]>(`${environment.apiUrl}/respuestas-formulario/ficha/${fichaId}`);
  }
}