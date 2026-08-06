import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { FichasPaginadasResponse } from '../models/revision-ficha.model';

@Injectable({ providedIn: 'root' })
export class PrioridadAtencionService {
    private readonly http = inject(HttpClient);
    private readonly apiUrl = `${environment.apiUrl}/fichas-respondidas`;

    getFichasPorPrioridad(
        skip: number = 0,
        take: number = 50,
        nivel: string = 'TODOS'
    ): Observable<FichasPaginadasResponse> {
        const params = new HttpParams()
            .set('skip', skip.toString())
            .set('take', take.toString())
            .set('nivel', nivel);
        return this.http.get<FichasPaginadasResponse>(`${this.apiUrl}/prioridad-atencion`, { params });
    }
}