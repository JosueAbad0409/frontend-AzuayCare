import { Component, OnInit, OnDestroy, inject, signal, computed, DestroyRef, ChangeDetectionStrategy, ViewEncapsulation } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators, AbstractControl } from '@angular/forms';
import { forkJoin, finalize, Subject, Subscription, of } from 'rxjs';
import { debounceTime, catchError } from 'rxjs/operators';
import Swal from 'sweetalert2';

import { Usuario } from '../../../core/models/usuario.model';
import { Carrera } from '../../../core/models/carrera.model';
import { Ciclo } from '../../../core/models/ciclo.model';
import { CoordinadorCarreraAsignacion } from '../../../core/models/coordinador-carrera.model';
import { UsuarioService } from '../../../core/services/usuario.service';
import { CarreraService } from '../../../core/services/carrera.service';
import { CiclosService } from '../../../core/services/ciclos.service';
import { CoordinadorCarreraService } from '../../../core/services/coordinador-carrera.service';
import { UbicacionesService } from '../../../core/services/ubicaciones.service';
import { ToastService } from '../../../core/services/toast.service';
import { cedulaEcuatorianaValidator } from '../../../core/validators/cedula.validator';

type TabEdicion = 'identidad' | 'academico' | 'socioeconomico';

@Component({
  selector: 'app-usuarios',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './usuarios.component.html',
  styleUrls: ['./usuarios.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.Emulated
})
export class UsuariosComponent implements OnInit, OnDestroy {
  // Inyección de servicios principales
  private readonly fb = inject(FormBuilder);
  private readonly usuarioService = inject(UsuarioService);
  private readonly carreraService = inject(CarreraService);
  private readonly ciclosService = inject(CiclosService);
  private readonly coordinadorCarreraService = inject(CoordinadorCarreraService);
  private readonly ubicacionesService = inject(UbicacionesService);
  private readonly toastService = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  // Estados reactivos (Signals) - Directorio
  readonly usuarios = signal<Usuario[]>([]);
  readonly carreras = signal<Carrera[]>([]);
  readonly ciclos = signal<Ciclo[]>([]);
  readonly asignaciones = signal<CoordinadorCarreraAsignacion[]>([]);
  readonly paises = signal<any[]>([]);

  readonly isLoading = signal<boolean>(true);
  readonly isSaving = signal<boolean>(false);

  // Filtros tabla de usuarios
  readonly filterNombre = signal<string>('');
  readonly filterCorreo = signal<string>('');
  readonly filterCedula = signal<string>('');
  readonly filterRol = signal<string>('');
  readonly filterCarrera = signal<string>('');
  readonly filtroEstado = signal<'ACTIVOS' | 'INACTIVOS' | 'TODOS'>('ACTIVOS');

  // Filtros tabla de asignaciones
  readonly filterAsigCoord = signal<string>('');
  readonly filterAsigCarrera = signal<string>('');
  readonly filterAsigFecha = signal<string>('');

  private readonly filterSubject = new Subject<{ campo: string; valor: string }>();
  private filterSubscription?: Subscription;

  // Clases CSS personalizadas para modales SweetAlert2 (solo se usan en "Asignar Coordinador")
  private readonly SWAL_CUSTOM_CLASS = {
    popup: 'custom-swal-popup custom-swal-centered',
    confirmButton: 'custom-swal-confirm',
    cancelButton: 'custom-swal-cancel',
    htmlContainer: 'custom-swal-html'
  };

  // ==========================================================
  //  MODAL DE EDICIÓN NATIVO (Reactive Forms) - Reemplaza SweetAlert2
  // ==========================================================
  readonly modalEdicionAbierto = signal(false);
  readonly guardandoEdicion = signal(false);
  readonly cargandoUsuarioEdicion = signal(false);
  readonly errorEdicion = signal('');
  readonly tabActivo = signal<TabEdicion>('identidad');
  readonly usuarioEditando = signal<any | null>(null);

  private readonly todosLosCiclos = signal<Ciclo[]>([]);
  readonly ciclosDisponiblesEdicion = signal<Ciclo[]>([]);
  readonly provinciasEdicion = signal<any[]>([]);
  readonly cantonesEdicion = signal<any[]>([]);

  readonly tiposDocumento = ['Cédula Ecuatoriana', 'Pasaporte', 'Documento Extranjero'];
  readonly sexos = ['Hombre', 'Mujer'];
  readonly generos = ['Masculino', 'Femenino', 'LGBTIQ+', 'Prefiero no decirlo'];
  readonly estadosCiviles = ['Soltero/a', 'Casado/a', 'Divorciado/a', 'Viudo/a', 'Unión libre'];
  readonly etnias = ['Mestizo/a', 'Indígena', 'Afroecuatoriano/a', 'Montubio/a', 'Blanco/a', 'Mulato/a', 'Otro'];
  readonly idiomas = ['Español', 'Kichwa', 'Shuar', 'Achuar', 'Cha´palaa', 'Awapit', 'Tsafiki', 'Inglés', 'Otro'];

  private readonly nombreRegex = /^[a-zA-ZñÑáéíóúÁÉÍÓÚüÜ\s]+$/;
  readonly maxDateNacimiento: string;
  readonly minDateNacimiento: string;
  readonly edicionForm: FormGroup;

  // Mapa de qué pestaña pertenece cada control (para saltar automáticamente al error)
  private readonly tabPorControl: Record<string, TabEdicion> = {
    tipo_documento: 'identidad', cedula: 'identidad', primer_nombre: 'identidad', segundo_nombre: 'identidad',
    primer_apellido: 'identidad', segundo_apellido: 'identidad', email_institucional: 'identidad',
    numero_celular: 'identidad', rol_id: 'identidad',
    carrera_id: 'academico', ciclo_id: 'academico',
    sexo: 'socioeconomico', genero: 'socioeconomico', estado_civil: 'socioeconomico',
    etnia: 'socioeconomico', pueblo_nacionalidad: 'socioeconomico', etnia_otra: 'socioeconomico', 
    idioma: 'socioeconomico', idioma_otro: 'socioeconomico',
    fecha_nacimiento: 'socioeconomico', nacionalidad_id: 'socioeconomico', pais_nacimiento_id: 'socioeconomico',
    provincia_nacimiento_id: 'socioeconomico', canton_nacimiento_id: 'socioeconomico'
  };

  // Listado computado de coordinadores disponibles
  readonly coordinadoresCarreraList = computed(() => {
    return this.usuarios().filter(u => {
      const rol = u.rol?.nombre || '';
      return (rol.includes('COORDINADOR') || rol === 'ADMIN') && !u.fecha_desactivacion;
    });
  });

  // Listado de roles para el filtro y para el select de edición
  readonly rolesDisponibles = computed(() => {
    const set = new Set<string>();
    this.usuarios().forEach(u => {
      if (u.rol?.nombre) set.add(u.rol.nombre);
    });
    return Array.from(set);
  });

  readonly rolesParaEdicion = computed(() => {
    const map = new Map<string, string>();
    this.usuarios().forEach(u => {
      if (u.rol?.id && u.rol?.nombre) map.set(u.rol.nombre, u.rol.id);
    });
    return Array.from(map.entries()).map(([nombre, id]) => ({ id, nombre }));
  });

  // Verificador de filtros activos
  readonly tieneFiltrosActivos = computed(() => {
    return !!(
      this.filterNombre() ||
      this.filterCorreo() ||
      this.filterCedula() ||
      this.filterRol() ||
      this.filterCarrera() ||
      this.filtroEstado() !== 'ACTIVOS' ||
      this.filterAsigCoord() ||
      this.filterAsigCarrera() ||
      this.filterAsigFecha()
    );
  });

  // Usuarios filtrados dinámicamente
  readonly usuariosFiltrados = computed(() => {
    const fNombre = this.filterNombre().toLowerCase().trim();
    const fCorreo = this.filterCorreo().toLowerCase().trim();
    const fCedula = this.filterCedula().toLowerCase().trim();
    const fRol = this.filterRol();
    const fCarrera = this.filterCarrera().toLowerCase().trim();
    const estado = this.filtroEstado();

    return this.usuarios().filter(u => {
      const estaInactivo = !!u.fecha_desactivacion;
      if (estado === 'ACTIVOS' && estaInactivo) return false;
      if (estado === 'INACTIVOS' && !estaInactivo) return false;

      if (fNombre) {
        const nombreCompleto = `${u.primer_nombre || ''} ${u.segundo_nombre || ''} ${u.primer_apellido || ''} ${u.segundo_apellido || ''}`.toLowerCase();
        if (!nombreCompleto.includes(fNombre)) return false;
      }

      if (fCorreo) {
        if (!u.email_institucional || !u.email_institucional.toLowerCase().includes(fCorreo)) return false;
      }

      if (fCedula) {
        if (!u.cedula || !u.cedula.includes(fCedula)) return false;
      }

      if (fRol) {
        const rolNombre = u.rol?.nombre || 'ESTUDIANTE';
        if (rolNombre !== fRol) return false;
      }

      if (fCarrera) {
        const carreraNombre = this.getCarreraNombreDeAsignacion(u).toLowerCase();
        if (!carreraNombre.includes(fCarrera)) return false;
      }

      return true;
    });
  });

  // Asignaciones filtradas dinámicamente
  readonly asignacionesFiltradas = computed(() => {
    const fCoord = this.filterAsigCoord().toLowerCase().trim();
    const fCarr = this.filterAsigCarrera().toLowerCase().trim();
    const fFecha = this.filterAsigFecha().trim();

    return this.asignaciones().filter(a => {
      if (fCoord) {
        const nombreCoord = `${a.usuario?.primer_nombre || ''} ${a.usuario?.primer_apellido || ''}`.toLowerCase();
        if (!nombreCoord.includes(fCoord)) return false;
      }

      if (fCarr) {
        const nombreCarrera = (a.carrera?.nombre || '').toLowerCase();
        if (!nombreCarrera.includes(fCarr)) return false;
      }

      if (fFecha) {
        const fIniStr = a.fecha_inicio ? new Date(a.fecha_inicio).toISOString().substring(0, 10) : '';
        const fFinStr = a.fecha_fin ? new Date(a.fecha_fin).toISOString().substring(0, 10) : '';
        if (fIniStr !== fFecha && fFinStr !== fFecha) return false;
      }

      return true;
    });
  });

  constructor() {
    const hoy = new Date();
    const mes = ('0' + (hoy.getMonth() + 1)).slice(-2);
    const dia = ('0' + hoy.getDate()).slice(-2);
    this.maxDateNacimiento = `${hoy.getFullYear() - 16}-${mes}-${dia}`;
    this.minDateNacimiento = `${hoy.getFullYear() - 80}-${mes}-${dia}`;

    this.edicionForm = this.fb.group({
      tipo_documento: ['Cédula Ecuatoriana', Validators.required],
      cedula: ['', [Validators.required, cedulaEcuatorianaValidator()]],
      numero_celular: ['', [Validators.required, Validators.pattern(/^09\d{8}$/)]],
      email_institucional: ['', [Validators.required, Validators.email, Validators.pattern(/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/)]],
      primer_nombre: ['', [Validators.required, Validators.pattern(this.nombreRegex), Validators.minLength(3), Validators.maxLength(50)]],
      segundo_nombre: ['', [Validators.pattern(this.nombreRegex), Validators.maxLength(50)]],
      primer_apellido: ['', [Validators.required, Validators.pattern(this.nombreRegex), Validators.minLength(3), Validators.maxLength(50)]],
      segundo_apellido: ['', [Validators.pattern(this.nombreRegex), Validators.maxLength(50)]],
      rol_id: ['', Validators.required],

      carrera_id: [null as string | null, Validators.required],
      ciclo_id: [{ value: null as string | null, disabled: true }, Validators.required],

      sexo: ['', Validators.required],
      genero: ['', Validators.required],
      estado_civil: ['', Validators.required],

      etnia: ['', Validators.required],
      pueblo_nacionalidad: [''],
      etnia_otra: [''],

      idioma: ['', Validators.required],
      idioma_otro: [''],

      fecha_nacimiento: ['', [Validators.required, this.validarFechaNacimientoNative.bind(this)]],
      nacionalidad_id: ['', Validators.required],

      pais_nacimiento_id: ['', Validators.required],
      provincia_nacimiento_id: [{ value: '', disabled: true }],
      canton_nacimiento_id: [{ value: '', disabled: true }],
    });

    this.configurarSuscripcionesEdicion();
  }

  ngOnInit(): void {
    this.filterSubscription = this.filterSubject
      .pipe(debounceTime(400))
      .subscribe(({ campo, valor }) => {
        this.aplicarFiltroSignal(campo, valor);
      });

    this.cargarTodo();
  }

  ngOnDestroy(): void {
    this.filterSubscription?.unsubscribe();
  }

  onColumnFilterInput(campo: string, event: Event): void {
    const valor = (event.target as HTMLInputElement | HTMLSelectElement).value;
    this.filterSubject.next({ campo, valor });
  }

  limpiarFiltros(): void {
    this.filterNombre.set('');
    this.filterCorreo.set('');
    this.filterCedula.set('');
    this.filterRol.set('');
    this.filterCarrera.set('');
    this.filtroEstado.set('ACTIVOS');
    this.filterAsigCoord.set('');
    this.filterAsigCarrera.set('');
    this.filterAsigFecha.set('');
  }

  private aplicarFiltroSignal(campo: string, valor: string): void {
    switch (campo) {
      case 'nombre': this.filterNombre.set(valor); break;
      case 'correo': this.filterCorreo.set(valor); break;
      case 'cedula': this.filterCedula.set(valor); break;
      case 'rol': this.filterRol.set(valor); break;
      case 'carrera': this.filterCarrera.set(valor); break;
      case 'estado': this.filtroEstado.set(valor as 'ACTIVOS' | 'INACTIVOS' | 'TODOS'); break;
      case 'asigCoord': this.filterAsigCoord.set(valor); break;
      case 'asigCarrera': this.filterAsigCarrera.set(valor); break;
      case 'asigFecha': this.filterAsigFecha.set(valor); break;
    }
  }

  cargarTodo(): void {
    this.isLoading.set(true);

    forkJoin({
      carreras: this.carreraService.getCarreras().pipe(catchError(() => of([]))),
      ciclos: this.ciclosService.getCiclos().pipe(catchError(() => of([]))),
      paises: this.ubicacionesService.getPaises().pipe(catchError(() => of([]))),
      asignaciones: this.coordinadorCarreraService.getAsignaciones().pipe(catchError(() => of([]))),
      usuarios: this.usuarioService.getUsuarios().pipe(catchError(() => of([])))
    })
    .pipe(finalize(() => this.isLoading.set(false)))
    .subscribe({
      next: ({ carreras, ciclos, paises, asignaciones, usuarios }) => {
        this.carreras.set(carreras || []);
        this.ciclos.set(ciclos || []);
        this.todosLosCiclos.set((ciclos || []).filter((c: any) => !c.fecha_desactivacion));
        this.paises.set(paises || []);
        this.asignaciones.set(asignaciones || []);
        this.usuarios.set(usuarios || []);
      },
      error: (err: HttpErrorResponse) => {
        console.error('Error al cargar datos:', err);
        this.toastService.show('Error al obtener los datos del sistema.', 'error');
      }
    });
  }

  getCarreraNombreDeAsignacion(usuario: Usuario): string {
    if (usuario.carrera?.nombre) return usuario.carrera.nombre;
    const match = this.asignaciones().find(a => a.usuario_id === usuario.id && !a.fecha_fin);
    return match ? (match.carrera?.nombre || 'Carrera Asignada') : 'Sin Carrera';
  }

  getCicloNombre(cicloId?: string | null): string {
    if (!cicloId) return 'N/A';
    const match = this.ciclos().find(c => c.id === cicloId);
    return match ? match.nombre : 'N/A';
  }

  // ==========================================================
  //  MODAL "ASIGNAR COORDINADOR" (se conserva con SweetAlert2, sin cambios funcionales)
  // ==========================================================
  abrirModalAsignar(): void {
    if (this.isSaving()) return;

    const listaUsuarios = this.coordinadoresCarreraList();
    const listaCarreras = this.carreras();

    const generarUsuariosHTML = (usuarios: Usuario[]) => {
      if (usuarios.length === 0) return `<div class="swal-empty-msg">No se encontraron resultados</div>`;
      return usuarios.map(u => `
        <label class="swal-radio-option">
          <input type="radio" name="swal-asig-user-radio" value="${u.id}">
          <div class="swal-radio-content">
            <span class="item-title">${u.primer_nombre || ''} ${u.primer_apellido || ''}</span>
            <span class="item-subtitle"><i class="fas fa-envelope"></i> ${u.email_institucional || 'N/A'}</span>
          </div>
        </label>
      `).join('');
    };

    const generarCarrerasHTML = (carreras: Carrera[]) => {
      if (carreras.length === 0) return `<div class="swal-empty-msg">No se encontraron resultados</div>`;
      return carreras.map(c => `
        <label class="swal-radio-option">
          <input type="radio" name="swal-asig-carrera-radio" value="${c.id}">
          <div class="swal-radio-content">
            <span class="item-title">${c.nombre}</span>
          </div>
        </label>
      `).join('');
    };

    Swal.fire({
      title: 'Asignar Coordinador a Carrera',
      html: `
        <div class="swal-form-card">
          <div class="swal-header-banner banner-green">
            <i class="fas fa-user-tag banner-icon icon-green"></i>
            <div>
              <div class="banner-title">Asignación Académica Directa</div>
              <div class="banner-sub">Selecciona el coordinador y la carrera correspondiente.</div>
            </div>
          </div>

          <div class="swal-two-columns">
            <div class="swal-field-card">
              <div class="swal-field-header">
                <label class="swal-form-label">1. Coordinador <span class="req">*</span></label>
                <input id="swal-search-user" type="text" class="swal-inline-search" placeholder="🔍 Buscar nombre/correo..." />
              </div>
              <div id="swal-user-list" class="swal-custom-list">
                ${generarUsuariosHTML(listaUsuarios)}
              </div>
            </div>

            <div class="swal-field-card">
              <div class="swal-field-header">
                <label class="swal-form-label">2. Carrera <span class="req">*</span></label>
                <input id="swal-search-carrera" type="text" class="swal-inline-search" placeholder="🔍 Buscar carrera..." />
              </div>
              <div id="swal-carrera-list" class="swal-custom-list">
                ${generarCarrerasHTML(listaCarreras)}
              </div>
            </div>
          </div>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: '<i class="fas fa-check-circle"></i> Guardar Asignación',
      cancelButtonText: '<i class="fas fa-times"></i> Cancelar',
      confirmButtonColor: '#10b981',
      cancelButtonColor: '#64748b',
      width: '820px',
      customClass: this.SWAL_CUSTOM_CLASS,
      didOpen: () => {
        const inputSearchUser = document.getElementById('swal-search-user') as HTMLInputElement;
        const containerUser = document.getElementById('swal-user-list') as HTMLDivElement;
        const inputSearchCarrera = document.getElementById('swal-search-carrera') as HTMLInputElement;
        const containerCarrera = document.getElementById('swal-carrera-list') as HTMLDivElement;

        inputSearchUser?.addEventListener('input', () => {
          const query = inputSearchUser.value.toLowerCase().trim();
          const filtrados = listaUsuarios.filter(u =>
            `${u.primer_nombre} ${u.primer_apellido} ${u.email_institucional}`.toLowerCase().includes(query)
          );
          containerUser.innerHTML = generarUsuariosHTML(filtrados);
        });

        inputSearchCarrera?.addEventListener('input', () => {
          const query = inputSearchCarrera.value.toLowerCase().trim();
          const filtrados = listaCarreras.filter(c => c.nombre.toLowerCase().includes(query));
          containerCarrera.innerHTML = generarCarrerasHTML(filtrados);
        });
      },
      preConfirm: () => {
        const userRadio = document.querySelector('input[name="swal-asig-user-radio"]:checked') as HTMLInputElement;
        const carreraRadio = document.querySelector('input[name="swal-asig-carrera-radio"]:checked') as HTMLInputElement;

        if (!userRadio || !carreraRadio) {
          Swal.showValidationMessage('Debes seleccionar un coordinador y una carrera de las listas.');
          return false;
        }
        return { usuario_id: userRadio.value, carrera_id: carreraRadio.value };
      }
    }).then((result) => {
      if (result.isConfirmed && result.value) {
        this.guardarAsignacion(result.value);
      }
    });
  }

  private guardarAsignacion(data: any): void {
    if (this.isSaving()) return;
    this.isSaving.set(true);

    this.coordinadorCarreraService.asignarCoordinador(data)
      .pipe(finalize(() => this.isSaving.set(false)))
      .subscribe({
        next: () => {
          this.toastService.show('Coordinador asignado con éxito.', 'success');
          this.cargarTodo();
        },
        error: (err: HttpErrorResponse) => {
          this.toastService.show(this.extraerMensajeError(err, 'Error al asignar coordinador.'), 'error');
        }
      });
  }

  desasignar(usuarioId: string, carreraId: string): void {
    if (this.isSaving()) return;

    Swal.fire({
      title: '¿Remover asignación?',
      text: 'El usuario dejará de ser coordinador de esta carrera.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#64748b',
      confirmButtonText: '<i class="fas fa-trash-alt"></i> Sí, remover',
      cancelButtonText: '<i class="fas fa-times"></i> Cancelar',
      customClass: this.SWAL_CUSTOM_CLASS
    }).then((result) => {
      if (result.isConfirmed) {
        this.isSaving.set(true);
        this.coordinadorCarreraService.desasignarCoordinador(usuarioId, carreraId)
          .pipe(finalize(() => this.isSaving.set(false)))
          .subscribe({
            next: () => {
              this.toastService.show('Asignación removida con éxito.', 'info');
              this.cargarTodo();
            },
            error: (err: HttpErrorResponse) => {
              this.toastService.show(this.extraerMensajeError(err, 'Error al eliminar la asignación.'), 'error');
            }
          });
      }
    });
  }

  eliminarUsuario(id: string): void {
    if (this.isSaving()) return;

    Swal.fire({
      title: '¿Desactivar usuario?',
      text: 'Esta acción desactivará su acceso al sistema.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#64748b',
      confirmButtonText: '<i class="fas fa-user-minus"></i> Sí, desactivar',
      cancelButtonText: '<i class="fas fa-times"></i> Cancelar',
      customClass: this.SWAL_CUSTOM_CLASS
    }).then((result) => {
      if (result.isConfirmed) {
        this.isSaving.set(true);
        this.usuarioService.delete(id)
          .pipe(finalize(() => this.isSaving.set(false)))
          .subscribe({
            next: () => {
              this.toastService.show('Usuario desactivado con éxito.', 'info');
              this.cargarTodo();
            },
            error: (err: HttpErrorResponse) => {
              this.toastService.show(this.extraerMensajeError(err, 'Error al desactivar usuario.'), 'error');
            }
          });
      }
    });
  }

  // ==========================================================
  //  MODAL DE EDICIÓN NATIVO - LÓGICA REPLICADA DE completar-perfil
  // ==========================================================

  private configurarSuscripcionesEdicion(): void {
    // Bloqueo inicial estricto de los buscadores dependientes de ubicación
    this.edicionForm.controls['provincia_nacimiento_id'].disable({ emitEvent: false });
    this.edicionForm.controls['canton_nacimiento_id'].disable({ emitEvent: false });

    // Tipo de documento -> validadores dinámicos de cédula
    this.edicionForm.controls['tipo_documento'].valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((tipo) => {
      const controlDoc = this.edicionForm.controls['cedula'];
      controlDoc.clearValidators();
      if (tipo === 'Cédula Ecuatoriana') controlDoc.setValidators([Validators.required, cedulaEcuatorianaValidator()]);
      else controlDoc.setValidators([Validators.required, Validators.pattern(/^[a-zA-Z0-9]{5,20}$/)]);
      controlDoc.updateValueAndValidity({ emitEvent: false });
    });

    // Carrera -> filtra y habilita ciclo académico
    let prevCarreraId: string | null = null;
    this.edicionForm.controls['carrera_id'].valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((carreraId) => {
      if (carreraId === prevCarreraId) return;
      prevCarreraId = carreraId;
      const cicloControl = this.edicionForm.controls['ciclo_id'];
      if (!carreraId) {
        this.ciclosDisponiblesEdicion.set([]);
        cicloControl.disable({ emitEvent: false });
        cicloControl.setValue(null, { emitEvent: false });
        return;
      }
      const ciclosFiltrados = (this.todosLosCiclos() || []).filter((c: any) =>
        (c?.ciclosCarreras || []).some((cc: any) => String(cc.carrera_id || cc.carrera?.id) === String(carreraId))
      );
      this.ciclosDisponiblesEdicion.set(ciclosFiltrados);
      const cicloActual = cicloControl.value;
      const sigueSiendoValido = ciclosFiltrados.some(c => c.id === cicloActual);
      if (!sigueSiendoValido) cicloControl.setValue(null, { emitEvent: false });
      if (ciclosFiltrados.length > 0) cicloControl.enable({ emitEvent: false }); else cicloControl.disable({ emitEvent: false });
    });

    // Etnia -> pueblo / etnia otra
    this.edicionForm.controls['etnia'].valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((etnia) => {
      const pueblo = this.edicionForm.controls['pueblo_nacionalidad'];
      const etniaOtra = this.edicionForm.controls['etnia_otra'];
      if (etnia && etnia.includes('Indígena')) pueblo.setValidators([Validators.required, Validators.pattern(this.nombreRegex)]);
      else { pueblo.clearValidators(); pueblo.setValue('', { emitEvent: false }); }
      if (etnia === 'Otro') etniaOtra.setValidators([Validators.required, Validators.pattern(this.nombreRegex)]);
      else { etniaOtra.clearValidators(); etniaOtra.setValue('', { emitEvent: false }); }
      pueblo.updateValueAndValidity({ emitEvent: false });
      etniaOtra.updateValueAndValidity({ emitEvent: false });
    });

    // Idioma -> idioma otro
    this.edicionForm.controls['idioma'].valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((idioma) => {
      const idiomaOtro = this.edicionForm.controls['idioma_otro'];
      if (idioma === 'Otro') idiomaOtro.setValidators([Validators.required, Validators.pattern(this.nombreRegex)]);
      else { idiomaOtro.clearValidators(); idiomaOtro.setValue('', { emitEvent: false }); }
      idiomaOtro.updateValueAndValidity({ emitEvent: false });
    });

    // Nacionalidad -> autocompleta y bloquea país de nacimiento
    this.edicionForm.controls['nacionalidad_id'].valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((nacionalidadId) => {
      const ctrlPaisNac = this.edicionForm.controls['pais_nacimiento_id'];
      if (nacionalidadId) {
        ctrlPaisNac.setValue(nacionalidadId, { emitEvent: true });
        ctrlPaisNac.disable({ emitEvent: false });
      } else {
        ctrlPaisNac.setValue('', { emitEvent: true });
        ctrlPaisNac.enable({ emitEvent: false });
      }
    });

    // País de nacimiento -> carga provincias
    this.edicionForm.controls['pais_nacimiento_id'].valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((paisId) => {
      const ctrlProv = this.edicionForm.controls['provincia_nacimiento_id'];
      const ctrlCan = this.edicionForm.controls['canton_nacimiento_id'];

      ctrlProv.setValue('', { emitEvent: false });
      ctrlCan.setValue('', { emitEvent: false });
      ctrlProv.disable({ emitEvent: false });
      ctrlCan.disable({ emitEvent: false });
      this.provinciasEdicion.set([]);
      this.cantonesEdicion.set([]);

      if (paisId) {
        this.ubicacionesService.getProvincias(paisId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
          next: (provs) => {
            this.provinciasEdicion.set(provs || []);
            if (provs && provs.length > 0) {
              ctrlProv.enable({ emitEvent: false });
              ctrlProv.setValidators([Validators.required]);
            } else {
              ctrlProv.clearValidators();
              ctrlCan.clearValidators();
            }
            ctrlProv.updateValueAndValidity({ emitEvent: false });
            ctrlCan.updateValueAndValidity({ emitEvent: false });
          },
          error: () => this.errorEdicion.set('Error al cargar las provincias.')
        });
      } else {
        ctrlProv.clearValidators();
        ctrlCan.clearValidators();
        ctrlProv.updateValueAndValidity({ emitEvent: false });
        ctrlCan.updateValueAndValidity({ emitEvent: false });
      }
    });

    // Provincia de nacimiento -> carga cantones
    this.edicionForm.controls['provincia_nacimiento_id'].valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((provId) => {
      const ctrlCan = this.edicionForm.controls['canton_nacimiento_id'];
      ctrlCan.setValue('', { emitEvent: false });
      ctrlCan.disable({ emitEvent: false });
      this.cantonesEdicion.set([]);

      if (provId) {
        this.ubicacionesService.getCantones(provId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
          next: (cants) => {
            this.cantonesEdicion.set(cants || []);
            if (cants && cants.length > 0) {
              ctrlCan.enable({ emitEvent: false });
              ctrlCan.setValidators([Validators.required]);
            } else {
              ctrlCan.clearValidators();
            }
            ctrlCan.updateValueAndValidity({ emitEvent: false });
          },
          error: () => this.errorEdicion.set('Error al cargar los cantones.')
        });
      } else {
        ctrlCan.clearValidators();
        ctrlCan.updateValueAndValidity({ emitEvent: false });
      }
    });
  }

  cambiarTab(tab: TabEdicion): void {
    this.tabActivo.set(tab);
  }

  onIdentificacionInput(event: any): void {
    const tipo = this.edicionForm.get('tipo_documento')?.value;
    let valor = this.sanitizeInput(event?.target?.value || '');
    if (tipo === 'Cédula Ecuatoriana') valor = valor.replace(/[^0-9]/g, '').substring(0, 10);
    else valor = valor.replace(/[^a-zA-Z0-9]/g, '').substring(0, 20);
    this.edicionForm.controls['cedula'].setValue(valor, { emitEvent: false });
  }

  onCelularInput(event: any): void {
    let valor = this.sanitizeInput(event?.target?.value || '').replace(/[^0-9]/g, '').substring(0, 10);
    this.edicionForm.controls['numero_celular'].setValue(valor, { emitEvent: false });
  }

  onLetrasInput(controlName: string, event: any): void {
    let valor = this.sanitizeInput(event?.target?.value || '').replace(/[^a-zA-ZñÑáéíóúÁÉÍÓÚüÜ\s]/g, '');
    if (this.edicionForm.controls[controlName]) this.edicionForm.controls[controlName].setValue(valor, { emitEvent: false });
  }

  abrirModalEditar(uSummary: Usuario): void {
    if (this.isSaving() || this.cargandoUsuarioEdicion()) return;
    this.cargandoUsuarioEdicion.set(true);

    this.usuarioService.getUsuarioById(uSummary.id).subscribe({
      next: (usuarioCompleto: any) => {
        this.cargandoUsuarioEdicion.set(false);
        this.iniciarEdicion(usuarioCompleto);
      },
      error: () => {
        this.cargandoUsuarioEdicion.set(false);
        this.iniciarEdicion(uSummary);
      }
    });
  }

  private iniciarEdicion(u: any): void {
    this.errorEdicion.set('');
    this.tabActivo.set('identidad');
    this.usuarioEditando.set(u);
    this.provinciasEdicion.set([]);
    this.cantonesEdicion.set([]);
    this.ciclosDisponiblesEdicion.set([]);

    // Reset completo del formulario antes de cargar el nuevo usuario
    this.edicionForm.reset({
      tipo_documento: 'Cédula Ecuatoriana',
      cedula: '', numero_celular: '', email_institucional: '',
      primer_nombre: '', segundo_nombre: '', primer_apellido: '', segundo_apellido: '',
      rol_id: '', carrera_id: null, ciclo_id: null,
      sexo: '', genero: '', estado_civil: '',
      etnia: '', pueblo_nacionalidad: '', etnia_otra: '',
      idioma: '', idioma_otro: '',
      fecha_nacimiento: '', nacionalidad_id: '', pais_nacimiento_id: '',
      provincia_nacimiento_id: '', canton_nacimiento_id: ''
    }, { emitEvent: false });
    this.edicionForm.controls['ciclo_id'].disable({ emitEvent: false });
    this.edicionForm.controls['provincia_nacimiento_id'].disable({ emitEvent: false });
    this.edicionForm.controls['canton_nacimiento_id'].disable({ emitEvent: false });

    const idiomasBase = this.idiomas;
    const idiomaEsOtro = !!u.idioma && !idiomasBase.includes(u.idioma);
    const valIdiomaSelect = idiomaEsOtro ? 'Otro' : (u.idioma || 'Español');
    const valIdiomaOtro = idiomaEsOtro ? u.idioma : (u.idioma_otro || '');

    const fnFormatted = u.fecha_nacimiento ? new Date(u.fecha_nacimiento).toISOString().split('T')[0] : '';
    const idNacionalidadSel = u.nacionalidad_id || (this.paises().find(p => p.nombre === 'Ecuador' || p.nacionalidad === 'Ecuatoriana')?.id || '');
    const idPaisNacSel = u.pais_nacimiento_id || idNacionalidadSel;

    this.edicionForm.patchValue({
      tipo_documento: u.tipo_documento || 'Cédula Ecuatoriana',
      cedula: this.sanitizeInput(u.cedula || ''),
      numero_celular: this.sanitizeInput(u.numero_celular || ''),
      email_institucional: this.sanitizeInput(u.email_institucional || ''),
      primer_nombre: this.sanitizeInput(u.primer_nombre || ''),
      segundo_nombre: this.sanitizeInput(u.segundo_nombre || ''),
      primer_apellido: this.sanitizeInput(u.primer_apellido || ''),
      segundo_apellido: this.sanitizeInput(u.segundo_apellido || ''),
      rol_id: u.rol?.id || u.rol_id || '',
      sexo: u.sexo || '',
      genero: u.genero || '',
      estado_civil: u.estado_civil || '',
      etnia: u.etnia || '',
      pueblo_nacionalidad: this.sanitizeInput(u.pueblo_nacionalidad || ''),
      etnia_otra: this.sanitizeInput(u.etnia_otra || ''),
      idioma: valIdiomaSelect,
      idioma_otro: this.sanitizeInput(valIdiomaOtro),
      fecha_nacimiento: fnFormatted,
      nacionalidad_id: idNacionalidadSel,
    }, { emitEvent: false });

    // Carrera / Ciclo (carga manual para evitar condiciones de carrera con el listener)
    const carreraId = u.carrera_id || u.carrera?.id || null;
    this.edicionForm.controls['carrera_id'].setValue(carreraId, { emitEvent: false });
    if (carreraId) {
      const ciclosFiltrados = (this.todosLosCiclos() || []).filter((c: any) =>
        (c?.ciclosCarreras || []).some((cc: any) => String(cc.carrera_id || cc.carrera?.id) === String(carreraId))
      );
      this.ciclosDisponiblesEdicion.set(ciclosFiltrados);
      if (ciclosFiltrados.length > 0) this.edicionForm.controls['ciclo_id'].enable({ emitEvent: false });
    }
    const cicloId = u.ciclo_id || u.ciclo?.id || null;
    this.edicionForm.controls['ciclo_id'].setValue(cicloId, { emitEvent: false });

    // Ubicación en cascada: país -> provincia -> cantón (carga manual)
    this.edicionForm.controls['pais_nacimiento_id'].setValue(idPaisNacSel, { emitEvent: false });
    if (idNacionalidadSel) this.edicionForm.controls['pais_nacimiento_id'].disable({ emitEvent: false });

    if (idPaisNacSel) {
      this.ubicacionesService.getProvincias(idPaisNacSel).subscribe({
        next: (provs) => {
          this.provinciasEdicion.set(provs || []);
          if (provs && provs.length > 0) {
            this.edicionForm.controls['provincia_nacimiento_id'].enable({ emitEvent: false });
            this.edicionForm.controls['provincia_nacimiento_id'].setValidators([Validators.required]);
          }
          const provinciaId = u.provincia_nacimiento_id || null;
          this.edicionForm.controls['provincia_nacimiento_id'].setValue(provinciaId, { emitEvent: false });
          this.edicionForm.controls['provincia_nacimiento_id'].updateValueAndValidity({ emitEvent: false });

          if (provinciaId) {
            this.ubicacionesService.getCantones(provinciaId).subscribe({
              next: (cants) => {
                this.cantonesEdicion.set(cants || []);
                if (cants && cants.length > 0) {
                  this.edicionForm.controls['canton_nacimiento_id'].enable({ emitEvent: false });
                  this.edicionForm.controls['canton_nacimiento_id'].setValidators([Validators.required]);
                }
                this.edicionForm.controls['canton_nacimiento_id'].setValue(u.canton_nacimiento_id || null, { emitEvent: false });
                this.edicionForm.controls['canton_nacimiento_id'].updateValueAndValidity({ emitEvent: false });
              },
              error: () => this.errorEdicion.set('No se pudieron cargar los cantones para este usuario.')
            });
          }
        },
        error: () => this.errorEdicion.set('No se pudieron cargar las provincias para este usuario.')
      });
    }

    this.modalEdicionAbierto.set(true);
  }

  cerrarModalEdicion(): void {
    if (this.guardandoEdicion()) return;
    this.modalEdicionAbierto.set(false);
    this.usuarioEditando.set(null);
    this.errorEdicion.set('');
  }

  guardarEdicion(): void {
    if (this.guardandoEdicion()) return;
    this.errorEdicion.set('');

    if (this.edicionForm.invalid) {
      this.edicionForm.markAllAsTouched();
      const primerControlInvalido = Object.keys(this.edicionForm.controls).find(k => this.edicionForm.get(k)?.invalid);
      if (primerControlInvalido) this.tabActivo.set(this.tabPorControl[primerControlInvalido] || 'identidad');
      const msg = 'Por favor, revisa los campos remarcados en rojo. Existen datos incompletos o incorrectos.';
      this.errorEdicion.set(msg);
      Swal.fire({
        title: 'Datos Incompletos',
        text: msg,
        icon: 'warning',
        confirmButtonColor: '#f59e0b',
        confirmButtonText: '<i class="fas fa-check"></i> Revisar',
        customClass: this.SWAL_CUSTOM_CLASS
      });
      return;
    }

    const u = this.usuarioEditando();
    if (!u?.id) { this.errorEdicion.set('No se pudo identificar al usuario a editar.'); return; }

    const v = this.edicionForm.getRawValue();
    const [year, month, day] = v.fecha_nacimiento.split('-');

    const dtoPerfil: any = {
      cedula: this.sanitizeInput(v.cedula),
      primer_nombre: this.sanitizeInput(v.primer_nombre),
      segundo_nombre: this.sanitizeInput(v.segundo_nombre),
      primer_apellido: this.sanitizeInput(v.primer_apellido),
      segundo_apellido: this.sanitizeInput(v.segundo_apellido),
      email_institucional: this.sanitizeInput(v.email_institucional),
      numero_celular: this.sanitizeInput(v.numero_celular), // 🔥 ESTA ES LA LÍNEA QUE FALTABA
      carrera_id: v.carrera_id,
      ciclo_id: v.ciclo_id,
      sexo: v.sexo,
      genero: v.genero,
      estado_civil: v.estado_civil,
      etnia: v.etnia,
      pueblo_nacionalidad: v.etnia?.includes('Indígena') ? this.sanitizeInput(v.pueblo_nacionalidad) : null,
      etnia_otra: v.etnia === 'Otro' ? this.sanitizeInput(v.etnia_otra) : null,
      idioma: v.idioma === 'Otro' ? this.sanitizeInput(v.idioma_otro) : v.idioma,
      fecha_nacimiento: `${day}/${month}/${year}`,
      nacionalidad_id: v.nacionalidad_id,
      pais_nacimiento_id: v.pais_nacimiento_id,
      provincia_nacimiento_id: v.provincia_nacimiento_id || null,
      canton_nacimiento_id: v.canton_nacimiento_id || null,
    };

    const rolNombre = this.rolesParaEdicion().find(r => r.id === v.rol_id)?.nombre || u.rol?.nombre || 'ESTUDIANTE';

    this.guardandoEdicion.set(true);

    forkJoin({
      perfil: this.usuarioService.completarPerfilEstudiante(u.id, rolNombre, dtoPerfil),
      usuario: this.usuarioService.updateUsuario(u.id, {
        rol_id: v.rol_id,
        carrera_id: v.carrera_id,
        ciclo_id: v.ciclo_id
      })
    })
    .pipe(finalize(() => this.guardandoEdicion.set(false)))
    .subscribe({
      next: () => {
        this.cerrarModalEdicion();
        this.cargarTodo();
        Swal.fire({
          title: '¡Cambios Guardados!',
          text: 'La información del usuario ha sido actualizada con éxito.',
          icon: 'success',
          confirmButtonColor: '#10b981',
          confirmButtonText: '<i class="fas fa-check"></i> Entendido',
          customClass: this.SWAL_CUSTOM_CLASS
        });
      },
      error: (err: HttpErrorResponse) => {
        // El error real del backend siempre se muestra, tal como se pidió
        const msg = this.extraerMensajeError(err, 'Ocurrió un error en el servidor al actualizar el usuario.');
        this.errorEdicion.set(msg);

        const msgLower = msg.toLowerCase();
        if (msgLower.includes('correo') || msgLower.includes('email')) {
          this.edicionForm.controls['email_institucional'].setErrors({ inUse: true });
          this.tabActivo.set('identidad');
        }
        if (msgLower.includes('cédula') || msgLower.includes('cedula') || msgLower.includes('identificación')) {
          this.edicionForm.controls['cedula'].setErrors({ inUse: true });
          this.tabActivo.set('identidad');
        }

        Swal.fire({
          title: 'Error al Guardar',
          text: msg,
          icon: 'error',
          confirmButtonColor: '#ef4444',
          confirmButtonText: '<i class="fas fa-check"></i> Entendido',
          customClass: this.SWAL_CUSTOM_CLASS
        });
      }
    });
  }

  campoInvalidoEdicion(n: string): boolean {
    const c = this.edicionForm.get(n);
    return !!(c && c.invalid && (c.touched || c.dirty));
  }

  mensajeCampoEdicion(n: string): string {
    const c = this.edicionForm.get(n);
    if (!c || !c.errors) return '';

    if (c.errors['inUse']) return 'Este dato ya está registrado por otro usuario.';
    if (c.errors['required']) return 'Este campo es obligatorio.';

    if (c.errors['pattern']) {
      if (n === 'cedula') return 'Formato de identificación incorrecto.';
      if (n === 'email_institucional') return 'Ingresa un correo con un dominio válido (ej. correo@dominio.com).';
      if (n === 'numero_celular') return 'El número debe tener 10 dígitos y empezar con 09.';
      return 'Solo se permiten letras y espacios en blanco.';
    }

    if (c.errors['email']) return 'Formato de correo electrónico no válido.';
    if (c.errors['minlength']) return `Debe tener al menos ${c.errors['minlength'].requiredLength} caracteres.`;
    if (c.errors['maxlength']) return `Supera el límite de ${c.errors['maxlength'].requiredLength} caracteres.`;
    if (c.errors['min']) return `El valor mínimo es ${c.errors['min'].min}.`;
    if (c.errors['max']) return `El valor máximo es ${c.errors['max'].max}.`;
    if (c.errors['cedulaInvalida']) return 'La cédula ingresada no es válida en el Registro Civil.';
    if (c.errors['invalida'] || c.errors['formato']) return 'La fecha ingresada no es válida.';
    if (c.errors['edadFueraRango']) return 'El usuario debe tener entre 16 y 80 años.';

    return 'Dato inválido, por favor verifica.';
  }

  private validarFechaNacimientoNative(control: AbstractControl) {
    const v = (control.value || '').trim();
    if (!v) return { required: true };
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
    if (!m) return { formato: true };
    const date = new Date(+m[1], +m[2] - 1, +m[3]);
    if (date.getFullYear() !== +m[1] || date.getMonth() !== +m[2] - 1 || date.getDate() !== +m[3]) return { invalida: true };
    if (date > new Date()) return { futura: true };
    let edad = new Date().getFullYear() - date.getFullYear();
    if (new Date().getMonth() - date.getMonth() < 0 || (new Date().getMonth() - date.getMonth() === 0 && new Date().getDate() < date.getDate())) edad--;
    if (edad < 16 || edad > 80) return { edadFueraRango: true };
    return null;
  }

  private sanitizeInput(val: string): string {
    if (typeof val !== 'string') return val;
    return val.replace(/<[^>]*>/g, '').trim();
  }

  private extraerMensajeError(err: HttpErrorResponse, fallback: string): string {
    const msg = err?.error?.message;
    if (!msg) return fallback;
    return Array.isArray(msg) ? msg.join(', ') : msg;
  }
}