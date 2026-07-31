// C:\Proyecto AzuayCare\frontend-AzuayCare\src\app\features\admin\formularios\formularios.component.ts
import { Component, OnInit, inject, signal, ChangeDetectionStrategy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { forkJoin } from 'rxjs';

import { FormularioService } from '../../../core/services/formulario.service';
import { PeriodoService } from '../../../core/services/periodo.service';
import { TipoFormularioService } from '../../../core/services/tipo-formulario.service'; // NUEVO IMPORT
import { ToastService } from '../../../core/services/toast.service';
import { Formulario } from '../../../core/models/formulario.model';
import { PeriodoMatricula } from '../../../core/models/periodo.model';
import { TipoFormulario } from '../../../core/models/tipo-formulario.model'; // NUEVO IMPORT

@Component({
  selector: 'app-formularios',
  standalone: true,
  imports: [CommonModule, RouterModule, ReactiveFormsModule],
  templateUrl: './formularios.component.html',
  styleUrls: ['./formularios.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FormulariosComponent implements OnInit {
  private readonly formularioService = inject(FormularioService);
  private readonly periodoService = inject(PeriodoService);
  private readonly tipoFormularioService = inject(TipoFormularioService); // NUEVA INYECCIÓN
  private readonly toastService = inject(ToastService);
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);

  // Signals de estado general
  formularios = signal<Formulario[]>([]);
  periodos = signal<PeriodoMatricula[]>([]);
  tiposFormulario = signal<TipoFormulario[]>([]); // NUEVA SIGNAL
  isLoading = signal<boolean>(true);
  isSaving = signal<boolean>(false);
  isCloning = signal<boolean>(false);
  isTogglingState = signal<boolean>(false); // Para bloquear múltiples clics al publicar/despublicar

  // Signals de modales
  showModal = signal<boolean>(false);
  showCloneModal = signal<boolean>(false);
  isEditMode = signal<boolean>(false);

  selectedFormularioId = signal<string | null>(null);

  formGroup: FormGroup = this.fb.group({
    titulo: ['', [Validators.required, Validators.maxLength(255)]],
    descripcion: [''],
    periodo_id: ['', Validators.required],
    tipo_formulario_id: ['', Validators.required] // DESPUÉS
  });

  cloneFormGroup: FormGroup = this.fb.group({
    periodo_destino_id: ['', Validators.required]
  });

  @HostListener('document:keydown.escape')
  handleEscape(): void {
    this.cerrarModales();
  }

  ngOnInit(): void {
    this.cargarDatos();
  }

  cargarDatos(): void {
    this.isLoading.set(true);

    forkJoin({
      periodos: this.periodoService.getPeriodos(),
      formularios: this.formularioService.getFormularios(),
      tiposFormulario: this.tipoFormularioService.getTiposFormulario() // NUEVO
    }).subscribe({
      next: ({ periodos, formularios, tiposFormulario }) => {
        this.periodos.set(periodos || []);
        this.formularios.set(formularios || []);
        this.tiposFormulario.set(tiposFormulario || []); // NUEVO
        this.isLoading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        console.error('Error al cargar datos del módulo de formularios:', err);
        this.toastService.show(this.extraerMensajeError(err, 'Error al cargar los datos iniciales.'), 'error');
        this.isLoading.set(false);
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
    this.formGroup.get('periodo_id')?.enable();
    this.formGroup.get('tipo_formulario_id')?.enable(); // Se puede elegir libremente al crear
    this.showModal.set(true);
  }

  abrirModalEditar(form: Formulario, e: Event): void {
    e.stopPropagation();
    if (form.bloqueado) {
      this.toastService.show('Este formulario es una versión anterior bloqueada y solo puede visualizarse.', 'info');
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

    this.formGroup.get('tipo_formulario_id')?.disable(); // Bloqueado en edición, coincide con la regla del backend
    this.showModal.set(true);
  }

  abrirModalClonar(formId: string, e: Event): void {
    e.stopPropagation();
    const form = this.formularios().find(f => f.id === formId);
    if (form?.bloqueado) {
      this.toastService.show('No se puede clonar una versión anterior bloqueada.', 'error');
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

    if (this.isEditMode() && this.selectedFormularioId()) {
      this.formularioService.updateFormulario(this.selectedFormularioId()!, {
        titulo: formData.titulo,
        descripcion: formData.descripcion,
        tipo_formulario_id: formData.tipo_formulario_id,
        periodo_id: formData.periodo_id
      }).subscribe({
        next: () => {
          this.toastService.show('Formulario actualizado con éxito.', 'success');
          this.isSaving.set(false);
          this.cerrarModales();
          this.cargarDatos();
        },
        error: (err: HttpErrorResponse) => {
          console.error('Error al actualizar formulario:', err);
          this.toastService.show(this.extraerMensajeError(err, 'Error al actualizar el formulario.'), 'error');
          this.isSaving.set(false);
        }
      });
    } else {
      this.formularioService.createFormulario(formData).subscribe({
        next: (nuevoForm: Formulario) => {
          this.toastService.show('Formulario en borrador creado con éxito.', 'success');
          this.isSaving.set(false);
          this.cerrarModales();
          this.router.navigate(['/admin/formularios/builder', nuevoForm.id]);
        },
        error: (err: HttpErrorResponse) => {
          console.error('Error al crear formulario:', err);
          this.toastService.show(this.extraerMensajeError(err, 'Error al crear el formulario.'), 'error');
          this.isSaving.set(false);
        }
      });
    }
  }

  confirmarClonacion(): void {
    if (this.cloneFormGroup.invalid || !this.selectedFormularioId()) {
      this.cloneFormGroup.markAllAsTouched();
      return;
    }

    this.isCloning.set(true);
    const periodoDestinoId = this.cloneFormGroup.value.periodo_destino_id;

    this.formularioService.clonarFormulario(this.selectedFormularioId()!, periodoDestinoId).subscribe({
      next: (clonado: Formulario) => {
        const versionTexto = clonado?.version ? ` v${clonado.version}` : '';
        this.toastService.show(`Formulario clonado con éxito a la versión${versionTexto}.`, 'success');
        this.isCloning.set(false);
        this.cerrarModales();
        this.cargarDatos();
      },
      error: (err: HttpErrorResponse) => {
        console.error('Error al clonar formulario:', err);
        this.toastService.show(this.extraerMensajeError(err, 'Error al clonar el formulario.'), 'error');
        this.isCloning.set(false);
      }
    });
  }

  // Método Toggling de Publicación
  togglePublicacion(form: Formulario, e: Event): void {
    e.stopPropagation();
    if (form.bloqueado) {
      this.toastService.show('No se puede cambiar el estado de una versión bloqueada.', 'error');
      return;
    }
    if (this.isTogglingState()) return;

    const accion = form.publicado ? 'despublicar' : 'publicar';
    const advertencia = form.publicado 
      ? '¿Estás seguro de que deseas despublicar esta ficha? Volverá a estado borrador.'
      : '¿Estás seguro de que deseas publicar esta ficha? Los estudiantes podrán empezar a llenarla.';

    if (confirm(advertencia)) {
      this.isTogglingState.set(true);
      const peticion$ = form.publicado
        ? this.formularioService.despublicarFormulario(form.id)
        : this.formularioService.publicarFormulario(form.id);

      peticion$.subscribe({
        next: () => {
          this.toastService.show(`Ficha ${form.publicado ? 'despublicada' : 'publicada'} con éxito.`, 'success');
          this.isTogglingState.set(false);
          this.cargarDatos();
        },
        error: (err: HttpErrorResponse) => {
          console.error(`Error al ${accion} formulario:`, err);
          this.toastService.show(this.extraerMensajeError(err, `Error al intentar ${accion} la ficha.`), 'error');
          this.isTogglingState.set(false);
        }
      });
    }
  }

  eliminarFormulario(id: string, e: Event): void {
    e.stopPropagation();
    const form = this.formularios().find(f => f.id === id);
    if (form?.bloqueado) {
      this.toastService.show('No se puede eliminar una versión bloqueada.', 'error');
      return;
    }

    if (confirm('¿Estás seguro de eliminar esta ficha en borrador? Esta acción no se puede deshacer.')) {
      this.formularioService.deleteFormulario(id).subscribe({
        next: () => {
          this.toastService.show('Formulario eliminado correctamente.', 'info');
          this.cargarDatos();
        },
        error: (err: HttpErrorResponse) => {
          console.error('Error al eliminar formulario:', err);
          this.toastService.show(
            this.extraerMensajeError(err, 'No se puede eliminar un formulario que ya ha sido publicado.'),
            'error'
          );
        }
      });
    }
  }

  // Método auxiliar para obtener el nombre del tipo de formulario
  getNombreTipoFormulario(form: Formulario): string {
    return form.tipoFormulario?.nombre
      || this.tiposFormulario().find(t => t.id === form.tipo_formulario_id)?.nombre
      || 'Sin tipo';
  }

  private extraerMensajeError(err: HttpErrorResponse, fallback: string): string {
    if (!err?.error?.message) return fallback;
    return Array.isArray(err.error.message) ? err.error.message.join(', ') : err.error.message;
  }
}