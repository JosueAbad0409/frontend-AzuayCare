import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { FichasPaginadasResponse } from '../models/revision-ficha.model';

// 🔥 1. NUEVA INTERFAZ PARA EL DETALLE DINÁMICO
export interface VulnerabilidadDetalle {
  respuesta: string;
  evidencia: boolean;
  riesgo: number;
}

// 🔥 2. INTERFAZ ACTUALIZADA (Sin campos quemados)
export interface ReporteNeeSalud {
  ficha_id: string;
  estudiante: string;
  cedula: string;
  carrera: string;
  ciclo: string;
  riesgo_total: number;
  detalles_vulnerabilidad: Record<string, VulnerabilidadDetalle>;
}

@Injectable({ providedIn: 'root' })
export class PrioridadAtencionService {
    private readonly http = inject(HttpClient);
    private readonly apiUrl = `${environment.apiUrl}`;

    getFichasPorPrioridad(
        skip: number = 0,
        take: number = 50,
        nivel: string = 'TODOS'
    ): Observable<FichasPaginadasResponse> {
        const params = new HttpParams()
            .set('skip', skip.toString())
            .set('take', take.toString())
            .set('nivel', nivel);
        return this.http.get<FichasPaginadasResponse>(`${this.apiUrl}/fichas-respondidas/prioridad-atencion`, { params });
    }

    getReporteNee(periodoId: string): Observable<ReporteNeeSalud[]> {
        return this.http.get<ReporteNeeSalud[]>(`${this.apiUrl}/reportes/nee/periodo/${periodoId}`);
    }
}