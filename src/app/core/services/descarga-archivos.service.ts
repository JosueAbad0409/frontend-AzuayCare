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
      ? this.http.post(url, body, { responseType: 'blob', observe: 'response' })
      : this.http.get(url, { responseType: 'blob', observe: 'response' });

    request$.subscribe({
      next: (response) => {
        const blob = response.body as Blob;
        const contentType = response.headers.get('content-type') || '';
        const contentDisposition = response.headers.get('content-disposition') || '';
        const nombreFinal = this.generarNombreArchivo(nombreArchivo, contentDisposition, contentType, blob);

        const objectUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = objectUrl;
        a.download = nombreFinal;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        window.setTimeout(() => window.URL.revokeObjectURL(objectUrl), 1500);
        this.isDescargando.set(false);
      },
      error: (err) => {
        console.error('Error al descargar archivo', err);
        this.toastService.show(mensajeError, 'error');
        this.isDescargando.set(false);
      },
    });
  }

  private generarNombreArchivo(nombreArchivo: string, contentDisposition: string, contentType: string, blob: Blob): string {
    const extensionPorContenido = this.extraerExtension(contentType, blob);
    const extensionEsperada = extensionPorContenido || this.extraerExtensionDesdeNombre(nombreArchivo);

    if (extensionEsperada && !nombreArchivo.toLowerCase().endsWith(extensionEsperada)) {
      const base = nombreArchivo.replace(/\.[^/.]+$/, '');
      return `${base}${extensionEsperada}`;
    }

    return nombreArchivo;
  }

  private extraerExtension(contentType: string, blob: Blob): string {
    if (contentType.includes('pdf')) return '.pdf';
    if (contentType.includes('spreadsheet') || contentType.includes('xlsx')) return '.xlsx';
    if (contentType.includes('excel')) return '.xlsx';
    if (contentType.includes('csv')) return '.csv';
    if (contentType.includes('json')) return '.json';
    if (blob.type.includes('pdf')) return '.pdf';
    return '';
  }

  private extraerExtensionDesdeNombre(nombreArchivo: string): string {
    const coincidencia = nombreArchivo.match(/\.[a-z0-9]+$/i);
    return coincidencia ? coincidencia[0].toLowerCase() : '';
  }
}