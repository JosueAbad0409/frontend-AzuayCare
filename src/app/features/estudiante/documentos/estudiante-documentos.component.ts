import { Component, OnInit, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { DocumentosService } from '../../../core/services/documentos.service';
import { ToastService } from '../../../core/services/toast.service';
import { DocumentoRespaldo } from '../../../core/models/documento.model';

@Component({
  selector: 'app-estudiante-documentos',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="max-w-5xl mx-auto space-y-6 animate-fade-in p-4 sm:p-6">

      <!-- Header -->
      <div class="bg-white border border-slate-200 p-6 sm:p-8 rounded-[2rem] shadow-sm">
        <h2 class="text-2xl sm:text-3xl font-black text-slate-800 flex items-center gap-3">
          <i class="fas fa-folder-open text-indigo-600"></i> Repositorio de Documentos
        </h2>
        <p class="text-slate-500 mt-2 font-medium">Sube, visualiza y gestiona las planillas, cédulas o comprobantes requeridos.</p>
      </div>

      <!-- Drag & Drop Zone -->
      <div class="bg-indigo-50/50 border-2 border-dashed border-indigo-200 hover:border-indigo-400 hover:bg-indigo-50 transition-all rounded-[2rem] p-10 text-center cursor-pointer group shadow-sm" (click)="fileInput.click()">
        <input #fileInput type="file" (change)="onFileSelected($event)" accept=".pdf,.png,.jpg,.jpeg" class="hidden" />
        <div class="w-20 h-20 mx-auto bg-white text-indigo-600 rounded-2xl flex items-center justify-center text-3xl group-hover:scale-110 transition-transform mb-4 border border-indigo-200 shadow-sm">
          <i class="fas fa-cloud-upload-alt"></i>
        </div>
        <h3 class="text-lg font-bold text-slate-800 mb-1 group-hover:text-indigo-600 transition-colors">Haz clic aquí para seleccionar un archivo</h3>
        <p class="text-sm text-slate-500 font-medium">Formatos soportados: PDF, JPG, PNG (Máx. 10MB)</p>
      </div>

      <!-- Galería de Documentos -->
      <div class="pt-4">
        <h3 class="text-lg font-bold text-slate-700 mb-4 flex items-center gap-2">
          <i class="fas fa-archive text-slate-400"></i> Mis Archivos ({{ misDocumentos().length }})
        </h3>

        @if (misDocumentos().length > 0) {
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            @for (doc of misDocumentos(); track doc.id) {
              <div class="bg-white border border-slate-200 rounded-2xl p-5 hover:border-slate-300 hover:shadow-md transition-all shadow-sm group flex flex-col justify-between h-full">
                <div class="flex items-start gap-4 mb-4">
                  <div class="w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0"
                       [ngClass]="doc.mime_type?.includes('pdf') ? 'bg-rose-50 text-rose-600 border border-rose-200' : 'bg-blue-50 text-blue-600 border border-blue-200'">
                    <i class="fas" [ngClass]="doc.mime_type?.includes('pdf') ? 'fa-file-pdf' : 'fa-file-image'"></i>
                  </div>
                  <div class="overflow-hidden">
                    <h4 class="font-bold text-slate-800 text-sm truncate" [title]="doc.nombre_original">{{ doc.nombre_original }}</h4>
                    <p class="text-xs text-slate-500 mt-0.5 font-medium">{{ doc.created_at | date:'dd/MM/yyyy, HH:mm' }}</p>
                  </div>
                </div>

                <div class="flex items-center gap-2 mt-auto pt-4 border-t border-slate-100">
                  <button (click)="abrirPreview(doc)" title="Ver archivo" class="flex-1 py-2 bg-slate-100 text-slate-600 hover:bg-indigo-600 hover:text-white rounded-xl text-xs font-bold transition-colors">
                    <i class="fas fa-eye"></i> Ver
                  </button>
                  <button (click)="descargarDocumento(doc)" title="Descargar archivo" class="flex-1 py-2 bg-slate-100 text-slate-600 hover:bg-emerald-600 hover:text-white rounded-xl text-xs font-bold transition-colors">
                    <i class="fas fa-download"></i> Descargar
                  </button>
                  <!-- AQUÍ LLAMAMOS A intentarEliminar EN LUGAR DE ELIMINAR DIRECTAMENTE -->
                  <button (click)="intentarEliminar(doc.id)" title="Eliminar archivo" class="w-10 py-2 bg-red-50 text-red-600 hover:bg-red-500 hover:text-white rounded-xl text-xs font-bold transition-colors border border-red-200 shrink-0">
                    <i class="fas fa-trash-alt"></i>
                  </button>
                </div>
              </div>
            }
          </div>
        } @else {
          <div class="bg-white border-2 border-dashed border-slate-200 rounded-2xl p-10 text-center">
            <i class="fas fa-folder-open text-4xl text-slate-300 mb-3"></i>
            <p class="text-slate-500 font-medium text-sm">Tu repositorio está vacío. Sube tus primeros documentos.</p>
          </div>
        }
      </div>
    </div>

    <!-- Modal de Previsualización (Se mantiene igual) -->
    @if (docPreview()) {
      <div class="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 animate-pop">
        <div class="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" (click)="cerrarPreview()"></div>

        <div class="relative w-full max-w-4xl h-[85vh] bg-white border border-slate-200 rounded-3xl shadow-2xl flex flex-col overflow-hidden z-10">
          <div class="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-white">
            <h3 class="font-bold text-slate-800 text-sm flex items-center gap-2 truncate pr-4">
              <i class="fas" [ngClass]="docPreview()?.mime_type?.includes('pdf') ? 'fa-file-pdf text-rose-500' : 'fa-image text-blue-500'"></i>
              {{ docPreview()?.nombre_original }}
            </h3>
            
            <div class="flex items-center gap-2">
              <button (click)="descargarDocumento(docPreview()!)" class="w-8 h-8 bg-indigo-50 text-indigo-600 rounded-xl hover:text-white hover:bg-indigo-600 transition-colors shrink-0 flex items-center justify-center" title="Descargar">
                <i class="fas fa-download"></i>
              </button>
              <button (click)="cerrarPreview()" class="w-8 h-8 bg-slate-100 text-slate-500 rounded-xl hover:text-white hover:bg-slate-700 transition-colors shrink-0 flex items-center justify-center">
                <i class="fas fa-times"></i>
              </button>
            </div>
          </div>

          <div class="flex-1 bg-slate-50 overflow-hidden flex items-center justify-center relative">
            @if (docPreview()?.mime_type?.includes('pdf')) {
              <iframe [src]="safePreviewUrl()" class="w-full h-full border-none"></iframe>
            } @else {
              <img [src]="docPreview()?.ruta_archivo" class="max-w-full max-h-full object-contain p-4" />
            }
          </div>
        </div>
      </div>
    }

    <!-- NUEVO: Modal Profesional de Confirmación de Eliminación -->
    @if (docAEliminar()) {
      <div class="fixed inset-0 z-[110] flex items-center justify-center p-4 animate-pop">
        <div class="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" (click)="cancelarEliminacion()"></div>

        <div class="relative w-full max-w-sm bg-white border border-slate-200 rounded-[2rem] shadow-2xl flex flex-col p-8 z-10 text-center">
          <div class="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center text-4xl mx-auto mb-5 border-[6px] border-red-100/50">
            <i class="fas fa-trash-alt"></i>
          </div>
          <h3 class="font-black text-slate-800 text-xl mb-2">¿Estás seguro?</h3>
          <p class="text-slate-500 text-sm font-medium mb-8 leading-relaxed">Esta acción no se puede deshacer. El archivo se eliminará de forma permanente de tu cuenta.</p>
          
          <div class="flex items-center gap-3 w-full">
            <button (click)="cancelarEliminacion()" class="flex-1 py-3.5 bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-800 rounded-2xl font-bold transition-all text-sm">
              Cancelar
            </button>
            <button (click)="confirmarEliminacion()" class="flex-1 py-3.5 bg-red-500 text-white hover:bg-red-600 hover:shadow-lg hover:shadow-red-500/30 rounded-2xl font-bold transition-all text-sm">
              Sí, eliminar
            </button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .animate-pop { animation: popIn 0.25s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; }
    @keyframes popIn { from { opacity: 0; transform: scale(0.9); } to { opacity: 1; transform: scale(1); } }
  `]
})
export class EstudianteDocumentosComponent implements OnInit {
  private readonly documentosService = inject(DocumentosService);
  private readonly toastService = inject(ToastService);
  private readonly sanitizer = inject(DomSanitizer);

  misDocumentos = signal<DocumentoRespaldo[]>([]);

  docPreview = signal<DocumentoRespaldo | null>(null);
  safePreviewUrl = signal<SafeResourceUrl | null>(null);

  // NUEVO: Signal para controlar qué documento se quiere borrar
  docAEliminar = signal<string | null>(null);

  ngOnInit(): void {
    this.cargarMisDocumentos();
  }

  cargarMisDocumentos(): void {
    this.documentosService.getMisDocumentos().subscribe({
      next: (docs) => this.misDocumentos.set(docs),
      error: () => this.toastService.show('Error al cargar tus documentos.', 'error')
    });
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];
      
      this.documentosService.subirDocumentoLibre(file).subscribe({
        next: (nuevoDoc) => {
          this.misDocumentos.update(docs => [...docs, nuevoDoc]);
          this.toastService.show('Archivo subido correctamente.', 'success');
        },
        error: (err: any) => this.toastService.show(err?.error?.message || 'Error al subir el archivo.', 'error')
      });
    }
    input.value = '';
  }

  // 1. Abre el modal
  intentarEliminar(id: string): void {
    this.docAEliminar.set(id);
  }

  // 2. Cierra el modal sin hacer nada
  cancelarEliminacion(): void {
    this.docAEliminar.set(null);
  }

  // 3. Ejecuta la eliminación si el usuario confirma
  confirmarEliminacion(): void {
    const id = this.docAEliminar();
    if (!id) return;

    this.documentosService.deleteDocumento(id).subscribe({
      next: () => {
        this.misDocumentos.update(docs => docs.filter(d => d.id !== id));
        this.toastService.show('Archivo eliminado.', 'success');
        this.docAEliminar.set(null); // Cerramos el modal
      },
      error: () => {
        this.toastService.show('Error al eliminar el archivo.', 'error');
        this.docAEliminar.set(null); // Cerramos el modal incluso si falla
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