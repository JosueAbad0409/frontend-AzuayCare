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

  loading = signal(false);
  cargandoCatalogos = signal(true);
  error = signal('');
  /** Lista de errores legibles al enviar el form */
  alertas = signal<string[]>([]);
  exito = signal('');

  carreras = signal<Carrera[]>([]);
  private todosLosCiclos = signal<Ciclo[]>([]);

  filtroCarreraControl = new FormControl('', { nonNullable: true });
  filtroCarrera = signal('');

  readonly sexos = ['Hombre', 'Mujer'];
  readonly estadosCiviles = [
    'Soltero/a',
    'Casado/a',
    'Divorciado/a',
    'Viudo/a',
    'Unión libre',
  ];
  readonly etnias = [
    'Mestizo/a',
    'Indígena',
    'Afroecuatoriano/a',
    'Montubio/a',
    'Blanco/a',
    'Mulato/a',
    'Otro',
  ];
  readonly rangosEdad = [
    'Menor a 18',
    '18 a 25',
    '26 a 35',
    '36 a 45',
    'Mayor a 45',
  ];
  readonly zonas = ['Urbano', 'Rural'];

  /** Opciones de discapacidad (van en tipo_discapacidad como texto) */
  readonly tiposDiscapacidad = [
    'Física',
    'Visual',
    'Auditiva',
    'Intelectual',
    'Psicosocial',
    'Múltiple',
    'Otra',
  ];

  /**
   * Embarazo: el backend solo acepta boolean.
   * En UI usamos meses; "no" => false, cualquier mes => true.
   */
  readonly opcionesEmbarazo = [
    { value: 'no', label: 'No' },
    { value: '1', label: 'Sí — 1 mes' },
    { value: '2', label: 'Sí — 2 meses' },
    { value: '3', label: 'Sí — 3 meses' },
    { value: '4', label: 'Sí — 4 meses' },
    { value: '5', label: 'Sí — 5 meses' },
    { value: '6', label: 'Sí — 6 meses' },
    { value: '7', label: 'Sí — 7 meses' },
    { value: '8', label: 'Sí — 8 meses' },
    { value: '9', label: 'Sí — 9 meses' },
  ];

  readonly mensajesCampo: Record<string, string> = {
    cedula: 'La cédula debe ser válida (10 dígitos ecuatorianos).',
    numero_celular: 'El celular debe ser 09 seguido de 8 dígitos (ej. 0991234567).',
    primer_nombre: 'El primer nombre es obligatorio.',
    primer_apellido: 'El primer apellido es obligatorio.',
    email_personal: 'El correo personal no es válido.',
    carrera_id: 'Debes seleccionar tu carrera.',
    ciclo_id: 'Debes seleccionar tu ciclo académico.',
    sexo: 'Selecciona tu sexo.',
    estado_civil: 'Selecciona tu estado civil.',
    tiene_hijos: 'Indica si tienes hijos/as.',
    etnia: 'Selecciona tu etnia o raza.',
    idioma: 'Indica el idioma principal.',
    lugar_nacimiento: 'Indica el lugar de nacimiento.',
    fecha_nacimiento: 'La fecha debe ser DD/MM/AAAA (ej. 15/03/2002).',
    rango_edad: 'Selecciona el rango de edad.',
    nacionalidad: 'Indica la nacionalidad.',
    zona_residencia: 'Selecciona zona urbana o rural.',
    mes_embarazo: 'Si eres mujer, indica si estás embarazada y en qué mes.',
    tiene_discapacidad: 'Indica si tienes alguna discapacidad.',
    tipo_discapacidad: 'Selecciona el tipo de discapacidad.',
  };

  perfilForm: FormGroup = this.fb.group({
    cedula: ['', [Validators.required, cedulaEcuatorianaValidator()]],
    primer_nombre: ['', Validators.required],
    segundo_nombre: [''],
    primer_apellido: ['', Validators.required],
    segundo_apellido: [''],
    email_institucional: [''],
    email_personal: ['', Validators.email],
    numero_celular: ['', [Validators.required, Validators.pattern(/^09\d{8}$/)]],

    carrera_id: [''],
    ciclo_id: [{ value: '', disabled: true }],

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

    /** Solo UI: 'no' | '1'..'9' → se mapea a esta_embarazada boolean */
    mes_embarazo: ['no'],

    tiene_discapacidad: [null as boolean | null, Validators.required],
    tipo_discapacidad: [''],
  });

  private carreraIdSeleccionada = toSignal(
    this.perfilForm.controls['carrera_id'].valueChanges,
    { initialValue: '' },
  );

  perfil = computed(() => {
    const user = this.authService.user();
    return {
      nombre: user?.nombre ?? 'Estudiante',
      email: user?.email ?? '',
    };
  });

  esEstudiante = computed(() => this.authService.user()?.rol === 'ESTUDIANTE');
  esMujer = computed(() => this.perfilForm.get('sexo')?.value === 'Mujer');

  carrerasFiltradas = computed(() => {
    const termino = this.filtroCarrera();
    const lista = this.carreras();
    if (!termino) return lista;
    return lista.filter((c) => c.nombre.toLowerCase().includes(termino));
  });

  ciclosDisponibles = computed(() => {
  const carreraId = this.carreraIdSeleccionada();
  if (!carreraId) return [];

  return this.todosLosCiclos().filter((c) =>
    (c.ciclosCarreras || []).some(
      (cc) => String(cc.carrera_id || cc.carrera?.id) === String(carreraId),
    ),
  );
});

  constructor() {
    this.filtroCarreraControl.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => this.filtroCarrera.set(value.toLowerCase().trim()));

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
        if (sexo === 'Mujer') {
          mes.setValidators([Validators.required]);
        } else {
          mes.clearValidators();
          mes.setValue('no');
        }
        mes.updateValueAndValidity();
      });

    this.perfilForm.controls['tiene_discapacidad'].valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((tiene) => {
        const tipo = this.perfilForm.controls['tipo_discapacidad'];
        if (tiene === true) {
          tipo.setValidators([Validators.required]);
        } else {
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

    if (user?.rol === 'ESTUDIANTE' || user?.rol === 'INVITADO') {
      this.perfilForm.controls['carrera_id'].setValidators([Validators.required]);
      this.perfilForm.controls['ciclo_id'].setValidators([Validators.required]);
      this.perfilForm.controls['carrera_id'].updateValueAndValidity();
      this.perfilForm.controls['ciclo_id'].updateValueAndValidity();
    }

    this.cargarCatalogos();
  }

  private validarFechaNacimiento(control: AbstractControl) {
    const v = (control.value || '').trim();
    if (!v) return { required: true };
    const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(v);
    if (!m) return { formato: true };
    const d = +m[1];
    const mo = +m[2];
    const y = +m[3];
    const date = new Date(y, mo - 1, d);
    if (date.getFullYear() !== y || date.getMonth() !== mo - 1 || date.getDate() !== d) {
      return { invalida: true };
    }
    if (date > new Date()) return { futura: true };
    return null;
  }

  private cargarCatalogos(): void {
    this.cargandoCatalogos.set(true);

    this.carreraService
      .getCarreras()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => this.carreras.set(res.filter((c) => !c.fecha_desactivacion)),
        error: () => {
          this.error.set('No se pudieron cargar las carreras. Revisa tu conexión.');
          this.alertas.set(['No se pudieron cargar las carreras.']);
        },
      });

    this.ciclosService
      .getCiclos()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          const normalizados = (res || [])
            .filter((c) => !c.fecha_desactivacion)
            .map((c: any) => {
              // Backend con ManyToMany → ya viene "carreras"
              if (c.carreras) return c;

              // Si aún manda la tabla intermedia
              if (c.ciclosCarreras) {
                return {
                  ...c,
                  carreras: c.ciclosCarreras
                    .map((cc: any) => cc.carrera || { id: cc.carrera_id, nombre: '—' })
                    .filter(Boolean),
                };
              }

              return { ...c, carreras: [] };
            });

          this.todosLosCiclos.set(normalizados);
          this.cargandoCatalogos.set(false);
        },
        error: () => {
          this.error.set('No se pudieron cargar los ciclos.');
          this.alertas.set(['No se pudieron cargar los ciclos.']);
          this.cargandoCatalogos.set(false);
        },
      });
  }

  /** Construye lista de alertas legibles y marca campos */
  private recolectarAlertas(): string[] {
    const lista: string[] = [];
    const controles = this.perfilForm.controls;

    for (const nombre of Object.keys(controles)) {
      const ctrl = controles[nombre];
      if (ctrl.disabled) continue;
      if (ctrl.invalid) {
        const msg = this.mensajesCampo[nombre] || `Revisa el campo: ${nombre}`;
        lista.push(msg);
      }
    }
    return lista;
  }

  guardar(): void {
    this.error.set('');
    this.exito.set('');
    this.alertas.set([]);
    this.perfilForm.markAllAsTouched();

    if (this.perfilForm.invalid) {
      const lista = this.recolectarAlertas();
      this.alertas.set(lista);
      this.error.set(
        lista.length
          ? `Hay ${lista.length} campo(s) por corregir. Revisa la lista abajo.`
          : 'Revisa los campos marcados en rojo.',
      );
      // Scroll al banner de alertas
      setTimeout(() => {
        document.querySelector('.alert-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 50);
      return;
    }

    this.loading.set(true);
    const v = this.perfilForm.getRawValue();

    const mes = v.mes_embarazo as string;
    const estaEmbarazada = v.sexo === 'Mujer' ? mes !== 'no' && mes !== '' : false;

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
    };

    if (v.segundo_nombre) payload.segundo_nombre = v.segundo_nombre;
    if (v.segundo_apellido) payload.segundo_apellido = v.segundo_apellido;
    if (v.email_institucional) payload.email_institucional = v.email_institucional;
    if (v.email_personal) payload.email_personal = v.email_personal;


    payload.carrera_id = v.carrera_id;
    payload.ciclo_id = v.ciclo_id;

    if (v.sexo === 'Mujer') {
      payload.esta_embarazada = estaEmbarazada;
    }

    if (v.tiene_discapacidad) {
      payload.tipo_discapacidad = v.tipo_discapacidad;
    }

    this.usuarioService
      .completarPerfil(payload)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.authService.marcarPerfilCompleto({
            cedula: payload.cedula,
            carrera_id: payload.carrera_id,
            ciclo_id: payload.ciclo_id,
          });
          this.loading.set(false);
          this.exito.set('¡Perfil guardado correctamente! Redirigiendo...');
          this.alertas.set([]);
          this.error.set('');
          setTimeout(() => this.router.navigate(['/estudiante/inicio']), 900);
        },
        error: (err) => {
          this.loading.set(false);
          console.error('Error completar perfil:', err?.error);
          const msg = err?.error?.message;
          if (Array.isArray(msg)) {
            this.alertas.set(msg);
            this.error.set('El servidor rechazó algunos datos. Corrige lo siguiente:');
          } else if (typeof msg === 'string') {
            this.alertas.set([msg]);
            this.error.set(msg);
          } else {
            this.error.set('No se pudo guardar. Intenta de nuevo o revisa tu conexión.');
            this.alertas.set(['Error de servidor o de red.']);
          }
          setTimeout(() => {
            document.querySelector('.alert-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }, 50);
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
    return this.mensajesCampo[nombre] || 'Campo inválido';
  }
}