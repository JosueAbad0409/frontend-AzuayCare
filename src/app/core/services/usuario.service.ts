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

  // El propio estudiante completa su registro (cédula, carrera y ciclo)
  // la primera vez que ingresa con Google. El backend identifica al usuario
  // por el token JWT, no hace falta enviar el id.
  completarPerfil(dto: CompletarPerfilDto): Observable<Usuario> {
    return this.http.patch<Usuario>(`${this.apiUrl}/perfil/completar`, dto);
  }
}