import { Component, OnInit, inject, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { finalize } from 'rxjs';
import Swal from 'sweetalert2';

import { PeriodoMatricula } from '../../../core/models/periodo.model';
import { PeriodoService } from '../../../core/services/periodo.service';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-periodos',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './periodos.component.html',
  styleUrls: ['./periodos.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PeriodosComponent implements OnInit {
  private readonly periodoService = inject(PeriodoService);
  private readonly toastService = inject(ToastService);
  
  // Estado base
  readonly periodos = signal<PeriodoMatricula[]>([]);
  readonly isLoading = signal<boolean>(true);
  
  // Filtros
  readonly searchTerm = signal<string>('');
  readonly filtroEstado = signal<string>('TODOS');
  
  // Filtro Reactivo Computado
  readonly periodosFiltrados = computed(() => {
    const term = this.searchTerm().toLowerCase().trim();
    const estado = this.filtroEstado();

    return this.periodos().filter(p => {
      const coincideTexto = !term || p.nombre.toLowerCase().includes(term);

      let coincideEstado = true;
      if (estado === 'ACTIVO') coincideEstado = !!p.activo;
      else if (estado === 'INACTIVO') coincideEstado = !p.activo;

      return coincideTexto && coincideEstado;
    });
  });

  ngOnInit(): void {
    this.cargarPeriodos();
  }

  onSearchChange(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.searchTerm.set(value);
  }

  onEstadoChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.filtroEstado.set(value);
  }

  cargarPeriodos(): void {
    this.isLoading.set(true);
    this.periodoService.getPeriodos()
      .pipe(finalize(() => this.isLoading.set(false)))
      .subscribe({
        next: (data) => this.periodos.set(data || []),
        error: (err: HttpErrorResponse) => {
          console.error('Error al cargar periodos:', err);
          this.toastService.show('Error al obtener la lista de periodos.', 'error');
        }
      });
  }

  abrirFormularioSwal(periodo?: PeriodoMatricula): void {
    const isEditing = !!periodo;
    const titleText = isEditing ? 'Editar Periodo' : 'Registrar Nuevo Periodo';
    const confirmText = isEditing ? 'Actualizar' : 'Guardar Periodo';

    const formatearFecha = (fecha?: string) => fecha ? fecha.split('T')[0] : '';
    const fechaInicioVal = isEditing ? formatearFecha(periodo?.fecha_inicio) : '';
    const fechaFinVal = isEditing ? formatearFecha(periodo?.fecha_fin) : '';
    const activoVal = isEditing && periodo?.activo ? 'checked' : '';

    Swal.fire({
      title: titleText,
      width: '600px',
      html: `
        <div style="text-align: left; padding-top: 10px;">
          <div style="margin-bottom: 1.25rem;">
            <label for="swal-nombre" style="font-size: 0.85rem; font-weight: 700; display: block; margin-bottom: 0.4rem; color: #0f172a;">Nombre del Periodo *</label>
            <input id="swal-nombre" type="text" class="swal2-input" placeholder="Ej. Abril - Agosto 2026" style="width: 100%; margin: 0; box-sizing: border-box;" value="${isEditing ? periodo.nombre : ''}">
          </div>
          
          <div style="display: flex; gap: 1rem; margin-bottom: 1.25rem;">
            <div style="flex: 1;">
              <label for="swal-inicio" style="font-size: 0.85rem; font-weight: 700; display: block; margin-bottom: 0.4rem; color: #0f172a;">Fecha de Inicio *</label>
              <input id="swal-inicio" type="date" class="swal2-input" style="width: 100%; margin: 0; box-sizing: border-box;" value="${fechaInicioVal}">
            </div>
            <div style="flex: 1;">
              <label for="swal-fin" style="font-size: 0.85rem; font-weight: 700; display: block; margin-bottom: 0.4rem; color: #0f172a;">Fecha de Fin *</label>
              <input id="swal-fin" type="date" class="swal2-input" style="width: 100%; margin: 0; box-sizing: border-box;" value="${fechaFinVal}">
            </div>
          </div>

          <div style="display: flex; align-items: center; gap: 0.5rem; margin-top: 1.5rem; padding-bottom: 0.25rem;">
            <input type="checkbox" id="swal-activo" style="width: 1.2rem; height: 1.2rem; accent-color: #8b5cf6; cursor: pointer;" ${activoVal}>
            <label for="swal-activo" style="font-size: 0.875rem; font-weight: 700; color: #334155; margin: 0; cursor: pointer;">Establecer como periodo ACTIVO</label>
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
        const fecha_inicio = (document.getElementById('swal-inicio') as HTMLInputElement).value;
        const fecha_fin = (document.getElementById('swal-fin') as HTMLInputElement).value;
        const activo = (document.getElementById('swal-activo') as HTMLInputElement).checked;

        if (!nombre) {
          Swal.showValidationMessage('El nombre es obligatorio.');
          return false;
        }
        if (!fecha_inicio || !fecha_fin) {
          Swal.showValidationMessage('Las fechas de inicio y fin son obligatorias.');
          return false;
        }
        if (new Date(fecha_inicio) > new Date(fecha_fin)) {
          Swal.showValidationMessage('La fecha de inicio no puede ser mayor a la fecha de fin.');
          return false;
        }

        return { nombre, fecha_inicio, fecha_fin, activo };
      }
    }).then((result) => {
      if (result.isConfirmed && result.value) {
        this.guardarPeriodoEnDb(result.value, isEditing ? periodo.id : null);
      }
    });
  }

  guardarPeriodoEnDb(formData: any, id: string | null): void {
    Swal.fire({
      title: 'Guardando...',
      text: 'Por favor, espera un momento.',
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading();
      }
    });

    const peticion$ = id
      ? this.periodoService.updatePeriodo(id, formData)
      : this.periodoService.createPeriodo(formData);

    peticion$.subscribe({
      next: () => {
        Swal.close();
        this.toastService.show(
          id ? 'Periodo actualizado con éxito.' : 'Periodo registrado con éxito.',
          'success'
        );
        this.cargarPeriodos();
      },
      error: (err: HttpErrorResponse) => {
        console.error('Error al guardar periodo:', err);
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: this.extraerMensajeError(err, 'Error al procesar la solicitud.'),
          confirmButtonColor: '#8b5cf6'
        });
      }
    });
  }

  eliminarPeriodo(id: string): void {
    Swal.fire({
      title: '¿Estás seguro?',
      text: '¿Estás seguro de eliminar este periodo? Los formularios asociados podrían verse afectados.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#8b5cf6',
      cancelButtonColor: '#ef4444',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (result.isConfirmed) {
        this.periodoService.deletePeriodo(id).subscribe({
          next: () => {
            this.toastService.show('Periodo eliminado con éxito.', 'info');
            this.cargarPeriodos();
          },
          error: (err: HttpErrorResponse) => {
            console.error('Error al eliminar periodo:', err);
            this.toastService.show(this.extraerMensajeError(err, 'No se pudo eliminar el periodo.'), 'error');
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