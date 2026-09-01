// C:\Proyecto AzuayCare\frontend-AzuayCare\src\app\core\services\matrices.service.ts

import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  FilaMatriz,
  ColumnaMatriz,
  CreateFilaDto,
  CreateColumnaDto,
  RespuestaMatrizDto
} from '../models/matriz.model';

@Injectable({ providedIn: 'root' })
export class MatricesService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/matrices-form`;

  // --- FILAS ---
  getFilas(preguntaId: string): Observable<FilaMatriz[]> {
    return this.http.get<FilaMatriz[]>(`${this.apiUrl}/filas/pregunta/${preguntaId}`);
  }

  createFila(dto: CreateFilaDto): Observable<FilaMatriz> {
    return this.http.post<FilaMatriz>(`${this.apiUrl}/fila`, dto);
  }

  // 🔧 AGREGADO: faltaba este método, por eso fallaba la compilación
  // (TS2339: Property 'updateFila' does not exist on type 'MatricesService').
  updateFila(id: string, dto: { es_multiple: boolean }): Observable<FilaMatriz> {
    return this.http.patch<FilaMatriz>(`${this.apiUrl}/fila/${id}`, dto);
  }

  deleteFila(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/fila/${id}`);
  }

  // --- COLUMNAS ---
  getColumnas(preguntaId: string): Observable<ColumnaMatriz[]> {
    return this.http.get<ColumnaMatriz[]>(`${this.apiUrl}/columnas/pregunta/${preguntaId}`);
  }

  createColumna(dto: CreateColumnaDto): Observable<ColumnaMatriz> {
    return this.http.post<ColumnaMatriz>(`${this.apiUrl}/columna`, dto);
  }

  deleteColumna(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/columna/${id}`);
  }

  // --- RESPUESTAS ---
  /**
   * Envía un único objeto o un arreglo de objetos al endpoint de matriz.
   */
  enviarRespuestasMatriz(respuestas: RespuestaMatrizDto | RespuestaMatrizDto[]): Observable<unknown> {
    return this.http.post(`${environment.apiUrl}/respuestas-matriz`, respuestas);
  }
}