import {
  Component,
  OnInit,
  inject,
  signal,
  computed,
  DestroyRef,
  ChangeDetectionStrategy,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  FormControl,
  ReactiveFormsModule,
  Validators,
  AbstractControl,
} from '@angular/forms';
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
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CompletarPerfilComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  readonly authService = inject(AuthService);
  private readonly usuarioService = inject(UsuarioService);
  private readonly carreraService = inject(CarreraService);
  private readonly ciclosService = inject(CiclosService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  // === ESTADOS DEL WIZARD ===
  readonly pasoActual = signal(0);
  readonly pasosNavegacion = [
    { nombre: 'Identificación', icono: 'fa-id-card' },
    { nombre: 'Datos Académicos', icono: 'fa-graduation-cap' },
    { nombre: 'Datos Personales', icono: 'fa-user' }
  ];
  
  readonly progreso = computed(() => {
    return ((this.pasoActual() + 1) / this.pasosNavegacion.length) * 100;
  });

  // === ESTADOS GLOBALES ===
  readonly loading = signal(false);
  readonly cargandoCatalogos = signal(true);
  readonly error = signal('');
  readonly alertas = signal<string[]>([]);
  readonly exito = signal('');

  readonly carreras = signal<Carrera[]>([]);
  private readonly todosLosCiclos = signal<Ciclo[]>([]);

  // === AUTOCOMPLETE CARRERAS ===
  readonly filtroCarreraControl = new FormControl('', { nonNullable: true });
  readonly filtroCarrera = signal('');
  readonly dropdownCarreraAbierto = signal(false);

  // === CATÁLOGOS LOCALES ===
  readonly sexos = ['Hombre', 'Mujer'];
  readonly estadosCiviles = ['Soltero/a', 'Casado/a', 'Divorciado/a', 'Viudo/a', 'Unión libre'];
  readonly etnias = ['Mestizo/a', 'Indígena', 'Afroecuatoriano/a', 'Montubio/a', 'Blanco/a', 'Mulato/a', 'Otro'];
  readonly rangosEdad = ['Menor a 18', '18 a 25', '26 a 35', '36 a 45', 'Mayor a 45'];
  readonly zonas = ['Urbano', 'Rural'];
  readonly tiposDiscapacidad = ['Física', 'Visual', 'Auditiva', 'Intelectual', 'Psicosocial', 'Múltiple', 'Otra'];
  readonly opcionesEmbarazo = [
    { value: 'no', label: 'No' },
    { value: '1', label: 'Sí — 1 mes' }, { value: '2', label: 'Sí — 2 meses' },
    { value: '3', label: 'Sí — 3 meses' }, { value: '4', label: 'Sí — 4 meses' },
    { value: '5', label: 'Sí — 5 meses' }, { value: '6', label: 'Sí — 6 meses' },
    { value: '7', label: 'Sí — 7 meses' }, { value: '8', label: 'Sí — 8 meses' },
    { value: '9', label: 'Sí — 9 meses' }
  ];

  readonly mensajesCampo: Record<string, string> = {
    cedula: 'Cédula inválida (10 dígitos).',
    numero_celular: 'Celular inválido (09...).',
    primer_nombre: 'Requerido.',
    primer_apellido: 'Requerido.',
    email_personal: 'Correo inválido.',
    carrera_id: 'Selecciona una carrera de la lista.',
    ciclo_id: 'Selecciona ciclo.',
    sexo: 'Requerido.',
    estado_civil: 'Requerido.',
    tiene_hijos: 'Requerido.',
    etnia: 'Requerido.',
    idioma: 'Requerido.',
    lugar_nacimiento: 'Requerido.',
    fecha_nacimiento: 'Usa el formato DD/MM/AAAA.',
    rango_edad: 'Requerido.',
    nacionalidad: 'Requerido.',
    zona_residencia: 'Requerido.',
    mes_embarazo: 'Requerido.',
    tiene_discapacidad: 'Requerido.',
    tipo_discapacidad: 'Requerido.',
  };

  readonly perfilForm: FormGroup = this.fb.group({
    // PASO 0
    cedula: ['', [Validators.required, cedulaEcuatorianaValidator()]],
    primer_nombre: ['', Validators.required],
    segundo_nombre: [''],
    primer_apellido: ['', Validators.required],
    segundo_apellido: [''],
    email_institucional: [''],
    email_personal: ['', Validators.email],
    numero_celular: ['', [Validators.required, Validators.pattern(/^09\d{8}$/)]],

    // PASO 1
    carrera_id: ['', Validators.required],
    ciclo_id: [{ value: '', disabled: true }, Validators.required],

    // PASO 2
    sexo: ['', Validators.required],
    estado_civil: ['', Validators.required],
    tiene_hijos: [null as boolean | null, Validators.required],
    etnia: ['', Validators.required],
    idioma: ['Español', Validators.required],
    lugar_nacimiento: ['', Validators.required],
    fecha_nacimiento: ['', [Validators.required, this.validarFechaNacimiento]],
    rango_edad: ['', Validators.required],
    nacionalidad: ['Ecuatoriana', Validators.required],
    zona_residencia: ['', Validators.required],
    mes_embarazo: ['no'],
    tiene_discapacidad: [null as boolean | null, Validators.required],
    tipo_discapacidad: [''],
  });

  private readonly carreraIdSeleccionada = toSignal(
    this.perfilForm.controls['carrera_id'].valueChanges,
    { initialValue: '' }
  );

  readonly perfil = computed(() => {
    const user = this.authService.user();
    return {
      nombre: user?.nombre ?? 'Estudiante',
      email: user?.email ?? '',
    };
  });

  readonly carrerasFiltradas = computed(() => {
    const termino = this.filtroCarrera();
    const lista = this.carreras();
    if (!termino) return lista;
    return lista.filter((c) => c.nombre.toLowerCase().includes(termino));
  });

  readonly ciclosDisponibles = computed(() => {
    const carreraId = this.carreraIdSeleccionada();
    if (!carreraId) return [];
    return this.todosLosCiclos().filter((c) =>
      (c.ciclosCarreras || []).some(
        (cc) => String(cc.carrera_id || cc.carrera?.id) === String(carreraId)
      )
    );
  });

  constructor() {
    // LÓGICA AUTOCOMPLETE CARRERA
    this.filtroCarreraControl.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => {
        this.filtroCarrera.set(value.toLowerCase().trim());
        
        // Si el usuario escribe algo que ya no coincide con la carrera seleccionada, borramos el ID
        const currentId = this.perfilForm.controls['carrera_id'].value;
        if (currentId) {
          const selected = this.carreras().find(c => c.id === currentId);
          if (selected && selected.nombre !== value) {
             this.perfilForm.controls['carrera_id'].setValue('');
          }
        }
      });

    this.perfilForm.controls['carrera_id'].valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        const cicloControl = this.perfilForm.controls['ciclo_id'];
        cicloControl.setValue('');
        if (this.ciclosDisponibles().length > 0) cicloControl.enable();
        else cicloControl.disable();
      });

    this.perfilForm.controls['sexo'].valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((sexo) => {
        const mes = this.perfilForm.controls['mes_embarazo'];
        if (sexo === 'Mujer') mes.setValidators([Validators.required]);
        else {
          mes.clearValidators();
          mes.setValue('no');
        }
        mes.updateValueAndValidity();
      });

    this.perfilForm.controls['tiene_discapacidad'].valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((tiene) => {
        const tipo = this.perfilForm.controls['tipo_discapacidad'];
        if (tiene === true) tipo.setValidators([Validators.required]);
        else {
          tipo.clearValidators();
          tipo.setValue('');
        }
        tipo.updateValueAndValidity();
      });
  }

  ngOnInit(): void {
    if (this.authService.perfilCompleto()) {
      this.router.navigate(['/estudiante/inicio']);
      return;
    }

    const user = this.authService.user();
    if (user) {
      const partes = (user.nombre || '').trim().split(/\s+/);
      this.perfilForm.patchValue({
        primer_nombre: partes[0] || '',
        primer_apellido: partes.slice(1).join(' ') || '',
        email_institucional: user.email || '',
      });
    }
    this.cargarCatalogos();
  }

  // === MÉTODOS DEL AUTOCOMPLETE ===
  cerrarDropdownCarrera() {
    // Retraso minúsculo para que el clic (mousedown) en la opción de la lista 
    // se registre antes de que el dropdown desaparezca por perder el foco.
    setTimeout(() => this.dropdownCarreraAbierto.set(false), 200);
  }

  seleccionarCarrera(c: Carrera) {
    this.perfilForm.controls['carrera_id'].setValue(c.id);
    this.filtroCarreraControl.setValue(c.nombre, { emitEvent: false }); 
    this.filtroCarrera.set(c.nombre.toLowerCase().trim());
    this.dropdownCarreraAbierto.set(false);
    this.perfilForm.controls['carrera_id'].markAsTouched();
  }

  // === NAVEGACIÓN DEL WIZARD ===
  irAPaso(index: number): void {
    this.pasoActual.set(index);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  siguiente(): void {
    if (this.pasoActual() < this.pasosNavegacion.length - 1) {
      this.pasoActual.update(p => p + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  anterior(): void {
    if (this.pasoActual() > 0) {
      this.pasoActual.update(p => p - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  private buscarPasoConError(): number {
    const camposPaso0 = ['cedula', 'numero_celular', 'primer_nombre', 'primer_apellido', 'email_personal'];
    const camposPaso1 = ['carrera_id', 'ciclo_id'];
    const controles = this.perfilForm.controls;

    for (const c of camposPaso0) if (controles[c]?.invalid) return 0;
    for (const c of camposPaso1) if (controles[c]?.invalid) return 1;
    return 2; 
  }

  // === VALIDACIONES Y GUARDADO ===
  private validarFechaNacimiento(control: AbstractControl) {
    const v = (control.value || '').trim();
    if (!v) return { required: true };
    const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(v);
    if (!m) return { formato: true };
    const date = new Date(+m[3], +m[2] - 1, +m[1]);
    if (date > new Date()) return { futura: true };
    return null;
  }

  private cargarCatalogos(): void {
    this.cargandoCatalogos.set(true);
    this.carreraService.getCarreras().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (res) => this.carreras.set(res.filter(c => !c.fecha_desactivacion)),
      error: () => this.error.set('No se pudieron cargar las carreras.')
    });

    this.ciclosService.getCiclos().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (res) => {
        this.todosLosCiclos.set((res || []).filter(c => !c.fecha_desactivacion));
        this.cargandoCatalogos.set(false);
      },
      error: () => {
        this.error.set('No se pudieron cargar los ciclos.');
        this.cargandoCatalogos.set(false);
      }
    });
  }

  guardar(): void {
    this.error.set('');
    this.alertas.set([]);
    this.perfilForm.markAllAsTouched();

    if (this.perfilForm.invalid) {
      const pasoError = this.buscarPasoConError();
      if (this.pasoActual() !== pasoError) {
        this.irAPaso(pasoError);
      }
      this.error.set('Hay campos obligatorios vacíos o incorrectos en este paso.');
      setTimeout(() => document.querySelector('.alert-panel')?.scrollIntoView({ behavior: 'smooth' }), 50);
      return;
    }

    this.loading.set(true);
    const v = this.perfilForm.getRawValue();

    const payload: any = {
      cedula: v.cedula,
      primer_nombre: v.primer_nombre,
      primer_apellido: v.primer_apellido,
      numero_celular: v.numero_celular,
      sexo: v.sexo,
      estado_civil: v.estado_civil,
      tiene_hijos: !!v.tiene_hijos,
      etnia: v.etnia,
      idioma: v.idioma,
      lugar_nacimiento: v.lugar_nacimiento,
      fecha_nacimiento: v.fecha_nacimiento,
      rango_edad: v.rango_edad,
      nacionalidad: v.nacionalidad,
      zona_residencia: v.zona_residencia,
      tiene_discapacidad: !!v.tiene_discapacidad,
      carrera_id: v.carrera_id,
      ciclo_id: v.ciclo_id,
    };

    if (v.segundo_nombre) payload.segundo_nombre = v.segundo_nombre;
    if (v.segundo_apellido) payload.segundo_apellido = v.segundo_apellido;
    if (v.email_institucional) payload.email_institucional = v.email_institucional;
    if (v.email_personal) payload.email_personal = v.email_personal;
    
    if (v.sexo === 'Mujer') payload.esta_embarazada = (v.mes_embarazo !== 'no' && v.mes_embarazo !== '');
    if (v.tiene_discapacidad) payload.tipo_discapacidad = v.tipo_discapacidad;

    this.usuarioService.completarPerfil(payload).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.authService.marcarPerfilCompleto({
          cedula: payload.cedula, carrera_id: payload.carrera_id, ciclo_id: payload.ciclo_id,
        });
        this.loading.set(false);
        this.exito.set('¡Perfil completado exitosamente!');
        setTimeout(() => this.router.navigate(['/estudiante/inicio']), 900);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err?.error?.message || 'Error al guardar el perfil.');
        setTimeout(() => document.querySelector('.alert-panel')?.scrollIntoView({ behavior: 'smooth' }), 50);
      },
    });
  }

  cancelar(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  campoInvalido(nombre: string): boolean {
    const c = this.perfilForm.get(nombre);
    return !!(c && c.invalid && c.touched);
  }

  mensajeCampo(nombre: string): string {
    return this.mensajesCampo[nombre] || 'Inválido';
  }
}