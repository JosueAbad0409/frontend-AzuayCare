import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Carrera, CreateCarreraDto } from '../../models/carrera.model';


@Injectable({
    providedIn: 'root'
})
export class CarreraService {
    private readonly http = inject(HttpClient);
    private readonly apiUrl = 'https://azuaycare-backend.onrender.com/carreras';

    getCarreras(): Observable<Carrera[]> {
        return this.http.get<Carrera[]>(this.apiUrl);
    }

    createCarrera(carrera: CreateCarreraDto): Observable<Carrera> {
        return this.http.post<Carrera>(this.apiUrl, carrera);
    }

    // Usamos PATCH para actualizar parcialmente o para el borrado lógico (fecha_desactivacion)
    updateCarrera(id: string, carrera: Partial<CreateCarreraDto>): Observable<Carrera> {
        return this.http.patch<Carrera>(`${this.apiUrl}/${id}`, carrera);
    }

    // Borrado físico (si lo permites en tu backend)
    deleteCarrera(id: string): Observable<void> {
        return this.http.delete<void>(`${this.apiUrl}/${id}`);
    }
}