import { Component, OnInit, inject, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { finalize } from 'rxjs';

import { Carrera } from '../../../core/models/carrera.model';
import { CarreraService } from '../../../core/services/carrera.service';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-carreras',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './carreras.component.html',
  styleUrls: ['./carreras.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CarrerasComponent implements OnInit {
  private readonly carreraService = inject(CarreraService);
  private readonly toastService = inject(ToastService);
  private readonly fb = inject(NonNullableFormBuilder);
  
  // Estado base
  readonly carreras = signal<Carrera[]>([]);
  readonly isLoading = signal<boolean>(true);
  readonly isSaving = signal<boolean>(false);
  
  // Filtros
  readonly searchTerm = signal<string>('');
  readonly filtroEstado = signal<string>('TODOS');
  
  // Modales/Formulario
  readonly showForm = signal<boolean>(false);
  readonly isEditing = signal<boolean>(false);
  readonly currentId = signal<string | null>(null);
  
  // Formulario reactivo fuertemente tipado
  readonly carreraForm = this.fb.group({
    nombre: ['', [Validators.required, Validators.maxLength(150)]],
    correo_institucional: ['', [Validators.required, Validators.email, Validators.maxLength(150)]]
  });

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

  abrirNuevoFormulario(): void {
    this.carreraForm.reset();
    this.isEditing.set(false);
    this.currentId.set(null);
    this.showForm.set(true);
  }

  abrirEditarFormulario(carrera: Carrera): void {
    this.isEditing.set(true);
    this.currentId.set(carrera.id);
    this.carreraForm.patchValue({
      nombre: carrera.nombre,
      correo_institucional: carrera.correo_institucional
    });
    this.showForm.set(true);
  }

  cancelarFormulario(): void {
    if (this.isSaving()) return;
    this.showForm.set(false);
    this.carreraForm.reset();
  }

  guardarCarrera(): void {
    if (this.carreraForm.invalid) {
      this.carreraForm.markAllAsTouched();
      return;
    }

    this.isSaving.set(true);
    const formData = this.carreraForm.getRawValue();
    const id = this.currentId();

    const peticion$ = (this.isEditing() && id)
      ? this.carreraService.updateCarrera(id, formData)
      : this.carreraService.createCarrera(formData);

    peticion$
      .pipe(finalize(() => this.isSaving.set(false)))
      .subscribe({
        next: () => {
          this.toastService.show(
            this.isEditing() ? 'Carrera actualizada correctamente.' : 'Carrera registrada correctamente.',
            'success'
          );
          this.cargarCarreras();
          this.cancelarFormulario();
        },
        error: (err: HttpErrorResponse) => {
          console.error('Error al guardar carrera:', err);
          this.toastService.show(this.extraerMensajeError(err, 'Error al procesar la solicitud.'), 'error');
        }
      });
  }

  eliminarCarrera(id: string): void {
    if (confirm('¿Estás seguro de eliminar esta carrera? Esta acción no se puede deshacer.')) {
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
  }

  private extraerMensajeError(err: HttpErrorResponse, fallback: string): string {
    const msg = err?.error?.message;
    if (!msg) return fallback;
    return Array.isArray(msg) ? msg.join(', ') : msg;
  }
}