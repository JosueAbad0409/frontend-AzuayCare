import { Component, inject, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { finalize } from 'rxjs';

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
export class TiposFormularioComponent {
  private readonly tipoFormularioService = inject(TipoFormularioService);
  private readonly toastService = inject(ToastService);
  private readonly fb = inject(NonNullableFormBuilder);

  // Señales de Estado
  readonly tipos = signal<TipoFormulario[]>([]);
  readonly loading = signal<boolean>(false);
  readonly isSaving = signal<boolean>(false);
  readonly modalOpen = signal<boolean>(false);
  readonly editingTipoId = signal<string | null>(null);
  readonly searchTerm = signal<string>('');

  // Formulario reactivo fuertemente tipado
  readonly tipoForm = this.fb.group({
    nombre: ['', [Validators.required, Validators.maxLength(150)]],
    descripcion: [''],
    icono: ['fa-file-alt'],
    color: ['#8b5cf6']
  });

  // Filtro de Búsqueda Computado
  readonly tiposFiltrados = computed(() => {
    const term = this.searchTerm().toLowerCase().trim();
    const lista = this.tipos();
    if (!term) return lista;
    return lista.filter(t => t.nombre.toLowerCase().includes(term));
  });

  constructor() {
    this.cargarTipos();
  }

  onSearchChange(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.searchTerm.set(value);
  }

  cargarTipos(): void {
    this.loading.set(true);
    this.tipoFormularioService.getTiposFormulario()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (data) => this.tipos.set(data),
        error: (err: HttpErrorResponse) => {
          console.error('Error al cargar tipos de formulario:', err);
          this.toastService.show('Error al cargar los tipos de formulario.', 'error');
        }
      });
  }

  openModal(tipo?: TipoFormulario): void {
    if (tipo?.id) {
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
    this.modalOpen.set(true);
  }

  closeModal(): void {
    if (this.isSaving()) return;
    this.modalOpen.set(false);
    this.tipoForm.reset({ icono: 'fa-file-alt', color: '#8b5cf6' });
  }

  guardarTipo(): void {
    if (this.tipoForm.invalid) {
      this.tipoForm.markAllAsTouched();
      return;
    }

    this.isSaving.set(true);
    const formData = this.tipoForm.getRawValue();
    const id = this.editingTipoId();

    const peticion$ = id
      ? this.tipoFormularioService.updateTipoFormulario(id, formData)
      : this.tipoFormularioService.createTipoFormulario(formData);

    peticion$
      .pipe(finalize(() => this.isSaving.set(false)))
      .subscribe({
        next: () => {
          this.toastService.show(
            id ? 'Tipo de formulario actualizado.' : 'Tipo de formulario registrado.',
            'success'
          );
          this.cargarTipos();
          this.closeModal();
        },
        error: (err: HttpErrorResponse) => {
          this.toastService.show(this.extraerMensajeError(err, 'Error al guardar el registro.'), 'error');
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
    const msg = err?.error?.message;
    if (!msg) return fallback;
    return Array.isArray(msg) ? msg.join(', ') : msg;
  }
}