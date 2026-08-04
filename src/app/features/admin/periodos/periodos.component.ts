import { Component, OnInit, inject, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { finalize } from 'rxjs';

import { PeriodoMatricula } from '../../../core/models/periodo.model';
import { PeriodoService } from '../../../core/services/periodo.service';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-periodos',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './periodos.component.html',
  styleUrls: ['./periodos.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PeriodosComponent implements OnInit {
  private readonly periodoService = inject(PeriodoService);
  private readonly toastService = inject(ToastService);
  private readonly fb = inject(NonNullableFormBuilder);
  
  // Estado base
  readonly periodos = signal<PeriodoMatricula[]>([]);
  readonly isLoading = signal<boolean>(true);
  readonly isSaving = signal<boolean>(false);
  
  // Filtros
  readonly searchTerm = signal<string>('');
  readonly filtroEstado = signal<string>('TODOS');
  
  // Formulario y vistas
  readonly showForm = signal<boolean>(false);
  readonly isEditing = signal<boolean>(false);
  readonly currentId = signal<string | null>(null);
  
  // Formulario reactivo fuertemente tipado
  readonly periodoForm = this.fb.group({
    nombre: ['', [Validators.required, Validators.maxLength(150)]],
    fecha_inicio: ['', Validators.required],
    fecha_fin: ['', Validators.required],
    activo: [false]
  });

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

  abrirNuevoFormulario(): void {
    this.periodoForm.reset({ activo: false });
    this.isEditing.set(false);
    this.currentId.set(null);
    this.showForm.set(true);
  }

  abrirEditarFormulario(periodo: PeriodoMatricula): void {
    this.isEditing.set(true);
    this.currentId.set(periodo.id);
    
    const formatearFecha = (fecha: string) => fecha ? fecha.split('T')[0] : '';

    this.periodoForm.patchValue({
      nombre: periodo.nombre,
      fecha_inicio: formatearFecha(periodo.fecha_inicio),
      fecha_fin: formatearFecha(periodo.fecha_fin),
      activo: periodo.activo
    });
    this.showForm.set(true);
  }

  cancelarFormulario(): void {
    if (this.isSaving()) return;
    this.showForm.set(false);
    this.periodoForm.reset();
  }

  guardarPeriodo(): void {
    if (this.periodoForm.invalid) {
      this.periodoForm.markAllAsTouched();
      return;
    }

    this.isSaving.set(true);
    const formData = this.periodoForm.getRawValue();
    const id = this.currentId();

    const peticion$ = (this.isEditing() && id)
      ? this.periodoService.updatePeriodo(id, formData)
      : this.periodoService.createPeriodo(formData);

    peticion$
      .pipe(finalize(() => this.isSaving.set(false)))
      .subscribe({
        next: () => {
          this.toastService.show(
            this.isEditing() ? 'Periodo actualizado con éxito.' : 'Periodo registrado con éxito.',
            'success'
          );
          this.cargarPeriodos();
          this.cancelarFormulario();
        },
        error: (err: HttpErrorResponse) => {
          console.error('Error al guardar periodo:', err);
          this.toastService.show(this.extraerMensajeError(err, 'Error al procesar la solicitud.'), 'error');
        }
      });
  }

  eliminarPeriodo(id: string): void {
    if (confirm('¿Estás seguro de eliminar este periodo? Los formularios asociados podrían verse afectados.')) {
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
  }

  private extraerMensajeError(err: HttpErrorResponse, fallback: string): string {
    const msg = err?.error?.message;
    if (!msg) return fallback;
    return Array.isArray(msg) ? msg.join(', ') : msg;
  }
}