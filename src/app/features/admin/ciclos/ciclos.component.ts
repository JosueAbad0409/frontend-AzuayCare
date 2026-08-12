import { Component, OnInit, inject, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CiclosService } from '../../../core/services/ciclos.service';
import { CarreraService } from '../../../core/services/carrera.service';
import { ToastService } from '../../../core/services/toast.service';
import { Carrera } from '../../../core/models/carrera.model';
import Swal from 'sweetalert2';
import { Ciclo } from '../../../core/models/ciclo.model';

@Component({
  selector: 'app-ciclos',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './ciclos.component.html',
  styleUrls: ['./ciclos.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CiclosComponent implements OnInit {
  private readonly ciclosService = inject(CiclosService);
  private readonly carreraService = inject(CarreraService);
  private readonly toastService = inject(ToastService);

  ciclos = signal<Ciclo[]>([]);
  carreras = signal<Carrera[]>([]);
  loading = signal<boolean>(false);
  searchTerm = signal<string>('');

  ciclosFiltrados = computed(() => {
    const term = this.searchTerm().toLowerCase().trim();
    if (!term) return this.ciclos();
    return this.ciclos().filter(c => 
      c.nombre.toLowerCase().includes(term) || 
      (c.carrera?.nombre || '').toLowerCase().includes(term)
    );
  });

  ngOnInit(): void {
    this.cargarCarreras();
    this.cargarCiclos();
  }

  onSearchChange(event: Event) {
    const value = (event.target as HTMLInputElement).value;
    this.searchTerm.set(value);
  }

  cargarCarreras(): void {
    this.carreraService.getCarreras().subscribe({
      next: (data) => this.carreras.set(data),
      error: (err) => console.error('Error al cargar carreras:', err)
    });
  }

  cargarCiclos(): void {
    this.loading.set(true);
    this.ciclosService.getCiclos().subscribe({
      next: (data) => {
        this.ciclos.set(data);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Error al cargar ciclos:', err);
        this.toastService.show('Error al cargar los ciclos académicos.', 'error');
        this.loading.set(false);
      }
    });
  }

  openModal(ciclo?: Ciclo): void {
    const isEditing = !!ciclo;
    const titleText = isEditing ? 'Editar Ciclo' : 'Nuevo Ciclo Académico';
    const confirmText = isEditing ? 'Actualizar' : 'Guardar Ciclo';

    let optionsHtml = `<option value="">-- Seleccione una Carrera --</option>`;
    this.carreras().forEach(c => {
      const isSelected = isEditing && String(ciclo.carrera_id) === String(c.id) ? 'selected' : '';
      optionsHtml += `<option value="${c.id}" ${isSelected}>${c.nombre}</option>`;
    });

    Swal.fire({
      title: titleText,
      html: `
        <div style="text-align: left; padding-top: 10px;">
          <div style="margin-bottom: 1.25rem;">
            <label for="swal-nombre" style="font-size: 0.85rem; font-weight: 700; display: block; margin-bottom: 0.4rem; color: #334155;">Nombre del Ciclo <span style="color: #ef4444;">*</span></label>
            <input id="swal-nombre" class="swal2-input" placeholder="Ej. Primer Ciclo, 1er Ciclo, etc." style="width: 100%; margin: 0; box-sizing: border-box;" value="${isEditing ? ciclo.nombre : ''}">
          </div>

          <div style="margin-bottom: 1.25rem;">
            <label for="swal-orden" style="font-size: 0.85rem; font-weight: 700; display: block; margin-bottom: 0.4rem; color: #334155;">Número de Orden <span style="color: #ef4444;">*</span></label>
            <input id="swal-orden" type="number" min="1" class="swal2-input" placeholder="Ej. 1, 2, 3..." style="width: 100%; margin: 0; box-sizing: border-box;" value="${isEditing ? (ciclo.orden ?? 1) : 1}">
            <small style="color: #64748b; font-size: 0.75rem;">Determina la secuencia lógica de ordenamiento (1, 2, 3...).</small>
          </div>

          <div>
            <label for="swal-carrera" style="font-size: 0.85rem; font-weight: 700; display: block; margin-bottom: 0.4rem; color: #334155;">Carrera a la que pertenece <span style="color: #ef4444;">*</span></label>
            <select id="swal-carrera" class="swal2-select" style="width: 100%; margin: 0; box-sizing: border-box; cursor: pointer;">
              ${optionsHtml}
            </select>
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
        const ordenVal = (document.getElementById('swal-orden') as HTMLInputElement).value;
        const carrera_id = (document.getElementById('swal-carrera') as HTMLSelectElement).value;

        const orden = parseInt(ordenVal, 10);

        if (!nombre || nombre.length < 3) {
          Swal.showValidationMessage('El nombre es obligatorio y debe tener al menos 3 caracteres.');
          return false;
        }
        if (isNaN(orden) || orden < 1) {
          Swal.showValidationMessage('El número de orden debe ser mayor o igual a 1.');
          return false;
        }
        if (!carrera_id) {
          Swal.showValidationMessage('Debes seleccionar una carrera.');
          return false;
        }

        return { nombre, orden, carrera_id };
      }
    }).then((result) => {
      if (result.isConfirmed && result.value) {
        this.guardarCiclo(result.value, isEditing ? ciclo.id! : null);
      }
    });
  }

  guardarCiclo(formData: any, id: string | null): void {
    Swal.fire({
      title: 'Guardando...',
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading()
    });

    if (id) {
      this.ciclosService.updateCiclo(id, formData).subscribe({
        next: () => {
          Swal.close();
          this.toastService.show('Ciclo actualizado correctamente.', 'success');
          this.cargarCiclos();
        },
        error: (err) => {
          Swal.close();
          this.toastService.show(err?.error?.message || 'Error al actualizar', 'error');
        }
      });
    } else {
      this.ciclosService.createCiclo(formData).subscribe({
        next: () => {
          Swal.close();
          this.toastService.show('Ciclo registrado correctamente.', 'success');
          this.cargarCiclos();
        },
        error: (err) => {
          Swal.close();
          this.toastService.show(err?.error?.message || 'Error al crear el ciclo', 'error');
        }
      });
    }
  }

  darDeBaja(id: string): void {
    Swal.fire({
      title: '¿Está seguro?',
      text: '¿Está seguro de eliminar/desactivar este ciclo?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#8b5cf6',
      cancelButtonColor: '#ef4444',
      confirmButtonText: 'Sí, desactivar',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (result.isConfirmed) {
        this.ciclosService.deleteCiclo(id).subscribe({
          next: () => {
            this.toastService.show('Ciclo desactivado con éxito.', 'info');
            this.cargarCiclos();
          },
          error: (err) => this.toastService.show('Error al eliminar el ciclo.', 'error')
        });
      }
    });
  }

  getCarreraNombre(carreraId: string): string {
    const match = this.carreras().find(c => String(c.id) === String(carreraId));
    return match ? match.nombre : 'Desconocida';
  }
}