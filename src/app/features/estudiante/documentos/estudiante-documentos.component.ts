import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { DocumentosService } from '../../../core/services/documentos.service';
import { FichaService } from '../../../core/services/ficha.service';
import { ToastService } from '../../../core/services/toast.service';
import { DocumentoRespaldo } from '../../../core/models/documento.model';

@Component({
  selector: 'app-estudiante-documentos',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="documentos-container">
      <div class="header-section">
        <h2>📁 Mis Documentos de Respaldo</h2>
        <p>Sube y gestiona tus archivos personales para respaldar tu ficha socioeconómica.</p>
      </div>

      <!-- Zona de Carga / Drag and Drop -->
      <div class="upload-card">
        <div class="upload-zone" (click)="fileInput.click()">
          <input #fileInput type="file" (change)="onFileSelected($event)" accept=".pdf,.png,.jpg,.jpeg" style="display: none;" />
          <span class="upload-icon">☁️</span>
          <h3>Haz clic o arrastra aquí un archivo</h3>
          <p>Formatos permitidos: PDF, PNG, JPG (Máx. 5MB)</p>
        </div>
      </div>

      <!-- Lista de Documentos -->
      <div class="list-section">
        <h3>Archivos Guardados ({{ misDocumentos().length }})</h3>
        
        <div class="grid-documentos" *ngIf="misDocumentos().length > 0; else emptyState">
          <div class="doc-card" *ngFor="let doc of misDocumentos()">
            <div class="doc-icon">
              {{ doc.tipo_mime?.includes('pdf') ? '📄' : '🖼️' }}
            </div>
            <div class="doc-info">
              <h4 class="doc-title">{{ doc.nombre_archivo }}</h4>
              <p class="doc-meta">{{ doc.created_at | date:'dd/MM/yyyy' }}</p>
            </div>
            <div class="doc-actions">
              <!-- Botón Previsualizar -->
              <button class="btn-icon" (click)="abrirPreview(doc)" title="Ver / Previsualizar">👁️</button>
              <button class="btn-icon danger" (click)="eliminarDocumento(doc.id)" title="Eliminar">🗑️</button>
            </div>
          </div>
        </div>

        <ng-template #emptyState>
          <div class="empty-box">
            <p>No tienes documentos guardados aún. Sube tu cédula o planillas de servicio para usarlas después.</p>
          </div>
        </ng-template>
      </div>
    </div>

    <!-- MODAL LIVE PREVIEW -->
    <div class="modal-backdrop" *ngIf="docPreview()" (click)="cerrarPreview()">
      <div class="modal-box-preview" (click)="$event.stopPropagation()">
        <div class="preview-header">
          <span style="display: flex; align-items: center; gap: 8px;">
            📄 {{ docPreview()?.nombre_archivo }}
          </span>
          <button class="close-btn" (click)="cerrarPreview()" title="Cerrar">❌</button>
        </div>
        <div class="preview-body">
          <iframe *ngIf="docPreview()?.tipo_mime?.includes('pdf')" [src]="safePreviewUrl()" width="100%" height="100%" style="border:none;"></iframe>
          <img *ngIf="!docPreview()?.tipo_mime?.includes('pdf')" [src]="docPreview()?.url_archivo" class="preview-img" />
        </div>
      </div>
    </div>
  `,
  styles: [`
    .documentos-container {
      display: flex;
      flex-direction: column;
      gap: 24px;
    }

    .header-section h2 {
      margin: 0 0 6px 0;
      color: #fff;
    }

    .header-section p {
      margin: 0;
      color: #9ca3af;
    }

    .upload-card {
      background: #111827;
      border: 2px dashed #374151;
      border-radius: 12px;
      padding: 32px;
      text-align: center;
      transition: border-color 0.2s;
    }

    .upload-card:hover {
      border-color: #10b981;
    }

    .upload-zone {
      cursor: pointer;
    }

    .upload-icon {
      font-size: 2.5rem;
      display: block;
      margin-bottom: 8px;
    }

    .grid-documentos {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 16px;
      margin-top: 16px;
    }

    .doc-card {
      background: #1f2937;
      border-radius: 8px;
      padding: 16px;
      display: flex;
      align-items: center;
      gap: 12px;
      border: 1px solid #374151;
    }

    .doc-icon {
      font-size: 1.8rem;
    }

    .doc-info {
      flex: 1;
      overflow: hidden;
    }

    .doc-title {
      margin: 0;
      font-size: 0.95rem;
      color: #fff;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .doc-meta {
      margin: 4px 0 0 0;
      font-size: 0.8rem;
      color: #9ca3af;
    }

    .doc-actions {
      display: flex;
      gap: 6px;
      align-items: center;
    }

    .btn-icon {
      background: #374151;
      border: none;
      color: #fff;
      padding: 6px 10px;
      border-radius: 6px;
      cursor: pointer;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 0.9rem;
    }

    .btn-icon:hover {
      background: #4b5563;
    }

    .btn-icon.danger:hover {
      background: #ef4444;
    }

    .empty-box {
      background: #111827;
      padding: 24px;
      border-radius: 8px;
      text-align: center;
      color: #6b7280;
    }

    /* Modal Backdrop Específico del Componente */
    .modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.7);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 50;
      backdrop-filter: blur(4px);
    }
    
    .close-btn {
      background: none;
      border: none;
      color: #fff;
      cursor: pointer;
      font-size: 1rem;
      opacity: 0.7;
    }
    
    .close-btn:hover {
      opacity: 1;
    }
  `]
})
export class EstudianteDocumentosComponent implements OnInit {
  private readonly documentosService = inject(DocumentosService);
  private readonly fichaService = inject(FichaService);
  private readonly toastService = inject(ToastService);
  private readonly sanitizer = inject(DomSanitizer);

  misDocumentos = signal<DocumentoRespaldo[]>([]);
  fichaIdActiva = signal<string | null>(null);

  // Estado para Live Preview
  docPreview = signal<DocumentoRespaldo | null>(null);
  safePreviewUrl = signal<SafeResourceUrl | null>(null);

  ngOnInit(): void {
    this.cargarFichaYDocumentos();
  }

  cargarFichaYDocumentos(): void {
    this.fichaService.getMisFichas().subscribe({
      next: (fichas) => {
        // Se cambió 'ENVIADO' por 'ENVIADA' para coincidir con la definición de tipo exacta
        const activa = fichas.find(f => f.estado_ficha === 'BORRADOR' || f.estado_ficha === 'ENVIADA');
        if (activa) {
          this.fichaIdActiva.set(activa.id);
          this.cargarDocumentos(activa.id);
        }
      }
    });
  }

  cargarDocumentos(fichaId: string): void {
    this.documentosService.getDocumentosByFicha(fichaId).subscribe({
      next: (docs) => this.misDocumentos.set(docs),
      error: (err: any) => this.toastService.show('Error al cargar los documentos de respaldo.', 'error')
    });
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      if (!this.fichaIdActiva()) {
        this.toastService.show('Debes iniciar una ficha socioeconómica antes de subir documentos.', 'error');
        return;
      }

      const file = input.files[0];
      this.documentosService.subirDocumento(this.fichaIdActiva()!, file).subscribe({
        next: (nuevoDoc) => {
          this.misDocumentos.update(docs => [...docs, nuevoDoc]);
          this.toastService.show('Documento subido con éxito.', 'success');
        },
        error: (err: any) => this.toastService.show(err?.error?.message || 'Error al subir el documento.', 'error')
      });
    }
  }

  eliminarDocumento(id: string): void {
    if (confirm('¿Deseas eliminar este documento?')) {
      this.documentosService.deleteDocumento(id).subscribe({
        next: () => {
          this.misDocumentos.update(docs => docs.filter(d => d.id !== id));
          this.toastService.show('Documento eliminado exitosamente.', 'success');
        },
        error: (err: any) => this.toastService.show('Error al intentar eliminar el documento.', 'error')
      });
    }
  }

  abrirPreview(doc: DocumentoRespaldo): void {
    this.docPreview.set(doc);
    if (doc.tipo_mime?.includes('pdf')) {
      // Necesitamos sanitizar la URL para que Angular permita cargar el iframe
      this.safePreviewUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(doc.url_archivo));
    }
  }

  cerrarPreview(): void {
    this.docPreview.set(null);
    this.safePreviewUrl.set(null);
  }
}