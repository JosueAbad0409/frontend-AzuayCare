import { Component, OnInit, inject, signal, computed, ChangeDetectionStrategy, DestroyRef } from '@angular/core';
import { CommonModule, NgClass, DatePipe } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
// ✅ IMPORTAR SWEETALERT2
import Swal from 'sweetalert2'; 

import { DocumentosService } from '../../../core/services/documentos.service';
import { ToastService } from '../../../core/services/toast.service';
import { DocumentoRespaldo } from '../../../core/models/documento.model';

@Component({
  selector: 'app-estudiante-documentos',
  standalone: true,
  imports: [CommonModule, NgClass, DatePipe],
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
  
  documentosFormulario = computed(() => {
    return this.misDocumentos().filter(doc => 
      (doc.respuesta_id != null || doc.ficha_id != null) && !(doc as any).fecha_desactivacion
    );
  });

  documentosSueltos = computed(() => {
    return this.misDocumentos().filter(doc => 
      doc.respuesta_id == null && doc.ficha_id == null && !(doc as any).fecha_desactivacion
    );
  });

  docPreview = signal<DocumentoRespaldo | null>(null);
  safePreviewUrl = signal<SafeResourceUrl | null>(null);
  
  isDragging = signal<boolean>(false);
  isUploading = signal<boolean>(false);
  isDeleting = signal<boolean>(false);

  private readonly LIMITE_ARCHIVO_BYTES = 2 * 1024 * 1024; // 2MB (cupo TOTAL)

  espacioUsadoLibreBytes = computed(() => {
    return this.documentosSueltos().reduce((total, doc) => total + (doc.tamanio_bytes || 0), 0);
  });

  espacioDisponibleBytes = computed(() => {
    return Math.max(this.LIMITE_ARCHIVO_BYTES - this.espacioUsadoLibreBytes(), 0);
  });

  porcentajeEspacioUsado = computed(() => {
    return Math.min((this.espacioUsadoLibreBytes() / this.LIMITE_ARCHIVO_BYTES) * 100, 100);
  });

  documentosPorPeriodo = computed(() => {
    const grupos = new Map<string, DocumentoRespaldo[]>();

    for (const doc of this.documentosFormulario()) {
      const nombrePeriodo = this.obtenerNombrePeriodo(doc);
      if (!grupos.has(nombrePeriodo)) grupos.set(nombrePeriodo, []);
      grupos.get(nombrePeriodo)!.push(doc);
    }

    return Array.from(grupos.entries())
      .sort((a, b) => b[0].localeCompare(a[0])) 
      .map(([periodo, docs]) => ({ periodo, docs }));
  });

  private obtenerNombrePeriodo(doc: DocumentoRespaldo): string {
    return (
      doc.ficha?.periodo?.nombre ||
      doc.respuesta?.ficha?.periodo?.nombre ||
      'Sin periodo asignado'
    );
  }

  ngOnInit(): void {
    this.cargarMisDocumentos();
  }

  refrescarDocumentos(): void {
    this.cargarMisDocumentos(true);
  }

  cargarMisDocumentos(mostrarToast: boolean = false): void {
    this.documentosService.getMisDocumentos()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (docs) => {
          this.misDocumentos.set(docs);
          if (mostrarToast) {
            this.toastService.show('Repositorio sincronizado.', 'success');
          }
        },
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

    // ✅ NUEVO: Validación de tipo de archivo (Seguridad adicional)
    const tiposPermitidos = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
    if (!tiposPermitidos.includes(file.type)) {
      Swal.fire({
        title: 'Formato no permitido',
        text: 'Solo puedes subir archivos PDF o imágenes (JPG, PNG).',
        icon: 'error',
        confirmButtonText: 'Entendido',
        confirmButtonColor: '#3085d6'
      });
      return;
    }

    const disponible = this.espacioDisponibleBytes();

    // ✅ SWEET ALERT PARA ESPACIO EXCEDIDO
    if (file.size > disponible) {
      const disponibleMb = (disponible / (1024 * 1024)).toFixed(2);
      const archivoMb = (file.size / (1024 * 1024)).toFixed(2);
      
      Swal.fire({
        title: '¡Límite de espacio excedido!',
        html: `No tienes espacio suficiente en tu repositorio libre.<br><br>
               <b>Espacio disponible:</b> ${disponibleMb}MB de 2.00MB.<br>
               <b>Tu archivo pesa:</b> ${archivoMb}MB.`,
        icon: 'warning',
        confirmButtonText: 'Entendido',
        confirmButtonColor: '#d33'
      });
      return;
    }

    this.isUploading.set(true);

    this.documentosService.subirDocumentoLibre(file)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (nuevoDoc) => {
          this.misDocumentos.update(docs => [nuevoDoc, ...docs]);
          this.toastService.show('Archivo subido correctamente.', 'success');
          this.isUploading.set(false);
        },
        error: (err: any) => {
          Swal.fire({
            title: 'Error de subida',
            text: err?.error?.message || 'Hubo un problema al subir el archivo.',
            icon: 'error',
            confirmButtonText: 'Aceptar'
          });
          this.isUploading.set(false);
        }
      });
  }

  // ✅ SWEET ALERT PARA CONFIRMAR ELIMINACIÓN
  intentarEliminar(id: string): void {
    if (this.isDeleting()) return;

    Swal.fire({
      title: '¿Eliminar documento?',
      text: 'Esta acción no se puede deshacer. El archivo será borrado permanentemente de tu repositorio.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#64748b',
      confirmButtonText: '<i class="fas fa-trash-alt"></i> Sí, eliminar',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (result.isConfirmed) {
        this.confirmarEliminacion(id);
      }
    });
  }

  private confirmarEliminacion(id: string): void {
    this.isDeleting.set(true);

    this.documentosService.deleteDocumento(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.misDocumentos.update(docs => docs.filter(d => d.id !== id));
          this.isDeleting.set(false);
          
          Swal.fire({
            title: '¡Eliminado!',
            text: 'Tu documento ha sido eliminado con éxito, recuperaste espacio.',
            icon: 'success',
            timer: 2000,
            showConfirmButton: false
          });
        },
        error: () => {
          this.isDeleting.set(false);
          Swal.fire('Error', 'Hubo un problema de conexión al intentar eliminar el archivo.', 'error');
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