// C:\Proyecto AzuayCare\frontend-AzuayCare\src\app\core\services\formulario.service.ts

import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { 
  Formulario, 
  CreateFormularioDto, 
  Seccion, 
  CreateSeccionDto, 
  Pregunta, 
  CreatePreguntaDto, 
  TipoCampoForm, 
  OpcionPregunta,
  CreateOpcionDto
} from '../models/formulario.model';
import { RangoVariableCalculada } from '../models/rango-variable.model';

@Injectable({
  providedIn: 'root'
})
export class FormularioService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/formularios`;
  
  private readonly seccionesUrl = `${environment.apiUrl}/secciones`;
  private readonly preguntasUrl = `${environment.apiUrl}/preguntas`;
  private readonly opcionesUrl = `${environment.apiUrl}/opciones-pregunta`;
  private readonly rangosUrl = `${environment.apiUrl}/rangos-variables`;

  // --- FORMULARIOS ---
  getFormularios(): Observable<Formulario[]> {
    return this.http.get<Formulario[]>(this.apiUrl);
  }

  getFormularioById(id: string): Observable<Formulario> {
    return this.http.get<Formulario>(`${this.apiUrl}/${id}`);
  }

  createFormulario(dto: CreateFormularioDto): Observable<Formulario> {
    return this.http.post<Formulario>(this.apiUrl, dto);
  }

  updateFormulario(id: string, dto: Partial<CreateFormularioDto>): Observable<Formulario> {
    return this.http.patch<Formulario>(`${this.apiUrl}/${id}`, dto);
  }

  // Corregido: Coincide con @Post(':id/clonar') y @Body('periodo_destino_id') de NestJS
  clonarFormulario(id: string, periodoDestinoId: string): Observable<Formulario> {
    return this.http.post<Formulario>(`${this.apiUrl}/${id}/clonar`, {
      periodo_destino_id: periodoDestinoId
    });
  }

  deleteFormulario(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  publicarFormulario(id: string): Observable<Formulario> {
    return this.http.post<Formulario>(`${this.apiUrl}/${id}/publicar`, {});
  }

  // Nuevo endpoint integrado
  despublicarFormulario(id: string): Observable<Formulario> {
    return this.http.patch<Formulario>(`${this.apiUrl}/${id}/despublicar`, {});
  }

  // --- RANGOS Y VARIABLES CALCULADAS ---
  getRangosByFormulario(formularioId: string): Observable<RangoVariableCalculada[]> {
    return this.http.get<RangoVariableCalculada[]>(`${this.rangosUrl}/formulario/${formularioId}`);
  }

  createRango(dto: Partial<RangoVariableCalculada>): Observable<RangoVariableCalculada> {
    return this.http.post<RangoVariableCalculada>(this.rangosUrl, dto);
  }

  deleteRango(id: string): Observable<void> {
    return this.http.delete<void>(`${this.rangosUrl}/${id}`);
  }

  // --- SECCIONES ---
  getSeccionesByFormulario(formularioId: string): Observable<Seccion[]> {
    return this.http.get<Seccion[]>(`${this.seccionesUrl}/formulario/${formularioId}`);
  }

  createSeccion(dto: CreateSeccionDto): Observable<Seccion> {
    return this.http.post<Seccion>(this.seccionesUrl, dto);
  }

  deleteSeccion(id: string): Observable<void> {
    return this.http.delete<void>(`${this.seccionesUrl}/${id}`);
  }

  reordenarSecciones(formularioId: string, ordenes: { id: string; orden: number }[]): Observable<void> {
    return this.http.patch<void>(`${this.seccionesUrl}/reordenar`, { formulario_id: formularioId, ordenes });
  }

  // --- PREGUNTAS Y TIPOS ---
  getTiposCampo(): Observable<TipoCampoForm[]> {
    return this.http.get<TipoCampoForm[]>(`${environment.apiUrl}/tipos-campo-form`);
  }

  getPreguntasBySeccion(seccionId: string): Observable<Pregunta[]> {
    return this.http.get<Pregunta[]>(`${this.preguntasUrl}/seccion/${seccionId}`);
  }

  createPregunta(dto: CreatePreguntaDto): Observable<Pregunta> {
    return this.http.post<Pregunta>(this.preguntasUrl, dto);
  }

  updatePregunta(id: string, dto: Partial<CreatePreguntaDto>): Observable<Pregunta> {
    return this.http.patch<Pregunta>(`${this.preguntasUrl}/${id}`, dto);
  }

  deletePregunta(id: string): Observable<void> {
    return this.http.delete<void>(`${this.preguntasUrl}/${id}`);
  }

  reordenarPreguntas(seccionId: string, ordenes: { id: string; orden: number }[]): Observable<void> {
    return this.http.patch<void>(`${this.preguntasUrl}/reordenar`, { seccion_id: seccionId, ordenes });
  }

  // --- OPCIONES DE PREGUNTA ---
  getOpcionesByPregunta(preguntaId: string): Observable<OpcionPregunta[]> {
    return this.http.get<OpcionPregunta[]>(`${this.opcionesUrl}/pregunta/${preguntaId}`);
  }

  createOpcion(dto: CreateOpcionDto): Observable<OpcionPregunta> {
    return this.http.post<OpcionPregunta>(this.opcionesUrl, dto);
  }

  updateOpcion(id: string, dto: Partial<CreateOpcionDto>): Observable<OpcionPregunta> {
    return this.http.patch<OpcionPregunta>(`${this.opcionesUrl}/${id}`, dto);
  }

  deleteOpcion(id: string): Observable<void> {
    return this.http.delete<void>(`${this.opcionesUrl}/${id}`);
  }
}