import { Component, OnInit, OnDestroy, inject, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Subject, Subscription, debounceTime, finalize } from 'rxjs';
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
export class CarrerasComponent implements OnInit, OnDestroy {
  private readonly carreraService = inject(CarreraService);
  private readonly toastService = inject(ToastService);

  readonly carreras = signal<Carrera[]>([]);
  readonly isLoading = signal<boolean>(true);
  readonly isSaving = signal<boolean>(false);

  readonly filterSearch = signal<string>('');
  readonly filterCorreo = signal<string>('');
  readonly filterEstado = signal<string>('TODOS');

  private readonly searchSubject = new Subject<string>();
  private readonly correoSubject = new Subject<string>();
  private searchSubscription?: Subscription;
  private correoSubscription?: Subscription;

  readonly dominiosSugeridos = computed(() => {
    const correos = this.carreras().map(c => c.correo_institucional).filter(Boolean);
    const dominios = new Set<string>();
    correos.forEach(email => {
      const partes = email.split('@');
      if (partes.length > 1) {
        dominios.add('@' + partes[1]);
      }
    });
    return Array.from(dominios);
  });

  readonly carrerasFiltradas = computed(() => {
    const term = this.filterSearch().toLowerCase().trim();
    const correoTerm = this.filterCorreo().toLowerCase().trim();
    const estado = this.filterEstado();

    return this.carreras().filter(c => {
      const coincideTexto = !term || 
        c.nombre.toLowerCase().includes(term) || 
        c.correo_institucional.toLowerCase().includes(term);

      const coincideCorreo = !correoTerm || 
        c.correo_institucional.toLowerCase().includes(correoTerm);

      let coincideEstado = true;
      if (estado === 'ACTIVA') coincideEstado = !c.fecha_desactivacion;
      else if (estado === 'INACTIVA') coincideEstado = !!c.fecha_desactivacion;

      return coincideTexto && coincideCorreo && coincideEstado;
    });
  });

  readonly totalCasos = computed(() => this.carrerasFiltradas().length);

  readonly tieneFiltrosActivos = computed(() => {
    return !!this.filterSearch() || !!this.filterCorreo() || this.filterEstado() !== 'TODOS';
  });

  ngOnInit(): void {
    this.searchSubscription = this.searchSubject
      .pipe(debounceTime(400))
      .subscribe(val => this.filterSearch.set(val));

    this.correoSubscription = this.correoSubject
      .pipe(debounceTime(400))
      .subscribe(val => this.filterCorreo.set(val));

    this.cargarCarreras();
  }

  ngOnDestroy(): void {
    this.searchSubscription?.unsubscribe();
    this.correoSubscription?.unsubscribe();
  }

  onSearchChange(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.searchSubject.next(value);
  }

  onCorreoSearchChange(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.correoSubject.next(value);
  }

  onCorreoSelectChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.filterCorreo.set(value);
  }

  limpiarFiltroCorreo(): void {
    this.filterCorreo.set('');
  }

  onEstadoChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.filterEstado.set(value);
  }

  limpiarFiltros(): void {
    this.filterSearch.set('');
    this.filterCorreo.set('');
    this.filterEstado.set('TODOS');
  }

  cargarCarreras(): void {
    this.isLoading.set(true);
    this.carreraService.getCarreras()
      .pipe(finalize(() => this.isLoading.set(false)))
      .subscribe({
        next: (data) => this.carreras.set(data || []),
        error: (err: HttpErrorResponse) => {
          this.toastService.show('Error al obtener la lista de carreras.', 'error');
        }
      });
  }

  abrirFormularioSwal(carrera?: Carrera): void {
    if (this.isSaving()) return;

    const isEditing = !!carrera;
    const titleText = isEditing ? 'Editar Carrera' : 'Registrar Nueva Carrera';

    Swal.fire({
      title: titleText,
      customClass: {
        popup: 'custom-swal-popup',
        title: 'custom-swal-title',
        htmlContainer: 'custom-swal-html-container',
        confirmButton: 'custom-swal-confirm',
        cancelButton: 'custom-swal-cancel'
      },
      html: `
        <div class="swal-form-card">
          <div class="swal-header-banner">
            <i class="fas fa-graduation-cap swal-banner-icon"></i>
            <div>
              <p class="swal-banner-title">${titleText}</p>
              <p class="swal-banner-sub">Configura la especialidad tecnológica</p>
            </div>
          </div>
          <div class="swal-form-group">
            <label for="swal-nombre" class="swal-form-label">Nombre de la Carrera *</label>
            <input id="swal-nombre" class="swal-input-styled" placeholder="Ej. Desarrollo de Software" value="${isEditing ? carrera.nombre : ''}">
          </div>
          <div class="swal-form-group">
            <label for="swal-correo" class="swal-form-label">Correo Institucional *</label>
            <input id="swal-correo" type="email" class="swal-input-styled" placeholder="ejemplo@tecazuay.edu.ec" value="${isEditing ? carrera.correo_institucional : ''}">
          </div>
        </div>
      `,
      focusConfirm: false,
      showCancelButton: true,
      buttonsStyling: false,
      confirmButtonText: isEditing 
        ? '<i class="fas fa-rotate" aria-hidden="true"></i> <span>Actualizar</span>' 
        : '<i class="fas fa-floppy-disk" aria-hidden="true"></i> <span>Guardar Carrera</span>',
      cancelButtonText: '<i class="fas fa-xmark" aria-hidden="true"></i> <span>Cancelar</span>',
      preConfirm: () => {
        const nombreEl = document.getElementById('swal-nombre') as HTMLInputElement;
        const correoEl = document.getElementById('swal-correo') as HTMLInputElement;

        const nombre = nombreEl ? nombreEl.value.trim() : '';
        const correo = correoEl ? correoEl.value.trim() : '';

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
    if (this.isSaving()) return;
    this.isSaving.set(true);

    Swal.fire({
      title: 'Guardando...',
      text: 'Por favor, espera un momento.',
      allowOutsideClick: false,
      customClass: {
        popup: 'custom-swal-popup',
        title: 'custom-swal-title'
      },
      didOpen: () => {
        Swal.showLoading();
      }
    });

    const peticion$ = id
      ? this.carreraService.updateCarrera(id, formData)
      : this.carreraService.createCarrera(formData);

    peticion$.pipe(finalize(() => this.isSaving.set(false))).subscribe({
      next: () => {
        Swal.close();
        this.toastService.show(
          id ? 'Carrera actualizada correctamente.' : 'Carrera registrada correctamente.',
          'success'
        );
        this.cargarCarreras();
      },
      error: (err: HttpErrorResponse) => {
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: this.extraerMensajeError(err, 'Error al procesar la solicitud.'),
          customClass: {
            popup: 'custom-swal-popup',
            title: 'custom-swal-title',
            confirmButton: 'custom-swal-confirm custom-swal-danger'
          },
          buttonsStyling: false
        });
      }
    });
  }

  eliminarCarrera(id: string): void {
    if (this.isSaving()) return;

    Swal.fire({
      title: '¿Estás seguro?',
      text: '¿Estás seguro de eliminar esta carrera? Esta acción no se puede deshacer.',
      icon: 'warning',
      showCancelButton: true,
      customClass: {
        popup: 'custom-swal-popup',
        title: 'custom-swal-title',
        confirmButton: 'custom-swal-confirm custom-swal-danger',
        cancelButton: 'custom-swal-cancel'
      },
      buttonsStyling: false,
      confirmButtonText: '<i class="fas fa-trash-alt" aria-hidden="true"></i> <span>Sí, eliminar</span>',
      cancelButtonText: '<i class="fas fa-times" aria-hidden="true"></i> <span>Cancelar</span>'
    }).then((result) => {
      if (result.isConfirmed) {
        this.isSaving.set(true);
        this.carreraService.deleteCarrera(id)
          .pipe(finalize(() => this.isSaving.set(false)))
          .subscribe({
            next: () => {
              this.toastService.show('Carrera eliminada con éxito.', 'info');
              this.cargarCarreras();
            },
            error: (err: HttpErrorResponse) => {
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