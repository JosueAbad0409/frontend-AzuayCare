import { Component, OnInit, inject, signal, computed, ChangeDetectionStrategy, DestroyRef, OnDestroy } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormArray, ReactiveFormsModule, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { debounceTime, catchError, forkJoin, of, firstValueFrom } from 'rxjs';
import Swal from 'sweetalert2';

import { environment } from '../../../environments/environment';
import { AuthService } from '../../core/services/auth.service';
import { FichaService } from '../../core/services/ficha.service';
import { FormularioService } from '../../core/services/formulario.service';
import { PeriodoService } from '../../core/services/periodo.service';
import { DocumentosService } from '../../core/services/documentos.service';
import { DependenciasService } from '../../core/services/dependencias.service';
import { MatricesService } from '../../core/services/matrices.service';
import { ToastService } from '../../core/services/toast.service';
import { DescargaArchivosService } from '../../core/services/descarga-archivos.service';

import { Formulario, Seccion, Pregunta } from '../../core/models/formulario.model';
import { FichaRevision, EstadoFicha } from '../../core/models/revision-ficha.model';
import { PreguntaDependencia } from '../../core/models/dependencia.model';
import { EstudiantePerfil } from '../../core/models/estudiante-perfil.model';
import { DocumentoEstudiante } from '../../core/models/documento-estudiante.interface';
import { PeriodoMatricula } from '../../core/models/periodo.model';
import { UbicacionesService } from '../../core/services/ubicaciones.service';

export type EstadoUI = 'NUEVA' | 'BORRADOR' | 'ENVIADA' | 'VALIDADO' | 'RECHAZADA' | 'CERRADA_POR_PLAZO';

export interface FormularioUI extends Formulario {
  estado_ui: EstadoUI;
}

const AUTOSAVE_PREFIX = 'azuaycare_autosave_ficha_';
const AUTOSAVE_TTL_MS = 24 * 60 * 60 * 1000; // 24 horas
const UUID_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const NUMERIC_REGEX = /^(0|[1-9]\d*)(\.\d{1,2})?$/;

const VALORES_ROMANOS: ReadonlyArray<{ valor: number; simbolo: string }> = [
  { valor: 1000, simbolo: 'M' }, { valor: 900, simbolo: 'CM' },
  { valor: 500, simbolo: 'D' }, { valor: 400, simbolo: 'CD' },
  { valor: 100, simbolo: 'C' }, { valor: 90, simbolo: 'XC' },
  { valor: 50, simbolo: 'L' }, { valor: 40, simbolo: 'XL' },
  { valor: 10, simbolo: 'X' }, { valor: 9, simbolo: 'IX' },
  { valor: 5, simbolo: 'V' }, { valor: 4, simbolo: 'IV' },
  { valor: 1, simbolo: 'I' }
];

function normalizarEstado(estado?: string | null): EstadoUI {
  switch (estado) {
    case 'BORRADOR': return 'BORRADOR';
    case 'ENVIADA':
    case 'ENVIADO': return 'ENVIADA';
    case 'VALIDADO': return 'VALIDADO';
    case 'RECHAZADA':
    case 'RECHAZADO': return 'RECHAZADA';
    case 'CERRADA_POR_PLAZO': return 'CERRADA_POR_PLAZO';
    default: return 'NUEVA';
  }
}

function minSelectedCheckboxesValidator(min = 1) {
  return (control: AbstractControl): ValidationErrors | null => {
    const formArray = control as FormArray;
    return formArray && formArray.length >= min ? null : { required: true };
  };
}

function requireAtLeastOneMatrixRowValidator() {
  return (group: AbstractControl): ValidationErrors | null => {
    const hasValue = Object.values(group.value).some((val: any) => Array.isArray(val) && val.length > 0);
    return hasValue ? null : { required: true };
  };
}

