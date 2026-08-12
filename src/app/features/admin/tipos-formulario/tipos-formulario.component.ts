import { Component, inject, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { finalize } from 'rxjs';
import Swal from 'sweetalert2';

import { TipoFormularioService } from '../../../core/services/tipo-formulario.service';
import { ToastService } from '../../../core/services/toast.service';
import { TipoFormulario } from '../../../core/models/tipo-formulario.model';

@Component({
  selector: 'app-tipos-formulario',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './tipos-formulario.component.html',
  styleUrls: ['./tipos-formulario.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TiposFormularioComponent {
  private readonly tipoFormularioService = inject(TipoFormularioService);
  private readonly toastService = inject(ToastService);

  // Señales de Estado
  readonly tipos = signal<TipoFormulario[]>([]);
  readonly loading = signal<boolean>(false);
  readonly searchTerm = signal<string>('');

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

  abrirFormularioSwal(tipo?: TipoFormulario): void {
    const isEditing = !!tipo;
    const titleText = isEditing ? 'Editar Tipo de Formulario' : 'Nuevo Tipo de Formulario';
    const confirmText = isEditing ? 'Actualizar' : 'Crear';

    Swal.fire({
      title: titleText,
      width: '550px',
      html: `
        <div style="text-align: left; padding-top: 10px;">
          <div style="margin-bottom: 1.25rem;">
            <label for="swal-nombre" style="font-size: 0.85rem; font-weight: 700; display: block; margin-bottom: 0.4rem; color: #0f172a;">Nombre *</label>
            <input id="swal-nombre" type="text" class="swal2-input" placeholder="Ej. Ficha Socioeconómica" style="width: 100%; margin: 0; box-sizing: border-box;" value="${isEditing ? tipo.nombre : ''}">
          </div>

          <div style="margin-bottom: 1.25rem;">
            <label for="swal-descripcion" style="font-size: 0.85rem; font-weight: 700; display: block; margin-bottom: 0.4rem; color: #0f172a;">Descripción</label>
            <textarea id="swal-descripcion" class="swal2-textarea" placeholder="Objetivo de esta ficha..." style="width: 100%; margin: 0; box-sizing: border-box;">${isEditing ? (tipo.descripcion || '') : ''}</textarea>
          </div>

          <div style="display: flex; gap: 1rem;">
            <div style="flex: 1;">
              <label for="swal-icono" style="font-size: 0.85rem; font-weight: 700; display: block; margin-bottom: 0.4rem; color: #0f172a;">Ícono (FontAwesome)</label>
              <input id="swal-icono" type="text" class="swal2-input" placeholder="fa-wallet" style="width: 100%; margin: 0; box-sizing: border-box;" value="${isEditing ? (tipo.icono || 'fa-file-alt') : 'fa-file-alt'}">
            </div>
            <div>
              <label for="swal-color" style="font-size: 0.85rem; font-weight: 700; display: block; margin-bottom: 0.4rem; color: #0f172a;">Color</label>
              <input id="swal-color" type="color" class="swal2-input" style="width: 100%; height: 3.2rem; margin: 0; padding: 0.25rem; box-sizing: border-box; cursor: pointer;" value="${isEditing ? (tipo.color || '#8b5cf6') : '#8b5cf6'}">
            </div>
          </div>
        </div>
      `,
      focusConfirm: false,
      showCancelButton: true,
      confirmButtonText: confirmText,
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#8b5cf6',
      cancelButtonColor: '#64748b',
      preConfirm: () => {
        const nombre = (document.getElementById('swal-nombre') as HTMLInputElement).value.trim();
        const descripcion = (document.getElementById('swal-descripcion') as HTMLTextAreaElement).value.trim();
        const icono = (document.getElementById('swal-icono') as HTMLInputElement).value.trim() || 'fa-file-alt';
        const color = (document.getElementById('swal-color') as HTMLInputElement).value;

        if (!nombre) {
          Swal.showValidationMessage('El nombre es obligatorio.');
          return false;
        }

        return { nombre, descripcion, icono, color };
      }
    }).then((result) => {
      if (result.isConfirmed && result.value) {
        this.guardarTipoEnDb(result.value, isEditing ? tipo.id : null);
      }
    });
  }

  guardarTipoEnDb(formData: any, id: string | null): void {
    Swal.fire({
      title: 'Guardando...',
      text: 'Por favor, espera un momento.',
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading();
      }
    });

    const peticion$ = id
      ? this.tipoFormularioService.updateTipoFormulario(id, formData)
      : this.tipoFormularioService.createTipoFormulario(formData);

    peticion$.subscribe({
      next: () => {
        Swal.close();
        this.toastService.show(
          id ? 'Tipo de formulario actualizado.' : 'Tipo de formulario registrado.',
          'success'
        );
        this.cargarTipos();
      },
      error: (err: HttpErrorResponse) => {
        console.error('Error al guardar tipo de formulario:', err);
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: this.extraerMensajeError(err, 'Error al guardar el registro.'),
          confirmButtonColor: '#8b5cf6'
        });
      }
    });
  }

  eliminarTipo(id: string): void {
    Swal.fire({
      title: '¿Estás seguro?',
      text: '¿Está seguro de eliminar este tipo de formulario? Solo será posible si no tiene formularios activos asociados.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#8b5cf6',
      cancelButtonColor: '#ef4444',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (result.isConfirmed) {
        this.tipoFormularioService.deleteTipoFormulario(id).subscribe({
          next: () => {
            this.toastService.show('Tipo de formulario desactivado con éxito.', 'info');
            this.cargarTipos();
          },
          error: (err: HttpErrorResponse) => {
            console.error('Error al desactivar:', err);
            this.toastService.show(this.extraerMensajeError(err, 'No se pudo desactivar el tipo de formulario.'), 'error');
          }
        });
      }
    });
  }

  private extraerMensajeError(err: HttpErrorResponse, fallback: string): string {
    const msg = err?.error?.message;
    if (!msg) return fallback;
    return Array.isArray(msg) ? msg.join(', ') : msg;
  }
}