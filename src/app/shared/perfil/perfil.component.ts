import { Component, OnInit, inject, signal, computed, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

// ✅ CORRECCIÓN: Importaciones a solo 2 niveles (../../core/)
import { AuthService } from '../../core/services/auth.service';
import { UsuarioService } from '../../core/services/usuario.service';
import { PerfilCoordinadorService } from '../../core/services/perfil-coordinador.service';
import { CarreraService } from '../../core/services/carrera.service';
import { CiclosService } from '../../core/services/ciclos.service';
import { Carrera } from '../../core/models/carrera.model';
import { Ciclo } from '../../core/models/ciclo.model';
import { comprimirImagenPerfil } from '../../core/utils/image-compress.util';

@Component({
  selector: 'app-perfil',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './perfil.component.html',
  styleUrls: ['./perfil.component.css'],
})
export class PerfilComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  readonly authService = inject(AuthService);
  private readonly usuarioService = inject(UsuarioService);
  private readonly perfilCoordinadorService = inject(PerfilCoordinadorService);
  private readonly carreraService = inject(CarreraService);
  private readonly ciclosService = inject(CiclosService);

  @ViewChild('fotoInput') fotoInput!: ElementRef<HTMLInputElement>;

  usuario = computed(() => this.authService.user());

  esCoordinador = computed(() => {
    const rol = this.usuario()?.rol;
    return rol === 'COORDINADOR_BIENESTAR' || rol === 'COORDINADOR_CARRERA';
  });

  esEstudianteOInvitado = computed(() => {
    const rol = this.usuario()?.rol;
    return rol === 'ESTUDIANTE' || rol === 'INVITADO';
  });

  etiquetaRol = computed(() => {
    const mapa: Record<string, string> = {
      ESTUDIANTE: 'Estudiante',
      INVITADO: 'Invitado',
      COORDINADOR_BIENESTAR: 'Coordinador de Bienestar',
      COORDINADOR_CARRERA: 'Coordinador de Carrera',
    };
    return mapa[this.usuario()?.rol ?? ''] ?? this.usuario()?.rol ?? '';
  });

  iniciales = computed(() => {
    const nombre = this.usuario()?.nombre ?? '';
    // ✅ CORRECCIÓN: Tipado de (p: string)
    return nombre.split(' ').filter(Boolean).slice(0, 2).map((p: string) => p[0]?.toUpperCase()).join('') || 'U';
  });

  // --- Foto de perfil ---
  subiendoFoto = signal(false);
  errorFoto = signal('');

  // --- Datos académicos (solo lectura, Estudiante/Invitado) ---
  carreras = signal<Carrera[]>([]);
  ciclos = signal<Ciclo[]>([]);
  cargandoAcademico = signal(false);

  nombreCarrera = computed(() => {
    const id = this.usuario()?.carrera_id;
    return this.carreras().find(c => c.id === id)?.nombre ?? 'No asignada';
  });

  nombreCiclo = computed(() => {
    const id = this.usuario()?.ciclo_id;
    return this.ciclos().find(c => c.id === id)?.nombre ?? 'No asignado';
  });

  // --- Datos de coordinación (editable, Coordinador) ---
  coordinadorForm: FormGroup = this.fb.group({
    titulo_profesional: [''],
    telefono_contacto: [''],
    correo_contacto: ['', [Validators.email]],
    ubicacion_oficina: [''],
    horario_atencion: [''],
    mensaje_ayuda_estudiantes: [''],
  });

  cargandoPerfilCoordinador = signal(false);
  guardandoCoordinador = signal(false);
  mensajeExitoCoordinador = signal('');
  errorCoordinador = signal('');

  ngOnInit(): void {
    if (this.esEstudianteOInvitado()) {
      this.cargarCatalogosAcademicos();
    }
    if (this.esCoordinador()) {
      this.cargarPerfilCoordinador();
    }
  }

  private cargarCatalogosAcademicos(): void {
    this.cargandoAcademico.set(true);
    
    // ✅ CORRECCIÓN: Tipados añadidos a 'c' y 'err'
    this.carreraService.getCarreras().subscribe({ 
      next: (c: Carrera[]) => this.carreras.set(c), 
      error: (err: any) => console.error('Error al cargar carreras', err) 
    });

    this.ciclosService.getCiclos().subscribe({
      next: (c: Ciclo[]) => { 
        this.ciclos.set(c); 
        this.cargandoAcademico.set(false); 
      },
      error: (err: any) => {
        console.error('Error al cargar ciclos', err);
        this.cargandoAcademico.set(false);
      }
    });
  }

  private cargarPerfilCoordinador(): void {
    const usuarioId = this.usuario()?.id;
    if (!usuarioId) return;

    this.cargandoPerfilCoordinador.set(true);
    this.perfilCoordinadorService.getPerfilByUsuario(usuarioId).subscribe({
      next: (perfil: any) => {
        if (perfil) {
          this.coordinadorForm.patchValue({
            titulo_profesional: perfil.titulo_profesional ?? '',
            telefono_contacto: perfil.telefono_contacto ?? '',
            correo_contacto: perfil.correo_contacto ?? '',
            ubicacion_oficina: perfil.ubicacion_oficina ?? '',
            horario_atencion: perfil.horario_atencion ?? '',
            mensaje_ayuda_estudiantes: perfil.mensaje_ayuda_estudiantes ?? '',
          });
        }
        this.cargandoPerfilCoordinador.set(false);
      },
      error: (err: any) => {
        console.error('Error al cargar perfil de coordinador', err);
        this.cargandoPerfilCoordinador.set(false);
      },
    });
  }

  guardarPerfilCoordinador(): void {
    const usuarioId = this.usuario()?.id;
    if (!usuarioId || this.coordinadorForm.invalid) {
      this.coordinadorForm.markAllAsTouched();
      return;
    }

    this.guardandoCoordinador.set(true);
    this.errorCoordinador.set('');
    this.mensajeExitoCoordinador.set('');

    const payload = { usuario_id: usuarioId, ...this.coordinadorForm.value };

    this.perfilCoordinadorService.saveOrUpdatePerfil(payload).subscribe({
      next: () => {
        this.guardandoCoordinador.set(false);
        this.mensajeExitoCoordinador.set('Tu información se guardó correctamente.');
        setTimeout(() => this.mensajeExitoCoordinador.set(''), 4000);
      },
      error: (err: any) => {
        this.guardandoCoordinador.set(false);
        this.errorCoordinador.set(err?.error?.message ?? 'No se pudo guardar tu información. Intenta nuevamente.');
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
      this.errorFoto.set('Selecciona un archivo de imagen válido.');
      input.value = '';
      return;
    }

    this.errorFoto.set('');
    this.subiendoFoto.set(true);

    try {
      const comprimida = await comprimirImagenPerfil(file);
      this.usuarioService.subirFoto(comprimida).subscribe({
        next: (usuarioActualizado: any) => {
          this.authService.actualizarFotoPerfil(usuarioActualizado.foto_url);
          this.subiendoFoto.set(false);
        },
        error: (err: any) => {
          this.errorFoto.set(err?.error?.message ?? 'No se pudo subir la foto. Intenta nuevamente.');
          this.subiendoFoto.set(false);
        },
      });
    } catch {
      this.errorFoto.set('No se pudo procesar la imagen seleccionada.');
      this.subiendoFoto.set(false);
    } finally {
      input.value = '';
    }
  }
}