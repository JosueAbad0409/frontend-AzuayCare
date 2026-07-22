import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Carrera, CreateCarreraDto } from '../../models/carrera.model';
import { environment } from '../../../../environments/environment';

@Injectable({
    providedIn: 'root'
})
export class CarreraService {
    private readonly http = inject(HttpClient);
    private readonly apiUrl = `${environment.apiUrl}/carreras`;

    getCarreras(): Observable<Carrera[]> {
        return this.http.get<Carrera[]>(this.apiUrl);
    }

    createCarrera(carrera: CreateCarreraDto): Observable<Carrera> {
        return this.http.post<Carrera>(this.apiUrl, carrera);
    }

    updateCarrera(id: string, carrera: Partial<CreateCarreraDto>): Observable<Carrera> {
        return this.http.patch<Carrera>(`${this.apiUrl}/${id}`, carrera);
    }

    deleteCarrera(id: string): Observable<void> {
        return this.http.delete<void>(`${this.apiUrl}/${id}`);
    }
}