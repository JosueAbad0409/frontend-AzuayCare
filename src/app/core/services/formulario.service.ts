import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, shareReplay, tap } from 'rxjs';
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

  // 🚀 CACHÉ EN MEMORIA
  private cacheFormulario = new Map<string, Observable<Formulario>>();
  private cacheSecciones = new Map<string, Observable<Seccion[]>>();
  private cachePreguntas = new Map<string, Observable<Pregunta[]>>();
  private cacheOpciones = new Map<string, Observable<OpcionPregunta[]>>();

  // --- FORMULARIOS ---
  getFormularios(): Observable<Formulario[]> {
    return this.http.get<Formulario[]>(this.apiUrl);
  }

  getFormularioById(id: string): Observable<Formulario> {
    if (!this.cacheFormulario.has(id)) {
      this.cacheFormulario.set(
        id,
        this.http.get<Formulario>(`${this.apiUrl}/${id}`).pipe(
          shareReplay({ bufferSize: 1, refCount: false })
        )
      );
    }
    return this.cacheFormulario.get(id)!;
  }

  createFormulario(dto: CreateFormularioDto): Observable<Formulario> {
    return this.http.post<Formulario>(this.apiUrl, dto);
  }

  updateFormulario(id: string, dto: Partial<CreateFormularioDto>): Observable<Formulario> {
    return this.http.patch<Formulario>(`${this.apiUrl}/${id}`, dto).pipe(
      tap(() => this.cacheFormulario.delete(id))
    );
  }

  clonarFormulario(id: string, periodoDestinoId: string): Observable<Formulario> {
    return this.http.post<Formulario>(`${this.apiUrl}/${id}/clonar`, {
      periodo_destino_id: periodoDestinoId
    });
  }

  deleteFormulario(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`).pipe(
      tap(() => this.cacheFormulario.delete(id))
    );
  }

  publicarFormulario(id: string): Observable<Formulario> {
    return this.http.post<Formulario>(`${this.apiUrl}/${id}/publicar`, {}).pipe(
      tap(() => this.cacheFormulario.delete(id))
    );
  }

  despublicarFormulario(id: string): Observable<Formulario> {
    return this.http.patch<Formulario>(`${this.apiUrl}/${id}/despublicar`, {}).pipe(
      tap(() => this.cacheFormulario.delete(id))
    );
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
    if (!this.cacheSecciones.has(formularioId)) {
      this.cacheSecciones.set(
        formularioId,
        this.http.get<Seccion[]>(`${this.seccionesUrl}/formulario/${formularioId}`).pipe(
          shareReplay({ bufferSize: 1, refCount: false })
        )
      );
    }
    return this.cacheSecciones.get(formularioId)!;
  }

  createSeccion(dto: CreateSeccionDto): Observable<Seccion> {
    return this.http.post<Seccion>(this.seccionesUrl, dto).pipe(
      tap(() => {
        if (dto.formulario_id) {
          this.cacheSecciones.delete(dto.formulario_id);
        }
      })
    );
  }

  deleteSeccion(id: string, formularioId?: string): Observable<void> {
    return this.http.delete<void>(`${this.seccionesUrl}/${id}`).pipe(
      tap(() => {
        if (formularioId) {
          this.cacheSecciones.delete(formularioId);
        } else {
          this.cacheSecciones.clear();
        }
      })
    );
  }

  reordenarSecciones(formularioId: string, ordenes: { id: string; orden: number }[]): Observable<void> {
    return this.http.patch<void>(`${this.seccionesUrl}/reordenar`, { formulario_id: formularioId, ordenes }).pipe(
      tap(() => this.cacheSecciones.delete(formularioId))
    );
  }

  // --- PREGUNTAS Y TIPOS ---
  getTiposCampo(): Observable<TipoCampoForm[]> {
    return this.http.get<TipoCampoForm[]>(`${environment.apiUrl}/tipos-campo-form`);
  }

  getPreguntasBySeccion(seccionId: string): Observable<Pregunta[]> {
    if (!this.cachePreguntas.has(seccionId)) {
      this.cachePreguntas.set(
        seccionId,
        this.http.get<Pregunta[]>(`${this.preguntasUrl}/seccion/${seccionId}`).pipe(
          shareReplay({ bufferSize: 1, refCount: false })
        )
      );
    }
    return this.cachePreguntas.get(seccionId)!;
  }

  createPregunta(dto: CreatePreguntaDto): Observable<Pregunta> {
    return this.http.post<Pregunta>(this.preguntasUrl, dto).pipe(
      tap(() => {
        if (dto.seccion_id) {
          this.cachePreguntas.delete(dto.seccion_id);
        }
      })
    );
  }

  updatePregunta(id: string, dto: Partial<CreatePreguntaDto>, seccionId?: string): Observable<Pregunta> {
    return this.http.patch<Pregunta>(`${this.preguntasUrl}/${id}`, dto).pipe(
      tap(() => {
        if (seccionId) {
          this.cachePreguntas.delete(seccionId);
        } else {
          this.cachePreguntas.clear();
        }
      })
    );
  }

  deletePregunta(id: string, seccionId?: string): Observable<void> {
    return this.http.delete<void>(`${this.preguntasUrl}/${id}`).pipe(
      tap(() => {
        if (seccionId) {
          this.cachePreguntas.delete(seccionId);
        } else {
          this.cachePreguntas.clear();
        }
      })
    );
  }

  reordenarPreguntas(seccionId: string, ordenes: { id: string; orden: number }[]): Observable<void> {
    return this.http.patch<void>(`${this.preguntasUrl}/reordenar`, { seccion_id: seccionId, ordenes }).pipe(
      tap(() => this.cachePreguntas.delete(seccionId))
    );
  }

  // --- OPCIONES DE PREGUNTA ---
  getOpcionesByPregunta(preguntaId: string): Observable<OpcionPregunta[]> {
    if (!this.cacheOpciones.has(preguntaId)) {
      this.cacheOpciones.set(
        preguntaId,
        this.http.get<OpcionPregunta[]>(`${this.opcionesUrl}/pregunta/${preguntaId}`).pipe(
          shareReplay({ bufferSize: 1, refCount: false })
        )
      );
    }
    return this.cacheOpciones.get(preguntaId)!;
  }

  createOpcion(dto: CreateOpcionDto): Observable<OpcionPregunta> {
    return this.http.post<OpcionPregunta>(this.opcionesUrl, dto).pipe(
      tap(() => {
        if (dto.pregunta_id) {
          this.cacheOpciones.delete(dto.pregunta_id);
        }
      })
    );
  }

  updateOpcion(id: string, dto: Partial<CreateOpcionDto>, preguntaId?: string): Observable<OpcionPregunta> {
    return this.http.patch<OpcionPregunta>(`${this.opcionesUrl}/${id}`, dto).pipe(
      tap(() => {
        if (preguntaId) {
          this.cacheOpciones.delete(preguntaId);
        } else {
          this.cacheOpciones.clear();
        }
      })
    );
  }

  deleteOpcion(id: string, preguntaId?: string): Observable<void> {
    return this.http.delete<void>(`${this.opcionesUrl}/${id}`).pipe(
      tap(() => {
        if (preguntaId) {
          this.cacheOpciones.delete(preguntaId);
        } else {
          this.cacheOpciones.clear();
        }
      })
    );
  }

  /**
   * Limpia toda la caché en memoria.
   */
  limpiarCache(): void {
    this.cacheFormulario.clear();
    this.cacheSecciones.clear();
    this.cachePreguntas.clear();
    this.cacheOpciones.clear();
  }
}