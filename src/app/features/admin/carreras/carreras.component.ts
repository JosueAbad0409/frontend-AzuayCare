import { Component, OnInit, inject, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { finalize } from 'rxjs';
import Swal from 'sweetalert2';

import { Carrera } from '../../../core/models/carrera.model';
import { CarreraService } from '../../../core/services/carrera.service';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-carreras',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './carreras.component.html',
  styleUrls: ['./carreras.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CarrerasComponent implements OnInit {
  private readonly carreraService = inject(CarreraService);
  private readonly toastService = inject(ToastService);
  
  // Estado base
  readonly carreras = signal<Carrera[]>([]);
  readonly isLoading = signal<boolean>(true);
  
  // Filtros
  readonly searchTerm = signal<string>('');
  readonly filtroEstado = signal<string>('TODOS');

  // Filtro Reactivo Multicriterio
  readonly carrerasFiltradas = computed(() => {
    const term = this.searchTerm().toLowerCase().trim();
    const estado = this.filtroEstado();

    return this.carreras().filter(c => {
      const coincideTexto = !term || 
        c.nombre.toLowerCase().includes(term) || 
        c.correo_institucional.toLowerCase().includes(term);

      let coincideEstado = true;
      if (estado === 'ACTIVA') coincideEstado = !c.fecha_desactivacion;
      else if (estado === 'INACTIVA') coincideEstado = !!c.fecha_desactivacion;

      return coincideTexto && coincideEstado;
    });
  });

  ngOnInit(): void {
    this.cargarCarreras();
  }

  onSearchChange(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.searchTerm.set(value);
  }

  onEstadoChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.filtroEstado.set(value);
  }

  cargarCarreras(): void {
    this.isLoading.set(true);
    this.carreraService.getCarreras()
      .pipe(finalize(() => this.isLoading.set(false)))
      .subscribe({
        next: (data) => this.carreras.set(data || []),
        error: (err: HttpErrorResponse) => {
          console.error('Error al cargar carreras:', err);
          this.toastService.show('Error al obtener la lista de carreras.', 'error');
        }
      });
  }

  abrirFormularioSwal(carrera?: Carrera): void {
    const isEditing = !!carrera;
    const titleText = isEditing ? 'Editar Carrera' : 'Registrar Nueva Carrera';
    const confirmText = isEditing ? 'Actualizar' : 'Guardar Carrera';

    Swal.fire({
      title: titleText,
      html: `
        <div style="text-align: left; padding-top: 10px;">
          <div style="margin-bottom: 1.25rem;">
            <label for="swal-nombre" style="font-size: 0.85rem; font-weight: 700; display: block; margin-bottom: 0.4rem; color: #0f172a;">Nombre de la Carrera *</label>
            <input id="swal-nombre" class="swal2-input" placeholder="Ej. Desarrollo de Software" style="width: 100%; margin: 0; box-sizing: border-box;" value="${isEditing ? carrera.nombre : ''}">
          </div>
          <div>
            <label for="swal-correo" style="font-size: 0.85rem; font-weight: 700; display: block; margin-bottom: 0.4rem; color: #0f172a;">Correo Institucional *</label>
            <input id="swal-correo" type="email" class="swal2-input" placeholder="ejemplo@tecazuay.edu.ec" style="width: 100%; margin: 0; box-sizing: border-box;" value="${isEditing ? carrera.correo_institucional : ''}">
          </div>
        </div>
      `,
      focusConfirm: false,
      showCancelButton: true,
      confirmButtonText: confirmText,
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#8b5cf6', // var(--primary-color)
      cancelButtonColor: '#64748b',  // var(--text-muted)
      preConfirm: () => {
        const nombre = (document.getElementById('swal-nombre') as HTMLInputElement).value.trim();
        const correo = (document.getElementById('swal-correo') as HTMLInputElement).value.trim();

        if (!nombre) {
          Swal.showValidationMessage('El nombre es obligatorio.');
          return false;
        }
        if (!correo) {
          Swal.showValidationMessage('El correo es obligatorio.');
          return false;
        }
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(correo)) {
          Swal.showValidationMessage('Formato de correo inválido.');
          return false;
        }

        return { nombre, correo_institucional: correo };
      }
    }).then((result) => {
      if (result.isConfirmed && result.value) {
        this.guardarCarreraEnDb(result.value, isEditing ? carrera.id : null);
      }
    });
  }

  guardarCarreraEnDb(formData: any, id: string | null): void {
    // Alerta de carga mientras se guarda
    Swal.fire({
      title: 'Guardando...',
      text: 'Por favor, espera un momento.',
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading();
      }
    });

    const peticion$ = id
      ? this.carreraService.updateCarrera(id, formData)
      : this.carreraService.createCarrera(formData);

    peticion$.subscribe({
      next: () => {
        // Cierra el Swal de carga e informa éxito usando el toast original
        Swal.close();
        this.toastService.show(
          id ? 'Carrera actualizada correctamente.' : 'Carrera registrada correctamente.',
          'success'
        );
        this.cargarCarreras();
      },
      error: (err: HttpErrorResponse) => {
        console.error('Error al guardar carrera:', err);
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: this.extraerMensajeError(err, 'Error al procesar la solicitud.'),
          confirmButtonColor: '#8b5cf6'
        });
      }
    });
  }

  eliminarCarrera(id: string): void {
    Swal.fire({
      title: '¿Estás seguro?',
      text: '¿Estás seguro de eliminar esta carrera? Esta acción no se puede deshacer.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#8b5cf6',
      cancelButtonColor: '#ef4444',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (result.isConfirmed) {
        this.carreraService.deleteCarrera(id).subscribe({
          next: () => {
            this.toastService.show('Carrera eliminada con éxito.', 'info');
            this.cargarCarreras();
          },
          error: (err: HttpErrorResponse) => {
            console.error('Error al eliminar carrera:', err);
            this.toastService.show(this.extraerMensajeError(err, 'No se pudo eliminar la carrera.'), 'error');
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