import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { DescargaArchivosService } from './descarga-archivos.service';
import { PeriodoMatricula } from '../models/periodo.model';
import {
  AgregadoPorPregunta,
  DatasetFiltradoResponse,
  FiltroPreguntaDisponible,
  FiltroReporteRequest
} from '../models/reportes.model';

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

  getFiltrosDisponibles(formularioId: string): Observable<FiltroPreguntaDisponible[]> {
    return this.http.get<FiltroPreguntaDisponible[]>(`${this.apiUrl}/filtros-disponibles/${formularioId}`);
  }

  getDatasetFiltrado(filtros: FiltroReporteRequest): Observable<DatasetFiltradoResponse> {
    return this.http.post<DatasetFiltradoResponse>(`${this.apiUrl}/dataset-filtrado`, filtros);
  }

  getAgregadoPorPregunta(filtros: FiltroReporteRequest): Observable<AgregadoPorPregunta[]> {
    return this.http.post<AgregadoPorPregunta[]>(`${this.apiUrl}/agregado-por-pregunta`, filtros);
  }

  descargarExcelMatriz(periodoId: string): void {
    this.descargaService.descargar(
      `${this.apiUrl}/dataset-plano/${periodoId}/excel`,
      `Matriz_Socioeconomica_${periodoId}.xlsx`,
      'No se pudo generar el reporte Excel.'
    );
  }

  descargarExcelFiltrado(filtros: FiltroReporteRequest): void {
    this.descargaService.descargarPost(
      `${this.apiUrl}/dataset-filtrado/excel`,
      filtros,
      `Matriz_Socioeconomica_Filtrada_${filtros.periodo_id}.xlsx`,
      'No se pudo generar el reporte Excel filtrado.'
    );
  }

  descargarPdfFiltrado(filtros: FiltroReporteRequest): void {
    this.descargaService.descargarPost(
      `${this.apiUrl}/dataset-filtrado/pdf`,
      filtros,
      `Reporte_Consolidado_${filtros.periodo_id}.pdf`,
      'No se pudo generar el reporte PDF filtrado.'
    );
  }
}
