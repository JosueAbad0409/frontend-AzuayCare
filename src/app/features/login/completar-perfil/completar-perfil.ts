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
import { cedulaEcuatorianaValidator } from '../../../core/validators/cedula.validator';

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
  private carreraSeleccionada = signal<string>('');

  nombreCompleto = computed(() => this.authService.user()?.nombre ?? 'Estudiante');
  correo = computed(() => this.authService.user()?.email ?? '');

  // Declaración inicial sin requerimientos en carrera y ciclo por defecto
  perfilForm: FormGroup = this.fb.group({
    cedula: ['', [Validators.required, cedulaEcuatorianaValidator()]],
    carrera_id: [''],
    ciclo_id: [{ value: '', disabled: true }],
  });

  ciclosDisponibles = computed(() => {
    const carreraId = this.carreraSeleccionada();
    if (!carreraId) return [];
    return this.todosLosCiclos().filter((ciclo) => ciclo.carrera_id === carreraId);
  });

  ngOnInit(): void {
    if (this.authService.perfilCompleto()) {
      this.router.navigate(['/estudiante/inicio']);
      return;
    }

    // Si el usuario es de rol ESTUDIANTE, exigimos de forma obligatoria carrera y ciclo
    if (this.authService.user()?.rol === 'ESTUDIANTE') {
      this.perfilForm.get('carrera_id')!.setValidators([Validators.required]);
      this.perfilForm.get('ciclo_id')!.setValidators([Validators.required]);
      this.perfilForm.get('carrera_id')!.updateValueAndValidity();
      this.perfilForm.get('ciclo_id')!.updateValueAndValidity();
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

    // Filtramos los campos opcionales para evitar enviar strings vacíos al backend
    const payload: { cedula: string; carrera_id?: string; ciclo_id?: string } = { cedula };
    if (carrera_id) payload.carrera_id = carrera_id;
    if (ciclo_id) payload.ciclo_id = ciclo_id;

    this.usuarioService.completarPerfil(payload).subscribe({
      next: () => {
        this.authService.marcarPerfilCompleto(payload);
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