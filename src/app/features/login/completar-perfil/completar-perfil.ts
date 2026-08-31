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
  // ✅ NUEVA SEÑAL PARA PINTAR DE ROJO LA TARJETA DE FOTO
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
    const termino = this.filtroCarrera();
    const lista = this.carreras();
    if (!termino) return lista;
    return lista.filter((c) => c.nombre.toLowerCase().includes(termino));
  });

  readonly tiposDocumento = ['Cédula Ecuatoriana', 'Pasaporte', 'Documento Extranjero'];
  readonly sexos = ['Hombre', 'Mujer'];
  readonly generos = ['Masculino', 'Femenino', 'LGBTIQ+', 'Prefiero no decirlo'];
  readonly estadosCiviles = ['Soltero/a', 'Casado/a', 'Divorciado/a', 'Viudo/a', 'Unión libre'];
  readonly etnias = ['Mestizo/a', 'Indígena', 'Afroecuatoriano/a', 'Montubio/a', 'Blanco/a', 'Mulato/a', 'Otro'];
  readonly idiomas = ['Español', 'Kichwa', 'Shuar', 'Achuar', 'Cha´palaa', 'Awapit', 'Tsafiki', 'Inglés', 'Otro'];
  
  readonly opcionesEmbarazo = [
    { value: 'no', label: 'No' }, { value: '1', label: 'Sí — 1 mes' }, { value: '2', label: 'Sí — 2 meses' },
    { value: '3', label: 'Sí — 3 meses' }, { value: '4', label: 'Sí — 4 meses' }, { value: '5', label: 'Sí — 5 meses' },
    { value: '6', label: 'Sí — 6 meses' }, { value: '7', label: 'Sí — 7 meses' }, { value: '8', label: 'Sí — 8 meses' },
    { value: '9', label: 'Sí — 9 meses' }
  ];

  private readonly nombreRegex = /^[a-zA-ZñÑáéíóúÁÉÍÓÚüÜ\s]+$/;
  readonly maxDateNacimiento: string;
  readonly minDateNacimiento: string;
  readonly perfilForm: FormGroup;

  get esInstitucionalBloqueado(): boolean {
    const email = this.authService.user()?.email || '';
    return email.includes('tecazuay.edu.ec');
  }

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
      primer_nombre: ['', [Validators.required, Validators.pattern(this.nombreRegex), Validators.minLength(3)]],
      segundo_nombre: ['', [Validators.pattern(this.nombreRegex)]],
      primer_apellido: ['', [Validators.required, Validators.pattern(this.nombreRegex), Validators.minLength(3)]],
      segundo_apellido: ['', [Validators.pattern(this.nombreRegex)]],
  
      carrera_id: [null as string | null, Validators.required],
      ciclo_id: [{ value: null as string | null, disabled: true }, Validators.required],
  
      sexo: ['', Validators.required],
      mes_embarazo: ['no'],
      genero: ['', Validators.required],
      estado_civil: ['', Validators.required],
      
      tiene_hijos: [null as boolean | null, Validators.required],
      hijos_menores_5_anios: [''], 

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

    this.configurarSuscripcionesDinamicas();
  }

  ngOnInit(): void {
    if (this.authService.perfilCompleto()) { this.router.navigate(['/estudiante/inicio']); return; }
    
    const user: any = this.authService.user();
    if (user) {
      this.fotoUrl.set(user.foto_url || null);
      
      let pNombre = '', pApellido = '';
      if (user.nombre) {
        const partes = user.nombre.trim().split(/\s+/);
        pNombre = partes[0] || '';
        pApellido = partes.slice(1).join(' ') || '';
      }
      if (pNombre === 'Usuario' && pApellido === 'Nuevo') { pNombre = ''; pApellido = ''; }
      const email = user.email || '';
      const esInstitucional = email.includes('tecazuay.edu.ec');

      let fechaNac = '';
      if (user.fecha_nacimiento) {
        fechaNac = new Date(user.fecha_nacimiento).toISOString().split('T')[0];
      }

      let idiomaSelect = user.idioma || '';
      let idiomaOtroText = '';
      if (user.idioma && !this.idiomas.includes(user.idioma)) {
         idiomaSelect = 'Otro';
         idiomaOtroText = user.idioma;
      }

      this.perfilForm.patchValue({ 
        primer_nombre: user.primer_nombre || pNombre, 
        primer_apellido: user.primer_apellido || pApellido, 
        email_institucional: esInstitucional ? email : '',
        cedula: user.cedula || '',
        numero_celular: user.numero_celular || '',
        sexo: user.sexo || '',
        genero: user.genero || '',
        estado_civil: user.estado_civil || '',
        tiene_hijos: user.tiene_hijos !== undefined ? user.tiene_hijos : null,
        hijos_menores_5_anios: user.hijos_menores_5_anios || '',
        etnia: user.etnia || '',
        pueblo_nacionalidad: user.pueblo_nacionalidad || '',
        etnia_otra: user.etnia_otra || '',
        idioma: idiomaSelect,
        idioma_otro: idiomaOtroText,
        fecha_nacimiento: fechaNac,
        nacionalidad_id: user.nacionalidad_id || '',
        pais_nacimiento_id: user.pais_nacimiento_id || '',
        provincia_nacimiento_id: user.provincia_nacimiento_id || '',
        canton_nacimiento_id: user.canton_nacimiento_id || '',
      });
    }
    
    this.cargarCatalogos();
  }

  onIdentificacionInput(event: any) {
    const tipo = this.perfilForm.get('tipo_documento')?.value;
    let valor = event.target.value;
    if (tipo === 'Cédula Ecuatoriana') {
      valor = valor.replace(/[^0-9]/g, '').substring(0, 10);
    } else {
      valor = valor.replace(/[^a-zA-Z0-9]/g, '').substring(0, 20);
    }
    this.perfilForm.controls['cedula'].setValue(valor, { emitEvent: false });
  }

  onCelularInput(event: any) {
    let valor = event.target.value.replace(/[^0-9]/g, '').substring(0, 10);
    this.perfilForm.controls['numero_celular'].setValue(valor, { emitEvent: false });
  }

  onLetrasInput(controlName: string, event: any) {
    let valor = event.target.value.replace(/[^a-zA-ZñÑáéíóúÁÉÍÓÚüÜ\s]/g, ''); 
    this.perfilForm.controls[controlName].setValue(valor, { emitEvent: false });
  }

  onFileSelected(event: any) {
    const file = event.target.files[0] as File;
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        this.error.set('La fotografía no puede pesar más de 2MB.');
        return;
      }
      if (!file.type.match(/image\/(jpeg|jpg|png|webp)/)) {
        this.error.set('Solo se permiten imágenes en formato JPG, PNG o WEBP.');
        return;
      }
      this.error.set('');
      this.fotoInvalida.set(false); // ✅ QUITA EL COLOR ROJO AL ELEGIR FOTO
      this.fotoSeleccionada.set(file);
      const reader = new FileReader();
      reader.onload = (e) => this.fotoUrl.set(e.target?.result as string);
      reader.readAsDataURL(file);
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
      this.filtroCarrera.set(value.toLowerCase().trim());
      const currentId = this.perfilForm.controls['carrera_id'].value;
      if (currentId) {
        const selected = this.carreras().find(c => c.id === currentId);
        if (selected && selected.nombre.toLowerCase() !== value.toLowerCase()) this.perfilForm.controls['carrera_id'].setValue(null);
      }
    });

    let prevCarreraId: string | null = null;
    this.perfilForm.controls['carrera_id'].valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((carreraId) => {
      if (carreraId === prevCarreraId) return; prevCarreraId = carreraId;
      const cicloControl = this.perfilForm.controls['ciclo_id'];
      if (!carreraId) { this.ciclosDisponibles.set([]); cicloControl.disable({emitEvent: false}); cicloControl.setValue(null, {emitEvent: false}); return; }
      const ciclosFiltrados = this.todosLosCiclos().filter(c => (c.ciclosCarreras || []).some(cc => String(cc.carrera_id || cc.carrera?.id) === String(carreraId)));
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

    this.perfilForm.controls['sexo'].valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((sexo) => {
      const mes = this.perfilForm.controls['mes_embarazo'];
      if (sexo === 'Mujer') { mes.setValidators([Validators.required]); if (!mes.value) mes.setValue('no', { emitEvent: false }); }
      else { mes.clearValidators(); mes.setValue('no', { emitEvent: false }); }
      mes.updateValueAndValidity({ emitEvent: false });
    });

    this.perfilForm.controls['tiene_hijos'].valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((tiene) => {
      const menores = this.perfilForm.controls['hijos_menores_5_anios'];
      if (tiene === true) menores.setValidators([Validators.required]); else { menores.clearValidators(); menores.setValue('', { emitEvent: false }); }
      menores.updateValueAndValidity({ emitEvent: false });
    });

    this.perfilForm.controls['etnia'].valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((etnia) => {
      const pueblo = this.perfilForm.controls['pueblo_nacionalidad'];
      const etniaOtra = this.perfilForm.controls['etnia_otra'];
      if (etnia && etnia.includes('Indígena')) pueblo.setValidators([Validators.required]); else { pueblo.clearValidators(); pueblo.setValue('', { emitEvent: false }); }
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
      ctrlProv.disable({ emitEvent: false }); ctrlCan.disable({ emitEvent: false });
      this.provinciasNacimiento.set([]); this.cantonesNacimiento.set([]);

      if (paisId) {
        this.ubicacionesService.getProvincias(paisId).subscribe({
          next: (provs) => {
            this.provinciasNacimiento.set(provs || []);
            if (provs && provs.length > 0) {
              ctrlProv.enable({ emitEvent: false }); ctrlProv.setValidators([Validators.required]);
            } else { ctrlProv.clearValidators(); ctrlCan.clearValidators(); }
            ctrlProv.updateValueAndValidity({ emitEvent: false }); ctrlCan.updateValueAndValidity({ emitEvent: false });
          }
        });
      }
    });

    this.perfilForm.controls['provincia_nacimiento_id'].valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((provId) => {
      const ctrlCan = this.perfilForm.controls['canton_nacimiento_id'];
      ctrlCan.setValue('', { emitEvent: false }); ctrlCan.disable({ emitEvent: false });
      this.cantonesNacimiento.set([]);

      if (provId) {
        this.ubicacionesService.getCantones(provId).subscribe({
          next: (cants) => {
            this.cantonesNacimiento.set(cants || []);
            if (cants && cants.length > 0) {
              ctrlCan.enable({ emitEvent: false }); ctrlCan.setValidators([Validators.required]);
            } else { ctrlCan.clearValidators(); }
            ctrlCan.updateValueAndValidity({ emitEvent: false });
          }
        });
      }
    });
  }

  scrollToSection(index: number): void {
    const el = document.getElementById(`seccion-${index}`);
    if (el) window.scrollTo({ top: (el.getBoundingClientRect().top - document.body.getBoundingClientRect().top) - 80, behavior: 'smooth' });
  }

  seleccionarCarrera(c: Carrera) {
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
    this.ubicacionesService.getPaises().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: (res) => this.paises.set(res) });
    this.carreraService.getCarreras().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: (res) => this.carreras.set(res.filter(c => !c.fecha_desactivacion)) });
    this.ciclosService.getCiclos().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (res) => { this.todosLosCiclos.set((res || []).filter(c => !c.fecha_desactivacion)); this.cargandoCatalogos.set(false); },
      error: () => { this.error.set('Error cargando ciclos.'); this.cargandoCatalogos.set(false); }
    });
  }

  guardar(): void {
    this.error.set('');
    this.fotoInvalida.set(false); // Reseteamos el estado de error de la foto

    // ✅ VALIDACIÓN DE LA FOTO: PINTA DE ROJO LA TARJETA
    if (!this.fotoUrl()) {
       this.fotoInvalida.set(true);
       this.error.set('Por favor, selecciona una fotografía de perfil para continuar.');
       window.scrollTo({ top: 0, behavior: 'smooth' });
       return;
    }

    if (this.perfilForm.invalid) {
      this.perfilForm.markAllAsTouched(); 
      this.error.set('Por favor, revisa los campos remarcados en rojo. Existen datos incompletos o incorrectos.');
      setTimeout(() => { const el = document.querySelector('.shake-error'); if (el) window.scrollTo({ top: (el.getBoundingClientRect().top - document.body.getBoundingClientRect().top) - 120, behavior: 'smooth' }); }, 100);
      return;
    }
    
    this.loading.set(true); const v = this.perfilForm.getRawValue();
    const [year, month, day] = v.fecha_nacimiento.split('-');
    
    const payload: any = {
      cedula: v.cedula, primer_nombre: v.primer_nombre, primer_apellido: v.primer_apellido,
      sexo: v.sexo, genero: v.genero, estado_civil: v.estado_civil, tiene_hijos: !!v.tiene_hijos,
      etnia: v.etnia,
      numero_celular: v.numero_celular,
      fecha_nacimiento: `${day}/${month}/${year}`, nacionalidad_id: v.nacionalidad_id,
      pais_nacimiento_id: v.pais_nacimiento_id,
      carrera_id: v.carrera_id, ciclo_id: v.ciclo_id,
    };

    payload.idioma = v.idioma === 'Otro' ? v.idioma_otro : v.idioma;

    if (v.provincia_nacimiento_id) payload.provincia_nacimiento_id = v.provincia_nacimiento_id;
    if (v.canton_nacimiento_id) payload.canton_nacimiento_id = v.canton_nacimiento_id;

    if (v.tiene_hijos) payload.hijos_menores_5_anios = Number(v.hijos_menores_5_anios);
    if (v.etnia && v.etnia.includes('Indígena')) payload.pueblo_nacionalidad = v.pueblo_nacionalidad;
    if (v.etnia === 'Otro') payload.etnia_otra = v.etnia_otra;
    if (v.segundo_nombre) payload.segundo_nombre = v.segundo_nombre;
    if (v.segundo_apellido) payload.segundo_apellido = v.segundo_apellido;
    if (v.email_institucional) payload.email_institucional = v.email_institucional;
    if (v.sexo === 'Mujer') payload.esta_embarazada = (v.mes_embarazo !== 'no' && v.mes_embarazo !== '');

    this.usuarioService.completarPerfil(payload).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.authService.marcarPerfilCompleto({ cedula: payload.cedula, carrera_id: payload.carrera_id, ciclo_id: payload.ciclo_id });
        const fotoNueva = this.fotoSeleccionada();
        if (fotoNueva) {
           this.usuarioService.actualizarFoto(fotoNueva).subscribe({
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

  campoInvalido(n: string): boolean { const c = this.perfilForm.get(n); return !!(c && c.invalid && c.touched); }
  
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
    if (c.errors['cedulaInvalida']) return 'La cédula ingresada no es válida en el Registro Civil.';
    if (c.errors['invalida'] || c.errors['formato']) return 'La fecha ingresada no es válida.';
    if (c.errors['edadFueraRango']) return 'Debes tener entre 16 y 80 años para registrarte.';
    
    return 'Dato inválido, por favor verifica.';
  }
}