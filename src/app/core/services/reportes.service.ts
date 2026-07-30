import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface EstadisticasPeriodo {
  total_fichas: number;
  fichas_borrador: number;
  fichas_enviadas: number;
  fichas_validadas: number;
  fichas_rechazadas: number;
  distribucion_rangos: {
    rango_nombre: string;
    total: number;
  }[];
}

@Injectable({
  providedIn: 'root'
})
export class ReportesService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/reportes`;

  /**
   * Abre en una pestaña nueva la descarga directa de la Matriz Excel Socioeconómica por periodo.
   */
  descargarExcelMatriz(periodoId: string): void {
    window.open(`${this.apiUrl}/socioeconomico/periodo/${periodoId}`, '_blank');
  }

  /**
   * Obtiene las métricas y resúmenes estadísticos consolidados del periodo.
   */
  getEstadisticasGenerales(periodoId: string): Observable<EstadisticasPeriodo> {
    return this.http.get<EstadisticasPeriodo>(`${this.apiUrl}/estadisticas/periodo/${periodoId}`);
  }
}