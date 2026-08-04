import { Component, OnInit, inject, signal, computed, ChangeDetectionStrategy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { forkJoin, finalize } from 'rxjs';

import { Usuario } from '../../../core/models/usuario.model';
import { Carrera } from '../../../core/models/carrera.model';
import { CoordinadorCarreraAsignacion } from '../../../core/models/coordinador-carrera.model';
import { UsuarioService } from '../../../core/services/usuario.service';
import { CarreraService } from '../../../core/services/carrera.service';
import { CoordinadorCarreraService } from '../../../core/services/coordinador-carrera.service';
import { ToastService } from '../../../core/services/toast.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-usuarios',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './usuarios.component.html',
  styleUrls: ['./usuarios.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class UsuariosComponent implements OnInit {
  private readonly usuarioService = inject(UsuarioService);
  private readonly carreraService = inject(CarreraService);
  private readonly coordinadorCarreraService = inject(CoordinadorCarreraService);
  private readonly toastService = inject(ToastService);
  private readonly fb = inject(NonNullableFormBuilder);

  // Estados Base
  readonly usuarios = signal<Usuario[]>([]);
  readonly carreras = signal<Carrera[]>([]);
  readonly asignaciones = signal<CoordinadorCarreraAsignacion[]>([]);
  readonly isLoading = signal<boolean>(true);
  readonly isSaving = signal<boolean>(false);

  // Filtros
  readonly searchTerm = signal<string>('');
  readonly filtroEstado = signal<'ACTIVOS' | 'INACTIVOS' | 'TODOS'>('ACTIVOS');

  // Modales
  readonly showModalAsignar = signal<boolean>(false);
  readonly showModalEditar = signal<boolean>(false);

  // Formulario Asignación
  readonly asignacionForm = this.fb.group({
    usuario_id: ['', Validators.required],
    carrera_id: ['', Validators.required],
    fecha_inicio: [new Date().toISOString().split('T')[0], Validators.required],
    fecha_fin: ['']
  });

  // Formulario Edición de Usuario
  readonly editarForm = this.fb.group({
    id: [''],
    primer_nombre: ['', Validators.required],
    primer_apellido: ['', Validators.required],
    cedula: [''],
    email_institucional: ['', [Validators.required, Validators.email]],
    rol_nombre: [{ value: '', disabled: true }]
  });

  // Coordinadores de carrera elegibles
  readonly coordinadoresCarreraList = computed(() => {
    return this.usuarios().filter(u => u.rol?.nombre === 'COORDINADOR_CARRERA' && !u.fecha_desactivacion);
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
      return u.email_institucional.toLowerCase().includes(term) ||
             u.primer_nombre.toLowerCase().includes(term) ||
             u.primer_apellido.toLowerCase().includes(term);
    });
  });

  @HostListener('document:keydown.escape')
  handleEscape(): void {
    this.showModalAsignar.set(false);
    this.showModalEditar.set(false);
  }

  ngOnInit(): void {
    this.cargarTodo();
  }

  onSearchChange(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.searchTerm.set(value);
  }

  onEstadoChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value as 'ACTIVOS' | 'INACTIVOS' | 'TODOS';
    this.filtroEstado.set(value);
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

  abrirModalAsignar(): void {
    this.asignacionForm.reset({
      usuario_id: '',
      carrera_id: '',
      fecha_inicio: new Date().toISOString().split('T')[0],
      fecha_fin: ''
    });
    this.showModalAsignar.set(true);
  }

  abrirModalEditar(usuario: Usuario): void {
    this.editarForm.patchValue({
      id: usuario.id,
      primer_nombre: usuario.primer_nombre,
      primer_apellido: usuario.primer_apellido,
      cedula: usuario.cedula || '',
      email_institucional: usuario.email_institucional || '',
      rol_nombre: usuario.rol?.nombre || 'ESTUDIANTE'
    });
    this.showModalEditar.set(true);
  }

  guardarAsignacion(): void {
    if (this.asignacionForm.invalid) {
      this.asignacionForm.markAllAsTouched();
      return;
    }

    this.isSaving.set(true);
    this.coordinadorCarreraService.asignarCoordinador(this.asignacionForm.getRawValue())
      .pipe(finalize(() => this.isSaving.set(false)))
      .subscribe({
        next: () => {
          this.toastService.show('Coordinador asignado a la carrera con éxito.', 'success');
          this.showModalAsignar.set(false);
          this.cargarTodo();
        },
        error: (err: HttpErrorResponse) => {
          this.toastService.show(this.extraerMensajeError(err, 'Error al asignar coordinador.'), 'error');
        }
      });
  }

  desasignar(usuarioId: string, carreraId: string): void {
    if (confirm('¿Estás seguro de remover esta asignación de coordinación?')) {
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
  }

  getCarreraNombreDeAsignacion(usuarioId: string): string {
    const match = this.asignaciones().find(a => a.usuario_id === usuarioId);
    return match ? (match.carrera?.nombre || 'Carrera Asignada') : 'Sin Carrera';
  }

  guardarEdicion(): void {
    if (this.editarForm.invalid) {
      this.editarForm.markAllAsTouched();
      return;
    }

    this.isSaving.set(true);
    const valores = this.editarForm.getRawValue();
    const idUsuario = valores.id;

    const payload = {
      primer_nombre: valores.primer_nombre,
      primer_apellido: valores.primer_apellido,
      cedula: valores.cedula,
      email_institucional: valores.email_institucional
    };

    this.usuarioService.update(idUsuario, payload)
      .pipe(finalize(() => this.isSaving.set(false)))
      .subscribe({
        next: () => {
          this.toastService.show('Usuario actualizado con éxito.', 'success');
          this.showModalEditar.set(false);
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
      customClass: {
        popup: 'rounded-2xl',
        confirmButton: 'rounded-xl',
        cancelButton: 'rounded-xl'
      }
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