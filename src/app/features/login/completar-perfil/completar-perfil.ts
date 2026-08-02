import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { UsuarioService } from '../../../core/services/usuario.service';
import { CarreraService } from '../../../core/services/carrera.service';
import { CiclosService } from '../../../core/services/ciclos.service';
import { Carrera } from '../../../core/models/carrera.model';
import { Ciclo } from '../../../core/models/ciclo.model';


// Pequeño formulario que aparece justo después de que el estudiante
// inicia sesión con Google por primera vez. Los nombres y apellidos
// ya vienen de Google (solo lectura); el estudiante llena cédula,
// carrera y ciclo para terminar su registro.
@Component({
  selector: 'app-completar-perfil',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './completar-perfil.html',
  styleUrls: ['./completar-perfil.css'],
  host: {
    style: "--bg-image: url('/images/tec-azuay-inicio-sesion.jpg');"
  }
})
export class CompletarPerfilComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  readonly authService = inject(AuthService);
  private readonly usuarioService = inject(UsuarioService);
  private readonly carreraService = inject(CarreraService);
  private readonly ciclosService = inject(CiclosService);
  private readonly router = inject(Router);

  loading = signal<boolean>(false);
  cargandoCatalogos = signal<boolean>(true);
  error = signal<string>('');

  carreras = signal<Carrera[]>([]);
  private todosLosCiclos = signal<Ciclo[]>([]);

  // Signal reflejando la carrera elegida en el <select>. Se actualiza a
  // mano en valueChanges porque un FormControl no es un signal y por eso
  // el computed de abajo no se recalculaba al cambiar de carrera.
  private carreraSeleccionada = signal<string>('');

  nombreCompleto = computed(() => this.authService.user()?.nombre ?? 'Estudiante');
  correo = computed(() => this.authService.user()?.email ?? '');

  perfilForm: FormGroup = this.fb.group({
    cedula: ['', [Validators.required, Validators.pattern(/^[0-9]{10}$/)]],
    carrera_id: ['', Validators.required],
    ciclo_id: [{ value: '', disabled: true }, Validators.required],
  });

  // Ciclos filtrados según la carrera seleccionada en el formulario.
  ciclosDisponibles = computed(() => {
    const carreraId = this.carreraSeleccionada();
    if (!carreraId) return [];
    return this.todosLosCiclos().filter((ciclo) => ciclo.carrera_id === carreraId);
  });

  ngOnInit(): void {
    // Si el estudiante ya completó su registro, no tiene nada que hacer aquí.
    if (this.authService.perfilCompleto()) {
      this.router.navigate(['/estudiante/inicio']);
      return;
    }

    this.cargarCatalogos();

    this.perfilForm.get('carrera_id')!.valueChanges.subscribe((carreraId: string) => {
      this.carreraSeleccionada.set(carreraId ?? '');

      const cicloControl = this.perfilForm.get('ciclo_id')!;
      cicloControl.setValue('');
      if (this.ciclosDisponibles().length > 0) {
        cicloControl.enable();
      } else {
        cicloControl.disable();
      }
    });
  }

  private cargarCatalogos(): void {
    this.cargandoCatalogos.set(true);

    this.carreraService.getCarreras().subscribe({
      next: (carreras) => this.carreras.set(carreras.filter((c) => !c.fecha_desactivacion)),
      error: () => this.error.set('No se pudieron cargar las carreras. Intenta recargar la página.'),
    });

    this.ciclosService.getCiclos().subscribe({
      next: (ciclos) => {
        this.todosLosCiclos.set(ciclos.filter((c) => !c.fecha_desactivacion));
        this.cargandoCatalogos.set(false);
      },
      error: () => {
        this.error.set('No se pudieron cargar los ciclos. Intenta recargar la página.');
        this.cargandoCatalogos.set(false);
      },
    });
  }

  guardar(): void {
    this.error.set('');

    if (this.perfilForm.invalid) {
      this.perfilForm.markAllAsTouched();
      this.error.set('Por favor completa todos los campos correctamente.');
      return;
    }

    this.loading.set(true);
    const { cedula, carrera_id, ciclo_id } = this.perfilForm.getRawValue();

    this.usuarioService.completarPerfil({ cedula, carrera_id, ciclo_id }).subscribe({
      next: () => {
        this.authService.marcarPerfilCompleto({ cedula, carrera_id, ciclo_id });
        this.loading.set(false);
        this.router.navigate(['/estudiante/inicio']);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(
          err?.error?.message ?? 'Ocurrió un error al guardar tus datos. Intenta nuevamente.'
        );
      },
    });
  }
}