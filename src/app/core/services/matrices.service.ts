import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { FilaMatriz, ColumnaMatriz, RespuestaMatrizDto } from '../models/matriz.model';

@Injectable({ providedIn: 'root' })
export class MatricesService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/matrices-form`;

  getFilas(preguntaId: string): Observable<FilaMatriz[]> {
    return this.http.get<FilaMatriz[]>(`${this.apiUrl}/filas/pregunta/${preguntaId}`);
  }

  getColumnas(preguntaId: string): Observable<ColumnaMatriz[]> {
    return this.http.get<ColumnaMatriz[]>(`${this.apiUrl}/columnas/pregunta/${preguntaId}`);
  }

  createFila(dto: { pregunta_id: string; texto_fila: string }): Observable<FilaMatriz> {
    return this.http.post<FilaMatriz>(`${this.apiUrl}/fila`, dto);
  }

  createColumna(dto: { pregunta_id: string; texto_columna: string }): Observable<ColumnaMatriz> {
    return this.http.post<ColumnaMatriz>(`${this.apiUrl}/columna`, dto);
  }

  enviarRespuestasMatriz(respuestas: RespuestaMatrizDto[]): Observable<any> {
    return this.http.post(`${environment.apiUrl}/respuestas-matriz`, respuestas);
  }
}