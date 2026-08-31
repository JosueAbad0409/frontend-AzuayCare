import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment'; 

@Injectable({
  providedIn: 'root'
})
export class UbicacionesService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/ubicaciones`;

  getPaises(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/paises`);
  }

  getProvincias(paisId: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/paises/${paisId}/provincias`);
  }

  getCantones(provinciaId: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/provincias/${provinciaId}/cantones`);
  }
}