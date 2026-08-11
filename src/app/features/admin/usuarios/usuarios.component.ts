import { Component, OnInit, inject, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { forkJoin, finalize } from 'rxjs';
import Swal from 'sweetalert2';

import { Usuario } from '../../../core/models/usuario.model';
import { Carrera } from '../../../core/models/carrera.model';
import { CoordinadorCarreraAsignacion } from '../../../core/models/coordinador-carrera.model';
import { UsuarioService } from '../../../core/services/usuario.service';
import { CarreraService } from '../../../core/services/carrera.service';
import { CoordinadorCarreraService } from '../../../core/services/coordinador-carrera.service';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-usuarios',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './usuarios.component.html',
  styleUrls: ['./usuarios.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class UsuariosComponent implements OnInit {
  private readonly usuarioService = inject(UsuarioService);
  private readonly carreraService = inject(CarreraService);
  private readonly coordinadorCarreraService = inject(CoordinadorCarreraService);
  private readonly toastService = inject(ToastService);

  // Estados Base
  readonly usuarios = signal<Usuario[]>([]);
  readonly carreras = signal<Carrera[]>([]);
  readonly asignaciones = signal<CoordinadorCarreraAsignacion[]>([]);
  readonly isLoading = signal<boolean>(true);
  readonly isSaving = signal<boolean>(false);

  // Filtros
  readonly searchTerm = signal<string>('');
  readonly filtroEstado = signal<'ACTIVOS' | 'INACTIVOS' | 'TODOS'>('ACTIVOS');

  // Constante de estilos premium para SweetAlert
  private readonly SWAL_CUSTOM_CLASS = {
    popup: 'rounded-2xl',
    confirmButton: 'rounded-xl',
    cancelButton: 'rounded-xl',
    htmlContainer: 'text-left'
  };

  // Coordinadores de carrera elegibles (Muestra Coordinadores y Admins)
  readonly coordinadoresCarreraList = computed(() => {
    return this.usuarios().filter(u => {
      const rol = u.rol?.nombre || '';
      // Si quieres que salgan todos los que sean coordinadores o admin
      return (rol.includes('COORDINADOR') || rol === 'ADMIN') && !u.fecha_desactivacion;
    });
  });

  // Filtro Reactivo Computado
  readonly usuariosFiltrados = computed(() => {
    const term = this.searchTerm().toLowerCase().trim();
    const estado = this.filtroEstado();

    return this.usuarios().filter(u => {
      const estaInactivo = !!u.fecha_desactivacion;
      if (estado === 'ACTIVOS' && estaInactivo) return false;
      if (estado === 'INACTIVOS' && !estaInactivo) return false;

      if (!term) return true;
      return (u.email_institucional && u.email_institucional.toLowerCase().includes(term)) ||
             (u.primer_nombre && u.primer_nombre.toLowerCase().includes(term)) ||
             (u.primer_apellido && u.primer_apellido.toLowerCase().includes(term)) ||
             (u.cedula && u.cedula.includes(term));
    });
  });

  ngOnInit(): void {
    this.cargarTodo();
  }

  onSearchChange(event: Event): void {
    this.searchTerm.set((event.target as HTMLInputElement).value);
  }

  onEstadoChange(event: Event): void {
    this.filtroEstado.set((event.target as HTMLSelectElement).value as 'ACTIVOS' | 'INACTIVOS' | 'TODOS');
  }

  cargarTodo(): void {
    this.isLoading.set(true);

    forkJoin({
      carreras: this.carreraService.getCarreras(),
      asignaciones: this.coordinadorCarreraService.getAsignaciones(),
      usuarios: this.usuarioService.getUsuarios()
    })
    .pipe(finalize(() => this.isLoading.set(false)))
    .subscribe({
      next: ({ carreras, asignaciones, usuarios }) => {
        this.carreras.set(carreras || []);
        this.asignaciones.set(asignaciones || []);
        this.usuarios.set(usuarios || []);
      },
      error: (err: HttpErrorResponse) => {
        console.error('Error al cargar datos:', err);
        this.toastService.show('Error al obtener los datos de usuarios y coordinaciones.', 'error');
      }
    });
  }

  getCarreraNombreDeAsignacion(usuarioId: string): string {
    const match = this.asignaciones().find(a => a.usuario_id === usuarioId);
    return match ? (match.carrera?.nombre || 'Carrera Asignada') : 'Sin Carrera';
  }

  // ==========================================
  // ASIGNACIONES CON SWEETALERT
  // ==========================================
  abrirModalAsignar(): void {
    const opcionesUsuarios = this.coordinadoresCarreraList()
      .map(u => `<option value="${u.id}">${u.primer_nombre} ${u.primer_apellido} (${u.email_institucional})</option>`)
      .join('');
      
    const opcionesCarreras = this.carreras()
      .map(c => `<option value="${c.id}">${c.nombre}</option>`)
      .join('');
      
    const hoy = new Date().toISOString().split('T')[0];

    Swal.fire({
      title: 'Asignar Coordinador a Carrera',
      html: `
        <div style="display:flex; flex-direction:column; gap:1rem; text-align:left;">
          <div>
            <label style="display:block;font-size:0.75rem;font-weight:600;color:#334155;margin-bottom:0.35rem">Seleccionar Usuario Coordinador *</label>
            <select id="swal-asig-user" class="swal2-select" style="margin:0;width:100%;box-sizing:border-box">
              <option value="">-- Seleccione Usuario --</option>
              ${opcionesUsuarios}
            </select>
          </div>
          <div>
            <label style="display:block;font-size:0.75rem;font-weight:600;color:#334155;margin-bottom:0.35rem">Seleccionar Carrera *</label>
            <select id="swal-asig-carrera" class="swal2-select" style="margin:0;width:100%;box-sizing:border-box">
              <option value="">-- Seleccione Carrera --</option>
              ${opcionesCarreras}
            </select>
          </div>
          <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1rem;">
            <div>
              <label style="display:block;font-size:0.75rem;font-weight:600;color:#334155;margin-bottom:0.35rem">Fecha Inicio *</label>
              <input id="swal-asig-inicio" type="date" class="swal2-input" value="${hoy}" style="margin:0;width:100%;box-sizing:border-box">
            </div>
            <div>
              <label style="display:block;font-size:0.75rem;font-weight:600;color:#334155;margin-bottom:0.35rem">Fecha Fin (Opcional)</label>
              <input id="swal-asig-fin" type="date" class="swal2-input" style="margin:0;width:100%;box-sizing:border-box">
            </div>
          </div>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: 'Guardar Asignación',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#10b981',
      cancelButtonColor: '#64748b',
      width: '550px',
      customClass: this.SWAL_CUSTOM_CLASS,
      preConfirm: () => {
        const usuario_id = (document.getElementById('swal-asig-user') as HTMLSelectElement).value;
        const carrera_id = (document.getElementById('swal-asig-carrera') as HTMLSelectElement).value;
        const fecha_inicio = (document.getElementById('swal-asig-inicio') as HTMLInputElement).value;
        const fecha_fin = (document.getElementById('swal-asig-fin') as HTMLInputElement).value;

        if (!usuario_id || !carrera_id || !fecha_inicio) {
          Swal.showValidationMessage('Por favor completa todos los campos obligatorios (*)');
          return false;
        }
        return { usuario_id, carrera_id, fecha_inicio, fecha_fin };
      }
    }).then((result) => {
      if (result.isConfirmed && result.value) {
        this.guardarAsignacion(result.value);
      }
    });
  }

  private guardarAsignacion(data: any): void {
    this.isSaving.set(true);
    this.coordinadorCarreraService.asignarCoordinador(data)
      .pipe(finalize(() => this.isSaving.set(false)))
      .subscribe({
        next: () => {
          this.toastService.show('Coordinador asignado a la carrera con éxito.', 'success');
          this.cargarTodo();
        },
        error: (err: HttpErrorResponse) => {
          this.toastService.show(this.extraerMensajeError(err, 'Error al asignar coordinador.'), 'error');
        }
      });
  }

  desasignar(usuarioId: string, carreraId: string): void {
    Swal.fire({
      title: '¿Remover asignación?',
      text: 'El usuario dejará de ser coordinador de esta carrera.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Sí, remover',
      cancelButtonText: 'Cancelar',
      customClass: this.SWAL_CUSTOM_CLASS
    }).then((result) => {
      if (result.isConfirmed) {
        this.coordinadorCarreraService.desasignarCoordinador(usuarioId, carreraId).subscribe({
          next: () => {
            this.toastService.show('Asignación removida con éxito.', 'info');
            this.cargarTodo();
          },
          error: (err: HttpErrorResponse) => {
            this.toastService.show(this.extraerMensajeError(err, 'Error al eliminar la asignación.'), 'error');
          }
        });
      }
    });
  }

  // ==========================================
  // EDICIÓN TOTAL DE USUARIOS CON SWEETALERT
  // ==========================================
  abrirModalEditar(usuario: Usuario): void {
    // Extraemos inteligentemente los roles y sus IDs de los usuarios ya cargados
    const rolesMap = new Map<string, string>();
    this.usuarios().forEach(u => {
      if (u.rol?.id && u.rol?.nombre) {
        rolesMap.set(u.rol.nombre, u.rol.id);
      }
    });

    const opcionesRoles = Array.from(rolesMap.entries())
      .map(([nombre, id]) => `<option value="${id}" ${usuario.rol?.id === id ? 'selected' : ''}>${nombre}</option>`)
      .join('');

    Swal.fire({
      title: 'Editar Usuario (Modo Admin)',
      html: `
        <div style="display:flex; flex-direction:column; gap:1rem; text-align:left;">
          <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1rem;">
            <div>
              <label style="display:block;font-size:0.75rem;font-weight:600;color:#334155;margin-bottom:0.35rem">Primer Nombre *</label>
              <input id="swal-edit-nombre" class="swal2-input" value="${usuario.primer_nombre || ''}" style="margin:0;width:100%;box-sizing:border-box">
            </div>
            <div>
              <label style="display:block;font-size:0.75rem;font-weight:600;color:#334155;margin-bottom:0.35rem">Primer Apellido *</label>
              <input id="swal-edit-apellido" class="swal2-input" value="${usuario.primer_apellido || ''}" style="margin:0;width:100%;box-sizing:border-box">
            </div>
          </div>
          <div>
            <label style="display:block;font-size:0.75rem;font-weight:600;color:#334155;margin-bottom:0.35rem">Correo Institucional *</label>
            <input id="swal-edit-correo" type="email" class="swal2-input" value="${usuario.email_institucional || ''}" style="margin:0;width:100%;box-sizing:border-box">
          </div>
          <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1rem;">
            <div>
              <label style="display:block;font-size:0.75rem;font-weight:600;color:#334155;margin-bottom:0.35rem">Cédula</label>
              <input id="swal-edit-cedula" class="swal2-input" value="${usuario.cedula || ''}" style="margin:0;width:100%;box-sizing:border-box">
            </div>
            <div>
              <label style="display:block;font-size:0.75rem;font-weight:600;color:#e11d48;margin-bottom:0.35rem">Privilegios (Rol) ⚠️</label>
              <select id="swal-edit-rol" class="swal2-select" style="margin:0;width:100%;box-sizing:border-box;border-color:#fca5a5;">
                <option value="">-- Mantener Rol Actual --</option>
                ${opcionesRoles}
              </select>
            </div>
          </div>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: 'Actualizar Usuario',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#8b5cf6',
      cancelButtonColor: '#64748b',
      width: '550px',
      customClass: this.SWAL_CUSTOM_CLASS,
      preConfirm: () => {
        const primer_nombre = (document.getElementById('swal-edit-nombre') as HTMLInputElement).value.trim();
        const primer_apellido = (document.getElementById('swal-edit-apellido') as HTMLInputElement).value.trim();
        const email_institucional = (document.getElementById('swal-edit-correo') as HTMLInputElement).value.trim();
        const cedula = (document.getElementById('swal-edit-cedula') as HTMLInputElement).value.trim();
        const rol_id = (document.getElementById('swal-edit-rol') as HTMLSelectElement).value;

        if (!primer_nombre || !primer_apellido || !email_institucional) {
          Swal.showValidationMessage('Nombre, Apellido y Correo son obligatorios.');
          return false;
        }
        return { primer_nombre, primer_apellido, email_institucional, cedula, rol_id };
      }
    }).then((result) => {
      if (result.isConfirmed && result.value) {
        this.guardarEdicion(usuario.id, result.value);
      }
    });
  }

  private guardarEdicion(idUsuario: string, data: any): void {
    this.isSaving.set(true);

    // Formateamos los datos para enviarlos al backend de manera segura
    const payload: any = {
      primer_nombre: data.primer_nombre,
      primer_apellido: data.primer_apellido,
      email_institucional: data.email_institucional,
      cedula: data.cedula ? data.cedula : null, // Evita conflictos enviando null en lugar de string vacío
    };

    // Solo enviamos el UUID del rol si se seleccionó en el SweetAlert
    if (data.rol_id) {
      payload.rol_id = data.rol_id;
    }

    this.usuarioService.update(idUsuario, payload)
      .pipe(finalize(() => this.isSaving.set(false)))
      .subscribe({
        next: () => {
          this.toastService.show('Usuario y privilegios actualizados con éxito.', 'success');
          this.cargarTodo();
        },
        error: (err: HttpErrorResponse) => {
          this.toastService.show(this.extraerMensajeError(err, 'Error al actualizar el usuario.'), 'error');
        }
      });
  }

  eliminarUsuario(id: string): void {
    Swal.fire({
      title: '¿Desactivar usuario?',
      text: 'Esta acción limitará su acceso al sistema. ¿Deseas continuar?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Sí, desactivar',
      cancelButtonText: 'Cancelar',
      customClass: this.SWAL_CUSTOM_CLASS
    }).then((result) => {
      if (result.isConfirmed) {
        this.usuarioService.delete(id).subscribe({
          next: () => {
            this.toastService.show('Usuario desactivado con éxito.', 'info');
            this.cargarTodo();
          },
          error: (err: HttpErrorResponse) => {
            this.toastService.show(this.extraerMensajeError(err, 'Error al desactivar el usuario.'), 'error');
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