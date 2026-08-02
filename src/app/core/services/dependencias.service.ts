import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, shareReplay, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { PreguntaDependencia, CreateDependenciaDto } from '../models/dependencia.model';

@Injectable({ providedIn: 'root' })
export class DependenciasService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/preguntas-dependencias`;

  private cacheDependencias = new Map<string, Observable<PreguntaDependencia[]>>();

  getDependenciasByFormulario(formularioId: string): Observable<PreguntaDependencia[]> {
    if (!this.cacheDependencias.has(formularioId)) {
      this.cacheDependencias.set(
        formularioId,
        this.http.get<PreguntaDependencia[]>(`${this.apiUrl}/formulario/${formularioId}`).pipe(
          shareReplay({ bufferSize: 1, refCount: false })
        )
      );
    }
    return this.cacheDependencias.get(formularioId)!;
  }

  createDependencia(dto: CreateDependenciaDto): Observable<PreguntaDependencia> {
    return this.http.post<PreguntaDependencia>(this.apiUrl, dto).pipe(
      tap(() => {
        // Acceso seguro por si la propiedad no existe directamente en el tipo DTO
        const formId = (dto as { formulario_id?: string }).formulario_id;
        if (formId) {
          this.cacheDependencias.delete(formId);
        } else {
          this.cacheDependencias.clear();
        }
      })
    );
  }

  deleteDependencia(id: string, formularioId?: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`).pipe(
      tap(() => {
        if (formularioId) {
          this.cacheDependencias.delete(formularioId);
        } else {
          this.cacheDependencias.clear();
        }
      })
    );
  }

  limpiarCache(): void {
    this.cacheDependencias.clear();
  }
}