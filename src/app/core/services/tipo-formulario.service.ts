import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { TipoFormulario, CreateTipoFormularioDto, UpdateTipoFormularioDto } from '../models/tipo-formulario.model';

@Injectable({ providedIn: 'root' })
export class TipoFormularioService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/tipos-formulario`;

  getTiposFormulario(): Observable<TipoFormulario[]> {
    return this.http.get<TipoFormulario[]>(this.apiUrl);
  }

  getTipoFormularioById(id: string): Observable<TipoFormulario> {
    return this.http.get<TipoFormulario>(`${this.apiUrl}/${id}`);
  }

  createTipoFormulario(dto: CreateTipoFormularioDto): Observable<TipoFormulario> {
    return this.http.post<TipoFormulario>(this.apiUrl, dto);
  }

  updateTipoFormulario(id: string, dto: UpdateTipoFormularioDto): Observable<TipoFormulario> {
    return this.http.patch<TipoFormulario>(`${this.apiUrl}/${id}`, dto);
  }

  deleteTipoFormulario(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}