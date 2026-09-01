import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Usuario, CreateUsuarioDto, CompletarPerfilDto } from '../models/usuario.model';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class UsuarioService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/usuarios`;

  getUsuarios(skip = 0, take = 1000): Observable<Usuario[]> {
    const params = new HttpParams()
      .set('skip', skip.toString())
      .set('take', take.toString());

    return this.http.get<Usuario[]>(this.apiUrl, { params });
  }

  getUsuarioById(id: string): Observable<Usuario> {
    return this.http.get<Usuario>(`${this.apiUrl}/${id}`);
  }

  createUsuario(dto: CreateUsuarioDto): Observable<Usuario> {
    return this.http.post<Usuario>(this.apiUrl, dto);
  }

  updateUsuario(id: string, dto: Partial<CreateUsuarioDto> | any): Observable<Usuario> {
    return this.http.patch<Usuario>(`${this.apiUrl}/${id}`, dto);
  }

  update(id: string, dto: Partial<CreateUsuarioDto> | any): Observable<Usuario> {
    return this.updateUsuario(id, dto);
  }

  deleteUsuario(id: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.apiUrl}/${id}`);
  }

  delete(id: string): Observable<{ message: string }> {
    return this.deleteUsuario(id);
  }

  getEstadoPerfil(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/perfil/estado`);
  }

  completarPerfil(payload: CompletarPerfilDto | any): Observable<any> {
    return this.http.patch<any>(`${this.apiUrl}/perfil/completar`, payload);
  }

  // ✅ Firma completa para llamadas administrativas desde usuarios.component.ts
  completarPerfilEstudiante(usuarioId: string, rol: string, dto: CompletarPerfilDto | any): Observable<any> {
    const params = new HttpParams().set('rol', rol);
    return this.http.post<any>(`${this.apiUrl}/${usuarioId}/completar-perfil`, dto, { params });
  }

  subirFoto(file: Blob | File): Observable<Usuario> {
    const formData = new FormData();
    formData.append('foto', file);
    return this.http.patch<Usuario>(`${this.apiUrl}/foto`, formData);
  }

  actualizarFoto(file: Blob | File): Observable<Usuario> {
    return this.subirFoto(file);
  }
}