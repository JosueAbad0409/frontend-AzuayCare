import { Component, OnInit, inject, signal, computed, DestroyRef, ChangeDetectionStrategy } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';

import { AuthService } from '../../../core/services/auth.service';
import { UsuarioService } from '../../../core/services/usuario.service';
import { CarreraService } from '../../../core/services/carrera.service';
import { CiclosService } from '../../../core/services/ciclos.service';
import { Carrera } from '../../../core/models/carrera.model';
import { Ciclo } from '../../../core/models/ciclo.model';
import { cedulaEcuatorianaValidator } from '../../../core/validators/cedula.validator';

interface PerfilForm {
  cedula: FormControl<string>;
  carrera_id: FormControl<string>;
  ciclo_id: FormControl<string>;
}

@Component({
  selector: 'app-completar-perfil',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './completar-perfil.html',
  styleUrls: ['./completar-perfil.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CompletarPerfilComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  readonly authService = inject(AuthService);
  private readonly usuarioService = inject(UsuarioService);
  private readonly carreraService = inject(CarreraService);
  private readonly ciclosService = inject(CiclosService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  // Estados
  loading = signal(false);
  cargandoCatalogos = signal(true);
  error = signal('');

  // Catálogos base
  carreras = signal<Carrera[]>([]);
  private todosLosCiclos = signal<Ciclo[]>([]);

  // Control e integración para filtro de carrera
  filtroCarreraControl = new FormControl('', { nonNullable: true });
  filtroCarrera = signal<string>('');

  // Formulario Reactivo
  perfilForm: FormGroup<PerfilForm> = this.fb.group({
    cedula: ['', [Validators.required, cedulaEcuatorianaValidator()]],
    carrera_id: [''],
    ciclo_id: [{ value: '', disabled: true }],
  }) as FormGroup<PerfilForm>;

  // Signal proveniente de los cambios del control 'carrera_id'
  private carreraIdSeleccionada = toSignal(
    this.perfilForm.controls.carrera_id.valueChanges, 
    { initialValue: '' }
  );

  // Datos del Usuario
  perfil = computed(() => {
    const user = this.authService.user();
    return {
      nombre: user?.nombre ?? 'Estudiante',
      email: user?.email ?? ''
    };
  });

  // Signal computada: Filtra las carreras por texto
  carrerasFiltradas = computed(() => {
    const termino = this.filtroCarrera();
    const lista = this.carreras();
    if (!termino) return lista;
    return lista.filter(c => c.nombre.toLowerCase().includes(termino));
  });

  // Signal computada: Filtra los ciclos de acuerdo a la carrera elegida
  ciclosDisponibles = computed(() => {
    const carreraId = this.carreraIdSeleccionada();
    if (!carreraId) return [];
    return this.todosLosCiclos().filter(c => c.carrera_id === carreraId);
  });

  constructor() {
    // Escuchar el input de filtro para actualizar la signal del término
    this.filtroCarreraControl.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(value => {
        this.filtroCarrera.set(value.toLowerCase().trim());
      });

    // Resetear y habilitar/deshabilitar el control de ciclo según la selección de carrera
    this.perfilForm.controls.carrera_id.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        const cicloControl = this.perfilForm.controls.ciclo_id;
        cicloControl.setValue('');
        
        if (this.ciclosDisponibles().length > 0) {
          cicloControl.enable();
        } else {
          cicloControl.disable();
        }
      });
  }

  ngOnInit(): void {
    if (this.authService.perfilCompleto()) {
      this.router.navigate(['/estudiante/inicio']);
      return;
    }

    const usuario = this.authService.user();
    if (usuario?.rol === 'ESTUDIANTE') {
      this.perfilForm.controls.carrera_id.setValidators([Validators.required]);
      this.perfilForm.controls.ciclo_id.setValidators([Validators.required]);
      this.perfilForm.controls.carrera_id.updateValueAndValidity();
      this.perfilForm.controls.ciclo_id.updateValueAndValidity();
    }

    this.cargarCatalogos();
  }

  private cargarCatalogos(): void {
    this.cargandoCatalogos.set(true);

    this.carreraService.getCarreras()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => this.carreras.set(res.filter(c => !c.fecha_desactivacion)),
        error: () => this.error.set('Fallo de conexión. No se pudieron cargar las carreras.')
      });

    this.ciclosService.getCiclos()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.todosLosCiclos.set(res.filter(c => !c.fecha_desactivacion));
          this.cargandoCatalogos.set(false);
        },
        error: () => {
          this.error.set('Fallo de conexión. No se pudieron cargar los ciclos.');
          this.cargandoCatalogos.set(false);
        }
      });
  }

  guardar(): void {
    this.error.set('');
    if (this.perfilForm.invalid) {
      this.perfilForm.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    const formValue = this.perfilForm.getRawValue();

    const payload: { cedula: string; carrera_id?: string; ciclo_id?: string } = { 
      cedula: formValue.cedula 
    };
    if (formValue.carrera_id) payload.carrera_id = formValue.carrera_id;
    if (formValue.ciclo_id) payload.ciclo_id = formValue.ciclo_id;

    this.usuarioService.completarPerfil(payload)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.authService.marcarPerfilCompleto(payload);
          this.router.navigate(['/estudiante/inicio']);
        },
        error: (err) => {
          this.loading.set(false);
          this.error.set(err?.error?.message ?? 'Error del servidor al procesar la solicitud.');
        }
      });
  }

  cancelar(): void {
    this.router.navigate(['/']);
  }
}