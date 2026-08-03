import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
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
  styleUrls: ['./usuarios.component.css']
})
export class UsuariosComponent implements OnInit {
  private readonly usuarioService = inject(UsuarioService);
  private readonly carreraService = inject(CarreraService);
  private readonly coordinadorCarreraService = inject(CoordinadorCarreraService);
  private readonly toastService = inject(ToastService);
  private readonly fb = inject(FormBuilder);

  usuarios = signal<Usuario[]>([]);
  carreras = signal<Carrera[]>([]);
  asignaciones = signal<CoordinadorCarreraAsignacion[]>([]);
  isLoading = signal<boolean>(true);
  searchTerm = signal<string>('');
  filtroEstado = signal<'ACTIVOS' | 'INACTIVOS' | 'TODOS'>('ACTIVOS');

  // Modal Asignación
  showModalAsignar = signal<boolean>(false);

  asignacionForm: FormGroup = this.fb.group({
    usuario_id: ['', Validators.required],
    carrera_id: ['', Validators.required],
    fecha_inicio: [new Date().toISOString().split('T')[0], Validators.required],
    fecha_fin: ['']
  });

  // Modal Edición de Usuario
  showModalEditar = signal<boolean>(false);

  editarForm: FormGroup = this.fb.group({
    id: [''],
    primer_nombre: ['', Validators.required],
    primer_apellido: ['', Validators.required],
    cedula: [''],
    email_institucional: ['', [Validators.required, Validators.email]],
    rol_nombre: [{ value: '', disabled: true }]
  });

  abrirModalEditar(usuario: Usuario) {
    // Usamos el operador OR (||) para evitar que el valor llegue como nulo o indefinido
    this.editarForm.patchValue({
      id: usuario.id,
      primer_nombre: usuario.primer_nombre,
      primer_apellido: usuario.primer_apellido,
      cedula: usuario.cedula || '',
      email_institucional: usuario.email_institucional || '',
      rol_nombre: usuario.rol?.nombre || ''
    });
    this.showModalEditar.set(true);
  }

  // Filtrado exclusivo de coordinadores de carrera elegibles
  coordinadoresCarreraList = computed(() => {
    return this.usuarios().filter(u => u.rol?.nombre === 'COORDINADOR_CARRERA');
  });

  usuariosFiltrados = computed(() => {
    const term = this.searchTerm().toLowerCase().trim();
    const estado = this.filtroEstado();

    return this.usuarios().filter(u => {
      // 1. Validar Filtro de Estado
      const estaInactivo = !!u.fecha_desactivacion;
      if (estado === 'ACTIVOS' && estaInactivo) return false;
      if (estado === 'INACTIVOS' && !estaInactivo) return false;

      // 2. Validar Búsqueda de Texto
      if (!term) return true;
      return u.email_institucional.toLowerCase().includes(term) ||
        u.primer_nombre.toLowerCase().includes(term) ||
        u.primer_apellido.toLowerCase().includes(term);
    });
  });

  onEstadoChange(event: Event) {
    const value = (event.target as HTMLSelectElement).value as any;
    this.filtroEstado.set(value);
  }

  ngOnInit() {
    this.cargarTodo();
  }

  cargarTodo() {
    this.isLoading.set(true);

    this.carreraService.getCarreras().subscribe({
      next: (carrs) => this.carreras.set(carrs),
      error: (err) => console.error('Error al cargar carreras:', err)
    });

    this.coordinadorCarreraService.getAsignaciones().subscribe({
      next: (asigs) => this.asignaciones.set(asigs),
      error: (err) => console.error('Error al cargar asignaciones:', err)
    });

    this.usuarioService.getUsuarios().subscribe({
      next: (data) => {
        this.usuarios.set(data);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Error al cargar usuarios:', err);
        this.isLoading.set(false);
      }
    });
  }

  onSearchChange(event: Event) {
    const value = (event.target as HTMLInputElement).value;
    this.searchTerm.set(value);
  }

  abrirModalAsignar() {
    this.asignacionForm.reset({
      usuario_id: '',
      carrera_id: '',
      fecha_inicio: new Date().toISOString().split('T')[0],
      fecha_fin: ''
    });
    this.showModalAsignar.set(true);
  }

  guardarAsignacion() {
    if (this.asignacionForm.invalid) {
      this.asignacionForm.markAllAsTouched();
      return;
    }

    this.coordinadorCarreraService.asignarCoordinador(this.asignacionForm.value).subscribe({
      next: () => {
        this.toastService.show('Coordinador asignado a la carrera con éxito.', 'success');
        this.showModalAsignar.set(false);
        this.cargarTodo();
      },
      error: (err) => {
        this.toastService.show(err?.error?.message || 'Error al asignar coordinador.', 'error');
      }
    });
  }

  desasignar(usuarioId: string, carreraId: string) {
    if (confirm('¿Estás seguro de remover esta asignación de coordinación?')) {
      this.coordinadorCarreraService.desasignarCoordinador(usuarioId, carreraId).subscribe({
        next: () => {
          this.toastService.show('Asignación de coordinación removida con éxito.', 'info');
          // Actualización reactiva inmediata
          this.asignaciones.update(lista =>
            lista.filter(a => !(a.usuario_id === usuarioId && (a.carrera_id === carreraId || (a.carrera as any)?.id === carreraId)))
          );

          // Refresco del estado general
          this.cargarTodo();
        },
        error: (err) => {
          this.toastService.show(err?.error?.message || 'Error al eliminar la asignación.', 'error');
        }
      });
    }
  }

  getCarreraNombreDeAsignacion(usuarioId: string): string {
    const match = this.asignaciones().find(a => a.usuario_id === usuarioId);
    return match ? (match.carrera?.nombre || 'Carrera Asignada') : 'Sin Carrera Asignada';
  }

  guardarEdicion() {
    if (this.editarForm.invalid) {
      this.editarForm.markAllAsTouched();
      return;
    }

    const valores = this.editarForm.value;
    const idUsuario = valores.id;
    delete valores.id; // Quitamos el ID del cuerpo para no enviarlo en el payload

    // NOTA: Asegúrate de que el método en tu UsuarioService se llame 'update' o ajústalo a tu nombre real.
    this.usuarioService.update(idUsuario, valores).subscribe({
      next: () => {
        this.toastService.show('Usuario actualizado con éxito.', 'success');
        this.showModalEditar.set(false);
        this.cargarTodo();
      },
      error: (err: any) => {
        this.toastService.show(err?.error?.message || 'Error al actualizar usuario.', 'error');
      }
    });
  }

  eliminarUsuario(id: string) {
    Swal.fire({
      title: '¿Desactivar usuario?',
      text: 'Esta acción limitará su acceso al sistema. ¿Deseas continuar?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#e11d48', // Rojo para acción destructiva
      cancelButtonColor: '#64748b',  // Gris para cancelar
      confirmButtonText: 'Sí, desactivar',
      cancelButtonText: 'Cancelar',
      customClass: {
        popup: 'rounded-2xl',
        confirmButton: 'rounded-xl',
        cancelButton: 'rounded-xl'
      }
    }).then((result) => {
      if (result.isConfirmed) {
        // NOTA: Asegúrate de que el método en tu UsuarioService se llame 'delete' o ajústalo a tu nombre real.
        this.usuarioService.delete(id).subscribe({
          next: () => {
            this.toastService.show('Usuario desactivado con éxito.', 'info');
            this.cargarTodo();
          },
          error: (err: any) => {
            this.toastService.show(err?.error?.message || 'Error al eliminar usuario.', 'error');
          }
        });
      }
    });
  }

}