@Component({
  selector: 'app-estudiante-ficha',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './estudiante-ficha.component.html',
  styleUrls: ['./estudiante-ficha.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EstudianteFichaComponent implements OnInit, OnDestroy {
  readonly authService = inject(AuthService);
  private readonly fichaService = inject(FichaService);
  private readonly formularioService = inject(FormularioService);
  private readonly periodoService = inject(PeriodoService);
  private readonly documentosService = inject(DocumentosService);
  private readonly dependenciasService = inject(DependenciasService);
  private readonly matricesService = inject(MatricesService);
  private readonly toastService = inject(ToastService);
  private readonly http = inject(HttpClient);
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly descargaService = inject(DescargaArchivosService);
  private readonly ubicacionesService = inject(UbicacionesService);

  isDescargandoPdf = this.descargaService.isDescargando;
  formulariosDisponibles = signal<FormularioUI[]>([]);
  vistaActual = signal<'LISTA' | 'FORMULARIO' | 'RESUMEN_FINAL'>('LISTA');
  alertasVulnerabilidad = signal<any[]>([]);

  misFichas = signal<FichaRevision[]>([]);
  fichaActiva = signal<FichaRevision | null>(null);
  formularioActivo = signal<Formulario | null>(null);
  secciones = signal<Seccion[]>([]);
  dependencias = signal<PreguntaDependencia[]>([]);
  periodoActivo = signal<PeriodoMatricula | null>(null);

  // ✅ VARIABLE PARA GUARDAR EL PERFIL COMPLETO DE LA BD
  datosCompletosPerfil: any = null;

  isLoading = signal<boolean>(true);
  enviando = signal<boolean>(false);
  isSavingLocal = signal<boolean>(false);
  mostrarBannerPrecarga = signal<boolean>(false);

  subiendoEvidenciaId = signal<string | null>(null);

  misDocumentosGuardados = signal<DocumentoEstudiante[]>([]);
  mostrarModalSeleccionDoc = signal<boolean>(false);
  respuestaIdParaAdjunto = signal<string | null>(null);

  perfilEstudiante = signal<EstudiantePerfil | null>(null);
  seccionActualIndex = signal<number>(0);

  totalIngresos = signal(0);
  totalEgresos = signal(0);
  valormap = signal<Record<string, any>>({});

  estadoActivoUI = computed<EstadoUI>(() => normalizarEstado(this.fichaActiva()?.estado_ficha));

  esEditable = computed(() => {
    const estado = this.estadoActivoUI();
    return estado === 'BORRADOR' || estado === 'RECHAZADA';
  });

  progreso = computed(() => {
    const totalPasos = this.secciones().length + 1;
    if (totalPasos === 1) return 0;
    return ((this.seccionActualIndex() + 1) / totalPasos) * 100;
  });

  esPasoResumen = computed(() => {
    return this.secciones().length > 0 && this.seccionActualIndex() === this.secciones().length;
  });

  balance = computed(() => Math.max(0, this.totalIngresos() - this.totalEgresos()));
  egresosExcedenIngresos = computed(() => this.totalEgresos() > this.totalIngresos());

  seccionActualEsFinanciera = computed(() => {
    const sec = this.secciones()[this.seccionActualIndex()];
    return sec?.tipo_seccion === 'FINANCIERA';
  });

  haySeccionFinanciera = computed(() =>
    this.secciones().some(s => s.tipo_seccion === 'FINANCIERA')
  );

  cedulaEstudiante = computed(() => {
    const ficha = this.fichaActiva();
    const perfil = this.perfilEstudiante();
    const user = this.authService.user() as any;
    const valores = this.valormap();

    let cedula =
      ficha?.usuario?.cedula ||
      user?.cedula ||
      user?.identificacion || 
      user?.numero_documento ||
      user?.usuario?.cedula ||
      user?.usuario?.identificacion ||
      perfil?.cedula ||
      '';

    if (!cedula || cedula === 'N/A') {
      for (const sec of this.secciones()) {
        for (const p of sec.preguntas || []) {
          const codigo = (p.codigo_sistema || '').toUpperCase();
          const enunciado = (p.enunciado || '').toLowerCase();
          
          const esCedula =
            codigo === 'CEDULA' ||
            codigo === 'REGISTRO_UNICO' ||
            codigo === 'DOCUMENTO_IDENTIDAD' ||
            enunciado.includes('cédula') ||
            enunciado.includes('cedula') ||
            enunciado.includes('identificación') ||
            enunciado.includes('identificacion') ||
            enunciado.includes('registro único') ||
            enunciado.includes('registro unico');

          if (esCedula && valores[p.id] && String(valores[p.id]).trim() !== '') {
            cedula = String(valores[p.id]);
            break;
          }
        }
        if (cedula && cedula !== 'N/A') break;
      }
    }

    const limpia = String(cedula || '').trim();
    if (!limpia || limpia === 'N/A') return '—';
    return limpia;
  });

  resumenRespuestas = computed<Record<string, string>>(() => {
  const map: Record<string, string> = {};
  void this.valormap();
  // 🔥 getRawValue SÍ OBTIENE LOS CAMPOS BLOQUEADOS (Nombres, Cédula)
  const valores = this.respuestasGroup.getRawValue();
  const matricesValores = this.matricesGroup.getRawValue();

  for (const sec of this.secciones()) {
    for (const p of sec.preguntas || []) {
      map[p.id] = this.calcularTexto(p, valores, matricesValores);
      for (const sub of this.getSubpreguntas(p.id)) {
        map[sub.id] = this.calcularTexto(sub, valores, matricesValores);
      }
    }
  }
  return map;
});

  private autosaveData: any = null;
  private respuestasBDCache: any[] = [];

  respuestasForm: FormGroup = this.fb.group({
    respuestas: this.fb.group({}),
    matrices: this.fb.group({}),
    evidencias: this.fb.group({})
  });

  get respuestasGroup(): FormGroup { return this.respuestasForm.get('respuestas') as FormGroup; }
  get matricesGroup(): FormGroup { return this.respuestasForm.get('matrices') as FormGroup; }
  get evidenciasGroup(): FormGroup { return this.respuestasForm.get('evidencias') as FormGroup; }


  ngOnInit(): void {
  this.cargarPerfilUsuario();
  this.cargarDatosEstudiante();

  this.respuestasForm.valueChanges
    .pipe(takeUntilDestroyed(this.destroyRef))
    .subscribe(val => {
      if (!this.esEditable()) return;
      this.valormap.set(val.respuestas || {});
      this.limpiarPreguntasOcultas();
      this.recalcularTotalesFinancieros();
    });

  this.respuestasForm.valueChanges
    .pipe(debounceTime(400), takeUntilDestroyed(this.destroyRef))
    .subscribe(() => {
      if (!this.esEditable()) return;
      this.isSavingLocal.set(true);
      this.persistirAutosave();
      setTimeout(() => this.isSavingLocal.set(false), 500);
    });
}

  // ---------- AUTOSAVE 24h POR FICHA ----------

  private getAutosaveKey(fichaId?: string): string {
    const id = fichaId || this.fichaActiva()?.id || 'temp';
    return `${AUTOSAVE_PREFIX}${id}`;
  }

  private recuperarAutosaveValido(fichaId?: string): void {
    const key = this.getAutosaveKey(fichaId);
    const saved = localStorage.getItem(key);
    this.autosaveData = null;

    if (!saved) return;

    try {
      const parsed = JSON.parse(saved);
      const ts = Number(parsed?.savedAt || 0);

      if (!ts || Date.now() - ts > AUTOSAVE_TTL_MS) {
        localStorage.removeItem(key);
        return;
      }

      this.autosaveData = parsed;
    } catch {
      localStorage.removeItem(key);
    }
  }

  private persistirAutosave(): void {
    if (!this.esEditable()) return;

    const fichaId = this.fichaActiva()?.id;
    if (!fichaId) return;

    const val = this.respuestasForm.getRawValue();
    const dataToSave = {
      ...val,
      seccionIndex: this.seccionActualIndex(),
      fichaId,
      formularioId: this.formularioActivo()?.id,
      savedAt: Date.now(),
    };

    localStorage.setItem(this.getAutosaveKey(fichaId), JSON.stringify(dataToSave));
  }

  private borrarAutosave(fichaId?: string): void {
    const id = fichaId || this.fichaActiva()?.id;
    if (id) localStorage.removeItem(this.getAutosaveKey(id));
  }

  // ---------- PERFIL / CÉDULA ----------

  cargarPerfilUsuario(): void {
    const user = this.authService.user() as any;
    if (!user) return;

    this.perfilEstudiante.set({
      cedula: user.cedula || user.identificacion || user.numero_documento || user.usuario?.cedula || user.usuario?.identificacion || '',
      rol: user.rol || 'ESTUDIANTE',
      correo: user.email || user.email_institucional || user.nombre || '',
      carrera: user.carrera?.nombre || user.carrera || 'General',
      ciclo: user.ciclo?.nombre || user.ciclo || 'N/A',
      periodoAcademico: user.periodo || 'Actual',
      estadoMatricula: user.estadoMatricula || 'MATRICULADO',
    });
  }

  private sincronizarCedulaDesdeFicha(): void {
    const cedula = this.fichaActiva()?.usuario?.cedula;
    if (!cedula) return;
    this.perfilEstudiante.update((p) => (p ? { ...p, cedula } : p));
  }

  // 🔥 MAGIA: PRECARGA E INYECCIÓN DE PERFIL EN RESPUESTAS
  private async precargarCamposPerfil(): Promise<void> {
    const p = this.datosCompletosPerfil;
    if (!p) return;

    // 1. Extraemos y formateamos la data básica
    const cedula = p.cedula || '';
    const nombres = [p.primer_nombre, p.segundo_nombre].filter(Boolean).join(' ');
    const apellidos = [p.primer_apellido, p.segundo_apellido].filter(Boolean).join(' ');
    const celular = p.numero_celular || 'No registrado';
    const correo = p.email_institucional || p.email || '';
    
    let fechaNacimiento = '';
    if (p.fecha_nacimiento) {
      fechaNacimiento = new Date(p.fecha_nacimiento).toISOString().split('T')[0];
    }

    // Datos demográficos
    let sexoGestacion = p.sexo || 'No registrado';
    if (p.sexo === 'Mujer' && p.esta_embarazada) sexoGestacion += ' (En estado de gestación)';
    
    const genero = p.genero || 'No registrado';
    const estadoCivil = p.estado_civil || 'No registrado';
    
    let hijos = 'No';
    if (p.tiene_hijos) hijos = `Sí (Menores de 5 años: ${p.hijos_menores_5_anios || 0})`;

    let etnia = p.etnia || 'No registrado';
    if (p.etnia === 'Indígena' && p.pueblo_nacionalidad) etnia += ` - ${p.pueblo_nacionalidad}`;
    if (p.etnia === 'Otro' && p.etnia_otra) etnia += ` - ${p.etnia_otra}`;

    let idioma = p.idioma || 'No registrado';
    if (p.idioma === 'Otro' && p.idioma_otro) idioma += ` - ${p.idioma_otro}`;

    // 2. GEOLOCALIZACIÓN: Traducción de UUIDs (Códigos raros) a Nombres Reales
    let nacionalidad = p.nacionalidad?.nacionalidad || p.nacionalidad?.nombre || p.nacionalidad_id || 'No registrado';
    let pais = p.pais_nacimiento?.nombre || p.pais_nacimiento_id || '';
    let prov = p.provincia_nacimiento?.nombre || p.provincia_nacimiento_id || '';
    let can = p.canton_nacimiento?.nombre || p.canton_nacimiento_id || '';

    try {
      // Si detecta un código UUID, consulta la Base de Datos para traer el nombre real
      if (UUID_REGEX.test(nacionalidad) || UUID_REGEX.test(pais)) {
        const paises = await firstValueFrom(this.ubicacionesService.getPaises());
        const nacObj = paises.find((x: any) => x.id === p.nacionalidad_id);
        if (nacObj) nacionalidad = nacObj.nacionalidad;

        const paisObj = paises.find((x: any) => x.id === p.pais_nacimiento_id);
        if (paisObj) pais = paisObj.nombre;
      }

      if (p.pais_nacimiento_id && UUID_REGEX.test(prov)) {
        const provs = await firstValueFrom(this.ubicacionesService.getProvincias(p.pais_nacimiento_id));
        const provObj = provs.find((x: any) => x.id === p.provincia_nacimiento_id);
        if (provObj) prov = provObj.nombre;
      }

      if (p.provincia_nacimiento_id && UUID_REGEX.test(can)) {
        const cantones = await firstValueFrom(this.ubicacionesService.getCantones(p.provincia_nacimiento_id));
        const canObj = cantones.find((x: any) => x.id === p.canton_nacimiento_id);
        if (canObj) can = canObj.nombre;
      }
    } catch (e) {
      console.warn('No se pudieron traducir algunas ubicaciones geográficas.');
    }

    const lugarNacimiento = [pais, prov, can].filter(Boolean).join(' - ') || 'No registrado';

    // 3. Inyectamos los datos cuidadosamente sin cruzar preguntas
    for (const sec of this.secciones()) {
      for (const preg of sec.preguntas || []) {
        const enunciado = (preg.enunciado || '').toLowerCase().trim();
        const ctrl = this.respuestasGroup.get(preg.id);
        if (!ctrl) continue;

        let valorAInyectar = null;

        // Búsqueda estricta para evitar que "Etnia / Nacionalidad" choque con "Nacionalidad"
        if (enunciado.includes('cédula') || enunciado.includes('pasaporte')) valorAInyectar = cedula;
        else if (enunciado.includes('nombres completos')) valorAInyectar = nombres;
        else if (enunciado.includes('apellidos completos')) valorAInyectar = apellidos;
        else if (enunciado.includes('celular')) valorAInyectar = celular;
        else if (enunciado.includes('correo') || enunciado.includes('email')) valorAInyectar = correo;
        else if (enunciado.includes('fecha de nacimiento')) valorAInyectar = fechaNacimiento;
        else if (enunciado.includes('país') || enunciado.includes('ciudad de nacimiento')) valorAInyectar = lugarNacimiento;
        else if (enunciado === 'nacionalidad') valorAInyectar = nacionalidad; // Búsqueda exacta
        else if (enunciado.includes('sexo')) valorAInyectar = sexoGestacion;
        else if (enunciado === 'género' || enunciado === 'genero') valorAInyectar = genero; // Búsqueda exacta
        else if (enunciado.includes('estado civil')) valorAInyectar = estadoCivil;
        else if (enunciado.includes('hijos')) valorAInyectar = hijos;
        else if (enunciado.includes('etnia')) valorAInyectar = etnia;
        else if (enunciado.includes('idioma')) valorAInyectar = idioma;

        if (valorAInyectar !== null && valorAInyectar !== '') {
          ctrl.setValue(valorAInyectar, { emitEvent: false });
          ctrl.disable({ emitEvent: false }); 
        }
      }
    }

    this.valormap.set(this.respuestasGroup.getRawValue());
    this.recalcularTotalesFinancieros();
  }

  // ---------- NAVEGACIÓN DE PASOS ----------

  irAPaso(index: number): void {
  if (!this.esEditable() || index <= this.seccionActualIndex()) {
    this.seccionActualIndex.set(index);
    this.guardarPasoEnLocal();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }

  if (this.validarHastaSeccion(index)) {
    this.seccionActualIndex.set(index);
    this.guardarPasoEnLocal();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } else {
    this.toastService.show('Por favor, completa los campos obligatorios de las secciones anteriores antes de avanzar.', 'warning');
  }
}

  siguiente(): void {
    if (this.validarSeccionActual()) {
      if (this.seccionActualIndex() <= this.secciones().length - 1) {
        this.seccionActualIndex.update(i => i + 1);
        this.guardarPasoEnLocal();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } else {
      this.toastService.show('Por favor, revisa que todos los campos requeridos estén llenos.', 'warning');
    }
  }

  anterior(): void {
    if (this.seccionActualIndex() > 0) {
      this.seccionActualIndex.update(i => i - 1);
      this.guardarPasoEnLocal();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  private validarSeccionPorIndice(index: number): boolean {
  if (!this.esEditable()) return true;

  const seccion = this.secciones()[index];
  if (!seccion) return true;

  let esValido = true;

  if (seccion.tipo_seccion === 'FINANCIERA' && this.egresosExcedenIngresos()) {
    esValido = false;
  }

  for (const preg of seccion.preguntas || []) {
    if (!this.esPreguntaVisible(preg.id)) continue;

    if (!this.validarPreguntaIndividual(preg)) esValido = false;

    for (const sub of this.getSubpreguntas(preg.id)) {
      if (this.esPreguntaVisible(sub.id) && !this.validarPreguntaIndividual(sub)) {
        esValido = false;
      }
    }
  }

  return esValido;
}

validarSeccionActual(): boolean {
  if (this.esPasoResumen() || !this.esEditable()) return true;

  const esValido = this.validarSeccionPorIndice(this.seccionActualIndex());

  if (!esValido) {
    const seccionActual = this.secciones()[this.seccionActualIndex()];
    if (seccionActual?.tipo_seccion === 'FINANCIERA' && this.egresosExcedenIngresos()) {
      this.toastService.show(
        'Los egresos no pueden ser mayores que los ingresos. Corrige los montos antes de continuar.',
        'error'
      );
    }
  }

  return esValido;
}

private validarHastaSeccion(index: number): boolean {
  for (let i = 0; i < index; i++) {
    if (!this.validarSeccionPorIndice(i)) return false;
  }
  return true;
}
seccionEstaCompleta(index: number): boolean {
  if (!this.esEditable()) return true;

  const seccion = this.secciones()[index];
  if (!seccion) return true;

  if (seccion.tipo_seccion === 'FINANCIERA' && this.egresosExcedenIngresos()) {
    return false;
  }

  for (const preg of seccion.preguntas || []) {
    if (!this.esPreguntaVisible(preg.id)) continue;

    if (!this.preguntaEstaCompleta(preg)) return false;

    for (const sub of this.getSubpreguntas(preg.id)) {
      if (this.esPreguntaVisible(sub.id) && !this.preguntaEstaCompleta(sub)) {
        return false;
      }
    }
  }

  return true;
}

private preguntaEstaCompleta(preg: Pregunta): boolean {
  const ctrl = this.respuestasGroup.get(preg.id);
  if (ctrl && ctrl.invalid) return false;

  if (preg.tipoCampo?.nombre === 'MATRIZ') {
    const matGroup = this.matricesGroup.get(preg.id) as FormGroup;
    if (matGroup && matGroup.invalid) return false;
  }

  if (preg.requiere_evidencia) {
    const evidenciaCtrl = this.evidenciasGroup.get(preg.id);
    if (evidenciaCtrl && evidenciaCtrl.invalid) return false;
  }

  return true;
}
  private validarPreguntaIndividual(preg: Pregunta): boolean {
    let esValido = true;

    const ctrl = this.respuestasGroup.get(preg.id);
    if (ctrl && ctrl.invalid) {
      ctrl.markAsTouched();
      esValido = false;
    }

    if (preg.tipoCampo?.nombre === 'MATRIZ') {
      const matGroup = this.matricesGroup.get(preg.id) as FormGroup;
      if (matGroup && matGroup.invalid) {
        matGroup.markAllAsTouched();
        esValido = false;
      }
    }

    if (preg.requiere_evidencia) {
      const evidenciaCtrl = this.evidenciasGroup.get(preg.id);
      if (evidenciaCtrl && evidenciaCtrl.invalid) {
        evidenciaCtrl.markAsTouched();
        esValido = false;
      }
    }

    return esValido;
  }

  private guardarPasoEnLocal(): void {
  if (this.esEditable()) {
    this.valormap.set(this.respuestasGroup.getRawValue());
    this.recalcularTotalesFinancieros();
  }
  this.persistirAutosave();
}

  // ---------- CARGA INICIAL ----------

  cargarDatosEstudiante(): void {
    this.isLoading.set(true);
    // Recuperamos el ID del usuario desde el token
    const userId = (this.authService.user() as any)?.id || (this.authService.user() as any)?.sub;

    // 🔥 Agregamos la petición extra para descargar el perfil completo y tener todos sus datos
    forkJoin({
      periodos: this.periodoService.getPeriodos(),
      fichas: this.fichaService.getMisFichas(),
      formularios: this.formularioService.getFormularios(),
      perfil: userId ? this.http.get<any>(`${environment.apiUrl}/usuarios/${userId}`).pipe(catchError(() => of(null))) : of(null)
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ periodos, fichas, formularios, perfil }) => {
          this.datosCompletosPerfil = perfil; // Guardamos el perfil para la precarga
          
          const pActivo = periodos.find(p => p.activo);
          this.periodoActivo.set(pActivo || null);
          this.misFichas.set(fichas);

          const formsPublicados = formularios.filter(f => {
            const fPeriodoId = f.periodo_id || (f as any).periodo?.id;
            return f.publicado === true && (!pActivo || fPeriodoId === pActivo.id);
          });

          const formsUI = formsPublicados.map((f): FormularioUI => {
            const fichaAsociada = fichas.find(fi => fi.formulario_id === f.id && (fi.periodo_id === pActivo?.id));
            return {
              ...f,
              estado_ui: normalizarEstado(fichaAsociada?.estado_ficha)
            };
          });

          this.formulariosDisponibles.set(formsUI);
          this.vistaActual.set('LISTA');
          this.isLoading.set(false);
        },
        error: () => {
          this.toastService.show('Error de conexión al cargar tus datos.', 'error');
          this.isLoading.set(false);
        }
      });
  }

  seleccionarFormulario(formularioId: string): void {
    if (this.isLoading() || this.enviando()) return;
    const pActivo = this.periodoActivo();
    if (!pActivo) {
      this.toastService.show('No hay un periodo de matrícula activo en este momento.', 'warning');
      return;
    }

    this.isLoading.set(true);
    this.vistaActual.set('FORMULARIO');

    const fichaExistente = this.misFichas().find(f =>
      f.formulario_id === formularioId &&
      (f.periodo_id === pActivo.id || (f.periodo as any)?.id === pActivo.id)
    );

    if (fichaExistente) {
      this.fichaActiva.set(fichaExistente);
      this.sincronizarCedulaDesdeFicha();
      this.recuperarAutosaveValido(fichaExistente.id);
      this.cargarEstructuraFormulario(formularioId);
    } else {
      this.crearNuevaFicha(pActivo.id, formularioId);
    }
  }

  volverALista(): void {
    if (this.isLoading() || this.enviando()) return;
    
    this.vistaActual.set('LISTA');
    this.fichaActiva.set(null);
    this.formularioActivo.set(null);
    this.seccionActualIndex.set(0);
    this.mostrarBannerPrecarga.set(false);
    this.autosaveData = null;

    this.respuestasForm = this.fb.group({
      respuestas: this.fb.group({}),
      matrices: this.fb.group({}),
      evidencias: this.fb.group({})
    });
    this.cargarDatosEstudiante(); 
  }

  evaluarPrecarga(fichas: FichaRevision[]): void {
    const tieneRespuestasReales = this.respuestasBDCache.length > 0;
    const tieneFichasAnteriores = fichas.some(f =>
      (f.estado_ficha === 'VALIDADO' || f.estado_ficha === 'ENVIADA' || f.estado_ficha === 'ENVIADO')
      && f.id !== this.fichaActiva()?.id
    );

    const debeMostrar = !tieneRespuestasReales && tieneFichasAnteriores && this.estadoActivoUI() === 'BORRADOR';
    this.mostrarBannerPrecarga.set(debeMostrar);
  }

  ignorarPrecarga(): void { this.mostrarBannerPrecarga.set(false); }

  ejecutarPrecarga(): void {
    const periodoNuevoId = this.fichaActiva()?.periodo_id;
    if (!periodoNuevoId) return;

    this.toastService.show('Importando datos, por favor espera...', 'info');
    this.isLoading.set(true);

    this.http
      .post<any>(`${environment.apiUrl}/respuestas-formulario/precarga/${periodoNuevoId}`, {})
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          if (data?.respuestas_transferidas) {
            this.mostrarBannerPrecarga.set(false);
            this.toastService.show(data.message || '¡Respuestas importadas!', 'success');
            this.borrarAutosave();
            this.autosaveData = null;
            this.forzarRecarga();
          } else {
            this.toastService.show(data?.message || 'No se encontraron datos para precargar.', 'info');
            this.isLoading.set(false);
          }
        },
        error: (err) => {
          this.toastService.show(err?.error?.message || 'Error al importar las respuestas.', 'error');
          this.isLoading.set(false);
        }
      });
  }

  forzarRecarga(): void {
    const ficha = this.fichaActiva();
    if (!ficha) return;

    this.borrarAutosave(ficha.id);
    this.autosaveData = null;

    this.respuestasGroup.reset({}, { emitEvent: false });
    this.matricesGroup.reset({}, { emitEvent: false });
    this.evidenciasGroup.reset({}, { emitEvent: false });
    this.valormap.set({});

    this.toastService.show('Sincronizando con la base de datos...', 'info');
    this.isLoading.set(true);

    this.cargarEstructuraFormulario(ficha.formulario_id);
  }

  crearNuevaFicha(periodoId: string, formularioId: string): void {
    this.fichaService.crearFicha({
      periodo_id: periodoId,
      formulario_id: formularioId,
      total_ingresos: 0,
      total_egresos: 0
    } as any)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (nuevaFicha: FichaRevision) => {
          this.fichaActiva.set(nuevaFicha);
          this.sincronizarCedulaDesdeFicha();
          this.recuperarAutosaveValido(nuevaFicha.id);
          const fichasActualizadas = [...this.misFichas(), nuevaFicha];
          this.misFichas.set(fichasActualizadas);
          this.cargarEstructuraFormulario(formularioId);
        },
        error: () => {
          this.fichaService.getMisFichas().subscribe(fichas => {
            const found = fichas.find(f => f.periodo_id === periodoId && f.formulario_id === formularioId);
            if (found) {
              this.fichaActiva.set(found);
              this.recuperarAutosaveValido(found.id);
              this.cargarEstructuraFormulario(found.formulario_id);
            } else {
              this.toastService.show('Error al crear o buscar tu ficha.', 'error');
              this.isLoading.set(false);
            }
          });
        }
      });
  }

  cargarEstructuraFormulario(formularioId: string): void {
    const fichaActual = this.fichaActiva();

    forkJoin({
      formulario: this.formularioService.getFormularioById(formularioId),
      dependencias: this.dependenciasService.getDependenciasByFormulario(formularioId),
      respuestas: fichaActual
        ? this.http
          .get<any[]>(`${environment.apiUrl}/respuestas-formulario/ficha/${fichaActual.id}`)
          .pipe(
            catchError(() => {
              this.toastService.show('No se pudieron cargar las respuestas guardadas.', 'error');
              return of([] as any[]);
            })
          )
        : of([] as any[]),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ formulario, dependencias, respuestas }) => {
          this.dependencias.set(dependencias);
          this.formularioActivo.set(formulario);
          this.respuestasBDCache = respuestas || [];

          const secsDelForm = (formulario as any).secciones as Seccion[] | undefined;

          if (secsDelForm && secsDelForm.length > 0 && secsDelForm[0]?.preguntas) {
            this.aplicarEstructuraYControles(secsDelForm);
            return;
          }

          this.formularioService
            .getSeccionesByFormulario(formularioId)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
              next: (secciones) => {
                if (!secciones.length) {
                  this.secciones.set([]);
                  this.isLoading.set(false);
                  return;
                }

                forkJoin(
                  secciones.map((s) =>
                    this.formularioService.getPreguntasBySeccion(s.id).pipe(
                      catchError(() => of([] as Pregunta[]))
                    )
                  )
                )
                  .pipe(takeUntilDestroyed(this.destroyRef))
                  .subscribe({
                    next: (preguntasPorSeccion) => {
                      const seccionesConPreguntas = secciones.map((s, i) => ({
                        ...s,
                        preguntas: preguntasPorSeccion[i] || [],
                      }));
                      this.aplicarEstructuraYControles(seccionesConPreguntas);
                    },
                    error: () => {
                      this.toastService.show('Error al cargar preguntas de la ficha.', 'error');
                      this.isLoading.set(false);
                    },
                  });
              },
              error: () => {
                this.toastService.show('Error al cargar secciones.', 'error');
                this.isLoading.set(false);
              },
            });
        },
        error: () => {
          this.toastService.show('Error de conexión con el formulario.', 'error');
          this.isLoading.set(false);
        },
      });
  }

  private aplicarEstructuraYControles(secciones: Seccion[]): void {
    this.secciones.set(secciones);

    const preguntasTodas = secciones.flatMap((s) => s.preguntas || []);
    const idsExistentes = new Set(preguntasTodas.map((p) => p.id));
    this.sanitizarAutosave(idsExistentes);

    preguntasTodas.forEach((p) => this.construirControlesPreguntas(p));
    this.aplicarRespuestasGuardadas(this.respuestasBDCache);
    
    // ✅ LLAMAMOS A LA PRECARGA DE DATOS AQUÍ
    this.precargarCamposPerfil();
    
    this.recalcularTotalesFinancieros();

    if (!this.esEditable()) {
      this.seccionActualIndex.set(this.secciones().length);
    } else if (this.autosaveData?.seccionIndex !== undefined) {
      const maxStep = this.secciones().length;
      const saved = this.autosaveData.seccionIndex;
      this.seccionActualIndex.set(saved <= maxStep ? saved : 0);
    }

    this.evaluarPrecarga(this.misFichas());
    this.isLoading.set(false);
    this.cargarOpcionesEnBackground(preguntasTodas);
  }

  private cargarOpcionesEnBackground(preguntas: Pregunta[]): void {
    const deSeleccion = preguntas.filter(
      (p) =>
        (!p.opciones || p.opciones.length === 0) &&
        (p.tipoCampo?.nombre === 'SELECCION_UNICA' || p.tipoCampo?.nombre === 'SELECCION_MULTIPLE')
    );

    if (deSeleccion.length === 0) return;

    const chunkSize = 8;
    const chunks: Pregunta[][] = [];
    for (let i = 0; i < deSeleccion.length; i += chunkSize) {
      chunks.push(deSeleccion.slice(i, i + chunkSize));
    }

    const procesarChunk = (idx: number) => {
      if (idx >= chunks.length) return;
      const chunk = chunks[idx];

      forkJoin(
        chunk.map((p) =>
          this.formularioService.getOpcionesByPregunta(p.id).pipe(
            catchError(() => of([] as any[]))
          )
        )
      )
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (opcionesList) => {
            chunk.forEach((p, i) => {
              p.opciones = opcionesList[i] || [];
            });

            this.secciones.update((secs) =>
              secs.map((s) => ({
                ...s,
                preguntas: (s.preguntas || []).map((pr) => {
                  const found = chunk.find((x) => x.id === pr.id);
                  return found ? { ...pr, opciones: found.opciones } : pr;
                }),
              }))
            );

            procesarChunk(idx + 1);
          },
        });
    };

    procesarChunk(0);
  }

  private sanitizarAutosave(idsPreguntasExistentes: Set<string>): void {
    if (!this.autosaveData) return;
    if (this.autosaveData.respuestas) {
      Object.keys(this.autosaveData.respuestas).forEach(key => {
        if (!idsPreguntasExistentes.has(key)) delete this.autosaveData.respuestas[key];
      });
    }
    if (this.autosaveData.matrices) {
      Object.keys(this.autosaveData.matrices).forEach(key => {
        if (!idsPreguntasExistentes.has(key)) delete this.autosaveData.matrices[key];
      });
    }
  }

  construirControlesPreguntas(p: Pregunta): void {
    const isMultiple = p.tipoCampo?.nombre === 'SELECCION_MULTIPLE';
    const isMatriz = p.tipoCampo?.nombre === 'MATRIZ';
    const isNumeric = p.tipoCampo?.nombre === 'NUMERICO';

    if (isMultiple) {
      if (!this.respuestasGroup.contains(p.id)) {
        const savedArr: string[] = Array.isArray(this.autosaveData?.respuestas?.[p.id])
          ? this.autosaveData.respuestas[p.id]
          : [];

        const formArray = this.fb.array(
          savedArr.map((id: string) => this.fb.control(id)),
          p.es_obligatorio ? minSelectedCheckboxesValidator(1) : []
        );
        this.respuestasGroup.addControl(p.id, formArray);
      }
    } else if (isMatriz) {
      this.cargarEstructuraMatriz(p);
    } else {
      const validators = p.es_obligatorio ? [Validators.required] : [];
      if (isNumeric) {
        validators.push(Validators.pattern(NUMERIC_REGEX));
        validators.push(Validators.min(0));
      }

      if (!this.respuestasGroup.contains(p.id)) {
        const savedVal = this.autosaveData?.respuestas?.[p.id] ?? '';
        this.respuestasGroup.addControl(p.id, this.fb.control(savedVal, validators));
      }
    }

    if (!this.evidenciasGroup.contains(p.id)) {
      const savedEvidencia = this.autosaveData?.evidencias?.[p.id] ?? '';
      const evidenciaValidators = p.requiere_evidencia ? [Validators.required] : [];
      this.evidenciasGroup.addControl(p.id, this.fb.control(savedEvidencia, evidenciaValidators));
    }

    this.valormap.set(this.respuestasGroup.getRawValue());
  }

  onToggleSeleccionMultiple(preguntaId: string, opcionId: string, event: Event): void {
    if (!this.esEditable()) return;

    const checked = (event.target as HTMLInputElement).checked;
    const formArray = this.respuestasGroup.get(preguntaId) as FormArray;
    if (!formArray) return;

    if (checked) {
      formArray.push(this.fb.control(opcionId));
    } else {
      const idx = formArray.controls.findIndex(ctrl => ctrl.value === opcionId);
      if (idx !== -1) formArray.removeAt(idx);
    }

    formArray.markAsTouched();
    this.valormap.set(this.respuestasGroup.getRawValue());
  }

  esOpcionMultipleSeleccionada(preguntaId: string, opcionId: string): boolean {
    const formArray = this.respuestasGroup.get(preguntaId) as FormArray;
    if (!formArray) return false;
    return formArray.controls.some(ctrl => ctrl.value === opcionId);
  }

  onToggleMatrizMultiple(preguntaId: string, filaId: string, columnaId: string, event: Event): void {
    if (!this.esEditable()) return;

    const checked = (event.target as HTMLInputElement).checked;
    const matrizGroup = this.matricesGroup.get(preguntaId) as FormGroup;
    if (!matrizGroup) return;

    const filaArray = matrizGroup.get(filaId) as FormArray;
    if (!filaArray) return;

    if (checked) {
      filaArray.push(this.fb.control(columnaId));
    } else {
      const idx = filaArray.controls.findIndex(ctrl => ctrl.value === columnaId);
      if (idx !== -1) filaArray.removeAt(idx);
    }

    filaArray.markAsTouched();
    this.valormap.set(this.respuestasGroup.getRawValue());
  }

  esColumnaMatrizSeleccionada(preguntaId: string, filaId: string, columnaId: string): boolean {
    const matrizGroup = this.matricesGroup.get(preguntaId) as FormGroup;
    if (!matrizGroup) return false;

    const filaArray = matrizGroup.get(filaId) as FormArray;
    if (!filaArray) return false;

    return filaArray.controls.some(ctrl => ctrl.value === columnaId);
  }

  esPreguntaDependiente(preguntaId: string): boolean {
    return this.dependencias().some(d => d.pregunta_id === preguntaId);
  }

  getSubpreguntas(preguntaPadreId: string): Pregunta[] {
    const deps = this.dependencias().filter(d => d.pregunta_disparadora_id === preguntaPadreId);
    const resultado: Pregunta[] = [];
    for (const dep of deps) {
      for (const s of this.secciones()) {
        const p = s.preguntas?.find(x => x.id === dep.pregunta_id);
        if (p) resultado.push(p);
      }
    }
    return resultado;
  }

  cargarEstructuraMatriz(pregunta: Pregunta): void {
    forkJoin({
      filas: this.matricesService.getFilas(pregunta.id),
      columnas: this.matricesService.getColumnas(pregunta.id)
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ filas, columnas }) => {
          this.secciones.update(secs => secs.map(s => ({
            ...s,
            preguntas: s.preguntas?.map(p => p.id === pregunta.id ? { ...p, filasMatriz: filas, columnasMatriz: columnas } : p)
          })));

          if (!this.matricesGroup.contains(pregunta.id)) {
            const groupValidators = pregunta.es_obligatorio ? [requireAtLeastOneMatrixRowValidator()] : [];
            const matrizFormGroup = this.fb.group({}, { validators: groupValidators });

            const respuestaBD = this.respuestasBDCache.find((r: any) => r.pregunta_id === pregunta.id);
            const matrizPorFilaBD: Record<string, string[]> = {};
            if (respuestaBD?.respuestasMatriz?.length > 0) {
              respuestaBD.respuestasMatriz.forEach((rm: any) => {
                if (!matrizPorFilaBD[rm.fila_id]) matrizPorFilaBD[rm.fila_id] = [];
                matrizPorFilaBD[rm.fila_id].push(rm.columna_id);
              });
            }

            filas.forEach((fila: any) => {
              let savedColArr: string[] = [];

              if (matrizPorFilaBD[fila.id]) {
                savedColArr = matrizPorFilaBD[fila.id];
              } else {
                const savedData = this.autosaveData?.matrices?.[pregunta.id]?.[fila.id];
                if (Array.isArray(savedData)) savedColArr = savedData;
                else if (savedData) savedColArr = [savedData];
              }

              const formArray = this.fb.array(savedColArr.map(id => this.fb.control(id)));
              matrizFormGroup.addControl(fila.id, formArray);
            });

            this.matricesGroup.addControl(pregunta.id, matrizFormGroup);

            if (!this.esEditable()) {
              matrizFormGroup.disable({ emitEvent: false });
            }
          }
        }
      });
  }

  esPreguntaVisible(preguntaId: string): boolean {
    const dep = this.dependencias().find(d => d.pregunta_id === preguntaId);
    if (!dep) return true;

    const valorDisparadorActual = this.valormap()[dep.pregunta_disparadora_id];

    if (dep.opcion_disparadora_id) {
      if (Array.isArray(valorDisparadorActual)) {
        return valorDisparadorActual.includes(dep.opcion_disparadora_id);
      }
      return valorDisparadorActual === dep.opcion_disparadora_id;
    }

    if (dep.valor_disparador !== undefined && dep.valor_disparador !== null) {
      return String(valorDisparadorActual).toLowerCase() === String(dep.valor_disparador).toLowerCase();
    }

    return true;
  }

  private limpiarPreguntasOcultas(): void {
    if (!this.esEditable()) return;

    this.dependencias().forEach(dep => {
      if (!this.esPreguntaVisible(dep.pregunta_id)) {
        const ctrl = this.respuestasGroup.get(dep.pregunta_id);
        if (ctrl) {
          if (ctrl instanceof FormArray) {
            if (ctrl.length > 0) ctrl.clear({ emitEvent: false });
          } else if (ctrl.value !== null && ctrl.value !== '') {
            ctrl.setValue('', { emitEvent: false });
          }
        }
        const matCtrl = this.matricesGroup.get(dep.pregunta_id);
        if (matCtrl) matCtrl.reset({}, { emitEvent: false });
      }
    });
  }

  private calcularTexto(pregunta: Pregunta, valores: any, matricesValores: any): string {
    if (pregunta.tipoCampo?.nombre === 'MATRIZ') {
      const matrizVals = matricesValores[pregunta.id];
      if (!matrizVals) return 'Sin responder';

      const resumenFilas: string[] = [];

      Object.keys(matrizVals).forEach(filaId => {
        const cols = matrizVals[filaId];

        if (Array.isArray(cols) && cols.length > 0) {
          const fila = pregunta.filasMatriz?.find((f: any) => f.id === filaId);
          const textoFila = fila ? fila.texto_fila : 'Fila';

          const textosColumnas = cols.map((colId: string) => {
            const col = pregunta.columnasMatriz?.find((c: any) => c.id === colId);
            return col ? col.texto_columna : colId;
          });

          resumenFilas.push(`${textoFila}: ${textosColumnas.join(', ')}`);
        }
      });

      return resumenFilas.length > 0 ? resumenFilas.join('\n') : 'Sin responder';
    }

    const val = valores[pregunta.id];
    if (val === null || val === undefined || val === '') return 'Sin responder';

    if (Array.isArray(val)) {
      if (val.length === 0) return 'Sin responder';
      const textos = val.map((opcId: string) => {
        const opc = pregunta.opciones?.find(o => o.id === opcId);
        return opc ? opc.texto_opcion : 'Opción seleccionada';
      });
      return textos.join(', ');
    }

    if (pregunta.opciones && pregunta.opciones.length > 0) {
      const opc = pregunta.opciones.find(o => o.id === val);
      if (opc) return opc.texto_opcion;
    }

    if (UUID_REGEX.test(String(val))) return 'Opción seleccionada';

    if (pregunta.tipoCampo?.nombre === 'FECHA' && typeof val === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(val)) {
      const [year, month, day] = val.split('-');
      return `${day}/${month}/${year}`;
    }

    return String(val);
  }

  recalcularTotalesFinancieros(): void {
    let ingresos = 0;
    let egresos = 0;
    const valores = this.respuestasGroup.getRawValue();

    for (const sec of this.secciones()) {
      if (sec.tipo_seccion !== 'FINANCIERA') continue;

      for (const p of sec.preguntas || []) {
        if (!this.esPreguntaVisible(p.id)) continue;
        if (p.tipoCampo?.nombre !== 'NUMERICO') continue;

        const raw = valores[p.id];
        const monto = Number(raw);
        if (Number.isNaN(monto)) continue;

        if (p.categoria_financiera === 'INGRESO') {
          ingresos += monto;
        } else if (p.categoria_financiera === 'EGRESO') {
          egresos += monto;
        }
      }
    }

    this.totalIngresos.set(ingresos);
    this.totalEgresos.set(egresos);
  }

  aplicarRespuestasGuardadas(respuestasBD: any[]): void {
    if (!respuestasBD || respuestasBD.length === 0) {
      this.precargarCamposPerfil();
      return;
    }

    const valoresParaElFormulario: any = {};
    const evidenciasParaElFormulario: any = {};

    respuestasBD.forEach(resp => {
      if (resp.respuestasMatriz && resp.respuestasMatriz.length > 0) return;

      let textoReal = resp.valor_texto;
      let evidenciaExtraida = '';
      if (textoReal && typeof textoReal === 'string' && textoReal.includes('[EVIDENCIA_URL:')) {
        const match = textoReal.match(/\[EVIDENCIA_URL:(.*?)\]/);
        if (match && match[1]) {
          evidenciaExtraida = match[1];
          textoReal = textoReal.replace(match[0], '').trim();
        }
      }

      if (!evidenciaExtraida && resp.documentos && resp.documentos.length > 0) {
        evidenciaExtraida = resp.documentos[0].ruta_archivo;
      }

      if (evidenciaExtraida) {
        evidenciasParaElFormulario[resp.pregunta_id] = evidenciaExtraida;
      }

      const controlArray = this.respuestasGroup.get(resp.pregunta_id);

      if (controlArray instanceof FormArray) {
        controlArray.clear({ emitEvent: false });
        if (resp.opcionesSeleccionadas && resp.opcionesSeleccionadas.length > 0) {
          resp.opcionesSeleccionadas.forEach((opc: any) => {
            controlArray.push(this.fb.control(opc.opcion_id), { emitEvent: false });
          });
        }
      } else if (resp.opcionesSeleccionadas && resp.opcionesSeleccionadas.length > 0) {
        valoresParaElFormulario[resp.pregunta_id] = resp.opcionesSeleccionadas[0].opcion_id;
      } else {
        valoresParaElFormulario[resp.pregunta_id] = textoReal !== null && textoReal !== '' ? textoReal : resp.valor_numerico;
      }
    });

    this.respuestasGroup.patchValue(valoresParaElFormulario, { emitEvent: false });
    this.evidenciasGroup.patchValue(evidenciasParaElFormulario, { emitEvent: false });
    this.valormap.set(this.respuestasGroup.getRawValue());
    this.recalcularTotalesFinancieros();

    if (!this.esEditable()) {
      this.respuestasGroup.disable({ emitEvent: false });
      this.evidenciasGroup.disable({ emitEvent: false });
      this.matricesGroup.disable({ emitEvent: false });
    } else {
      this.respuestasGroup.enable({ emitEvent: false });
      this.evidenciasGroup.enable({ emitEvent: false });
      this.matricesGroup.enable({ emitEvent: false });
    }

    this.precargarCamposPerfil();
  }

  descargarPdfResumen(fichaId: string): void {
    const ficha = this.fichaActiva();
    const cedula = ficha?.usuario?.cedula || fichaId.slice(0, 8);
    this.descargaService.descargar(
      `${environment.apiUrl}/fichas-respondidas/${fichaId}/pdf-resumen`,
      `Resumen_Ficha_${cedula}.pdf`,
      'Hubo un problema al generar tu comprobante PDF.'
    );
  }

  guardarYEnviar(esFinal: boolean = true): void {
    if (this.isLoading() || this.enviando() || this.isSavingLocal()) return;
    const ficha = this.fichaActiva();
    if (!ficha) return;

    const ejecutar = () => {
      if (this.egresosExcedenIngresos()) {
        this.toastService.show(
          'No puedes enviar la ficha: los egresos superan a los ingresos. Corrige la sección financiera.',
          'error'
        );
        return;
      }

      this.enviando.set(true);

      // Usamos getRawValue para que sí incluya las cajitas bloqueadas de Cédula y Nombres
      const respuestasValores = this.respuestasGroup.getRawValue();
      const evidenciasValores = this.evidenciasGroup.getRawValue();
      const payloadRespuestas: any[] = [];

      Object.keys(respuestasValores).forEach(preguntaId => {
        if (this.esPreguntaVisible(preguntaId)) {
          let val = respuestasValores[preguntaId];
          const evidenciaUrl = evidenciasValores[preguntaId];

          const appendEvidencia = (baseText: string | null) => {
            if (!evidenciaUrl) return baseText;
            return baseText ? `${baseText} [EVIDENCIA_URL:${evidenciaUrl}]` : `[EVIDENCIA_URL:${evidenciaUrl}]`;
          };

          if ((val === null || val === undefined || val === '') && !evidenciaUrl) return;

          if (Array.isArray(val) && val.length > 0) {
            payloadRespuestas.push({ ficha_id: ficha.id, pregunta_id: preguntaId, opciones_seleccionadas: val, valor_texto: appendEvidencia(null) });
          } else if (typeof val === 'number') {
            payloadRespuestas.push({ ficha_id: ficha.id, pregunta_id: preguntaId, valor_numerico: val, valor_texto: appendEvidencia(null) });
          } else if (typeof val === 'boolean') {
            payloadRespuestas.push({ ficha_id: ficha.id, pregunta_id: preguntaId, valor_texto: appendEvidencia(val ? 'SI' : 'NO') });
          } else if (typeof val === 'string' && val.trim() !== '') {
            if (UUID_REGEX.test(val)) {
              payloadRespuestas.push({ ficha_id: ficha.id, pregunta_id: preguntaId, opciones_seleccionadas: [val], valor_texto: appendEvidencia(null) });
            } else {
              payloadRespuestas.push({ ficha_id: ficha.id, pregunta_id: preguntaId, valor_texto: appendEvidencia(val) });
            }
          } else if (evidenciaUrl) {
            payloadRespuestas.push({ ficha_id: ficha.id, pregunta_id: preguntaId, valor_texto: appendEvidencia(null) });
          }
        }
      });

      const matricesValores = this.matricesGroup.getRawValue();

      Object.keys(matricesValores).forEach(preguntaId => {
        if (this.esPreguntaVisible(preguntaId)) {
          const filasObj = matricesValores[preguntaId];
          const respuestasMatriz: { fila_id: string; columna_id: string }[] = [];

          if (filasObj && typeof filasObj === 'object') {
            Object.keys(filasObj).forEach(filaId => {
              const columnasSeleccionadas = filasObj[filaId];
              if (Array.isArray(columnasSeleccionadas) && columnasSeleccionadas.length > 0) {
                columnasSeleccionadas.forEach(columnaId => {
                  respuestasMatriz.push({ fila_id: filaId, columna_id: columnaId });
                });
              }
            });
          }

          if (respuestasMatriz.length > 0) {
            payloadRespuestas.push({
              ficha_id: ficha.id,
              pregunta_id: preguntaId,
              respuestas_matriz: respuestasMatriz
            });
          }
        }
      });

      this.fichaService.enviarBloqueRespuestas(payloadRespuestas, esFinal)
        .pipe(
          takeUntilDestroyed(this.destroyRef),
          catchError(() => {
            this.toastService.show('Ocurrió un error al guardar la ficha. Reintenta por favor.', 'error');
            this.enviando.set(false);
            return of(null);
          })
        )
        .subscribe(res => {
          if (res !== null) {
            if (esFinal) {
              this.finalizarEnvio();
            } else {
              this.enviando.set(false);
              this.toastService.show('Borrador guardado exitosamente en la nube.', 'info');
            }
          }
        });
    };

    if (esFinal) {
      const eraCorreccion = this.estadoActivoUI() === 'RECHAZADA';
      Swal.fire({
        title: eraCorreccion ? '¿Enviar la corrección de tu ficha?' : '¿Seguro que quieres terminar la ficha?',
        text: eraCorreccion
          ? 'Tu ficha corregida será enviada nuevamente a Bienestar Estudiantil para revisión.'
          : 'Una vez enviada, no podrás modificar tus respuestas a menos que Bienestar Estudiantil te la reabra.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: eraCorreccion ? 'Sí, reenviar ficha' : 'Sí, terminar ficha',
        cancelButtonText: 'Revisar de nuevo',
        customClass: {
          popup: 'custom-swal-popup rounded-2xl p-6 text-left',
          confirmButton: 'custom-swal-confirm px-5 py-2.5 rounded-xl font-bold text-white shadow-md hover:-translate-y-0.5 transition-all',
          cancelButton: 'custom-swal-cancel px-5 py-2.5 rounded-xl font-bold bg-slate-100 text-slate-700 border border-slate-300 hover:bg-slate-200 transition-all'
        }
      }).then((result) => {
        if (result.isConfirmed) {
          ejecutar();
        }
      });
    } else {
      ejecutar();
    }
  }

  private finalizarEnvio(): void {
    this.enviando.set(false);
    this.borrarAutosave();
    this.toastService.show('¡Ficha socioeconómica enviada exitosamente a Bienestar!', 'success');

    const fichaId = this.fichaActiva()?.id;

    this.http.get<any>(`${environment.apiUrl}/fichas-respondidas/${fichaId}/resumen-vulnerabilidad`)
      .subscribe({
        next: (res) => {
          this.alertasVulnerabilidad.set(res.detalles || []);
          this.vistaActual.set('RESUMEN_FINAL');
        },
        error: () => {
          this.vistaActual.set('RESUMEN_FINAL');
        }
      });
  }

  subirArchivoEvidencia(event: Event, preguntaId: string): void {
    if (!this.esEditable() || this.enviando()) return;

    const element = event.currentTarget as HTMLInputElement;
    const fileList: FileList | null = element.files;

    if (fileList && fileList.length > 0) {
      const file = fileList[0];
      const fichaId = this.fichaActiva()?.id;
      if (!fichaId) return;

      const tiposPermitidos = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
      if (!tiposPermitidos.includes(file.type)) {
        this.toastService.show('Formato no permitido. Solo se aceptan archivos PDF, JPG o PNG.', 'warning');
        element.value = '';
        return;
      }

      if (file.size > 5 * 1024 * 1024) {
        this.toastService.show('El archivo sobrepasa el límite máximo permitido de 5 MB.', 'warning');
        element.value = '';
        return;
      }

      this.subiendoEvidenciaId.set(preguntaId);
      this.toastService.show('Subiendo evidencia, por favor espera...', 'info');

      this.documentosService.subirDocumentoGeneral(fichaId, file)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (docRes: any) => {
            const urlFinal = docRes.ruta_archivo;
            const ctrl = this.evidenciasGroup.get(preguntaId);
            if (ctrl) {
              ctrl.setValue(urlFinal);
              ctrl.markAsDirty();
              ctrl.markAsTouched();
            }
            this.respuestasForm.updateValueAndValidity();
            this.persistirAutosave();
            this.toastService.show('Documento adjuntado correctamente.', 'success');
            element.value = '';
            this.subiendoEvidenciaId.set(null);
          },
          error: () => {
            this.toastService.show('Error al subir el archivo.', 'error');
            this.subiendoEvidenciaId.set(null);
          }
        });
    }
  }

  eliminarArchivoEvidencia(preguntaId: string): void {
    if (!this.esEditable() || this.enviando()) return;

    Swal.fire({
      title: '¿Eliminar evidencia?',
      text: 'Se quitará el archivo adjunto de esta pregunta.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
      customClass: {
        popup: 'custom-swal-popup rounded-2xl p-6 text-left',
        confirmButton: 'px-4 py-2 rounded-xl font-bold bg-rose-600 text-white hover:bg-rose-700 transition-all shadow-md',
        cancelButton: 'px-4 py-2 rounded-xl font-bold bg-slate-100 text-slate-700 hover:bg-slate-200 transition-all'
      }
    }).then((result) => {
      if (result.isConfirmed) {
        const ctrl = this.evidenciasGroup.get(preguntaId);
        if (ctrl) {
          ctrl.setValue('');
          ctrl.markAsDirty();
          ctrl.markAsTouched();
        }
        this.respuestasForm.updateValueAndValidity();
        this.persistirAutosave();
        this.toastService.show('Evidencia eliminada del borrador.', 'info');
      }
    });
  }

  getIconoExtension(url: string | null): string {
    if (!url) return 'fas fa-file-alt';
    const cleanUrl = url.toLowerCase();
    if (cleanUrl.endsWith('.pdf')) return 'fas fa-file-pdf text-rose-500';
    if (cleanUrl.endsWith('.jpg') || cleanUrl.endsWith('.png') || cleanUrl.endsWith('.jpeg')) return 'fas fa-file-image text-blue-500';
    return 'fas fa-file-alt text-amber-500';
  }

  getIconoSeccion(nombre: string): string {
    const n = nombre.toLowerCase();
    if (n.includes('consentimiento')) return 'far fa-user';
    if (n.includes('personales') || n.includes('identificativos')) return 'far fa-address-card';
    if (n.includes('salud') || n.includes('discapacidad') || n.includes('nee')) return 'fas fa-notes-medical text-rose-500';
    if (n.includes('familiar') || n.includes('hijos')) return 'fas fa-users';
    if (n.includes('econom')) return 'fas fa-coins';
    return 'far fa-folder';
  }

  numeroRomano(num: number): string {
    if (!num || num <= 0) return String(num);

    let resultado = '';
    let n = num;

    for (const { valor, simbolo } of VALORES_ROMANOS) {
      while (n >= valor) {
        resultado += simbolo;
        n -= valor;
      }
    }

    return resultado;
  }

  ngOnDestroy(): void {
    if (this.esEditable()) {
      this.persistirAutosave();
    }
  }
}