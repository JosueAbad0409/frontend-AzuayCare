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
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { AuthService } from '../../core/services/auth.service';
import { UsuarioService } from '../../core/services/usuario.service';
import { PerfilCoordinadorService } from '../../core/services/perfil-coordinador.service';
import { CarreraService } from '../../core/services/carrera.service';
import { CiclosService } from '../../core/services/ciclos.service';
import { UbicacionesService } from '../../core/services/ubicaciones.service';
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
  private readonly ubicacionesService = inject(UbicacionesService);
  private readonly destroyRef = inject(DestroyRef);

  @ViewChild('fotoInput') fotoInput!: ElementRef<HTMLInputElement>;

  usuario = computed(() => this.authService.user());
  readonly fotoVersion = signal<number>(Date.now());

  // === ESTADOS PARA EL ESTUDIANTE / USUARIO ===
  readonly cargandoPerfilEstudiante = signal(false);
  readonly datosCompletosEstudiante = signal<any | null>(null);

  readonly fotoUrl = computed(() => {
    const foto = this.datosCompletosEstudiante()?.foto_url || this.usuario()?.foto_url;
    if (!foto) return null;
    const separator = foto.includes('?') ? '&' : '?';
    return `${foto}${separator}v=${this.fotoVersion()}`;
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
  readonly paises = signal<any[]>([]);
  readonly provincias = signal<any[]>([]);
  readonly cantones = signal<any[]>([]);
  readonly cargandoAcademico = signal(false);

  // === COMPUTED DATO ACADÉMICO Y UBICACIÓN ===
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

  readonly nacionalidadNombre = computed(() => {
    const d = this.datosCompletosEstudiante();
    if (!d) return 'No especificado';
    if (d.nacionalidad?.nacionalidad) return d.nacionalidad.nacionalidad;
    if (d.nacionalidad?.nombre) return d.nacionalidad.nombre;
    if (d.nacionalidad_id) {
      const p = this.paises().find(x => x.id === d.nacionalidad_id);
      if (p) return p.nacionalidad || p.nombre;
    }
    return 'No especificado';
  });

  readonly lugarNacimientoCompleto = computed(() => {
    const d = this.datosCompletosEstudiante();
    if (!d) return 'No especificado';

    const partes: string[] = [];
    const canton = d.canton_nacimiento?.nombre || this.cantones().find(c => c.id === d.canton_nacimiento_id)?.nombre;
    const provincia = d.provincia_nacimiento?.nombre || this.provincias().find(p => p.id === d.provincia_nacimiento_id)?.nombre;
    const pais = d.pais_nacimiento?.nombre || this.paises().find(p => p.id === d.pais_nacimiento_id)?.nombre;

    if (canton) partes.push(canton);
    if (provincia) partes.push(provincia);
    if (pais) partes.push(pais);

    return partes.length > 0 ? partes.join(', ') : 'No especificado';
  });

  // === ESTADOS MODO COORDINADOR ===
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

  ngOnInit(): void {
    this.sincronizarUsuarioServidor();

    if (this.esEstudianteOInvitado()) {
      this.cargarCatalogosAcademicos();
      this.cargarDatosCompletosEstudiante();
    }
    if (this.esCoordinador()) {
      this.cargarPerfilCoordinador();
    }
  }

  private sincronizarUsuarioServidor(): void {
    const id = this.usuario()?.id;
    if (!id) return;

    this.usuarioService.getUsuarioById(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (usuarioServidor: Usuario) => {
          if (usuarioServidor?.foto_url) {
            this.authService.actualizarFotoPerfil(usuarioServidor.foto_url);
            this.fotoVersion.set(Date.now());
          }
        },
        error: (err: unknown) => {
          console.error('Error al refrescar estado:', err);
        }
      });
  }

  private cargarDatosCompletosEstudiante(): void {
    const id = this.usuario()?.id;
    if (!id) return;

    this.cargandoPerfilEstudiante.set(true);

    this.usuarioService.getUsuarioById(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data: any) => {
          this.datosCompletosEstudiante.set(data);
          if (data?.foto_url) {
            this.authService.actualizarFotoPerfil(data.foto_url);
          }
          this.cargandoPerfilEstudiante.set(false);
          this.cargarUbicacionesRelacionadas(data);
        },
        error: (err: unknown) => {
          console.error('Error al cargar datos del estudiante:', err);
          this.cargandoPerfilEstudiante.set(false);
        }
      });
  }

  private cargarUbicacionesRelacionadas(data: any): void {
    const obsPaises = this.ubicacionesService.getPaises().pipe(catchError(() => of([])));

    obsPaises.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(resPaises => {
      this.paises.set(resPaises || []);

      if (data?.pais_nacimiento_id) {
        this.ubicacionesService.getProvincias(data.pais_nacimiento_id)
          .pipe(
            catchError(() => of([])),
            takeUntilDestroyed(this.destroyRef)
          )
          .subscribe(resProvincias => {
            this.provincias.set(resProvincias || []);

            if (data?.provincia_nacimiento_id) {
              this.ubicacionesService.getCantones(data.provincia_nacimiento_id)
                .pipe(
                  catchError(() => of([])),
                  takeUntilDestroyed(this.destroyRef)
                )
                .subscribe(resCantones => {
                  this.cantones.set(resCantones || []);
                });
            }
          });
      }
    });
  }

  getNombreCompleto(): string {
    const d = this.datosCompletosEstudiante();
    if (!d) return this.usuario()?.nombre || 'No especificado';
    const nombres = [d.primer_nombre, d.segundo_nombre].filter(Boolean).join(' ');
    const apellidos = [d.primer_apellido, d.segundo_apellido].filter(Boolean).join(' ');
    const completo = `${nombres} ${apellidos}`.trim();
    return completo || this.usuario()?.nombre || 'No especificado';
  }

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

  getEtniaDetalle(): string {
    const d = this.datosCompletosEstudiante();
    if (!d || !d.etnia) return 'No especificado';
    let texto = String(d.etnia);
    if (d.pueblo_nacionalidad) texto += ` (${d.pueblo_nacionalidad})`;
    if (d.etnia_otra) texto += ` (${d.etnia_otra})`;
    return texto;
  }

  toggleEdicionCoordinador(): void {
    this.modoEdicionCoordinador.update(v => !v);
  }

  private cargarCatalogosAcademicos(): void {
    this.cargandoAcademico.set(true);

    forkJoin({
      carreras: this.carreraService.getCarreras().pipe(catchError(() => of([]))),
      ciclos: this.ciclosService.getCiclos().pipe(catchError(() => of([])))
    })
    .pipe(takeUntilDestroyed(this.destroyRef))
    .subscribe({
      next: (res) => {
        this.carreras.set(res.carreras || []);
        this.ciclos.set(res.ciclos || []);
        this.cargandoAcademico.set(false);
      },
      error: () => this.cargandoAcademico.set(false)
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
              this.datosCompletosEstudiante.update(curr => curr ? { ...curr, foto_url: nuevaFoto } : null);
              this.fotoVersion.set(Date.now());
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