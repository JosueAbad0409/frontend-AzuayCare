import { Component, OnInit, inject, signal, ChangeDetectionStrategy, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DocumentosService } from '../../../core/services/documentos.service';
import { ToastService } from '../../../core/services/toast.service';
import { DocumentoRespaldo } from '../../../core/models/documento.model';

@Component({
  selector: 'app-estudiante-documentos',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './estudiante-documentos.component.html',
  styleUrls: ['./estudiante-documentos.component.css']
})
export class EstudianteDocumentosComponent implements OnInit {
  private readonly documentosService = inject(DocumentosService);
  private readonly toastService = inject(ToastService);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly destroyRef = inject(DestroyRef);

  misDocumentos = signal<DocumentoRespaldo[]>([]);
  docPreview = signal<DocumentoRespaldo | null>(null);
  safePreviewUrl = signal<SafeResourceUrl | null>(null);
  docAEliminar = signal<string | null>(null);

  isDragging = signal<boolean>(false);
  isUploading = signal<boolean>(false);
  isDeleting = signal<boolean>(false);

  ngOnInit(): void {
    this.cargarMisDocumentos();
  }

  cargarMisDocumentos(): void {
    this.documentosService.getMisDocumentos()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (docs) => this.misDocumentos.set(docs),
        error: () => this.toastService.show('Error al cargar tus documentos.', 'error')
      });
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.procesarArchivo(input.files[0]);
    }
    input.value = '';
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(true);
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(false);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(false);

    if (event.dataTransfer?.files && event.dataTransfer.files.length > 0) {
      this.procesarArchivo(event.dataTransfer.files[0]);
    }
  }

  private procesarArchivo(file: File): void {
    if (this.isUploading()) return;
    this.isUploading.set(true);

    this.documentosService.subirDocumentoLibre(file)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (nuevoDoc) => {
          this.misDocumentos.update(docs => [...docs, nuevoDoc]);
          this.toastService.show('Archivo subido correctamente.', 'success');
          this.isUploading.set(false);
        },
        error: (err: any) => {
          this.toastService.show(err?.error?.message || 'Error al subir el archivo.', 'error');
          this.isUploading.set(false);
        }
      });
  }

  intentarEliminar(id: string): void {
    this.docAEliminar.set(id);
  }

  cancelarEliminacion(): void {
    if (this.isDeleting()) return;
    this.docAEliminar.set(null);
  }

  confirmarEliminacion(): void {
    const id = this.docAEliminar();
    if (!id || this.isDeleting()) return;

    this.isDeleting.set(true);

    this.documentosService.deleteDocumento(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.misDocumentos.update(docs => docs.filter(d => d.id !== id));
          this.toastService.show('Archivo eliminado.', 'success');
          this.docAEliminar.set(null);
          this.isDeleting.set(false);
        },
        error: () => {
          this.toastService.show('Error al eliminar el archivo.', 'error');
          this.docAEliminar.set(null);
          this.isDeleting.set(false);
        }
      });
  }

  descargarDocumento(doc: DocumentoRespaldo): void {
    this.toastService.show('Iniciando descarga...', 'info');
    fetch(doc.ruta_archivo)
      .then(response => response.blob())
      .then(blob => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = doc.nombre_original;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      })
      .catch(() => {
        window.open(doc.ruta_archivo, '_blank');
      });
  }

  abrirPreview(doc: DocumentoRespaldo): void {
    this.docPreview.set(doc);
    if (doc.mime_type?.includes('pdf')) {
      this.safePreviewUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(doc.ruta_archivo));
    }
  }

  cerrarPreview(): void {
    this.docPreview.set(null);
    this.safePreviewUrl.set(null);
  }
}