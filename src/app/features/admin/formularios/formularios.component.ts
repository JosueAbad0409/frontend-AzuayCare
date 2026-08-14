import { Component, inject, signal, computed, ChangeDetectionStrategy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { forkJoin, finalize } from 'rxjs';
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
  readonly isEditMode = signal<boolean>(false);
  readonly selectedFormularioId = signal<string | null>(null);

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

  constructor() {
    this.cargarDatos();
  }

  // ==========================================
  // FILTROS
  // ==========================================
  
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

  // ==========================================
  // CREACIÓN Y EDICIÓN CON SWEETALERT
  // ==========================================

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
        <div style="text-align:left; display:flex; flex-direction:column; gap:1rem;">
          <div>
            <label style="display:block;font-size:0.75rem;font-weight:600;margin-bottom:0.35rem;color:#334155">Título de la Ficha *</label>
            <input id="swal-titulo" class="swal2-input" placeholder="Ej. Ficha Socioeconómica ISTA 2026"
              value="${esEdicion && form ? this.escapeHtml(form.titulo) : ''}"
              style="margin:0;width:100%;box-sizing:border-box">
          </div>
          <div>
            <label style="display:block;font-size:0.75rem;font-weight:600;margin-bottom:0.35rem;color:#334155">Periodo Académico *</label>
            <select id="swal-periodo" class="swal2-select" style="margin:0;width:100%;box-sizing:border-box">
              <option value="">-- Selecciona un Periodo --</option>
              ${opcionesPeriodo}
            </select>
          </div>
          <div>
            <label style="display:block;font-size:0.75rem;font-weight:600;margin-bottom:0.35rem;color:#334155">Tipo de Formulario *</label>
            <select id="swal-tipo" class="swal2-select" style="margin:0;width:100%;box-sizing:border-box"
              ${esEdicion ? 'disabled' : ''}>
              <option value="">-- Selecciona un Tipo de Formulario --</option>
              ${opcionesTipo}
            </select>
          </div>
          <div>
            <label style="display:block;font-size:0.75rem;font-weight:600;margin-bottom:0.35rem;color:#334155">Descripción / Objetivo</label>
            <textarea id="swal-desc" class="swal2-textarea" rows="2" placeholder="Instrucciones generales..."
              style="margin:0;width:100%;box-sizing:border-box">${esEdicion && form ? this.escapeHtml(form.descripcion || '') : ''}</textarea>
          </div>
        </div>
      `,
      showCancelButton: true,
      focusConfirm: false,
      confirmButtonText: esEdicion ? 'Actualizar' : 'Crear y Diseñar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#8b5cf6',
      cancelButtonColor: '#64748b',
      width: '520px',
      customClass: { popup: 'rounded-2xl', confirmButton: 'rounded-xl', cancelButton: 'rounded-xl' },
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

  // ==========================================
  // CLONACIÓN CON SWEETALERT
  // ==========================================

  abrirModalClonar(formId: string, e: Event): void {
    e.stopPropagation();
    const periodoActivo = this.periodos().find(p => p.activo);
    const opcionesPeriodo = this.periodos()
      .map(p => `<option value="${p.id}" ${periodoActivo?.id === p.id ? 'selected' : ''}>${p.nombre}${p.activo ? ' (ACTIVO)' : ''}</option>`)
      .join('');

    Swal.fire({
      title: 'Clonar Formulario',
      html: `
        <div style="text-align:left; display:flex; flex-direction:column; gap:1rem;">
          <p style="margin:0; font-size:0.85rem; color:#64748b;">Selecciona el periodo destino para la nueva versión de esta ficha.</p>
          <div>
            <label style="display:block;font-size:0.75rem;font-weight:600;margin-bottom:0.35rem;color:#334155">Periodo Destino *</label>
            <select id="swal-clone-periodo" class="swal2-select" style="margin:0;width:100%;box-sizing:border-box">
              <option value="">-- Selecciona un Periodo --</option>
              ${opcionesPeriodo}
            </select>
          </div>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: 'Clonar Ficha',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#3b82f6',
      cancelButtonColor: '#64748b',
      width: '450px',
      customClass: { popup: 'rounded-2xl', confirmButton: 'rounded-xl', cancelButton: 'rounded-xl' },
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

  // ==========================================
  // PUBLICAR / ELIMINAR CON SWEETALERT
  // ==========================================

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
      confirmButtonColor: esPublicar ? '#10b981' : '#f59e0b',
      cancelButtonColor: '#64748b',
      confirmButtonText: esPublicar ? 'Sí, publicar' : 'Sí, despublicar',
      cancelButtonText: 'Cancelar',
      customClass: { popup: 'rounded-2xl', confirmButton: 'rounded-xl', cancelButton: 'rounded-xl' }
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

    Swal.fire({
      title: '¿Eliminar borrador?',
      text: 'Esta acción no se puede deshacer.',
      icon: 'error',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
      customClass: { popup: 'rounded-2xl', confirmButton: 'rounded-xl', cancelButton: 'rounded-xl' }
    }).then((result) => {
      if (result.isConfirmed) {
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
    });
  }

  // ==========================================
  // UTILERÍAS
  // ==========================================

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