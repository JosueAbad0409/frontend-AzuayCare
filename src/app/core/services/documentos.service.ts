import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { DocumentoRespaldo } from '../models/documento.model';

@Injectable({ providedIn: 'root' })
export class DocumentosService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/documentos-respaldo`;

  /**
   * Sube un documento sin atarlo a ninguna ficha ni respuesta (Documento suelto/libre)
   */
  subirDocumentoLibre(file: File): Observable<DocumentoRespaldo> {
    return this.subir({}, file);
  }

  /**
   * Sube un documento ligado a una pregunta puntual del formulario.
   */
  subirDocumentoDeRespuesta(respuestaId: string, file: File): Observable<DocumentoRespaldo> {
    return this.subir({ respuesta_id: respuestaId }, file);
  }

  /**
   * Sube un documento general atado a la ficha.
   */
  subirDocumentoGeneral(fichaId: string, file: File): Observable<DocumentoRespaldo> {
    return this.subir({ ficha_id: fichaId }, file);
  }

  private subir(ancla: { respuesta_id?: string; ficha_id?: string }, file: File): Observable<DocumentoRespaldo> {
    const formData = new FormData();
    formData.append('file', file);
    if (ancla.respuesta_id) formData.append('respuesta_id', ancla.respuesta_id);
    if (ancla.ficha_id) formData.append('ficha_id', ancla.ficha_id);

    return this.http.post<DocumentoRespaldo>(`${this.apiUrl}/upload`, formData);
  }

  // NUEVO: Obtener todos los documentos sueltos del usuario actual
  getMisDocumentos(): Observable<DocumentoRespaldo[]> {
    return this.http.get<DocumentoRespaldo[]>(`${this.apiUrl}/mis-documentos`);
  }

  getDocumentosByRespuesta(respuestaId: string): Observable<DocumentoRespaldo[]> {
    return this.http.get<DocumentoRespaldo[]>(`${this.apiUrl}/respuesta/${respuestaId}`);
  }

  getDocumentosByFicha(fichaId: string): Observable<DocumentoRespaldo[]> {
    return this.http.get<DocumentoRespaldo[]>(`${this.apiUrl}/ficha/${fichaId}`);
  }

  marcarVerificado(documentoId: string, verificado: boolean, observacion?: string): Observable<DocumentoRespaldo> {
    return this.http.patch<DocumentoRespaldo>(`${this.apiUrl}/${documentoId}/verificar`, { verificado, observacion });
  }

  deleteDocumento(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}