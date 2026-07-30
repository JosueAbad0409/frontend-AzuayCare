// C:\Proyecto AzuayCare\frontend-AzuayCare\src\app\core\services\ficha.service.ts

import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { FichaRevision } from '../models/revision-ficha.model';
import { EnviarRespuestaDto, GuardarBloqueRespuestasDto } from '../models/respuesta.model';

@Injectable({
  providedIn: 'root'
})
export class FichaService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/fichas-respondidas`;

  getMisFichas(): Observable<FichaRevision[]> {
    return this.http.get<FichaRevision[]>(`${this.apiUrl}/mis-fichas`);
  }

  crearFicha(data: { periodo_id: string; formulario_id: string }): Observable<FichaRevision> {
    return this.http.post<FichaRevision>(this.apiUrl, data);
  }

  /**
   * Envía las respuestas masivas usando la estructura estricta del DTO requerida por NestJS.
   * Transmite 'es_envio_final' dentro del cuerpo (Body) en formato JSON para alinearse con el backend.
   */
  enviarBloqueRespuestas(respuestas: EnviarRespuestaDto[], esEnvioFinal: boolean = false): Observable<any> {
    const payload: GuardarBloqueRespuestasDto = { respuestas, es_envio_final: esEnvioFinal };
    return this.http.post<any>(`${environment.apiUrl}/respuestas-formulario/enviar-bloque`, payload);
  }
}