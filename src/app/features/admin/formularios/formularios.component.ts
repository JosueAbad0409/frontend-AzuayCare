import { Component, inject, signal, computed, ChangeDetectionStrategy, DestroyRef, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { ReactiveFormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { forkJoin, finalize, Subject, debounceTime, distinctUntilChanged } from 'rxjs';
import Swal from 'sweetalert2';

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
export class FormulariosComponent implements OnInit {
  private readonly formularioService = inject(FormularioService);
  private readonly periodoService = inject(PeriodoService);
  private readonly tipoFormularioService = inject(TipoFormularioService);
  private readonly toastService = inject(ToastService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  // Control de modales informativos (FAQ y Tour)
  readonly showHelpModal = signal<boolean>(false);
  readonly showGuideModal = signal<boolean>(false);
  readonly guideStep = signal<number>(0);

  readonly guideSteps = [
    {
      title: '1. Creación de Borradores',
      text: 'Usa el botón "Nueva Ficha" para configurar los metadatos de un formulario. Mientras permanezca en borrador, podrás estructurar sus secciones y preguntas libremente.'
    },
    {
      title: '2. Publicación y Seguridad',
      text: 'Al publicar la ficha, estará disponible para los estudiantes. Si una ficha ya fue publicada o contiene respuestas, no podrá eliminarse para preservar el historial institucional.'
    },
    {
      title: '3. Versionamiento y Clonación',
      text: 'Puedes duplicar la estructura completa de un formulario publicado de un periodo académico anterior hacia el periodo activo utilizando la función de clonación.'
    }
  ];

  readonly formularios = signal<Formulario[]>([]);
  readonly periodos = signal<PeriodoMatricula[]>([]);
  readonly tiposFormulario = signal<TipoFormulario[]>([]);
  readonly isLoading = signal<boolean>(true);
  readonly isSaving = signal<boolean>(false);
  readonly isCloning = signal<boolean>(false);
  readonly isTogglingState = signal<boolean>(false);

  readonly searchTerm = signal<string>('');
  readonly filtroTipo = signal<string>('TODOS');
  readonly filtroVersion = signal<string>('TODOS');
  readonly filtroEstado = signal<string>('TODOS');
  readonly filtroPeriodo = signal<string>('TODOS');

  readonly isEditMode = signal<boolean>(false);
  readonly selectedFormularioId = signal<string | null>(null);

  private readonly searchSubject = new Subject<string>();

  readonly versionesDisponibles = computed(() => {
    const versiones = this.formularios().map(f => f.version);
    return Array.from(new Set(versiones)).sort((a, b) => b - a);
  });

  readonly formulariosFiltrados = computed(() => {
    const term = this.searchTerm().toLowerCase().trim();
    const tipo = this.filtroTipo();
    const version = this.filtroVersion();
    const estado = this.filtroEstado();
    const periodo = this.filtroPeriodo();

    return this.formularios().filter(form => {
      const coincideTexto = !term || 
        form.titulo.toLowerCase().includes(term) || 
        (form.descripcion && form.descripcion.toLowerCase().includes(term));

      const coincideTipo = tipo === 'TODOS' || form.tipo_formulario_id === tipo;
      const coincideVersion = version === 'TODOS' || form.version.toString() === version;
      const coincidePeriodo = periodo === 'TODOS' || form.periodo_id === periodo || (form as any).periodo?.id === periodo;

      let coincideEstado = true;
      if (estado === 'BLOQUEADO') coincideEstado = !!form.bloqueado;
      else if (estado === 'PUBLICADO') coincideEstado = !form.bloqueado && !!form.publicado;
      else if (estado === 'BORRADOR') coincideEstado = !form.bloqueado && !form.publicado;

      return coincideTexto && coincideTipo && coincideVersion && coincideEstado && coincidePeriodo;
    });
  });

  readonly hayFiltrosActivos = computed(() => {
    const periodoActivo = this.periodos().find(p => p.activo);
    const periodoPorDefecto = periodoActivo ? periodoActivo.id : 'TODOS';

    return this.searchTerm() !== '' || 
           this.filtroTipo() !== 'TODOS' || 
           this.filtroVersion() !== 'TODOS' || 
           this.filtroEstado() !== 'TODOS' ||
           this.filtroPeriodo() !== periodoPorDefecto;
  });

  ngOnInit(): void {
    this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(term => {
      this.searchTerm.set(term);
    });

    this.cargarDatos();
  }

  openGuideModal(): void {
    this.guideStep.set(0);
    this.showGuideModal.set(true);
  }

  abrirTourDesdeAyuda(): void {
    this.showHelpModal.set(false);
    this.openGuideModal();
  }

  nextGuideStep(): void {
    if (this.guideStep() < this.guideSteps.length - 1) {
      this.guideStep.update(s => s + 1);
    }
  }

  prevGuideStep(): void {
    if (this.guideStep() > 0) {
      this.guideStep.update(s => s - 1);
    }
  }

  onSearchChange(event: Event): void {
    this.searchSubject.next((event.target as HTMLInputElement).value);
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

  onPeriodoChange(event: Event): void {
    this.filtroPeriodo.set((event.target as HTMLSelectElement).value);
  }

  limpiarSearch(): void {
    this.searchTerm.set('');
    this.searchSubject.next('');
    const input = document.getElementById('search-title-input') as HTMLInputElement;
    if (input) input.value = '';
  }

  limpiarFiltros(): void {
    this.limpiarSearch();
    this.filtroTipo.set('TODOS');
    this.filtroVersion.set('TODOS');
    this.filtroEstado.set('TODOS');

    const periodoActivo = this.periodos().find(p => p.activo);
    this.filtroPeriodo.set(periodoActivo ? periodoActivo.id : 'TODOS');
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

        const periodoActivo = (periodos || []).find(p => p.activo);
        if (periodoActivo) {
          this.filtroPeriodo.set(periodoActivo.id);
        }
      },
      error: (err: HttpErrorResponse) => {
        this.toastService.show(this.extraerMensajeError(err, 'Error al cargar los datos iniciales.'), 'error');
      }
    });
  }

  getNombreTipoFormulario(form: Formulario): string {
    return form.tipoFormulario?.nombre
      || this.tiposFormulario().find(t => t.id === form.tipo_formulario_id)?.nombre
      || 'Sin categoría';
  }

  abrirModalCrear(): void {
    this.isEditMode.set(false);
    this.selectedFormularioId.set(null);
    this.abrirSwalFicha();
  }

  abrirModalEditar(form: Formulario, e: Event): void {
    e.stopPropagation();
    this.isEditMode.set(true);
    this.selectedFormularioId.set(form.id);
    this.abrirSwalFicha(form);
  }

  private abrirSwalFicha(form?: Formulario): void {
    const esEdicion = this.isEditMode();
    const periodoActivo = this.periodos().find(p => p.activo);

    const opcionesPeriodo = this.periodos()
      .map(p => `<option value="${p.id}" ${
        (esEdicion && form?.periodo_id === p.id) || (!esEdicion && periodoActivo?.id === p.id) ? 'selected' : ''
      }>${this.escapeHtml(p.nombre)}${p.activo ? ' (ACTIVO)' : ''}</option>`)
      .join('');

    const opcionesTipo = this.tiposFormulario()
      .map(t => `<option value="${t.id}" ${esEdicion && form?.tipo_formulario_id === t.id ? 'selected' : ''}>${this.escapeHtml(t.nombre)}</option>`)
      .join('');

    Swal.fire({
      title: esEdicion ? 'Editar Propiedades de Ficha' : 'Nueva Ficha Socioeconómica',
      customClass: {
        popup: 'custom-swal-popup',
        confirmButton: 'custom-swal-confirm',
        cancelButton: 'custom-swal-cancel',
        title: 'custom-swal-title'
      },
      html: `
        <div class="swal-form-card">
          <div class="swal-header-banner">
            <i class="fas fa-file-signature swal-banner-icon" aria-hidden="true"></i>
            <div>
              <p class="swal-banner-title">${esEdicion ? 'Actualizar metadatos del formulario' : 'Configurar nuevo borrador de ficha'}</p>
              <p class="swal-banner-sub">Complete los campos requeridos para la ficha académica.</p>
            </div>
          </div>

          <div class="swal-form-group">
            <label for="swal-titulo" class="swal-form-label">Título de la Ficha <span class="required-star">*</span></label>
            <input id="swal-titulo" class="swal-input-styled" placeholder="Ej. Ficha Socioeconómica ISTA 2026"
              value="${esEdicion && form ? this.escapeHtml(form.titulo) : ''}">
          </div>

          <div class="swal-form-group">
            <label for="swal-periodo" class="swal-form-label">Periodo Académico <span class="required-star">*</span></label>
            <select id="swal-periodo" class="swal-select-styled">
              <option value="">-- Selecciona un Periodo --</option>
              ${opcionesPeriodo}
            </select>
          </div>

          <div class="swal-form-group">
            <label for="swal-tipo" class="swal-form-label">Categoría de Formulario <span class="required-star">*</span></label>
            <select id="swal-tipo" class="swal-select-styled" ${esEdicion ? 'disabled' : ''}>
              <option value="">-- Selecciona un Tipo --</option>
              ${opcionesTipo}
            </select>
          </div>

          <div class="swal-form-group">
            <label for="swal-desc" class="swal-form-label">Descripción u Objetivos</label>
            <textarea id="swal-desc" class="swal-textarea-styled" rows="3" placeholder="Instrucciones generales para los estudiantes...">${esEdicion && form ? this.escapeHtml(form.descripcion || '') : ''}</textarea>
          </div>
        </div>
      `,
      showCancelButton: true,
      focusConfirm: false,
      buttonsStyling: false,
      confirmButtonText: esEdicion 
        ? '<i class="fas fa-save" aria-hidden="true"></i> <span>Actualizar</span>' 
        : '<i class="fas fa-arrow-right" aria-hidden="true"></i> <span>Crear y Diseñar</span>',
      cancelButtonText: '<span>Cancelar</span>',
      didOpen: () => { 
        (document.getElementById('swal-titulo') as HTMLInputElement | null)?.focus(); 
      },
      preConfirm: () => {
        const titulo = (document.getElementById('swal-titulo') as HTMLInputElement)?.value?.trim() || '';
        const periodo_id = (document.getElementById('swal-periodo') as HTMLSelectElement)?.value || '';
        const tipo_formulario_id = (document.getElementById('swal-tipo') as HTMLSelectElement)?.value || '';
        const descripcion = (document.getElementById('swal-desc') as HTMLTextAreaElement)?.value?.trim() || '';

        if (!titulo || titulo.length < 3) { 
          Swal.showValidationMessage('El título es obligatorio (mínimo 3 caracteres)'); 
          return false; 
        }
        if (!periodo_id) { 
          Swal.showValidationMessage('Debe seleccionar un periodo académico'); 
          return false; 
        }
        if (!tipo_formulario_id) { 
          Swal.showValidationMessage('Debe seleccionar la categoría del formulario'); 
          return false; 
        }

        return { titulo, periodo_id, tipo_formulario_id, descripcion };
      }
    }).then((result) => {
      if (result.isConfirmed && result.value) {
        this.guardarFichaDesdeSwal(result.value);
      }
    });
  }

  private guardarFichaDesdeSwal(data: { titulo: string; periodo_id: string; tipo_formulario_id: string; descripcion: string; }): void {
    if (this.isSaving()) return;
    this.isSaving.set(true);
    const id = this.selectedFormularioId();

    if (this.isEditMode() && id) {
      this.formularioService.updateFormulario(id, data)
        .pipe(finalize(() => this.isSaving.set(false)))
        .subscribe({
          next: () => {
            this.toastService.show('Formulario actualizado con éxito.', 'success');
            this.cargarDatos();
          },
          error: (err: HttpErrorResponse) => {
            this.toastService.show(this.extraerMensajeError(err, 'Error al actualizar el formulario.'), 'error');
          }
        });
    } else {
      this.formularioService.createFormulario(data)
        .pipe(finalize(() => this.isSaving.set(false)))
        .subscribe({
          next: (nuevoForm: Formulario) => {
            this.toastService.show('Borrador de formulario creado.', 'success');
            this.router.navigate(['/admin/formularios/builder', nuevoForm.id]);
          },
          error: (err: HttpErrorResponse) => {
            this.toastService.show(this.extraerMensajeError(err, 'Error al crear el formulario.'), 'error');
          }
        });
    }
  }

  abrirModalClonar(formId: string, e: Event): void {
    e.stopPropagation();
    const periodoActivo = this.periodos().find(p => p.activo);
    const opcionesPeriodo = this.periodos()
      .map(p => `<option value="${p.id}" ${periodoActivo?.id === p.id ? 'selected' : ''}>${this.escapeHtml(p.nombre)}${p.activo ? ' (ACTIVO)' : ''}</option>`)
      .join('');

    Swal.fire({
      title: 'Clonar Ficha Socioeconómica',
      customClass: {
        popup: 'custom-swal-popup',
        confirmButton: 'custom-swal-confirm',
        cancelButton: 'custom-swal-cancel',
        title: 'custom-swal-title'
      },
      html: `
        <div class="swal-form-card">
          <div class="swal-header-banner">
            <i class="fas fa-copy swal-banner-icon" aria-hidden="true"></i>
            <div>
              <p class="swal-banner-title">Generar nueva versión de la ficha</p>
              <p class="swal-banner-sub">Se duplicará toda la estructura de preguntas para el periodo seleccionado.</p>
            </div>
          </div>

          <div class="swal-form-group">
            <label for="swal-clone-periodo" class="swal-form-label">Periodo Académico Destino <span class="required-star">*</span></label>
            <select id="swal-clone-periodo" class="swal-select-styled">
              <option value="">-- Selecciona el Periodo --</option>
              ${opcionesPeriodo}
            </select>
          </div>
        </div>
      `,
      showCancelButton: true,
      focusConfirm: false,
      buttonsStyling: false,
      confirmButtonText: '<i class="fas fa-clone" aria-hidden="true"></i> <span>Ejecutar Clonación</span>',
      cancelButtonText: '<span>Cancelar</span>',
      preConfirm: () => {
        const periodo_destino_id = (document.getElementById('swal-clone-periodo') as HTMLSelectElement)?.value || '';
        if (!periodo_destino_id) {
          Swal.showValidationMessage('Debe seleccionar un periodo destino');
          return false;
        }
        return { periodo_destino_id };
      }
    }).then((result) => {
      if (result.isConfirmed && result.value) {
        this.ejecutarClonacion(formId, result.value.periodo_destino_id);
      }
    });
  }

  private ejecutarClonacion(id: string, periodoDestinoId: string): void {
    if (this.isCloning()) return;
    this.isCloning.set(true);
    this.formularioService.clonarFormulario(id, periodoDestinoId)
      .pipe(finalize(() => this.isCloning.set(false)))
      .subscribe({
        next: (clonado: Formulario) => {
          this.toastService.show(`Formulario clonado a versión v${clonado.version}.`, 'success');
          this.cargarDatos();
        },
        error: (err: HttpErrorResponse) => {
          this.toastService.show(this.extraerMensajeError(err, 'Error al clonar el formulario.'), 'error');
        }
      });
  }

  togglePublicacion(form: Formulario, e: Event): void {
    e.stopPropagation();
    if (this.isTogglingState()) return;

    const esPublicar = !form.publicado;

    Swal.fire({
      title: esPublicar ? '¿Publicar Ficha Socioeconómica?' : '¿Despublicar Ficha?',
      text: esPublicar
        ? 'La ficha estará visible para el diligenciamiento por parte de los estudiantes.'
        : 'La ficha volverá a estado borrador y los estudiantes no podrán acceder a ella.',
      icon: 'warning',
      showCancelButton: true,
      buttonsStyling: false,
      confirmButtonText: esPublicar 
        ? '<i class="fas fa-check" aria-hidden="true"></i> <span>Sí, publicar</span>' 
        : '<i class="fas fa-eye-slash" aria-hidden="true"></i> <span>Sí, despublicar</span>',
      cancelButtonText: '<span>Cancelar</span>',
      customClass: { 
        popup: 'custom-swal-popup', 
        confirmButton: esPublicar ? 'custom-swal-confirm' : 'custom-swal-confirm custom-swal-danger', 
        cancelButton: 'custom-swal-cancel',
        title: 'custom-swal-title'
      }
    }).then((result) => {
      if (result.isConfirmed) {
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
    });
  }

  eliminarFormulario(id: string, e: Event): void {
    e.stopPropagation();
    if (this.isTogglingState()) return;

    Swal.fire({
      title: '¿Eliminar Borrador?',
      text: 'Esta acción eliminará permanentemente la ficha y su configuración.',
      icon: 'error',
      showCancelButton: true,
      buttonsStyling: false,
      confirmButtonText: '<i class="fas fa-trash-alt" aria-hidden="true"></i> <span>Sí, eliminar</span>',
      cancelButtonText: '<span>Cancelar</span>',
      customClass: { 
        popup: 'custom-swal-popup', 
        confirmButton: 'custom-swal-confirm custom-swal-danger', 
        cancelButton: 'custom-swal-cancel',
        title: 'custom-swal-title'
      }
    }).then((result) => {
      if (result.isConfirmed) {
        this.isTogglingState.set(true);
        this.formularioService.deleteFormulario(id)
          .pipe(finalize(() => this.isTogglingState.set(false)))
          .subscribe({
            next: () => {
              this.toastService.show('Formulario borrador eliminado.', 'info');
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
    });
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  private extraerMensajeError(err: HttpErrorResponse, fallback: string): string {
    const msg = err?.error?.message;
    if (!msg) return fallback;
    return Array.isArray(msg) ? msg.join(', ') : msg;
  }
}