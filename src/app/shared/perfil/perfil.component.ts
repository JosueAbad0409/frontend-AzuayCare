import {
  Component,
  OnInit,
  inject,
  signal,
  computed,
  ViewChild,
  ElementRef,
  DestroyRef,
  ChangeDetectionStrategy
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { AuthService } from '../../core/services/auth.service';
import { UsuarioService } from '../../core/services/usuario.service';
import { PerfilCoordinadorService } from '../../core/services/perfil-coordinador.service';
import { CarreraService } from '../../core/services/carrera.service';
import { CiclosService } from '../../core/services/ciclos.service';
import { Carrera } from '../../core/models/carrera.model';
import { Ciclo } from '../../core/models/ciclo.model';
import { Usuario } from '../../core/models/usuario.model';
import { PerfilCoordinador } from '../../core/models/perfil-coordinador.model';
import { comprimirImagenPerfil } from '../../core/utils/image-compress.util';

interface PerfilCoordinadorPayload {
  usuario_id: string;
  titulo_profesional?: string;
  telefono_contacto?: string;
  correo_contacto?: string;
  ubicacion_oficina?: string;
  horario_atencion?: string;
  mensaje_ayuda_estudiantes?: string;
}

@Component({
  selector: 'app-perfil',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './perfil.component.html',
  styleUrls: ['./perfil.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PerfilComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  readonly authService = inject(AuthService);
  private readonly usuarioService = inject(UsuarioService);
  private readonly perfilCoordinadorService = inject(PerfilCoordinadorService);
  private readonly carreraService = inject(CarreraService);
  private readonly ciclosService = inject(CiclosService);
  private readonly destroyRef = inject(DestroyRef);

  @ViewChild('fotoInput') fotoInput!: ElementRef<HTMLInputElement>;

  usuario = computed(() => this.authService.user());

  // === ESTADOS PARA EL ESTUDIANTE ===
  readonly cargandoPerfilEstudiante = signal(false);
  readonly datosCompletosEstudiante = signal<Usuario | null>(null);

  readonly fotoUrl = computed(() => {
    const user = this.usuario();
    return user?.foto_url || null;
  });

  readonly esCoordinador = computed(() => {
    const rol = this.usuario()?.rol;
    return rol === 'COORDINADOR_BIENESTAR' || rol === 'COORDINADOR_CARRERA';
  });

  readonly esEstudianteOInvitado = computed(() => {
    const rol = this.usuario()?.rol;
    return rol === 'ESTUDIANTE' || rol === 'INVITADO';
  });

  readonly etiquetaRol = computed(() => {
    const mapa: Record<string, string> = {
      ESTUDIANTE: 'Estudiante',
      INVITADO: 'Invitado',
      COORDINADOR_BIENESTAR: 'Coordinador de Bienestar',
      COORDINADOR_CARRERA: 'Coordinador de Carrera',
    };
    return mapa[this.usuario()?.rol ?? ''] ?? this.usuario()?.rol ?? 'Usuario';
  });

  readonly iniciales = computed(() => {
    const nombre = this.usuario()?.nombre ?? '';
    const partes = nombre.trim().split(/\s+/).filter(Boolean);
    if (!partes.length) return 'U';
    if (partes.length === 1) return partes[0][0]?.toUpperCase() ?? 'U';
    return (partes[0][0] + partes[1][0]).toUpperCase();
  });

  readonly subiendoFoto = signal(false);
  readonly errorFoto = signal('');

  readonly carreras = signal<Carrera[]>([]);
  readonly ciclos = signal<Ciclo[]>([]);
  readonly cargandoAcademico = signal(false);

  readonly nombreCarrera = computed(() => {
    const data: any = this.datosCompletosEstudiante() || this.usuario();
    if (!data) return 'No asignada';
    if (data.carrera?.nombre) return data.carrera.nombre;
    const id = data.carrera?.id || data.carrera_id;
    return this.carreras().find(c => c.id === id)?.nombre ?? 'No asignada';
  });

  readonly nombreCiclo = computed(() => {
    const data: any = this.datosCompletosEstudiante() || this.usuario();
    if (!data) return 'No asignado';
    if (data.ciclo?.nombre) return data.ciclo.nombre;
    const id = data.ciclo?.id || data.ciclo_id;
    return this.ciclos().find(c => c.id === id)?.nombre ?? 'No asignado';
  });

  readonly modoEdicionCoordinador = signal(false);
  readonly cargandoPerfilCoordinador = signal(false);
  readonly guardandoCoordinador = signal(false);
  readonly mensajeExitoCoordinador = signal('');
  readonly errorCoordinador = signal('');

  readonly coordinadorForm: FormGroup = this.fb.group({
    titulo_profesional: ['', Validators.required],
    telefono_contacto: ['', [Validators.required, Validators.pattern('^[0-9]*$')]],
    correo_contacto: ['', [Validators.required, Validators.email]],
    ubicacion_oficina: ['', Validators.required],
    horario_atencion: ['', Validators.required],
    mensaje_ayuda_estudiantes: [''],
  });

  // Corrección: Cambiado a `string` simple para evitar conflicto de tipo con SonarLint
  getDato(prop: string, fallback = 'No especificado'): string {
    const data: any = this.datosCompletosEstudiante() || this.usuario();
    if (!data) return fallback;

    const val = data[prop];
    if (val === undefined || val === null || val === '') return fallback;

    if (prop === 'fecha_nacimiento') {
      if (typeof val === 'string') {
        const fechaParte = val.split('T')[0];
        const parts = fechaParte.split('-');
        if (parts.length === 3) {
          return `${parts[2]}/${parts[1]}/${parts[0]}`;
        }
      }
    }
    return String(val);
  }

  // Corrección: Cambiado a `string` simple
  getBooleanDato(prop: string): string {
    const data: any = this.datosCompletosEstudiante() || this.usuario();
    if (!data) return 'No especificado';
    
    const val = data[prop];
    if (val === undefined || val === null || val === '') return 'No especificado';
    
    if (val === false || val === 'false' || val === '0' || val === 0) {
      return 'No';
    }
    return 'Sí';
  }

  ngOnInit(): void {
    if (this.esEstudianteOInvitado()) {
      this.cargarCatalogosAcademicos();
      this.cargarDatosCompletosEstudiante();
    }
    if (this.esCoordinador()) {
      this.cargarPerfilCoordinador();
    }
  }

  private cargarDatosCompletosEstudiante(): void {
    const id = this.usuario()?.id;
    if (!id) return;

    this.cargandoPerfilEstudiante.set(true);

    this.usuarioService.getUsuarioById(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data: Usuario) => {
          this.datosCompletosEstudiante.set(data);
          this.cargandoPerfilEstudiante.set(false);
        },
        error: (err: unknown) => {
          console.error('Error al cargar datos del usuario:', err);
          this.cargandoPerfilEstudiante.set(false);
        }
      });
  }

  toggleEdicionCoordinador(): void {
    this.modoEdicionCoordinador.update(v => !v);
  }

  private cargarCatalogosAcademicos(): void {
    this.cargandoAcademico.set(true);

    this.carreraService.getCarreras()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (c: Carrera[]) => this.carreras.set(c),
        error: (err: unknown) => console.error(err)
      });

    this.ciclosService.getCiclos()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (c: Ciclo[]) => {
          this.ciclos.set(c);
          this.cargandoAcademico.set(false);
        },
        error: (err: unknown) => {
          console.error(err);
          this.cargandoAcademico.set(false);
        }
      });
  }

  private cargarPerfilCoordinador(): void {
    const usuarioId = this.usuario()?.id;
    if (!usuarioId) return;

    this.cargandoPerfilCoordinador.set(true);
    this.perfilCoordinadorService.getPerfilByUsuario(usuarioId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (perfil: PerfilCoordinador | null) => {
          if (perfil) {
            this.coordinadorForm.patchValue({
              titulo_profesional: perfil.titulo_profesional ?? '',
              telefono_contacto: perfil.telefono_contacto ?? '',
              correo_contacto: perfil.correo_contacto ?? '',
              ubicacion_oficina: perfil.ubicacion_oficina ?? '',
              horario_atencion: perfil.horario_atencion ?? '',
              mensaje_ayuda_estudiantes: perfil.mensaje_ayuda_estudiantes ?? '',
            });
          } else {
            this.modoEdicionCoordinador.set(true);
          }
          this.cargandoPerfilCoordinador.set(false);
        },
        error: (err: unknown) => {
          console.error(err);
          this.cargandoPerfilCoordinador.set(false);
        },
      });
  }

  guardarPerfilCoordinador(event?: Event): void {
    event?.preventDefault();
    
    const usuarioId = this.usuario()?.id;
    
    if (this.coordinadorForm.invalid) {
      this.coordinadorForm.markAllAsTouched();
      return;
    }
    
    if (!usuarioId || this.guardandoCoordinador()) return;

    this.guardandoCoordinador.set(true);
    this.errorCoordinador.set('');
    this.mensajeExitoCoordinador.set('');

    const payload: PerfilCoordinadorPayload = {
      usuario_id: usuarioId,
      ...this.coordinadorForm.value
    };

    this.perfilCoordinadorService.saveOrUpdatePerfil(payload)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.guardandoCoordinador.set(false);
          this.modoEdicionCoordinador.set(false);
          this.mensajeExitoCoordinador.set('Tu información de atención se actualizó correctamente.');
          setTimeout(() => this.mensajeExitoCoordinador.set(''), 4000);
        },
        error: (err: { error?: { message?: string } }) => {
          this.guardandoCoordinador.set(false);
          this.errorCoordinador.set(err?.error?.message ?? 'No se pudo guardar la información.');
        },
      });
  }

  abrirSelectorFoto(): void {
    this.fotoInput?.nativeElement.click();
  }

  async onFotoSeleccionada(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      this.errorFoto.set('Por favor, selecciona un archivo de imagen válido (PNG, JPG, WEBP).');
      input.value = '';
      return;
    }

    this.errorFoto.set('');
    this.subiendoFoto.set(true);

    try {
      const comprimida = await comprimirImagenPerfil(file);
      this.usuarioService.subirFoto(comprimida)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (usuarioActualizado: Usuario) => {
            const nuevaFoto = usuarioActualizado?.foto_url;
            if (nuevaFoto) {
              this.authService.actualizarFotoPerfil(nuevaFoto);
            }
            this.subiendoFoto.set(false);
          },
          error: (err: { error?: { message?: string } }) => {
            this.errorFoto.set(err?.error?.message ?? 'No se pudo subir la foto de perfil.');
            this.subiendoFoto.set(false);
          },
        });
    } catch (err) {
      console.error(err);
      this.errorFoto.set('Ocurrió un error al procesar y comprimir la imagen.');
      this.subiendoFoto.set(false);
    } finally {
      input.value = '';
    }
  }
}