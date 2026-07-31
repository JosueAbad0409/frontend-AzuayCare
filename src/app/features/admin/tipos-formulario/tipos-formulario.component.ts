import { Component, OnInit, inject, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { TipoFormularioService } from '../../../core/services/tipo-formulario.service';
import { ToastService } from '../../../core/services/toast.service';
import { TipoFormulario } from '../../../core/models/tipo-formulario.model';

@Component({
  selector: 'app-tipos-formulario',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './tipos-formulario.component.html',
  styleUrls: ['./tipos-formulario.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TiposFormularioComponent implements OnInit {
  private readonly tipoFormularioService = inject(TipoFormularioService);
  private readonly toastService = inject(ToastService);
  private readonly fb = inject(FormBuilder);

  tipos = signal<TipoFormulario[]>([]);
  loading = signal<boolean>(false);
  isSaving = signal<boolean>(false);
  modalOpen = signal<boolean>(false);
  editingTipoId = signal<string | null>(null);
  searchTerm = signal<string>('');

  tipoForm: FormGroup = this.fb.group({
    nombre: ['', [Validators.required, Validators.maxLength(150)]],
    descripcion: [''],
    icono: ['fa-file-alt'],
    color: ['#8b5cf6']
  });

  tiposFiltrados = computed(() => {
    const term = this.searchTerm().toLowerCase().trim();
    if (!term) return this.tipos();
    return this.tipos().filter(t => t.nombre.toLowerCase().includes(term));
  });

  ngOnInit(): void {
    this.cargarTipos();
  }

  onSearchChange(event: Event): void {
    this.searchTerm.set((event.target as HTMLInputElement).value);
  }

  cargarTipos(): void {
    this.loading.set(true);
    this.tipoFormularioService.getTiposFormulario().subscribe({
      next: (data) => {
        this.tipos.set(data);
        this.loading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        console.error('Error al cargar tipos de formulario:', err);
        this.toastService.show('Error al cargar los tipos de formulario.', 'error');
        this.loading.set(false);
      }
    });
  }

  openModal(tipo?: TipoFormulario): void {
    this.modalOpen.set(true);
    if (tipo && tipo.id) {
      this.editingTipoId.set(tipo.id);
      this.tipoForm.patchValue({
        nombre: tipo.nombre,
        descripcion: tipo.descripcion || '',
        icono: tipo.icono || 'fa-file-alt',
        color: tipo.color || '#8b5cf6'
      });
    } else {
      this.editingTipoId.set(null);
      this.tipoForm.reset({ icono: 'fa-file-alt', color: '#8b5cf6' });
    }
  }

  closeModal(): void {
    if (this.isSaving()) return;
    this.modalOpen.set(false);
    this.tipoForm.reset();
  }

  guardarTipo(): void {
    if (this.tipoForm.invalid) {
      this.tipoForm.markAllAsTouched();
      return;
    }

    this.isSaving.set(true);
    const formData = this.tipoForm.value;

    const peticion$ = this.editingTipoId()
      ? this.tipoFormularioService.updateTipoFormulario(this.editingTipoId()!, formData)
      : this.tipoFormularioService.createTipoFormulario(formData);

    peticion$.subscribe({
      next: () => {
        this.toastService.show(
          this.editingTipoId() ? 'Tipo de formulario actualizado correctamente.' : 'Tipo de formulario registrado correctamente.',
          'success'
        );
        this.isSaving.set(false);
        this.cargarTipos();
        this.closeModal();
      },
      error: (err: HttpErrorResponse) => {
        this.toastService.show(this.extraerMensajeError(err, 'Error al guardar el tipo de formulario.'), 'error');
        this.isSaving.set(false);
      }
    });
  }

  eliminarTipo(id: string): void {
    if (!confirm('¿Está seguro de desactivar este tipo de formulario? Solo será posible si no tiene formularios activos asociados.')) return;

    this.tipoFormularioService.deleteTipoFormulario(id).subscribe({
      next: () => {
        this.toastService.show('Tipo de formulario desactivado con éxito.', 'info');
        this.cargarTipos();
      },
      error: (err: HttpErrorResponse) => {
        this.toastService.show(this.extraerMensajeError(err, 'No se pudo desactivar el tipo de formulario.'), 'error');
      }
    });
  }

  private extraerMensajeError(err: HttpErrorResponse, fallback: string): string {
    if (!err?.error?.message) return fallback;
    return Array.isArray(err.error.message) ? err.error.message.join(', ') : err.error.message;
  }
}