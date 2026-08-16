import { Component, OnInit, OnDestroy, inject, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { forkJoin, finalize, Subject, Subscription } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
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
export class UsuariosComponent implements OnInit, OnDestroy {
  private readonly usuarioService = inject(UsuarioService);
  private readonly carreraService = inject(CarreraService);
  private readonly coordinadorCarreraService = inject(CoordinadorCarreraService);
  private readonly toastService = inject(ToastService);

  readonly usuarios = signal<Usuario[]>([]);
  readonly carreras = signal<Carrera[]>([]);
  readonly asignaciones = signal<CoordinadorCarreraAsignacion[]>([]);
  readonly isLoading = signal<boolean>(true);
  readonly isSaving = signal<boolean>(false);

  readonly filterNombre = signal<string>('');
  readonly filterCorreo = signal<string>('');
  readonly filterCedula = signal<string>('');
  readonly filterRol = signal<string>('');
  readonly filterCarrera = signal<string>('');
  readonly filtroEstado = signal<'ACTIVOS' | 'INACTIVOS' | 'TODOS'>('ACTIVOS');

  readonly filterAsigCoord = signal<string>('');
  readonly filterAsigCarrera = signal<string>('');
  readonly filterAsigFecha = signal<string>('');

  private readonly filterSubject = new Subject<{ campo: string; valor: string }>();
  private filterSubscription?: Subscription;

  private readonly SWAL_CUSTOM_CLASS = {
    popup: 'custom-swal-popup custom-swal-wide',
    confirmButton: 'custom-swal-confirm',
    cancelButton: 'custom-swal-cancel',
    htmlContainer: 'custom-swal-html'
  };

  readonly coordinadoresCarreraList = computed(() => {
    return this.usuarios().filter(u => {
      const rol = u.rol?.nombre || '';
      return (rol.includes('COORDINADOR') || rol === 'ADMIN') && !u.fecha_desactivacion;
    });
  });

  readonly rolesDisponibles = computed(() => {
    const set = new Set<string>();
    this.usuarios().forEach(u => {
      if (u.rol?.nombre) set.add(u.rol.nombre);
    });
    return Array.from(set);
  });

  readonly tieneFiltrosActivos = computed(() => {
    return !!(
      this.filterNombre() ||
      this.filterCorreo() ||
      this.filterCedula() ||
      this.filterRol() ||
      this.filterCarrera() ||
      this.filtroEstado() !== 'ACTIVOS' ||
      this.filterAsigCoord() ||
      this.filterAsigCarrera() ||
      this.filterAsigFecha()
    );
  });

  readonly usuariosFiltrados = computed(() => {
    const fNombre = this.filterNombre().toLowerCase().trim();
    const fCorreo = this.filterCorreo().toLowerCase().trim();
    const fCedula = this.filterCedula().toLowerCase().trim();
    const fRol = this.filterRol();
    const fCarrera = this.filterCarrera().toLowerCase().trim();
    const estado = this.filtroEstado();

    return this.usuarios().filter(u => {
      const estaInactivo = !!u.fecha_desactivacion;
      if (estado === 'ACTIVOS' && estaInactivo) return false;
      if (estado === 'INACTIVOS' && !estaInactivo) return false;

      if (fNombre) {
        const nombreCompleto = `${u.primer_nombre || ''} ${u.primer_apellido || ''}`.toLowerCase();
        if (!nombreCompleto.includes(fNombre)) return false;
      }

      if (fCorreo) {
        if (!u.email_institucional || !u.email_institucional.toLowerCase().includes(fCorreo)) return false;
      }

      if (fCedula) {
        if (!u.cedula || !u.cedula.includes(fCedula)) return false;
      }

      if (fRol) {
        const rolNombre = u.rol?.nombre || 'ESTUDIANTE';
        if (rolNombre !== fRol) return false;
      }

      if (fCarrera) {
        const carreraNombre = this.getCarreraNombreDeAsignacion(u).toLowerCase();
        if (!carreraNombre.includes(fCarrera)) return false;
      }

      return true;
    });
  });

  readonly asignacionesFiltradas = computed(() => {
    const fCoord = this.filterAsigCoord().toLowerCase().trim();
    const fCarr = this.filterAsigCarrera().toLowerCase().trim();
    const fFecha = this.filterAsigFecha().trim();

    return this.asignaciones().filter(a => {
      if (fCoord) {
        const nombreCoord = `${a.usuario?.primer_nombre || ''} ${a.usuario?.primer_apellido || ''}`.toLowerCase();
        if (!nombreCoord.includes(fCoord)) return false;
      }

      if (fCarr) {
        const nombreCarrera = (a.carrera?.nombre || '').toLowerCase();
        if (!nombreCarrera.includes(fCarr)) return false;
      }

      if (fFecha) {
        const fIniStr = a.fecha_inicio ? new Date(a.fecha_inicio).toISOString().substring(0, 10) : '';
        const fFinStr = a.fecha_fin ? new Date(a.fecha_fin).toISOString().substring(0, 10) : '';
        if (fIniStr !== fFecha && fFinStr !== fFecha) return false;
      }

      return true;
    });
  });

  ngOnInit(): void {
    this.filterSubscription = this.filterSubject
      .pipe(debounceTime(400))
      .subscribe(({ campo, valor }) => {
        this.aplicarFiltroSignal(campo, valor);
      });

    this.cargarTodo();
  }

  ngOnDestroy(): void {
    this.filterSubscription?.unsubscribe();
  }

  onColumnFilterInput(campo: string, event: Event): void {
    const valor = (event.target as HTMLInputElement | HTMLSelectElement).value;
    this.filterSubject.next({ campo, valor });
  }

  limpiarFiltros(): void {
    this.filterNombre.set('');
    this.filterCorreo.set('');
    this.filterCedula.set('');
    this.filterRol.set('');
    this.filterCarrera.set('');
    this.filtroEstado.set('ACTIVOS');
    this.filterAsigCoord.set('');
    this.filterAsigCarrera.set('');
    this.filterAsigFecha.set('');
  }

  private aplicarFiltroSignal(campo: string, valor: string): void {
    switch (campo) {
      case 'nombre':
        this.filterNombre.set(valor);
        break;
      case 'correo':
        this.filterCorreo.set(valor);
        break;
      case 'cedula':
        this.filterCedula.set(valor);
        break;
      case 'rol':
        this.filterRol.set(valor);
        break;
      case 'carrera':
        this.filterCarrera.set(valor);
        break;
      case 'estado':
        this.filtroEstado.set(valor as 'ACTIVOS' | 'INACTIVOS' | 'TODOS');
        break;
      case 'asigCoord':
        this.filterAsigCoord.set(valor);
        break;
      case 'asigCarrera':
        this.filterAsigCarrera.set(valor);
        break;
      case 'asigFecha':
        this.filterAsigFecha.set(valor);
        break;
    }
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

  getCarreraNombreDeAsignacion(usuario: Usuario): string {
    if (usuario.carrera?.nombre) {
      return usuario.carrera.nombre;
    }

    const match = this.asignaciones().find(a => 
      a.usuario_id === usuario.id && !a.fecha_fin
    );
    return match ? (match.carrera?.nombre || 'Carrera Asignada') : 'Sin Carrera';
  }

  abrirModalAsignar(): void {
    if (this.isSaving()) return;

    const listaUsuarios = this.coordinadoresCarreraList();
    const listaCarreras = this.carreras();

    const generarUsuariosHTML = (usuarios: Usuario[]) => {
      if (usuarios.length === 0) return `<div class="swal-empty-msg">No se encontraron resultados</div>`;
      return usuarios.map(u => `
        <label class="swal-radio-option">
          <input type="radio" name="swal-asig-user-radio" value="${u.id}">
          <div class="swal-radio-content">
            <span class="item-title">${u.primer_nombre || ''} ${u.primer_apellido || ''}</span>
            <span class="item-subtitle"><i class="fas fa-envelope"></i> ${u.email_institucional || 'N/A'}</span>
          </div>
        </label>
      `).join('');
    };

    const generarCarrerasHTML = (carreras: Carrera[]) => {
      if (carreras.length === 0) return `<div class="swal-empty-msg">No se encontraron resultados</div>`;
      return carreras.map(c => `
        <label class="swal-radio-option">
          <input type="radio" name="swal-asig-carrera-radio" value="${c.id}">
          <div class="swal-radio-content">
            <span class="item-title">${c.nombre}</span>
          </div>
        </label>
      `).join('');
    };

    Swal.fire({
      title: 'Asignar Coordinador a Carrera',
      html: `
        <div class="swal-form-card">
          <div class="swal-header-banner banner-green">
            <i class="fas fa-user-tag banner-icon icon-green"></i>
            <div>
              <div class="banner-title">Asignación Académica Directa</div>
              <div class="banner-sub">Busca y selecciona en paralelo el coordinador y la carrera de destino.</div>
            </div>
          </div>

          <div class="swal-two-columns">
            <div class="swal-field-card">
              <div class="swal-field-header">
                <label class="swal-form-label">1. Coordinador <span class="req">*</span></label>
                <input id="swal-search-user" type="text" class="swal-inline-search" placeholder="🔍 Buscar nombre/correo..." />
              </div>
              <div id="swal-user-list" class="swal-custom-list">
                ${generarUsuariosHTML(listaUsuarios)}
              </div>
            </div>

            <div class="swal-field-card">
              <div class="swal-field-header">
                <label class="swal-form-label">2. Carrera <span class="req">*</span></label>
                <input id="swal-search-carrera" type="text" class="swal-inline-search" placeholder="🔍 Buscar carrera..." />
              </div>
              <div id="swal-carrera-list" class="swal-custom-list">
                ${generarCarrerasHTML(listaCarreras)}
              </div>
            </div>
          </div>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: '<i class="fas fa-check-circle"></i> Guardar Asignación',
      cancelButtonText: '<i class="fas fa-times"></i> Cancelar',
      confirmButtonColor: '#10b981',
      cancelButtonColor: '#64748b',
      width: '820px',
      customClass: this.SWAL_CUSTOM_CLASS,
      didOpen: () => {
        const inputSearchUser = document.getElementById('swal-search-user') as HTMLInputElement;
        const containerUser = document.getElementById('swal-user-list') as HTMLDivElement;
        
        const inputSearchCarrera = document.getElementById('swal-search-carrera') as HTMLInputElement;
        const containerCarrera = document.getElementById('swal-carrera-list') as HTMLDivElement;

        inputSearchUser?.addEventListener('input', () => {
          const query = inputSearchUser.value.toLowerCase().trim();
          const filtrados = listaUsuarios.filter(u => 
            `${u.primer_nombre} ${u.primer_apellido} ${u.email_institucional}`.toLowerCase().includes(query)
          );
          containerUser.innerHTML = generarUsuariosHTML(filtrados);
        });

        inputSearchCarrera?.addEventListener('input', () => {
          const query = inputSearchCarrera.value.toLowerCase().trim();
          const filtrados = listaCarreras.filter(c => 
            c.nombre.toLowerCase().includes(query)
          );
          containerCarrera.innerHTML = generarCarrerasHTML(filtrados);
        });
      },
      preConfirm: () => {
        const userRadio = document.querySelector('input[name="swal-asig-user-radio"]:checked') as HTMLInputElement;
        const carreraRadio = document.querySelector('input[name="swal-asig-carrera-radio"]:checked') as HTMLInputElement;

        if (!userRadio || !carreraRadio) {
          Swal.showValidationMessage('Debes seleccionar un coordinador y una carrera de las listas.');
          return false;
        }
        return { usuario_id: userRadio.value, carrera_id: carreraRadio.value };
      }
    }).then((result) => {
      if (result.isConfirmed && result.value) {
        this.guardarAsignacion(result.value);
      }
    });
  }

  private guardarAsignacion(data: any): void {
    if (this.isSaving()) return;
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
    if (this.isSaving()) return;

    Swal.fire({
      title: '¿Remover asignación?',
      text: 'El usuario dejará de ser coordinador de esta carrera.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#64748b',
      confirmButtonText: '<i class="fas fa-trash-alt"></i> Sí, remover',
      cancelButtonText: '<i class="fas fa-times"></i> Cancelar',
      customClass: this.SWAL_CUSTOM_CLASS
    }).then((result) => {
      if (result.isConfirmed) {
        this.isSaving.set(true);
        this.coordinadorCarreraService.desasignarCoordinador(usuarioId, carreraId)
          .pipe(finalize(() => this.isSaving.set(false)))
          .subscribe({
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

  abrirModalEditar(usuario: Usuario): void {
    if (this.isSaving()) return;

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
        <div class="swal-form-card">
          <div class="swal-header-banner banner-purple">
            <i class="fas fa-user-gear banner-icon icon-purple"></i>
            <div>
              <div class="banner-title">Gestión de Perfil e Identidad</div>
              <div class="banner-sub">Edita la información personal y los permisos del sistema.</div>
            </div>
          </div>

          <div class="swal-form-row">
            <div class="swal-form-group">
              <label class="swal-form-label" for="swal-edit-nombre">Primer Nombre <span class="req">*</span></label>
              <input id="swal-edit-nombre" class="swal-form-control" value="${usuario.primer_nombre || ''}" placeholder="Nombre">
            </div>
            <div class="swal-form-group">
              <label class="swal-form-label" for="swal-edit-apellido">Primer Apellido <span class="req">*</span></label>
              <input id="swal-edit-apellido" class="swal-form-control" value="${usuario.primer_apellido || ''}" placeholder="Apellido">
            </div>
          </div>

          <div class="swal-form-group">
            <label class="swal-form-label" for="swal-edit-correo">Correo Institucional <span class="req">*</span></label>
            <input id="swal-edit-correo" type="email" class="swal-form-control" value="${usuario.email_institucional || ''}" placeholder="correo@domain.edu.ec">
          </div>

          <div class="swal-form-row">
            <div class="swal-form-group">
              <label class="swal-form-label" for="swal-edit-cedula">Cédula de Identidad</label>
              <input id="swal-edit-cedula" class="swal-form-control" value="${usuario.cedula || ''}" placeholder="0101010101">
            </div>
            <div class="swal-form-group">
              <label class="swal-form-label label-purple" for="swal-edit-rol">Privilegios (Rol) ⚠️</label>
              <select id="swal-edit-rol" class="swal-form-control select-purple">
                <option value="">-- Mantener Rol Actual --</option>
                ${opcionesRoles}
              </select>
            </div>
          </div>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: '<i class="fas fa-sync-alt"></i> Actualizar Usuario',
      cancelButtonText: '<i class="fas fa-times"></i> Cancelar',
      confirmButtonColor: '#8b5cf6',
      cancelButtonColor: '#64748b',
      width: '680px',
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
    if (this.isSaving()) return;
    this.isSaving.set(true);

    const payload: any = {
      primer_nombre: data.primer_nombre,
      primer_apellido: data.primer_apellido,
      email_institucional: data.email_institucional,
      cedula: data.cedula ? data.cedula : null
    };

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
    if (this.isSaving()) return;

    Swal.fire({
      title: '¿Desactivar usuario?',
      text: 'Esta acción limitará su acceso al sistema. ¿Deseas continuar?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#64748b',
      confirmButtonText: '<i class="fas fa-user-minus"></i> Sí, desactivar',
      cancelButtonText: '<i class="fas fa-times"></i> Cancelar',
      customClass: this.SWAL_CUSTOM_CLASS
    }).then((result) => {
      if (result.isConfirmed) {
        this.isSaving.set(true);
        this.usuarioService.delete(id)
          .pipe(finalize(() => this.isSaving.set(false)))
          .subscribe({
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