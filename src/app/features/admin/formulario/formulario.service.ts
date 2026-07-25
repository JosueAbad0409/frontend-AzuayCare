import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { 
  Formulario, CreateFormularioDto, 
  Seccion, CreateSeccionDto, 
  Pregunta, CreatePreguntaDto, 
  TipoCampoForm, OpcionPregunta 
} from '../../../core/models/formulario.model';

@Injectable({ providedIn: 'root' })
export class FormularioService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  // --- FORMULARIOS ---
  getFormularios(): Observable<Formulario[]> {
    return this.http.get<Formulario[]>(`${this.apiUrl}/formularios`);
  }

  getFormularioById(id: string): Observable<Formulario> {
    return this.http.get<Formulario>(`${this.apiUrl}/formularios/${id}`);
  }

  createFormulario(dto: CreateFormularioDto): Observable<Formulario> {
    return this.http.post<Formulario>(`${this.apiUrl}/formularios`, dto);
  }

  publicarFormulario(id: string): Observable<Formulario> {
    return this.http.post<Formulario>(`${this.apiUrl}/formularios/${id}/publicar`, {});
  }

  deleteFormulario(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/formularios/${id}`);
  }

  // --- SECCIONES ---
  getSeccionesByFormulario(formularioId: string): Observable<Seccion[]> {
    return this.http.get<Seccion[]>(`${this.apiUrl}/secciones/formulario/${formularioId}`);
  }

  createSeccion(dto: CreateSeccionDto): Observable<Seccion> {
    return this.http.post<Seccion>(`${this.apiUrl}/secciones`, dto);
  }

  deleteSeccion(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/secciones/${id}`);
  }

  // --- TIPOS DE CAMPO ---
  getTiposCampo(): Observable<TipoCampoForm[]> {
    return this.http.get<TipoCampoForm[]>(`${this.apiUrl}/tipos-campo-form`);
  }

  // --- PREGUNTAS ---
  getPreguntasBySeccion(seccionId: string): Observable<Pregunta[]> {
    return this.http.get<Pregunta[]>(`${this.apiUrl}/preguntas/seccion/${seccionId}`);
  }

  createPregunta(dto: CreatePreguntaDto): Observable<Pregunta> {
    return this.http.post<Pregunta>(`${this.apiUrl}/preguntas`, dto);
  }

  updatePregunta(id: string, dto: Partial<CreatePreguntaDto>): Observable<Pregunta> {
    return this.http.patch<Pregunta>(`${this.apiUrl}/preguntas/${id}`, dto);
  }

  deletePregunta(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/preguntas/${id}`);
  }

  // --- OPCIONES DE PREGUNTA ---
  createOpcion(dto: { pregunta_id: string; texto_opcion: string; orden?: number }): Observable<OpcionPregunta> {
    return this.http.post<OpcionPregunta>(`${this.apiUrl}/opciones-pregunta`, dto);
  }

  getOpcionesByPregunta(preguntaId: string): Observable<OpcionPregunta[]> {
    return this.http.get<OpcionPregunta[]>(`${this.apiUrl}/opciones-pregunta/pregunta/${preguntaId}`);
  }

  deleteOpcion(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/opciones-pregunta/${id}`);
  }
}