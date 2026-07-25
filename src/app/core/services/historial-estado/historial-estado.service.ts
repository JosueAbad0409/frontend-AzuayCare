import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { HistorialEstadoFicha } from '../../models/historial-estado.model';

@Injectable({
  providedIn: 'root'
})
export class HistorialEstadoService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/historial-estado-ficha`;

  getHistorialByFicha(fichaId: string): Observable<HistorialEstadoFicha[]> {
    return this.http.get<HistorialEstadoFicha[]>(`${this.apiUrl}/ficha/${fichaId}`);
  }

  registrarTransicion(payload: {
    ficha_id: string;
    estado_anterior: string;
    estado_nuevo: string;
    comentario?: string;
  }): Observable<HistorialEstadoFicha> {
    return this.http.post<HistorialEstadoFicha>(this.apiUrl, payload);
  }
}