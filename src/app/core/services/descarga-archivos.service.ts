import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ToastService } from './toast.service';

@Injectable({ providedIn: 'root' })
export class DescargaArchivosService {
  private readonly http = inject(HttpClient);
  private readonly toastService = inject(ToastService);

  isDescargando = signal<boolean>(false);

  descargar(url: string, nombreArchivo: string, mensajeError = 'No se pudo generar el archivo.'): void {
    this.descargarConMetodo('GET', url, undefined, nombreArchivo, mensajeError);
  }

  descargarPost(url: string, body: unknown, nombreArchivo: string, mensajeError = 'No se pudo generar el archivo.'): void {
    this.descargarConMetodo('POST', url, body, nombreArchivo, mensajeError);
  }

  private descargarConMetodo(method: 'GET' | 'POST', url: string, body: unknown, nombreArchivo: string, mensajeError: string): void {
    if (this.isDescargando()) return; // evita doble clic / doble descarga
    this.isDescargando.set(true);

    const request$ = method === 'POST'
      ? this.http.post(url, body, { responseType: 'blob' })
      : this.http.get(url, { responseType: 'blob' });

    request$.subscribe({
      next: (blob) => {
        const objectUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = objectUrl;
        a.download = nombreArchivo;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(objectUrl);
        this.isDescargando.set(false);
      },
      error: (err) => {
        console.error('Error al descargar archivo', err);
        this.toastService.show(mensajeError, 'error');
        this.isDescargando.set(false);
      },
    });
  }
}