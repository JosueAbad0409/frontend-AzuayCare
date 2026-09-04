import { Component, OnInit, OnDestroy, inject, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject, Subscription, debounceTime } from 'rxjs';
import Swal from 'sweetalert2';

import { CiclosService } from '../../../core/services/ciclos.service';
import { CarreraService } from '../../../core/services/carrera.service';
import { ToastService } from '../../../core/services/toast.service';
import { Carrera } from '../../../core/models/carrera.model';
import { Ciclo } from '../../../core/models/ciclo.model';

@Component({
  selector: 'app-ciclos',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './ciclos.component.html',
  styleUrls: ['./ciclos.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CiclosComponent implements OnInit, OnDestroy {
  private readonly ciclosService = inject(CiclosService);
  private readonly carreraService = inject(CarreraService);
  private readonly toastService = inject(ToastService);

  readonly ciclos = signal<Ciclo[]>([]);
  readonly carreras = signal<Carrera[]>([]);
  readonly loading = signal<boolean>(false);
  readonly isSaving = signal<boolean>(false);

  readonly filterSearch = signal<string>('');
  readonly filterCarrera = signal<string>('TODOS');
  readonly filterEstado = signal<string>('TODOS');

  private readonly searchSubject = new Subject<string>();
  private searchSubscription?: Subscription;

  readonly carrerasDisponibles = computed(() => this.carreras());

  readonly ciclosFiltrados = computed(() => {
    const term = this.filterSearch().toLowerCase().trim();
    const carreraId = this.filterCarrera();
    const estadoStr = this.filterEstado();

    return this.ciclos().filter((c) => {
      const nombresCarreras = (c.ciclosCarreras || [])
        .map((cc) => (cc.carrera?.nombre || '').toLowerCase())
        .join(' ');

      const coincideNombre =
        !term ||
        c.nombre.toLowerCase().includes(term) ||
        nombresCarreras.includes(term);

      const coincideCarrera =
        carreraId === 'TODOS' ||
        (c.ciclosCarreras || []).some(
          (cc) => String(cc.carrera_id || cc.carrera?.id) === carreraId,
        );

      let coincideEstado = true;
      if (estadoStr === 'ACTIVO') coincideEstado = !c.fecha_desactivacion;
      else if (estadoStr === 'INACTIVO') coincideEstado = !!c.fecha_desactivacion;

      return coincideNombre && coincideCarrera && coincideEstado;
    });
  });

  readonly totalCasos = computed(() => this.ciclosFiltrados().length);

  readonly tieneFiltrosActivos = computed(() => {
    return !!this.filterSearch() || this.filterCarrera() !== 'TODOS' || this.filterEstado() !== 'TODOS';
  });

  ngOnInit(): void {
    this.searchSubscription = this.searchSubject
      .pipe(debounceTime(300))
      .subscribe(val => this.filterSearch.set(val));

    this.cargarCarreras();
    this.cargarCiclos();
  }

  ngOnDestroy(): void {
    this.searchSubscription?.unsubscribe();
  }

  onSearchChange(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.searchSubject.next(value);
  }

  onCarreraFilterChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.filterCarrera.set(value);
  }

  onEstadoFilterChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.filterEstado.set(value);
  }

  limpiarFiltros(): void {
    this.filterSearch.set('');
    this.filterCarrera.set('TODOS');
    this.filterEstado.set('TODOS');
  }

  cargarCarreras(): void {
    this.carreraService.getCarreras().subscribe({
      next: (data) => this.carreras.set(data || []),
      error: (err) => console.error('Error al cargar carreras:', err)
    });
  }

  cargarCiclos(): void {
    this.loading.set(true);
    this.ciclosService.getCiclos().subscribe({
      next: (data) => {
        this.ciclos.set(data || []);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Error al cargar ciclos:', err);
        this.toastService.show('Error al cargar los ciclos académicos.', 'error');
        this.loading.set(false);
      },
    });
  }

  getCarrerasLista(ciclo: Ciclo): { id: string; nombre: string }[] {
    return (ciclo.ciclosCarreras || [])
      .filter((cc) => cc.carrera?.nombre)
      .map((cc) => ({
        id: String(cc.carrera_id || cc.carrera?.id),
        nombre: cc.carrera!.nombre
      }));
  }

  openModal(ciclo?: Ciclo): void {
    if (this.isSaving()) return;

    const isEditing = !!ciclo;
    const titleText = isEditing ? 'Editar Ciclo Académico' : 'Nuevo Ciclo Académico';
    const selectedIds = new Set(
      (ciclo?.ciclosCarreras || []).map((cc) =>
        String(cc.carrera_id || cc.carrera?.id || '')
      )
    );

    const totalCarreras = this.carreras().length;
    const allCheckedInitial = totalCarreras > 0 && selectedIds.size === totalCarreras;

    let checkboxesHtml = '';
    this.carreras().forEach(c => {
      const isChecked = selectedIds.has(String(c.id));
      checkboxesHtml += `
        <label class="swal-check-item ${isChecked ? 'is-selected' : ''}">
          <input type="checkbox" class="swal-carrera-check" value="${c.id}" ${isChecked ? 'checked' : ''}>
          <span class="swal-check-text">${c.nombre}</span>
        </label>
      `;
    });

    Swal.fire({
      title: titleText,
      customClass: {
        popup: 'custom-swal-popup',
        confirmButton: 'custom-swal-confirm',
        cancelButton: 'custom-swal-cancel',
        title: 'custom-swal-title'
      },
      html: `
        <div class="swal-form-card">
          <div class="swal-header-banner">
            <i class="fas fa-layer-group swal-banner-icon" aria-hidden="true"></i>
            <div>
              <p class="swal-banner-title">${isEditing ? 'Modificar parámetros del ciclo' : 'Crear nuevo ciclo académico'}</p>
              <p class="swal-banner-sub">Asigne las carreras correspondientes a este nivel.</p>
            </div>
          </div>
          
          <div class="swal-form-group">
            <label for="swal-nombre" class="swal-form-label">Nombre del Ciclo <span class="required-star">*</span></label>
            <input id="swal-nombre" class="swal-input-styled" placeholder="Ej. Primer Ciclo, 1er Ciclo" value="${isEditing ? ciclo!.nombre : ''}">
          </div>

          <div class="swal-form-group">
            <label for="swal-orden" class="swal-form-label">Número de Orden Secuencial <span class="required-star">*</span></label>
            <input id="swal-orden" type="number" min="1" class="swal-input-styled font-mono" placeholder="Ej. 1, 2, 3..." value="${isEditing ? (ciclo!.orden ?? 1) : 1}">
            <small class="swal-help-text">Establece la secuencia lógica de ordenamiento (1, 2, 3...).</small>
          </div>

          <div class="swal-form-group">
            <div class="swal-label-header">
              <label class="swal-form-label mb-0">Carreras Asociadas <span class="required-star">*</span></label>
              <button type="button" id="btn-toggle-select-all" class="swal-btn-link">
                <i class="fas ${allCheckedInitial ? 'fa-square-minus' : 'fa-check-double'}" id="icon-toggle-all"></i>
                <span id="text-toggle-all">${allCheckedInitial ? 'Desmarcar todas' : 'Seleccionar todas'}</span>
              </button>
            </div>
            <div class="swal-check-list-wrapper">
              ${checkboxesHtml || '<p class="text-muted text-center py-2">No hay carreras registradas</p>'}
            </div>
            <small class="swal-help-text">Seleccione una o múltiples carreras para este ciclo.</small>
          </div>
        </div>
      `,
      focusConfirm: false,
      showCancelButton: true,
      buttonsStyling: false,
      confirmButtonText: isEditing
        ? '<i class="fas fa-sync-alt" aria-hidden="true"></i> <span>Actualizar</span>'
        : '<i class="fas fa-plus-circle" aria-hidden="true"></i> <span>Guardar Ciclo</span>',
      cancelButtonText: '<span>Cancelar</span>',
      didOpen: () => {
        const container = document.querySelector('.swal-check-list-wrapper');
        const toggleBtn = document.getElementById('btn-toggle-select-all');
        const toggleText = document.getElementById('text-toggle-all');
        const toggleIcon = document.getElementById('icon-toggle-all');

        const updateToggleBtnState = () => {
          const checks = Array.from(document.querySelectorAll('.swal-carrera-check')) as HTMLInputElement[];
          const allChecked = checks.length > 0 && checks.every(c => c.checked);
          if (toggleText && toggleIcon) {
            toggleText.textContent = allChecked ? 'Desmarcar todas' : 'Seleccionar todas';
            toggleIcon.className = allChecked ? 'fas fa-square-minus' : 'fas fa-check-double';
          }
        };

        container?.addEventListener('change', (e: Event) => {
          const target = e.target as HTMLInputElement;
          if (target && target.classList.contains('swal-carrera-check')) {
            const label = target.closest('.swal-check-item');
            if (label) {
              if (target.checked) label.classList.add('is-selected');
              else label.classList.remove('is-selected');
            }
            updateToggleBtnState();
          }
        });

        toggleBtn?.addEventListener('click', () => {
          const checks = Array.from(document.querySelectorAll('.swal-carrera-check')) as HTMLInputElement[];
          const shouldCheckAll = !checks.every(c => c.checked);

          checks.forEach(check => {
            check.checked = shouldCheckAll;
            const label = check.closest('.swal-check-item');
            if (label) {
              if (shouldCheckAll) label.classList.add('is-selected');
              else label.classList.remove('is-selected');
            }
          });

          updateToggleBtnState();
        });
      },
      preConfirm: () => {
        const nombreEl = document.getElementById('swal-nombre') as HTMLInputElement;
        const ordenEl = document.getElementById('swal-orden') as HTMLInputElement;
        const checks = Array.from(document.querySelectorAll('.swal-carrera-check')) as HTMLInputElement[];

        const nombre = nombreEl?.value.trim() || '';
        const orden = parseInt(ordenEl?.value || '', 10);
        const carrera_ids = checks.filter(c => c.checked).map(c => c.value);

        if (!nombre || nombre.length < 3) {
          Swal.showValidationMessage('El nombre es obligatorio (mínimo 3 caracteres).');
          return false;
        }
        if (isNaN(orden) || orden < 1) {
          Swal.showValidationMessage('El orden debe ser un número válido mayor o igual a 1.');
          return false;
        }
        if (!carrera_ids.length) {
          Swal.showValidationMessage('Debe asociar al menos una carrera al ciclo.');
          return false;
        }

        return { nombre, orden, carrera_ids };
      }
    }).then((result) => {
      if (result.isConfirmed && result.value) {
        this.guardarCiclo(result.value, isEditing ? ciclo!.id! : null);
      }
    });
  }

  guardarCiclo(formData: { nombre: string; orden: number; carrera_ids: string[] }, id: string | null): void {
    if (this.isSaving()) return;
    this.isSaving.set(true);

    Swal.fire({
      title: 'Guardando datos...',
      text: 'Espere mientras se actualiza el sistema.',
      allowOutsideClick: false,
      customClass: {
        popup: 'custom-swal-popup',
        title: 'custom-swal-title'
      },
      didOpen: () => Swal.showLoading()
    });

    if (id) {
      this.ciclosService.updateCiclo(id, formData).subscribe({
        next: () => {
          this.isSaving.set(false);
          Swal.close();
          this.toastService.show('Ciclo actualizado correctamente.', 'success');
          this.cargarCiclos();
        },
        error: (err) => {
          this.isSaving.set(false);
          Swal.close();
          this.toastService.show(err?.error?.message || 'Error al actualizar el ciclo.', 'error');
        }
      });
    } else {
      this.ciclosService.createCiclo(formData).subscribe({
        next: () => {
          this.isSaving.set(false);
          Swal.close();
          this.toastService.show('Ciclo registrado correctamente.', 'success');
          this.cargarCiclos();
        },
        error: (err) => {
          this.isSaving.set(false);
          Swal.close();
          this.toastService.show(err?.error?.message || 'Error al crear el ciclo.', 'error');
        }
      });
    }
  }

  reactivar(id: string): void {
    if (this.isSaving()) return;

    Swal.fire({
      title: '¿Reactivar Ciclo?',
      text: 'El ciclo volverá a estar disponible para su asignación en las carreras.',
      icon: 'info',
      showCancelButton: true,
      customClass: {
        popup: 'custom-swal-popup',
        confirmButton: 'custom-swal-confirm',
        cancelButton: 'custom-swal-cancel',
        title: 'custom-swal-title'
      },
      buttonsStyling: false,
      confirmButtonText: '<i class="fas fa-check-circle" aria-hidden="true"></i> <span>Sí, reactivar</span>',
      cancelButtonText: '<span>Cancelar</span>'
    }).then((result) => {
      if (result.isConfirmed) {
        this.isSaving.set(true);
        this.ciclosService.reactivarCiclo(id).subscribe({
          next: () => {
            this.isSaving.set(false);
            this.toastService.show('Ciclo reactivado con éxito.', 'success');
            this.cargarCiclos();
          },
          error: (err) => {
            this.isSaving.set(false);
            this.toastService.show(err?.error?.message || 'Error al reactivar el ciclo.', 'error');
          }
        });
      }
    });
  }

  darDeBaja(id: string): void {
    if (this.isSaving()) return;

    Swal.fire({
      title: '¿Desactivar Ciclo?',
      text: 'El ciclo pasará a estado inactivo y no estará disponible para nuevas asignaciones.',
      icon: 'warning',
      showCancelButton: true,
      customClass: {
        popup: 'custom-swal-popup',
        confirmButton: 'custom-swal-confirm custom-swal-danger',
        cancelButton: 'custom-swal-cancel',
        title: 'custom-swal-title'
      },
      buttonsStyling: false,
      confirmButtonText: '<i class="fas fa-trash-alt" aria-hidden="true"></i> <span>Sí, desactivar</span>',
      cancelButtonText: '<span>Cancelar</span>'
    }).then((result) => {
      if (result.isConfirmed) {
        this.isSaving.set(true);
        this.ciclosService.deleteCiclo(id).subscribe({
          next: () => {
            this.isSaving.set(false);
            this.toastService.show('Ciclo desactivado con éxito.', 'info');
            this.cargarCiclos();
          },
          error: () => {
            this.isSaving.set(false);
            this.toastService.show('Error al desactivar el ciclo.', 'error');
          }
        });
      }
    });
  }
}