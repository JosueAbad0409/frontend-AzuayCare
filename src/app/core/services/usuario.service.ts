import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Usuario, CreateUsuarioDto, CompletarPerfilDto } from '../models/usuario.model';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class UsuarioService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/usuarios`;

  getUsuarios(): Observable<Usuario[]> {
    return this.http.get<Usuario[]>(this.apiUrl);
  }

  getUsuarioById(id: string): Observable<Usuario> {
    return this.http.get<Usuario>(`${this.apiUrl}/${id}`);
  }

  createUsuario(dto: CreateUsuarioDto): Observable<Usuario> {
    return this.http.post<Usuario>(this.apiUrl, dto);
  }

  updateUsuario(id: string, dto: Partial<CreateUsuarioDto>): Observable<Usuario> {
    return this.http.patch<Usuario>(`${this.apiUrl}/${id}`, dto);
  }

  deleteUsuario(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

    getEstadoPerfil() {
    return this.http.get<any>(`${this.apiUrl}/perfil/estado`);
  }

  completarPerfil(payload: any) {
    return this.http.patch(`${this.apiUrl}/perfil/completar`, payload);
  }

  update(id: string, data: any) {
    return this.http.patch(`${environment.apiUrl}/usuarios/${id}`, data);
  }

  delete(id: string) {
    return this.http.delete(`${environment.apiUrl}/usuarios/${id}`);
  }
  
  subirFoto(file: File): Observable<Usuario> {
    const formData = new FormData();
    formData.append('foto', file);
    return this.http.patch<Usuario>(`${this.apiUrl}/foto`, formData);
  }
  
  actualizarFoto(foto: File) {
    const formData = new FormData();
    formData.append('foto', foto); // 'foto' es el nombre que espera el backend
    return this.http.patch(`${this.apiUrl}/foto`, formData);
  }
}