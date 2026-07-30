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
   * Sube un archivo adjunto utilizando multipart/form-data.
   * La clave 'file' coincide con el FileInterceptor('file') en NestJS.
   */
  subirDocumento(respuestaId: string, file: File): Observable<DocumentoRespaldo> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('respuesta_id', respuestaId);

    return this.http.post<DocumentoRespaldo>(`${this.apiUrl}/upload`, formData);
  }

  getDocumentosByFicha(fichaId: string): Observable<DocumentoRespaldo[]> {
    return this.http.get<DocumentoRespaldo[]>(`${this.apiUrl}/ficha/${fichaId}`);
  }

  marcarVerificado(documentoId: string, verificado: boolean): Observable<DocumentoRespaldo> {
    return this.http.patch<DocumentoRespaldo>(`${this.apiUrl}/${documentoId}/verificar`, { verificado });
  }

  deleteDocumento(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}