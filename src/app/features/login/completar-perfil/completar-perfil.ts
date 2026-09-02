import { Component, OnInit, inject, signal, computed, DestroyRef, ChangeDetectionStrategy } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormControl, ReactiveFormsModule, Validators, AbstractControl } from '@angular/forms';
import { Router } from '@angular/router';

import { AuthService } from '../../../core/services/auth.service';
import { UsuarioService } from '../../../core/services/usuario.service';
import { CarreraService } from '../../../core/services/carrera.service';
import { CiclosService } from '../../../core/services/ciclos.service';
import { UbicacionesService } from '../../../core/services/ubicaciones.service';
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
  private readonly ubicacionesService = inject(UbicacionesService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly pasosNavegacion = [
    { nombre: 'Identificación', icono: 'fa-id-card' },
    { nombre: 'Datos Académicos', icono: 'fa-graduation-cap' },
    { nombre: 'Datos Personales', icono: 'fa-user' }
  ];
  
  readonly progreso = signal(0);
  readonly loading = signal(false);
  readonly cargandoCatalogos = signal(true);
  readonly error = signal('');
  readonly exito = signal('');

  readonly fotoUrl = signal<string | null>(null);
  readonly fotoSeleccionada = signal<File | null>(null);
  readonly fotoInvalida = signal(false);

  readonly carreras = signal<Carrera[]>([]);
  private readonly todosLosCiclos = signal<Ciclo[]>([]);
  readonly ciclosDisponibles = signal<Ciclo[]>([]);
  
  readonly paises = signal<any[]>([]);
  readonly provinciasNacimiento = signal<any[]>([]);
  readonly cantonesNacimiento = signal<any[]>([]);

  readonly filtroCarreraControl = new FormControl('', { nonNullable: true });
  readonly filtroCarrera = signal('');
  readonly dropdownCarreraAbierto = signal(false);

  readonly carrerasFiltradas = computed(() => {
    const termino = this.filtroCarrera().toLowerCase().trim();
    const lista = this.carreras();
    if (!termino) return lista;
    return lista.filter((c) => (c.nombre || '').toLowerCase().includes(termino));
  });

  readonly filtroNacionalidadControl = new FormControl('', { nonNullable: true });
  readonly filtroNacionalidad = signal('');
  readonly dropdownNacionalidadAbierto = signal(false);

  readonly nacionalidadesFiltradas = computed(() => {
    const termino = this.filtroNacionalidad().toLowerCase().trim();
    const lista = this.paises();
    if (!termino) return lista;
    return lista.filter((p) => (p.nacionalidad || '').toLowerCase().includes(termino) || (p.nombre || '').toLowerCase().includes(termino));
  });

  readonly filtroProvinciaControl = new FormControl('', { nonNullable: true });
  readonly filtroProvincia = signal('');
  readonly dropdownProvinciaAbierto = signal(false);

  readonly provinciasFiltradas = computed(() => {
    const termino = this.filtroProvincia().toLowerCase().trim();
    const lista = this.provinciasNacimiento();
    if (!termino) return lista;
    return lista.filter((prov) => (prov.nombre || '').toLowerCase().includes(termino));
  });

  readonly filtroCantonControl = new FormControl('', { nonNullable: true });
  readonly filtroCanton = signal('');
  readonly dropdownCantonAbierto = signal(false);

  readonly cantonesFiltrados = computed(() => {
    const termino = this.filtroCanton().toLowerCase().trim();
    const lista = this.cantonesNacimiento();
    if (!termino) return lista;
    return lista.filter((can) => (can.nombre || '').toLowerCase().includes(termino));
  });

  readonly filtroIdiomaControl = new FormControl('', { nonNullable: true });
  readonly filtroIdioma = signal('');
  readonly dropdownIdiomaAbierto = signal(false);

  readonly idiomas = ['Español', 'Kichwa', 'Shuar', 'Achuar', 'Cha´palaa', 'Awapit', 'Tsafiki', 'Inglés', 'Otro'];

  readonly idiomasFiltrados = computed(() => {
    const termino = this.filtroIdioma().toLowerCase().trim();
    if (!termino) return this.idiomas;
    return this.idiomas.filter((i) => i.toLowerCase().includes(termino));
  });

  readonly tiposDocumento = ['Cédula Ecuatoriana', 'Pasaporte', 'Documento Extranjero'];
  readonly sexos = ['Hombre', 'Mujer'];
  readonly generos = ['Masculino', 'Femenino', 'LGBTIQ+', 'Prefiero no decirlo'];
  readonly estadosCiviles = ['Soltero/a', 'Casado/a', 'Divorciado/a', 'Viudo/a', 'Unión libre'];
  readonly etnias = ['Mestizo/a', 'Indígena', 'Afroecuatoriano/a', 'Montubio/a', 'Blanco/a', 'Mulato/a', 'Otro'];

  private readonly nombreRegex = /^[a-zA-ZñÑáéíóúÁÉÍÓÚüÜ\s]+$/;
  readonly maxDateNacimiento: string;
  readonly minDateNacimiento: string;
  readonly perfilForm: FormGroup;


  constructor() {
    const hoy = new Date();
    const mes = ('0' + (hoy.getMonth() + 1)).slice(-2);
    const dia = ('0' + hoy.getDate()).slice(-2);
    this.maxDateNacimiento = `${hoy.getFullYear() - 16}-${mes}-${dia}`;
    this.minDateNacimiento = `${hoy.getFullYear() - 80}-${mes}-${dia}`;

    this.perfilForm = this.fb.group({
      tipo_documento: ['Cédula Ecuatoriana', Validators.required],
      cedula: ['', [Validators.required, cedulaEcuatorianaValidator()]],
      numero_celular: ['', [Validators.required, Validators.pattern(/^09\d{8}$/)]],
      email_institucional: ['', [Validators.email, Validators.pattern(/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/)]],
      primer_nombre: ['', [Validators.required, Validators.pattern(this.nombreRegex), Validators.minLength(3), Validators.maxLength(50)]],
      segundo_nombre: ['', [Validators.pattern(this.nombreRegex), Validators.maxLength(50)]],
      primer_apellido: ['', [Validators.required, Validators.pattern(this.nombreRegex), Validators.minLength(3), Validators.maxLength(50)]],
      segundo_apellido: ['', [Validators.pattern(this.nombreRegex), Validators.maxLength(50)]],
  
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

    this.filtroProvinciaControl.disable({ emitEvent: false });
    this.filtroCantonControl.disable({ emitEvent: false });

    this.configurarSuscripcionesDinamicas();
  }

  ngOnInit(): void {
    try {
      if (this.authService.perfilCompleto()) { this.router.navigate(['/estudiante/inicio']); return; }
      
      const user: any = this.authService.user();
      if (user) {
        this.fotoUrl.set(user.foto_url || null);
        
        let pNombre = '', pApellido = '';
        if (user.nombre) {
          const partes = String(user.nombre).trim().split(/\s+/);
          pNombre = partes[0] || '';
          pApellido = partes.slice(1).join(' ') || '';
        }
        if (pNombre === 'Usuario' && pApellido === 'Nuevo') { pNombre = ''; pApellido = ''; }
        const email = user.email || '';
        const esInstitucional = email.includes('tecazuay.edu.ec');

        let fechaNac = '';
        if (user.fecha_nacimiento) {
          const d = new Date(user.fecha_nacimiento);
          if (!isNaN(d.getTime())) {
            fechaNac = d.toISOString().split('T')[0];
          }
        }

        let idiomaSelect = user.idioma || '';
        let idiomaOtroText = '';
        if (user.idioma && !this.idiomas.includes(user.idioma)) {
           idiomaSelect = 'Otro';
           idiomaOtroText = user.idioma;
        }

        this.perfilForm.patchValue({ 
          primer_nombre: this.sanitizeInput(user.primer_nombre || pNombre), 
          primer_apellido: this.sanitizeInput(user.primer_apellido || pApellido), 
          email_institucional: email, // 🔥 Queda así de limpio
          cedula: this.sanitizeInput(user.cedula || ''),
          numero_celular: this.sanitizeInput(user.numero_celular || ''),
          sexo: user.sexo || '',
          genero: user.genero || '',
          estado_civil: user.estado_civil || '',
          etnia: user.etnia || '',
          pueblo_nacionalidad: this.sanitizeInput(user.pueblo_nacionalidad || ''),
          etnia_otra: this.sanitizeInput(user.etnia_otra || ''),
          idioma: idiomaSelect,
          idioma_otro: this.sanitizeInput(idiomaOtroText),
          fecha_nacimiento: fechaNac,
          nacionalidad_id: user.nacionalidad_id || '',
          pais_nacimiento_id: user.pais_nacimiento_id || '',
          provincia_nacimiento_id: user.provincia_nacimiento_id || '',
          canton_nacimiento_id: user.canton_nacimiento_id || '',
        });

        if (idiomaSelect) {
          this.filtroIdiomaControl.setValue(idiomaSelect, { emitEvent: false });
        }
      }
      
      this.cargarCatalogos();
    } catch (e) {
      this.error.set('Ocurrió un error al cargar la información del usuario.');
      this.cargandoCatalogos.set(false);
    }
  }

  limpiarFiltroCarrera(): void {
    this.filtroCarreraControl.setValue('');
    this.filtroCarrera.set('');
    this.perfilForm.controls['carrera_id'].setValue(null);
    this.dropdownCarreraAbierto.set(false);
  }

  limpiarFiltroNacionalidad(): void {
    this.filtroNacionalidadControl.setValue('');
    this.filtroNacionalidad.set('');
    this.perfilForm.controls['nacionalidad_id'].setValue('');
    this.dropdownNacionalidadAbierto.set(false);
  }

  limpiarFiltroProvincia(): void {
    this.filtroProvinciaControl.setValue('');
    this.filtroProvincia.set('');
    this.perfilForm.controls['provincia_nacimiento_id'].setValue('');
    this.dropdownProvinciaAbierto.set(false);
  }

  limpiarFiltroCanton(): void {
    this.filtroCantonControl.setValue('');
    this.filtroCanton.set('');
    this.perfilForm.controls['canton_nacimiento_id'].setValue('');
    this.dropdownCantonAbierto.set(false);
  }

  limpiarFiltroIdioma(): void {
    this.filtroIdiomaControl.setValue('');
    this.filtroIdioma.set('');
    this.perfilForm.controls['idioma'].setValue('');
    this.dropdownIdiomaAbierto.set(false);
  }

  onIdentificacionInput(event: any) {
    const tipo = this.perfilForm.get('tipo_documento')?.value;
    let valor = this.sanitizeInput(event?.target?.value || '');
    if (tipo === 'Cédula Ecuatoriana') {
      valor = valor.replace(/[^0-9]/g, '').substring(0, 10);
    } else {
      valor = valor.replace(/[^a-zA-Z0-9]/g, '').substring(0, 20);
    }
    this.perfilForm.controls['cedula'].setValue(valor, { emitEvent: false });
  }

  onCelularInput(event: any) {
    let valor = this.sanitizeInput(event?.target?.value || '').replace(/[^0-9]/g, '').substring(0, 10);
    this.perfilForm.controls['numero_celular'].setValue(valor, { emitEvent: false });
  }

  onLetrasInput(controlName: string, event: any) {
    let valor = this.sanitizeInput(event?.target?.value || '').replace(/[^a-zA-ZñÑáéíóúÁÉÍÓÚüÜ\s]/g, ''); 
    if (this.perfilForm.controls[controlName]) {
      this.perfilForm.controls[controlName].setValue(valor, { emitEvent: false });
    }
  }

  onFileSelected(event: any) {
    try {
      const file = event?.target?.files?.[0] as File | undefined;
      if (file) {
        if (file.size > 2 * 1024 * 1024) {
          this.error.set('La fotografía no puede pesar más de 2MB.');
          this.fotoInvalida.set(true);
          return;
        }
        if (!file.type.match(/^image\/(jpeg|jpg|png|webp)$/i)) {
          this.error.set('Solo se permiten imágenes en formato JPG, PNG o WEBP.');
          this.fotoInvalida.set(true);
          return;
        }
        this.error.set('');
        this.fotoInvalida.set(false);
        this.fotoSeleccionada.set(file);
        const reader = new FileReader();
        reader.onload = (e) => this.fotoUrl.set(e.target?.result as string);
        reader.onerror = () => {
          this.error.set('Error al leer el archivo seleccionado.');
          this.fotoInvalida.set(true);
        };
        reader.readAsDataURL(file);
      }
    } catch (e) {
      this.error.set('Fallo crítico al seleccionar el archivo.');
    }
  }

  private configurarSuscripcionesDinamicas(): void {
    this.perfilForm.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      let total = 0, valids = 0;
      Object.keys(this.perfilForm.controls).forEach(key => {
        const c = this.perfilForm.get(key);
        if (c && c.validator) { total++; if (c.valid) valids++; }
      });
      this.progreso.set(total === 0 ? 0 : Math.round((valids / total) * 100));
    });

    this.filtroCarreraControl.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((value) => {
      const sanitized = this.sanitizeInput(value);
      this.filtroCarrera.set(sanitized.toLowerCase().trim());
      const currentId = this.perfilForm.controls['carrera_id'].value;
      if (currentId) {
        const selected = this.carreras().find(c => c.id === currentId);
        if (selected && (selected.nombre || '').toLowerCase() !== sanitized.toLowerCase()) {
          this.perfilForm.controls['carrera_id'].setValue(null);
        }
      }
    });

    this.filtroNacionalidadControl.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((value) => {
      const sanitized = this.sanitizeInput(value);
      this.filtroNacionalidad.set(sanitized.toLowerCase().trim());
      const currentId = this.perfilForm.controls['nacionalidad_id'].value;
      if (currentId) {
        const selected = this.paises().find(p => p.id === currentId);
        if (selected && (selected.nacionalidad || '').toLowerCase() !== sanitized.toLowerCase()) {
          this.perfilForm.controls['nacionalidad_id'].setValue('');
        }
      }
    });

    this.filtroProvinciaControl.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((value) => {
      const sanitized = this.sanitizeInput(value);
      this.filtroProvincia.set(sanitized.toLowerCase().trim());
      const currentId = this.perfilForm.controls['provincia_nacimiento_id'].value;
      if (currentId) {
        const selected = this.provinciasNacimiento().find(p => p.id === currentId);
        if (selected && (selected.nombre || '').toLowerCase() !== sanitized.toLowerCase()) {
          this.perfilForm.controls['provincia_nacimiento_id'].setValue('');
        }
      }
    });

    this.filtroCantonControl.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((value) => {
      const sanitized = this.sanitizeInput(value);
      this.filtroCanton.set(sanitized.toLowerCase().trim());
      const currentId = this.perfilForm.controls['canton_nacimiento_id'].value;
      if (currentId) {
        const selected = this.cantonesNacimiento().find(c => c.id === currentId);
        if (selected && (selected.nombre || '').toLowerCase() !== sanitized.toLowerCase()) {
          this.perfilForm.controls['canton_nacimiento_id'].setValue('');
        }
      }
    });

    this.filtroIdiomaControl.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((value) => {
      const sanitized = this.sanitizeInput(value);
      this.filtroIdioma.set(sanitized.toLowerCase().trim());
      const current = this.perfilForm.controls['idioma'].value;
      if (current && current.toLowerCase() !== sanitized.toLowerCase()) {
        this.perfilForm.controls['idioma'].setValue('');
      }
    });

    let prevCarreraId: string | null = null;
    this.perfilForm.controls['carrera_id'].valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((carreraId) => {
      if (carreraId === prevCarreraId) return; prevCarreraId = carreraId;
      const cicloControl = this.perfilForm.controls['ciclo_id'];
      if (!carreraId) { this.ciclosDisponibles.set([]); cicloControl.disable({emitEvent: false}); cicloControl.setValue(null, {emitEvent: false}); return; }
      const ciclosFiltrados = (this.todosLosCiclos() || []).filter(c => (c?.ciclosCarreras || []).some(cc => String(cc.carrera_id || cc.carrera?.id) === String(carreraId)));
      this.ciclosDisponibles.set(ciclosFiltrados);
      cicloControl.setValue(null, {emitEvent: false}); 
      if (ciclosFiltrados.length > 0) cicloControl.enable({emitEvent: false}); else cicloControl.disable({emitEvent: false});
    });

    this.perfilForm.controls['tipo_documento'].valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((tipo) => {
      const controlDoc = this.perfilForm.controls['cedula']; controlDoc.clearValidators();
      if (tipo === 'Cédula Ecuatoriana') controlDoc.setValidators([Validators.required, cedulaEcuatorianaValidator()]);
      else controlDoc.setValidators([Validators.required, Validators.pattern(/^[a-zA-Z0-9]{5,20}$/)]);
      controlDoc.updateValueAndValidity({ emitEvent: false });
    });

    this.perfilForm.controls['etnia'].valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((etnia) => {
      const pueblo = this.perfilForm.controls['pueblo_nacionalidad'];
      const etniaOtra = this.perfilForm.controls['etnia_otra'];
      if (etnia && etnia.includes('Indígena')) pueblo.setValidators([Validators.required, Validators.pattern(this.nombreRegex)]); else { pueblo.clearValidators(); pueblo.setValue('', { emitEvent: false }); }
      if (etnia === 'Otro') etniaOtra.setValidators([Validators.required, Validators.pattern(this.nombreRegex)]); else { etniaOtra.clearValidators(); etniaOtra.setValue('', { emitEvent: false }); }
      pueblo.updateValueAndValidity({ emitEvent: false }); etniaOtra.updateValueAndValidity({ emitEvent: false });
    });

    this.perfilForm.controls['idioma'].valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((idioma) => {
      const idiomaOtro = this.perfilForm.controls['idioma_otro'];
      if (idioma === 'Otro') {
        idiomaOtro.setValidators([Validators.required, Validators.pattern(this.nombreRegex)]);
      } else {
        idiomaOtro.clearValidators();
        idiomaOtro.setValue('', { emitEvent: false });
      }
      idiomaOtro.updateValueAndValidity({ emitEvent: false });
    });

    this.perfilForm.controls['nacionalidad_id'].valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((nacionalidadId) => {
      const ctrlPaisNac = this.perfilForm.controls['pais_nacimiento_id'];
      if (nacionalidadId) {
        ctrlPaisNac.setValue(nacionalidadId, { emitEvent: true });
        ctrlPaisNac.disable({ emitEvent: false }); 
      } else {
        ctrlPaisNac.setValue('', { emitEvent: true });
        ctrlPaisNac.enable({ emitEvent: false });
      }
    });

    this.perfilForm.controls['pais_nacimiento_id'].valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((paisId) => {
      const ctrlProv = this.perfilForm.controls['provincia_nacimiento_id'];
      const ctrlCan = this.perfilForm.controls['canton_nacimiento_id'];
      
      ctrlProv.setValue('', { emitEvent: false }); ctrlCan.setValue('', { emitEvent: false });
      this.filtroProvinciaControl.setValue('', { emitEvent: false });
      this.filtroCantonControl.setValue('', { emitEvent: false });
      
      ctrlProv.disable({ emitEvent: false }); ctrlCan.disable({ emitEvent: false });
      this.filtroProvinciaControl.disable({ emitEvent: false });
      this.filtroCantonControl.disable({ emitEvent: false });
      
      this.provinciasNacimiento.set([]); this.cantonesNacimiento.set([]);

      if (paisId) {
        this.ubicacionesService.getProvincias(paisId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
          next: (provs) => {
            this.provinciasNacimiento.set(provs || []);
            if (provs && provs.length > 0) {
              ctrlProv.enable({ emitEvent: false }); 
              ctrlProv.setValidators([Validators.required]);
              this.filtroProvinciaControl.enable({ emitEvent: false });
            } else { 
              ctrlProv.clearValidators(); 
              ctrlCan.clearValidators(); 
              this.filtroProvinciaControl.disable({ emitEvent: false });
              this.filtroCantonControl.disable({ emitEvent: false });
            }
            ctrlProv.updateValueAndValidity({ emitEvent: false }); ctrlCan.updateValueAndValidity({ emitEvent: false });
          },
          error: () => {
            this.error.set('Error al cargar las provincias.');
          }
        });
      } else {
        ctrlProv.clearValidators();
        ctrlCan.clearValidators();
        ctrlProv.updateValueAndValidity({ emitEvent: false });
        ctrlCan.updateValueAndValidity({ emitEvent: false });
      }
    });

    this.perfilForm.controls['provincia_nacimiento_id'].valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((provId) => {
      const ctrlCan = this.perfilForm.controls['canton_nacimiento_id'];
      ctrlCan.setValue('', { emitEvent: false }); ctrlCan.disable({ emitEvent: false });
      this.filtroCantonControl.setValue('', { emitEvent: false });
      this.filtroCantonControl.disable({ emitEvent: false });
      this.cantonesNacimiento.set([]);

      if (provId) {
        this.ubicacionesService.getCantones(provId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
          next: (cants) => {
            this.cantonesNacimiento.set(cants || []);
            if (cants && cants.length > 0) {
              ctrlCan.enable({ emitEvent: false }); 
              ctrlCan.setValidators([Validators.required]);
              this.filtroCantonControl.enable({ emitEvent: false });
            } else { 
              ctrlCan.clearValidators(); 
              this.filtroCantonControl.disable({ emitEvent: false });
            }
            ctrlCan.updateValueAndValidity({ emitEvent: false });
          },
          error: () => {
            this.error.set('Error al cargar los cantones.');
          }
        });
      } else {
        ctrlCan.clearValidators();
        ctrlCan.updateValueAndValidity({ emitEvent: false });
      }
    });
  }

  scrollToSection(index: number): void {
    const el = document.getElementById(`seccion-${index}`);
    if (el) window.scrollTo({ top: (el.getBoundingClientRect().top - document.body.getBoundingClientRect().top) - 80, behavior: 'smooth' });
  }

  seleccionarCarrera(c: Carrera) {
    if (!c || !c.id) return;
    this.perfilForm.controls['carrera_id'].setValue(c.id);
    this.filtroCarreraControl.setValue(c.nombre, { emitEvent: false }); this.filtroCarrera.set(c.nombre.toLowerCase().trim());
    this.dropdownCarreraAbierto.set(false); this.perfilForm.controls['carrera_id'].markAsTouched();
  }

  cerrarDropdownCarrera() {
    setTimeout(() => {
      this.dropdownCarreraAbierto.set(false); const currentId = this.perfilForm.controls['carrera_id'].value;
      if (currentId) { const selected = this.carreras().find(c => c.id === currentId); if (selected) this.filtroCarreraControl.setValue(selected.nombre, { emitEvent: false }); }
      else this.filtroCarreraControl.setValue('', { emitEvent: false });
    }, 200);
  }

  seleccionarNacionalidad(p: any) {
    if (!p || !p.id) return;
    this.perfilForm.controls['nacionalidad_id'].setValue(p.id);
    this.filtroNacionalidadControl.setValue(p.nacionalidad, { emitEvent: false });
    this.filtroNacionalidad.set(p.nacionalidad.toLowerCase().trim());
    this.dropdownNacionalidadAbierto.set(false);
    this.perfilForm.controls['nacionalidad_id'].markAsTouched();
  }

  cerrarDropdownNacionalidad() {
    setTimeout(() => {
      this.dropdownNacionalidadAbierto.set(false);
      const currentId = this.perfilForm.controls['nacionalidad_id'].value;
      if (currentId) {
        const selected = this.paises().find(p => p.id === currentId);
        if (selected) this.filtroNacionalidadControl.setValue(selected.nacionalidad, { emitEvent: false });
      } else {
        this.filtroNacionalidadControl.setValue('', { emitEvent: false });
      }
    }, 200);
  }

  seleccionarProvincia(prov: any) {
    if (!prov || !prov.id) return;
    this.perfilForm.controls['provincia_nacimiento_id'].setValue(prov.id);
    this.filtroProvinciaControl.setValue(prov.nombre, { emitEvent: false });
    this.filtroProvincia.set(prov.nombre.toLowerCase().trim());
    this.dropdownProvinciaAbierto.set(false);
    this.perfilForm.controls['provincia_nacimiento_id'].markAsTouched();
  }

  cerrarDropdownProvincia() {
    setTimeout(() => {
      this.dropdownProvinciaAbierto.set(false);
      const currentId = this.perfilForm.controls['provincia_nacimiento_id'].value;
      if (currentId) {
        const selected = this.provinciasNacimiento().find(p => p.id === currentId);
        if (selected) this.filtroProvinciaControl.setValue(selected.nombre, { emitEvent: false });
      } else {
        this.filtroProvinciaControl.setValue('', { emitEvent: false });
      }
    }, 200);
  }

  seleccionarCanton(can: any) {
    if (!can || !can.id) return;
    this.perfilForm.controls['canton_nacimiento_id'].setValue(can.id);
    this.filtroCantonControl.setValue(can.nombre, { emitEvent: false });
    this.filtroCanton.set(can.nombre.toLowerCase().trim());
    this.dropdownCantonAbierto.set(false);
    this.perfilForm.controls['canton_nacimiento_id'].markAsTouched();
  }

  cerrarDropdownCanton() {
    setTimeout(() => {
      this.dropdownCantonAbierto.set(false);
      const currentId = this.perfilForm.controls['canton_nacimiento_id'].value;
      if (currentId) {
        const selected = this.cantonesNacimiento().find(c => c.id === currentId);
        if (selected) this.filtroCantonControl.setValue(selected.nombre, { emitEvent: false });
      } else {
        this.filtroCantonControl.setValue('', { emitEvent: false });
      }
    }, 200);
  }

  seleccionarIdioma(idioma: string) {
    if (!idioma) return;
    this.perfilForm.controls['idioma'].setValue(idioma);
    this.filtroIdiomaControl.setValue(idioma, { emitEvent: false });
    this.filtroIdioma.set(idioma.toLowerCase().trim());
    this.dropdownIdiomaAbierto.set(false);
    this.perfilForm.controls['idioma'].markAsTouched();
  }

  cerrarDropdownIdioma() {
    setTimeout(() => {
      this.dropdownIdiomaAbierto.set(false);
      const current = this.perfilForm.controls['idioma'].value;
      if (current) {
        this.filtroIdiomaControl.setValue(current, { emitEvent: false });
      } else {
        this.filtroIdiomaControl.setValue('', { emitEvent: false });
      }
    }, 200);
  }

  private validarFechaNacimientoNative(control: AbstractControl) {
    const v = (control.value || '').trim(); if (!v) return { required: true };
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v); if (!m) return { formato: true };
    const date = new Date(+m[1], +m[2] - 1, +m[3]);
    if (date.getFullYear() !== +m[1] || date.getMonth() !== +m[2] - 1 || date.getDate() !== +m[3]) return { invalida: true };
    if (date > new Date()) return { futura: true };
    let edad = new Date().getFullYear() - date.getFullYear();
    if (new Date().getMonth() - date.getMonth() < 0 || (new Date().getMonth() - date.getMonth() === 0 && new Date().getDate() < date.getDate())) edad--;
    if (edad < 16 || edad > 80) return { edadFueraRango: true };
    return null;
  }

  private cargarCatalogos(): void {
    this.cargandoCatalogos.set(true);
    this.ubicacionesService.getPaises().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ 
      next: (res) => {
        this.paises.set(res || []);
        const nacId = this.perfilForm.controls['nacionalidad_id'].value;
        if (nacId) {
          const selected = (res || []).find(p => p.id === nacId);
          if (selected) this.filtroNacionalidadControl.setValue(selected.nacionalidad, { emitEvent: false });
        }
      },
      error: () => this.error.set('Error cargando países.')
    });
    this.carreraService.getCarreras().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ 
      next: (res) => this.carreras.set((res || []).filter(c => !c.fecha_desactivacion)),
      error: () => this.error.set('Error cargando carreras.')
    });
    this.ciclosService.getCiclos().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (res) => { this.todosLosCiclos.set((res || []).filter(c => !c.fecha_desactivacion)); this.cargandoCatalogos.set(false); },
      error: () => { this.error.set('Error cargando ciclos.'); this.cargandoCatalogos.set(false); }
    });
  }

  guardar(): void {
    if (this.loading()) return;
    this.error.set('');
    this.fotoInvalida.set(false);

    if (!this.fotoUrl()) {
       this.fotoInvalida.set(true);
       this.error.set('Por favor, selecciona una fotografía de perfil para continuar.');
       window.scrollTo({ top: 0, behavior: 'smooth' });
       return;
    }

    if (this.perfilForm.invalid) {
      this.perfilForm.markAllAsTouched(); 
      this.error.set('Por favor, revisa los campos remarcados en rojo. Existen datos incompletos o incorrectos.');
      
      setTimeout(() => { 
        const primerInvalido = document.querySelector('.shake-error, .ng-invalid:not(form)'); 
        if (primerInvalido) {
          primerInvalido.scrollIntoView({ behavior: 'smooth', block: 'center' });
          (primerInvalido as HTMLElement).focus?.();
        }
      }, 100);
      return;
    }
    
    this.loading.set(true); 
    const v = this.perfilForm.getRawValue();
    const [year, month, day] = v.fecha_nacimiento.split('-');
    
    const payload: any = {
      cedula: this.sanitizeInput(v.cedula), 
      primer_nombre: this.sanitizeInput(v.primer_nombre), 
      primer_apellido: this.sanitizeInput(v.primer_apellido),
      sexo: v.sexo, 
      genero: v.genero, 
      estado_civil: v.estado_civil, 
      etnia: v.etnia,
      numero_celular: this.sanitizeInput(v.numero_celular),
      fecha_nacimiento: `${day}/${month}/${year}`, 
      nacionalidad_id: v.nacionalidad_id,
      pais_nacimiento_id: v.pais_nacimiento_id,
      carrera_id: v.carrera_id, 
      ciclo_id: v.ciclo_id,
    };

    payload.idioma = v.idioma === 'Otro' ? this.sanitizeInput(v.idioma_otro) : v.idioma;

    if (v.provincia_nacimiento_id) payload.provincia_nacimiento_id = v.provincia_nacimiento_id;
    if (v.canton_nacimiento_id) payload.canton_nacimiento_id = v.canton_nacimiento_id;

    if (v.etnia && v.etnia.includes('Indígena')) payload.pueblo_nacionalidad = this.sanitizeInput(v.pueblo_nacionalidad);
    if (v.etnia === 'Otro') payload.etnia_otra = this.sanitizeInput(v.etnia_otra);
    if (v.segundo_nombre) payload.segundo_nombre = this.sanitizeInput(v.segundo_nombre);
    if (v.segundo_apellido) payload.segundo_apellido = this.sanitizeInput(v.segundo_apellido);
    if (v.email_institucional) payload.email_institucional = this.sanitizeInput(v.email_institucional);

    this.usuarioService.completarPerfil(payload).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.authService.marcarPerfilCompleto({ cedula: payload.cedula, carrera_id: payload.carrera_id, ciclo_id: payload.ciclo_id });
        const fotoNueva = this.fotoSeleccionada();
        if (fotoNueva) {
           this.usuarioService.actualizarFoto(fotoNueva).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
             next: () => this.finalizarExito(),
             error: () => {
                 this.error.set('Perfil guardado, pero hubo un error subiendo la foto. Puedes intentarlo luego.');
                 this.loading.set(false);
                 setTimeout(() => this.finalizarExito(), 3000);
             }
           });
        } else {
           this.finalizarExito();
        }
      },
      error: (err) => {
        this.loading.set(false); 
        let msg = 'Ocurrió un error al guardar.';
        if (err?.error?.message) msg = Array.isArray(err.error.message) ? err.error.message.join('. ') : err.error.message;
        this.error.set(msg); 
        
        const msgLower = msg.toLowerCase();
        if (msgLower.includes('correo') || msgLower.includes('email')) {
          this.perfilForm.controls['email_institucional'].setErrors({ inUse: true });
        }
        if (msgLower.includes('cédula') || msgLower.includes('cedula') || msgLower.includes('identificación')) {
          this.perfilForm.controls['cedula'].setErrors({ inUse: true });
        }

        setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 100);
      }
    });
  }

  private finalizarExito() {
    this.loading.set(false);
    this.exito.set('¡Perfil completado exitosamente!');
    setTimeout(() => this.router.navigate(['/estudiante/inicio']), 900);
  }

  cancelar(): void { this.authService.logout(); this.router.navigate(['/login']); }

  campoInvalido(n: string): boolean { const c = this.perfilForm.get(n); return !!(c && c.invalid && (c.touched || c.dirty)); }
  
  mensajeCampo(n: string): string {
    const c = this.perfilForm.get(n); if (!c || !c.errors) return '';
    
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
    if (c.errors['edadFueraRango']) return 'Debes tener entre 16 y 80 años para registrarte.';
    
    return 'Dato inválido, por favor verifica.';
  }

  private sanitizeInput(val: string): string {
    if (typeof val !== 'string') return val;
    return val.replace(/<[^>]*>/g, '').trim();
  }
}