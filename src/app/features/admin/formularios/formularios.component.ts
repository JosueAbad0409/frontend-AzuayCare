import { Component, inject, signal, computed, ChangeDetectionStrategy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { forkJoin, finalize } from 'rxjs';

import { FormularioService } from '../../../core/services/formulario.service';
import { PeriodoService } from '../../../core/services/periodo.service';
import { TipoFormularioService } from '../../../core/services/tipo-formulario.service';
import { ToastService } from '../../../core/services/toast.service';
import { Formulario } from '../../../core/models/formulario.model';
import { PeriodoMatricula } from '../../../core/models/periodo.model';
import { TipoFormulario } from '../../../core/models/tipo-formulario.model';

@Component({
  selector: 'app-formularios',
  standalone: true,
  imports: [CommonModule, RouterModule, ReactiveFormsModule],
  templateUrl: './formularios.component.html',
  styleUrls: ['./formularios.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FormulariosComponent {
  private readonly formularioService = inject(FormularioService);
  private readonly periodoService = inject(PeriodoService);
  private readonly tipoFormularioService = inject(TipoFormularioService);
  private readonly toastService = inject(ToastService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly router = inject(Router);

  // Estado Base
  readonly formularios = signal<Formulario[]>([]);
  readonly periodos = signal<PeriodoMatricula[]>([]);
  readonly tiposFormulario = signal<TipoFormulario[]>([]);
  readonly isLoading = signal<boolean>(true);
  readonly isSaving = signal<boolean>(false);
  readonly isCloning = signal<boolean>(false);
  readonly isTogglingState = signal<boolean>(false);

  // Filtros
  readonly searchTerm = signal<string>('');
  readonly filtroTipo = signal<string>('TODOS');
  readonly filtroVersion = signal<string>('TODOS');
  readonly filtroEstado = signal<string>('TODOS');

  // Modales
  readonly showModal = signal<boolean>(false);
  readonly showCloneModal = signal<boolean>(false);
  readonly isEditMode = signal<boolean>(false);
  readonly selectedFormularioId = signal<string | null>(null);

  // Forms
  readonly formGroup = this.fb.group({
    titulo: ['', [Validators.required, Validators.maxLength(255)]],
    descripcion: [''],
    periodo_id: ['', Validators.required],
    tipo_formulario_id: ['', Validators.required]
  });

  readonly cloneFormGroup = this.fb.group({
    periodo_destino_id: ['', Validators.required]
  });

  // Lista de versiones ordenada
  readonly versionesDisponibles = computed(() => {
    const versiones = this.formularios().map(f => f.version);
    return Array.from(new Set(versiones)).sort((a, b) => b - a);
  });

  // Filtro Reactivo Computado
  readonly formulariosFiltrados = computed(() => {
    const term = this.searchTerm().toLowerCase().trim();
    const tipo = this.filtroTipo();
    const version = this.filtroVersion();
    const estado = this.filtroEstado();

    return this.formularios().filter(form => {
      const coincideTexto = !term || 
        form.titulo.toLowerCase().includes(term) || 
        (form.descripcion && form.descripcion.toLowerCase().includes(term));

      const coincideTipo = tipo === 'TODOS' || form.tipo_formulario_id === tipo;
      const coincideVersion = version === 'TODOS' || form.version.toString() === version;

      let coincideEstado = true;
      if (estado === 'BLOQUEADO') coincideEstado = !!form.bloqueado;
      else if (estado === 'PUBLICADO') coincideEstado = !form.bloqueado && !!form.publicado;
      else if (estado === 'BORRADOR') coincideEstado = !form.bloqueado && !form.publicado;

      return coincideTexto && coincideTipo && coincideVersion && coincideEstado;
    });
  });

  @HostListener('document:keydown.escape')
  handleEscape(): void {
    this.cerrarModales();
  }

  constructor() {
    this.cargarDatos();
  }

  onSearchChange(event: Event): void {
    this.searchTerm.set((event.target as HTMLInputElement).value);
  }

  onTipoChange(event: Event): void {
    this.filtroTipo.set((event.target as HTMLSelectElement).value);
  }

  onVersionChange(event: Event): void {
    this.filtroVersion.set((event.target as HTMLSelectElement).value);
  }

  onEstadoChange(event: Event): void {
    this.filtroEstado.set((event.target as HTMLSelectElement).value);
  }

  cargarDatos(): void {
    this.isLoading.set(true);

    forkJoin({
      periodos: this.periodoService.getPeriodos(),
      formularios: this.formularioService.getFormularios(),
      tiposFormulario: this.tipoFormularioService.getTiposFormulario()
    })
    .pipe(finalize(() => this.isLoading.set(false)))
    .subscribe({
      next: ({ periodos, formularios, tiposFormulario }) => {
        this.periodos.set(periodos || []);
        this.formularios.set(formularios || []);
        this.tiposFormulario.set(tiposFormulario || []);
      },
      error: (err: HttpErrorResponse) => {
        console.error('Error al cargar datos:', err);
        this.toastService.show(this.extraerMensajeError(err, 'Error al cargar los datos iniciales.'), 'error');
      }
    });
  }

  abrirModalCrear(): void {
    this.isEditMode.set(false);
    this.selectedFormularioId.set(null);
    const periodoActivo = this.periodos().find(p => p.activo);

    this.formGroup.reset({
      titulo: '',
      descripcion: '',
      tipo_formulario_id: '',
      periodo_id: periodoActivo ? periodoActivo.id : ''
    });
    this.formGroup.controls.periodo_id.enable();
    this.formGroup.controls.tipo_formulario_id.enable();
    this.showModal.set(true);
  }

  abrirModalEditar(form: Formulario, e: Event): void {
    e.stopPropagation();
    if (form.bloqueado) {
      this.toastService.show('Formulario en versión bloqueada (solo lectura).', 'info');
      return;
    }
    this.isEditMode.set(true);
    this.selectedFormularioId.set(form.id);

    this.formGroup.patchValue({
      titulo: form.titulo,
      descripcion: form.descripcion || '',
      periodo_id: form.periodo_id,
      tipo_formulario_id: form.tipo_formulario_id
    });

    this.formGroup.controls.tipo_formulario_id.disable();
    this.showModal.set(true);
  }

  abrirModalClonar(formId: string, e: Event): void {
    e.stopPropagation();
    const form = this.formularios().find(f => f.id === formId);
    if (form?.bloqueado) {
      this.toastService.show('No se puede clonar una versión bloqueada.', 'error');
      return;
    }

    this.selectedFormularioId.set(formId);
    const periodoActivo = this.periodos().find(p => p.activo);

    this.cloneFormGroup.reset({
      periodo_destino_id: periodoActivo ? periodoActivo.id : ''
    });

    this.showCloneModal.set(true);
  }

  cerrarModales(): void {
    if (this.isSaving() || this.isCloning()) return;
    this.showModal.set(false);
    this.showCloneModal.set(false);
    this.selectedFormularioId.set(null);
  }

  guardarFormulario(): void {
    if (this.formGroup.invalid) {
      this.formGroup.markAllAsTouched();
      return;
    }

    this.isSaving.set(true);
    const formData = this.formGroup.getRawValue();
    const id = this.selectedFormularioId();

    if (this.isEditMode() && id) {
      this.formularioService.updateFormulario(id, {
        titulo: formData.titulo,
        descripcion: formData.descripcion,
        tipo_formulario_id: formData.tipo_formulario_id,
        periodo_id: formData.periodo_id
      })
      .pipe(finalize(() => this.isSaving.set(false)))
      .subscribe({
        next: () => {
          this.toastService.show('Formulario actualizado con éxito.', 'success');
          this.cerrarModales();
          this.cargarDatos();
        },
        error: (err: HttpErrorResponse) => {
          this.toastService.show(this.extraerMensajeError(err, 'Error al actualizar el formulario.'), 'error');
        }
      });
    } else {
      this.formularioService.createFormulario(formData)
      .pipe(finalize(() => this.isSaving.set(false)))
      .subscribe({
        next: (nuevoForm: Formulario) => {
          this.toastService.show('Formulario borrador creado con éxito.', 'success');
          this.cerrarModales();
          this.router.navigate(['/admin/formularios/builder', nuevoForm.id]);
        },
        error: (err: HttpErrorResponse) => {
          this.toastService.show(this.extraerMensajeError(err, 'Error al crear el formulario.'), 'error');
        }
      });
    }
  }

  confirmarClonacion(): void {
    const id = this.selectedFormularioId();
    if (this.cloneFormGroup.invalid || !id) {
      this.cloneFormGroup.markAllAsTouched();
      return;
    }

    this.isCloning.set(true);
    const periodoDestinoId = this.cloneFormGroup.getRawValue().periodo_destino_id;

    this.formularioService.clonarFormulario(id, periodoDestinoId)
      .pipe(finalize(() => this.isCloning.set(false)))
      .subscribe({
        next: (clonado: Formulario) => {
          this.toastService.show(`Formulario clonado a versión v${clonado.version}.`, 'success');
          this.cerrarModales();
          this.cargarDatos();
        },
        error: (err: HttpErrorResponse) => {
          this.toastService.show(this.extraerMensajeError(err, 'Error al clonar el formulario.'), 'error');
        }
      });
  }

  togglePublicacion(form: Formulario, e: Event): void {
    e.stopPropagation();
    if (form.bloqueado || this.isTogglingState()) return;

    const advertencia = form.publicado 
      ? '¿Estás seguro de despublicar esta ficha? Volverá a estado borrador.'
      : '¿Estás seguro de publicar esta ficha? Los estudiantes podrán empezar a completarla.';

    if (confirm(advertencia)) {
      this.isTogglingState.set(true);
      const peticion$ = form.publicado
        ? this.formularioService.despublicarFormulario(form.id)
        : this.formularioService.publicarFormulario(form.id);

      peticion$
        .pipe(finalize(() => this.isTogglingState.set(false)))
        .subscribe({
          next: () => {
            this.toastService.show(`Ficha ${form.publicado ? 'despublicada' : 'publicada'} con éxito.`, 'success');
            this.cargarDatos();
          },
          error: (err: HttpErrorResponse) => {
            this.toastService.show(this.extraerMensajeError(err, 'Error al cambiar estado de publicación.'), 'error');
          }
        });
    }
  }

  eliminarFormulario(id: string, e: Event): void {
    e.stopPropagation();
    if (confirm('¿Estás seguro de eliminar este borrador? Esta acción no se puede deshacer.')) {
      this.formularioService.deleteFormulario(id).subscribe({
        next: () => {
          this.toastService.show('Formulario eliminado correctamente.', 'info');
          this.cargarDatos();
        },
        error: (err: HttpErrorResponse) => {
          this.toastService.show(
            this.extraerMensajeError(err, 'No se puede eliminar un formulario que ya fue publicado.'),
            'error'
          );
        }
      });
    }
  }

  getNombreTipoFormulario(form: Formulario): string {
    return form.tipoFormulario?.nombre
      || this.tiposFormulario().find(t => t.id === form.tipo_formulario_id)?.nombre
      || 'Sin tipo';
  }

  private extraerMensajeError(err: HttpErrorResponse, fallback: string): string {
    const msg = err?.error?.message;
    if (!msg) return fallback;
    return Array.isArray(msg) ? msg.join(', ') : msg;
  }
}