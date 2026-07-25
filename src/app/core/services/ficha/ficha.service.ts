import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { FichaRevision } from '../../models/revision-ficha.model';
import { EnviarRespuestaDto, GuardarBloqueRespuestasDto } from '../../models/respuesta.model';

@Injectable({
  providedIn: 'root'
})
export class FichaService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/fichas`;
  private readonly respuestasUrl = `${environment.apiUrl}/respuestas`;

  getMisFichas(): Observable<FichaRevision[]> {
    return this.http.get<FichaRevision[]>(`${this.apiUrl}/mis-fichas`);
  }

  crearFicha(data: { periodo_id: string; formulario_id: string }): Observable<FichaRevision> {
    return this.http.post<FichaRevision>(this.apiUrl, data);
  }

  /**
   * Envía las respuestas masivas usando la estructura estricta del DTO requerida por NestJS.
   */
  enviarBloqueRespuestas(respuestas: EnviarRespuestaDto[]): Observable<any> {
    const payload: GuardarBloqueRespuestasDto = { respuestas };
    return this.http.post<any>(`${this.respuestasUrl}/bulk`, payload);
  }
}