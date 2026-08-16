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

  readonly hayFiltrosActivos = computed(() => {
    return this.searchTerm() !== '' || 
           this.filtroTipo() !== 'TODOS' || 
           this.filtroVersion() !== 'TODOS' || 
           this.filtroEstado() !== 'TODOS';
  });

  ngOnInit(): void {
    this.searchSubject.pipe(
      debounceTime(400),
      distinctUntilChanged(),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(term => {
      this.searchTerm.set(term);
    });

    this.cargarDatos();
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

  limpiarFiltros(): void {
    this.searchTerm.set('');
    this.filtroTipo.set('TODOS');
    this.filtroVersion.set('TODOS');
    this.filtroEstado.set('TODOS');
    this.searchSubject.next('');
    
    const searchInput = document.getElementById('search-title-input') as HTMLInputElement;
    if (searchInput) searchInput.value = '';
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
        this.toastService.show(this.extraerMensajeError(err, 'Error al cargar los datos iniciales.'), 'error');
      }
    });
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
      }>${p.nombre}${p.activo ? ' (ACTIVO)' : ''}</option>`)
      .join('');

    const opcionesTipo = this.tiposFormulario()
      .map(t => `<option value="${t.id}" ${esEdicion && form?.tipo_formulario_id === t.id ? 'selected' : ''}>${t.nombre}</option>`)
      .join('');

    Swal.fire({
      title: esEdicion ? 'Editar Ficha' : 'Nueva Ficha Socioeconómica',
      html: `
        <div class="swal-form-card">
          <div style="text-align:left; display:flex; flex-direction:column; gap:1.25rem; padding-top:0.5rem;">
            <div>
              <label class="swal-form-label">Título de la Ficha *</label>
              <input id="swal-titulo" class="swal2-input custom-input" placeholder="Ej. Ficha Socioeconómica ISTA 2026"
                value="${esEdicion && form ? this.escapeHtml(form.titulo) : ''}"
                style="margin:0;width:100%;box-sizing:border-box">
            </div>
            <div>
              <label class="swal-form-label">Periodo Académico *</label>
              <select id="swal-periodo" class="swal2-select custom-select" style="margin:0;width:100%;box-sizing:border-box">
                <option value="">-- Selecciona un Periodo --</option>
                ${opcionesPeriodo}
              </select>
            </div>
            <div>
              <label class="swal-form-label">Tipo de Formulario *</label>
              <select id="swal-tipo" class="swal2-select custom-select" style="margin:0;width:100%;box-sizing:border-box"
                ${esEdicion ? 'disabled' : ''}>
                <option value="">-- Selecciona un Tipo de Formulario --</option>
                ${opcionesTipo}
              </select>
            </div>
            <div>
              <label class="swal-form-label">Descripción / Objetivo</label>
              <textarea id="swal-desc" class="swal2-textarea custom-textarea" rows="2" placeholder="Instrucciones generales..."
                style="margin:0;width:100%;box-sizing:border-box">${esEdicion && form ? this.escapeHtml(form.descripcion || '') : ''}</textarea>
            </div>
          </div>
        </div>
      `,
      showCancelButton: true,
      focusConfirm: false,
      confirmButtonText: esEdicion ? '<i class="fas fa-save"></i> Actualizar' : '<i class="fas fa-magic"></i> Crear y Diseñar',
      cancelButtonText: '<i class="fas fa-times"></i> Cancelar',
      width: '560px',
      customClass: { 
        popup: 'custom-swal-popup', 
        confirmButton: 'custom-swal-confirm', 
        cancelButton: 'custom-swal-cancel',
        title: 'custom-swal-title'
      },
      didOpen: () => { (document.getElementById('swal-titulo') as HTMLInputElement | null)?.focus(); },
      preConfirm: () => {
        const titulo = (document.getElementById('swal-titulo') as HTMLInputElement)?.value?.trim() || '';
        const periodo_id = (document.getElementById('swal-periodo') as HTMLSelectElement)?.value || '';
        const tipo_formulario_id = (document.getElementById('swal-tipo') as HTMLSelectElement)?.value || '';
        const descripcion = (document.getElementById('swal-desc') as HTMLTextAreaElement)?.value?.trim() || '';

        if (!titulo) { Swal.showValidationMessage('El título es obligatorio'); return false; }
        if (!periodo_id) { Swal.showValidationMessage('Selecciona un periodo académico'); return false; }
        if (!tipo_formulario_id) { Swal.showValidationMessage('Selecciona un tipo de formulario'); return false; }
        return { titulo, periodo_id, tipo_formulario_id, descripcion };
      }
    }).then((result) => {
      if (result.isConfirmed && result.value) {
        this.guardarFichaDesdeSwal(result.value);
      }
    });
  }

  private guardarFichaDesdeSwal(data: { titulo: string; periodo_id: string; tipo_formulario_id: string; descripcion: string; }): void {
    if(this.isSaving()) return;
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
          this.toastService.show('Formulario borrador creado con éxito.', 'success');
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
      .map(p => `<option value="${p.id}" ${periodoActivo?.id === p.id ? 'selected' : ''}>${p.nombre}${p.activo ? ' (ACTIVO)' : ''}</option>`)
      .join('');

    Swal.fire({
      title: 'Clonar Formulario',
      html: `
        <div class="swal-form-card">
          <div style="text-align:left; display:flex; flex-direction:column; gap:1rem; padding-top:0.5rem;">
            <p style="margin:0; font-size:0.85rem; color:#64748b;">Selecciona el periodo destino para la nueva versión de esta ficha.</p>
            <div>
              <label class="swal-form-label">Periodo Destino *</label>
              <select id="swal-clone-periodo" class="swal2-select custom-select" style="margin:0;width:100%;box-sizing:border-box">
                <option value="">-- Selecciona un Periodo --</option>
                ${opcionesPeriodo}
              </select>
            </div>
          </div>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: '<i class="fas fa-copy"></i> Clonar Ficha',
      cancelButtonText: '<i class="fas fa-times"></i> Cancelar',
      width: '500px',
      customClass: { 
        popup: 'custom-swal-popup', 
        confirmButton: 'custom-swal-confirm', 
        cancelButton: 'custom-swal-cancel',
        title: 'custom-swal-title'
      },
      preConfirm: () => {
        const periodo_destino_id = (document.getElementById('swal-clone-periodo') as HTMLSelectElement)?.value || '';
        if (!periodo_destino_id) {
          Swal.showValidationMessage('Selecciona un periodo destino');
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
    if(this.isCloning()) return;
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
      title: esPublicar ? '¿Publicar ficha?' : '¿Despublicar ficha?',
      text: esPublicar
        ? 'Los estudiantes podrán empezar a completarla.'
        : 'Volverá a estado borrador y los estudiantes no podrán verla.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: esPublicar ? '<i class="fas fa-check"></i> Sí, publicar' : '<i class="fas fa-eye-slash"></i> Sí, despublicar',
      cancelButtonText: '<i class="fas fa-times"></i> Cancelar',
      customClass: { 
        popup: 'custom-swal-popup', 
        confirmButton: esPublicar ? 'custom-swal-confirm-success' : 'custom-swal-confirm-warning', 
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
      title: '¿Eliminar borrador?',
      text: 'Esta acción no se puede deshacer.',
      icon: 'error',
      showCancelButton: true,
      confirmButtonText: '<i class="fas fa-trash-alt"></i> Sí, eliminar',
      cancelButtonText: '<i class="fas fa-times"></i> Cancelar',
      customClass: { 
        popup: 'custom-swal-popup', 
        confirmButton: 'custom-swal-confirm-danger', 
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
    });
  }

  getNombreTipoFormulario(form: Formulario): string {
    return form.tipoFormulario?.nombre
      || this.tiposFormulario().find(t => t.id === form.tipo_formulario_id)?.nombre
      || 'Sin tipo';
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