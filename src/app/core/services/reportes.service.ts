import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { DescargaArchivosService } from './descarga-archivos.service';
import { PeriodoMatricula } from '../models/periodo.model';

export interface DashboardResumenBackend {
  totalCarreras: number;
  totalFormularios: number;
  totalFichasEvaluadas: number;
  periodoActivo: PeriodoMatricula | null;
  graficos: {
    nivelesEconomicos: { labels: string[]; data: number[] };
    fichasPorCarrera: { labels: string[]; enviadas: number[]; validadas: number[] };
  };
}

export interface EstadisticasPeriodo {
  total_fichas: number;
  fichas_borrador: number;
  fichas_enviadas: number;
  fichas_validadas: number;
  fichas_rechazadas: number;
  distribucion_rangos: { rango_nombre: string; total: number }[];
}

@Injectable({ 
  providedIn: 'root' 
})
export class ReportesService {
  private readonly http = inject(HttpClient);
  private readonly descargaService = inject(DescargaArchivosService);
  private readonly apiUrl = `${environment.apiUrl}/reportes`;

  /** Endpoint consolidado para el Dashboard principal */
  getDashboardResumen(): Observable<DashboardResumenBackend> {
    return this.http.get<DashboardResumenBackend>(`${this.apiUrl}/dashboard-resumen`);
  }

  /** Obtiene las estadísticas tabuladas por período */
  getEstadisticasGenerales(periodoId: string): Observable<EstadisticasPeriodo> {
    return this.http.get<EstadisticasPeriodo>(`${this.apiUrl}/estadisticas/periodo/${periodoId}`);
  }

  /** Descarga la Matriz Excel Socioeconómica del periodo mediante streaming */
  descargarExcelMatriz(periodoId: string): void {
    this.descargaService.descargar(
      `${this.apiUrl}/dataset-plano/${periodoId}/excel`,
      `Matriz_Socioeconomica_${periodoId}.xlsx`,
      'No se pudo generar el reporte Excel.'
    );
  }
}
