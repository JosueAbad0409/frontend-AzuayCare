import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Usuario } from '../../../core/models/usuario.model';
import { Carrera } from '../../../core/models/carrera.model';
import { CoordinadorCarreraAsignacion } from '../../../core/models/coordinador-carrera.model';
import { UsuarioService } from '../../../core/services/usuario/usuario.service';
import { CarreraService } from '../../../core/services/carrera/carrera.service';
import { CoordinadorCarreraService } from '../../../core/services/coordinador-carrera/coordinador-carrera.service';

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
  private readonly fb = inject(FormBuilder);

  usuarios = signal<Usuario[]>([]);
  carreras = signal<Carrera[]>([]);
  asignaciones = signal<CoordinadorCarreraAsignacion[]>([]);
  isLoading = signal<boolean>(true);
  searchTerm = signal<string>('');
  
  // Modal Asignación
  showModalAsignar = signal<boolean>(false);
  
  asignacionForm: FormGroup = this.fb.group({
    usuario_id: ['', Validators.required],
    carrera_id: ['', Validators.required],
    fecha_inicio: [new Date().toISOString().split('T')[0], Validators.required],
    fecha_fin: ['']
  });

  // Filtrado solo de coordinadores de carrera seleccionables
  coordinadoresCarreraList = computed(() => {
    return this.usuarios().filter(u => u.rol?.nombre === 'COORDINADOR_CARRERA' || u.rol_id);
  });

  usuariosFiltrados = computed(() => {
    const term = this.searchTerm().toLowerCase().trim();
    if (!term) return this.usuarios();
    return this.usuarios().filter(u => 
      u.email_institucional.toLowerCase().includes(term) ||
      u.primer_nombre.toLowerCase().includes(term) ||
      u.primer_apellido.toLowerCase().includes(term)
    );
  });

  ngOnInit() {
    this.cargarTodo();
  }

  cargarTodo() {
    this.isLoading.set(true);

    this.carreraService.getCarreras().subscribe({
      next: (carrs) => this.carreras.set(carrs)
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
      error: () => this.isLoading.set(false)
    });
  }

  onSearchChange(event: Event) {
    const value = (event.target as HTMLInputElement).value;
    this.searchTerm.set(value);
  }

  abrirModalAsignar() {
    this.asignacionForm.reset({
      fecha_inicio: new Date().toISOString().split('T')[0]
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
        alert('Coordinador asignado a la carrera con éxito.');
        this.showModalAsignar.set(false);
        this.cargarTodo();
      },
      error: (err) => alert(err?.error?.message || 'Error al asignar coordinador.')
    });
  }

  desasignar(usuarioId: string, carreraId: string) {
    if (confirm('¿Estás seguro de remover esta asignación de coordinación?')) {
      this.coordinadorCarreraService.desasignarCoordinador(usuarioId, carreraId).subscribe({
        next: () => {
          this.cargarTodo();
        },
        error: (err) => alert(err?.error?.message || 'Error al eliminar la asignación.')
      });
    }
  }

  getCarreraNombreDeAsignacion(usuarioId: string): string {
    const match = this.asignaciones().find(a => a.usuario_id === usuarioId);
    return match ? (match.carrera?.nombre || 'Carrera Asignada') : 'Sin Carrera Asignada';
  }
}