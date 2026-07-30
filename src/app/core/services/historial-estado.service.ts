import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { HistorialEstadoFicha } from '../models/historial-estado.model';

@Injectable({
  providedIn: 'root'
})
export class HistorialEstadoService {
  private readonly http = inject(HttpClient);
  // CORREGIDO: Ruta en plural acorde al controlador de NestJS
  private readonly apiUrl = `${environment.apiUrl}/historial-estados-ficha`;

  /**
   * Obtiene la trazabilidad y observaciones de cambios de estado de una ficha.
   */
  getHistorialByFicha(fichaId: string): Observable<HistorialEstadoFicha[]> {
    return this.http.get<HistorialEstadoFicha[]>(`${this.apiUrl}/ficha/${fichaId}`);
  }

  /**
   * Registrar transiciones o comentarios de devolución/aprobación.
   */
  registrarTransicion(payload: {
    ficha_id: string;
    estado_anterior: string;
    estado_nuevo: string;
    comentario?: string;
  }): Observable<HistorialEstadoFicha> {
    return this.http.post<HistorialEstadoFicha>(this.apiUrl, payload);
  }
}