// C:\Proyecto AzuayCare\frontend-AzuayCare\src\app\pages\estudiante\ficha\estudiante-ficha.component.ts

import { Component, OnInit, inject, signal, computed, ChangeDetectionStrategy, ElementRef, ViewChild, afterNextRender, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormArray, ReactiveFormsModule, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../core/services/auth.service';
import { FichaService } from '../../core/services/ficha.service';
import { FormularioService } from '../../core/services/formulario.service';
import { PeriodoService } from '../../core/services/periodo.service';
import { DocumentosService } from '../../core/services/documentos.service';
import { DependenciasService } from '../../core/services/dependencias.service';
import { MatricesService } from '../../core/services/matrices.service';
import { ToastService } from '../../core/services/toast.service';
import { Formulario, Seccion, Pregunta } from '../../core/models/formulario.model';
import { FichaRevision } from '../../core/models/revision-ficha.model';
import { PreguntaDependencia } from '../../core/models/dependencia.model';
import { EstudiantePerfil } from '../../core/models/estudiante-perfil.model';
import { DocumentoEstudiante } from '../../core/models/documento-estudiante.interface';
import { PeriodoMatricula } from '../../core/models/periodo.model';
import { EstudiantePerfilModalComponent } from './components/estudiante-perfil-modal.component';

// Se agregó debounceTime a la importación de rxjs
import { forkJoin, of, catchError, debounceTime } from 'rxjs';

function minSelectedCheckboxesValidator(min = 1) {
  return (control: AbstractControl): ValidationErrors | null => {
    const formArray = control as FormArray;
    return formArray && formArray.length >= min ? null : { required: true };
  };
}

@Component({
  selector: 'app-estudiante-ficha',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, EstudiantePerfilModalComponent],
  templateUrl: './estudiante-ficha.component.html',
  styleUrls: ['./estudiante-ficha.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EstudianteFichaComponent implements OnInit {
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

  misFichas = signal<FichaRevision[]>([]);
  fichaActiva = signal<FichaRevision | null>(null);
  formularioActivo = signal<Formulario | null>(null);
  secciones = signal<Seccion[]>([]);
  dependencias = signal<PreguntaDependencia[]>([]);
  periodoActivo = signal<PeriodoMatricula | null>(null);
  
  isLoading = signal<boolean>(true);
  enviando = signal<boolean>(false);

  // Estados de UX/UI
  isSavingLocal = signal<boolean>(false);
  mostrarBannerPrecarga = signal<boolean>(false);

  // Repositorio "Mis Documentos"
  misDocumentosGuardados = signal<DocumentoEstudiante[]>([]);
  mostrarModalSeleccionDoc = signal<boolean>(false);
  respuestaIdParaAdjunto = signal<string | null>(null);

  // Perfil del Estudiante
  perfilEstudiante = signal<EstudiantePerfil | null>(null);
  mostrarModalPerfil = signal<boolean>(false);

  @ViewChild('stars') starsEl!: ElementRef;
  @ViewChild('stars2') stars2El!: ElementRef;
  @ViewChild('stars3') stars3El!: ElementRef;

  seccionActualIndex = signal<number>(0);

  // Progreso incluyendo el paso adicional de Resumen
  progreso = computed(() => {
    const totalPasos = this.secciones().length + 1; // +1 para la sección de resumen
    if (totalPasos === 1) return 0;
    return ((this.seccionActualIndex() + 1) / totalPasos) * 100;
  });

  esPasoResumen = computed(() => {
    return this.secciones().length > 0 && this.seccionActualIndex() === this.secciones().length;
  });

  private autosaveData: any = null;
  private readonly AUTOSAVE_KEY = 'azuaycare_autosave_ficha';

  respuestasForm: FormGroup = this.fb.group({
    respuestas: this.fb.group({}),
    matrices: this.fb.group({})
  });

  valormap = signal<Record<string, any>>({});

  constructor() {
    afterNextRender(() => {
      this.generateStars(this.starsEl?.nativeElement, 120);
      this.generateStars(this.stars2El?.nativeElement, 60);
      this.generateStars(this.stars3El?.nativeElement, 20);
    });
  }

  ngOnInit(): void {
    this.recuperarAutosaveValido();
    this.cargarPerfilUsuario();
    this.cargarDatosEstudiante();

    // Se aplicó la opción recomendada: debounceTime de 500ms
    this.respuestasForm.valueChanges
      .pipe(
        debounceTime(500),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(val => {
        this.isSavingLocal.set(true);
        this.valormap.set(val.respuestas || {});
        this.limpiarPreguntasOcultas();
        localStorage.setItem(this.AUTOSAVE_KEY, JSON.stringify(val));
        setTimeout(() => this.isSavingLocal.set(false), 800);
      });
  }

  private recuperarAutosaveValido(): void {
    const saved = localStorage.getItem(this.AUTOSAVE_KEY);
    if (saved) {
      try { 
        this.autosaveData = JSON.parse(saved); 
      } catch (e) {
        console.warn('Error al parsear autosave local, limpiando caché corrupta:', e);
        localStorage.removeItem(this.AUTOSAVE_KEY);
        this.autosaveData = null;
      }
    }
  }

  cargarPerfilUsuario(): void {
    const user = this.authService.user();
    if (user) {
      this.perfilEstudiante.set({
        cedula: (user as any).cedula || (user as any).identificacion || 'N/A',
        rol: (user.rol as any) || 'ESTUDIANTE',
        correo: user.email || user.nombre,
        carrera: (user as any).carrera || 'Tecnología Superior en Enfermería',
        ciclo: (user as any).ciclo || '3er Ciclo',
        periodoAcademico: (user as any).periodo || '2026 - Periodo I',
        estadoMatricula: (user as any).estadoMatricula || 'MATRICULADO'
      });
    }
  }

  abrirPerfil(): void { this.mostrarModalPerfil.set(true); }
  cerrarPerfil(): void { this.mostrarModalPerfil.set(false); }

  get respuestasGroup(): FormGroup { return this.respuestasForm.get('respuestas') as FormGroup; }
  get matricesGroup(): FormGroup { return this.respuestasForm.get('matrices') as FormGroup; }

  irAPaso(index: number): void {
    if (index <= this.seccionActualIndex() || this.validarSeccionActual()) {
      this.seccionActualIndex.set(index);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      this.toastService.show('Por favor, completa los campos obligatorios antes de avanzar.', 'error');
    }
  }

  siguiente(): void {
    if (this.validarSeccionActual()) {
      if (this.seccionActualIndex() <= this.secciones().length - 1) {
        this.seccionActualIndex.update(i => i + 1);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } else {
      this.toastService.show('Por favor, completa los campos obligatorios de esta sección antes de continuar.', 'error');
    }
  }

  anterior(): void {
    if (this.seccionActualIndex() > 0) {
      this.seccionActualIndex.update(i => i - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  validarSeccionActual(): boolean {
    if (this.esPasoResumen()) return true;

    const seccionActual = this.secciones()[this.seccionActualIndex()];
    if (!seccionActual) return true;

    let esValido = true;
    for (const preg of seccionActual.preguntas || []) {
      if (this.esPreguntaVisible(preg.id)) {
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
      }
    }
    return esValido;
  }

  cargarDatosEstudiante(): void {
    this.isLoading.set(true);

    forkJoin({
      periodos: this.periodoService.getPeriodos(),
      fichas: this.fichaService.getMisFichas()
    })
    .pipe(takeUntilDestroyed(this.destroyRef))
    .subscribe({
      next: ({ periodos, fichas }) => {
        const activo = periodos.find(p => p.activo);
        this.periodoActivo.set(activo || null);
        this.misFichas.set(fichas);

        const borradorOEnviada = fichas.find(f => f.estado_ficha === 'BORRADOR' || f.estado_ficha === 'ENVIADA');

        if (borradorOEnviada) {
          this.validarYBloquearFormularioObsoleto(borradorOEnviada, fichas);
        } else {
          this.buscarFormularioVigente();
        }
      },
      error: (err) => {
        console.error('Error al cargar datos iniciales del estudiante:', err);
        this.toastService.show('Error al cargar datos del estudiante', 'error');
        this.isLoading.set(false);
      }
    });
  }

  private validarYBloquearFormularioObsoleto(ficha: FichaRevision, todasLasFichas: FichaRevision[]): void {
    this.formularioService.getFormularioById(ficha.formulario_id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (formActual: Formulario) => {
          const pActivo = this.periodoActivo();

          if (!formActual.publicado || (pActivo && formActual.periodo_id !== pActivo.id)) {
            this.toastService.show(
              'La versión de la ficha que tenías en borrador ha sido desactualizada. Redirigiendo a la versión publicada oficial...',
              'warning'
            );
            localStorage.removeItem(this.AUTOSAVE_KEY);
            this.autosaveData = null;
            this.buscarFormularioVigente();
          } else {
            this.fichaActiva.set(ficha);
            this.cargarEstructuraFormulario(ficha.formulario_id);
            this.evaluarPrecarga(ficha.periodo_id, todasLasFichas);
          }
        },
        error: () => {
          this.buscarFormularioVigente();
        }
      });
  }

  evaluarPrecarga(periodoActualId: string, fichas: FichaRevision[]): void {
    const tieneBorradorLleno = localStorage.getItem(this.AUTOSAVE_KEY) !== null;
    const tieneFichasAnteriores = fichas.length > 1;

    if (!tieneBorradorLleno && tieneFichasAnteriores && this.fichaActiva()?.estado_ficha === 'BORRADOR') {
      this.mostrarBannerPrecarga.set(true);
    }
  }

  ignorarPrecarga(): void { this.mostrarBannerPrecarga.set(false); }

  ejecutarPrecarga(): void {
    const periodoNuevoId = this.fichaActiva()?.periodo_id;
    if (!periodoNuevoId) return;

    this.toastService.show('Importando datos de tu ficha anterior...', 'info');
    this.mostrarBannerPrecarga.set(false);

    this.http.get<any>(`${environment.apiUrl}/respuestas-formulario/precarga/${periodoNuevoId}`)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          if (data && data.respuestas_transferidas) {
            this.toastService.show('Ficha precargada exitosamente.', 'success');
            window.location.reload();
          } else {
            this.toastService.show('No se encontraron respuestas anteriores para precargar.', 'info');
          }
        },
        error: () => this.toastService.show('Error al intentar precargar la ficha.', 'error')
      });
  }

  buscarFormularioVigente(): void {
    this.formularioService.getFormularios()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (formularios: Formulario[]) => {
          const pActivo = this.periodoActivo();

          const formPublicadoVigente = formularios.find(f => 
            f.publicado === true && (!pActivo || f.periodo_id === pActivo.id)
          );

          if (formPublicadoVigente && formPublicadoVigente.periodo_id) {
            this.crearNuevaFicha(formPublicadoVigente.periodo_id, formPublicadoVigente.id);
          } else {
            this.toastService.show('No existe una ficha socioeconómica publicada para el periodo actual.', 'info');
            this.isLoading.set(false);
          }
        },
        error: () => {
          this.toastService.show('Error al buscar formulario publicado', 'error');
          this.isLoading.set(false);
        }
      });
  }

  crearNuevaFicha(periodoId: string, formularioId: string): void {
    this.fichaService.crearFicha({ periodo_id: periodoId, formulario_id: formularioId })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (nuevaFicha: FichaRevision) => {
          this.fichaActiva.set(nuevaFicha);
          this.cargarEstructuraFormulario(formularioId);
        },
        error: () => {
          this.toastService.show('Error al crear ficha', 'error');
          this.isLoading.set(false);
        }
      });
  }

  cargarEstructuraFormulario(formularioId: string): void {
    forkJoin({
      dependencias: this.dependenciasService.getDependenciasByFormulario(formularioId),
      formulario: this.formularioService.getFormularioById(formularioId),
      secciones: this.formularioService.getSeccionesByFormulario(formularioId)
    })
    .pipe(takeUntilDestroyed(this.destroyRef))
    .subscribe({
      next: ({ dependencias, formulario, secciones }) => {
        this.dependencias.set(dependencias);
        this.formularioActivo.set(formulario);
        this.secciones.set(secciones);

        const preguntasReqs = secciones.map((s: Seccion) => 
          this.formularioService.getPreguntasBySeccion(s.id)
        );

        if (preguntasReqs.length === 0) {
          this.isLoading.set(false);
          return;
        }

        forkJoin(preguntasReqs)
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: (preguntasPorSeccion: Pregunta[][]) => {
              const seccionesActualizadas = secciones.map((s: Seccion, index: number) => ({
                ...s,
                preguntas: preguntasPorSeccion[index]
              }));
              
              this.secciones.set(seccionesActualizadas);
              
              const preguntasTodas = preguntasPorSeccion.flat();
              const idsPreguntasExistentes = new Set(preguntasTodas.map(p => p.id));

              this.sanitizarAutosave(idsPreguntasExistentes);
              preguntasTodas.forEach((p: Pregunta) => this.construirControlesPreguntas(p));
              this.isLoading.set(false);
            },
            error: () => {
              this.toastService.show('Error al cargar preguntas de la sección', 'error');
              this.isLoading.set(false);
            }
          });
      },
      error: () => {
        this.toastService.show('Error al cargar la estructura del formulario', 'error');
        this.isLoading.set(false);
      }
    });
  }

  private sanitizarAutosave(idsPreguntasExistentes: Set<string>): void {
    if (!this.autosaveData) return;

    if (this.autosaveData.respuestas) {
      Object.keys(this.autosaveData.respuestas).forEach(key => {
        if (!idsPreguntasExistentes.has(key)) {
          delete this.autosaveData.respuestas[key];
        }
      });
    }

    if (this.autosaveData.matrices) {
      Object.keys(this.autosaveData.matrices).forEach(key => {
        if (!idsPreguntasExistentes.has(key)) {
          delete this.autosaveData.matrices[key];
        }
      });
    }
  }

  construirControlesPreguntas(p: Pregunta): void {
    const isMultiple = p.tipoCampo?.nombre === 'SELECCION_MULTIPLE';

    if (isMultiple) {
      if (!this.respuestasGroup.contains(p.id)) {
        const savedArr: string[] = Array.isArray(this.autosaveData?.respuestas?.[p.id]) 
          ? this.autosaveData.respuestas[p.id] 
          : [];

        const formArray = this.fb.array(
          savedArr.map(id => this.fb.control(id)),
          p.es_obligatorio ? minSelectedCheckboxesValidator(1) : []
        );

        this.respuestasGroup.addControl(p.id, formArray);
      }
    } else {
      const validators = p.es_obligatorio ? [Validators.required] : [];
      if (!this.respuestasGroup.contains(p.id)) {
        const savedVal = this.autosaveData?.respuestas?.[p.id] ?? '';
        this.respuestasGroup.addControl(p.id, this.fb.control(savedVal, validators));
      }
    }

    if (p.tipoCampo?.nombre === 'MATRIZ') {
      this.cargarEstructuraMatriz(p);
    }
    
    this.valormap.set(this.respuestasGroup.value);
  }

  onToggleSeleccionMultiple(preguntaId: string, opcionId: string, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    const formArray = this.respuestasGroup.get(preguntaId) as FormArray;

    if (!formArray) return;

    if (checked) {
      formArray.push(this.fb.control(opcionId));
    } else {
      const idx = formArray.controls.findIndex(ctrl => ctrl.value === opcionId);
      if (idx !== -1) {
        formArray.removeAt(idx);
      }
    }

    formArray.markAsTouched();
    this.valormap.set(this.respuestasGroup.value);
  }

  esOpcionMultipleSeleccionada(preguntaId: string, opcionId: string): boolean {
    const formArray = this.respuestasGroup.get(preguntaId) as FormArray;
    if (!formArray) return false;
    return formArray.controls.some(ctrl => ctrl.value === opcionId);
  }

  esPreguntaDependiente(preguntaId: string): boolean {
    return this.dependencias().some(d => d.pregunta_dependiente_id === preguntaId);
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
          const matrizFormGroup = this.fb.group({});
          filas.forEach((fila: any) => {
            const validator = pregunta.es_obligatorio ? [Validators.required] : [];
            const savedColVal = this.autosaveData?.matrices?.[pregunta.id]?.[fila.id] ?? '';
            matrizFormGroup.addControl(fila.id, this.fb.control(savedColVal, validator));
          });
          this.matricesGroup.addControl(pregunta.id, matrizFormGroup);
        }
      },
      error: () => this.toastService.show(`Error al cargar la matriz de la pregunta`, 'error')
    });
  }

  esPreguntaVisible(preguntaId: string): boolean {
    const dep = this.dependencias().find(d => d.pregunta_dependiente_id === preguntaId);
    if (!dep) return true;

    const valorDisparadorActual = this.valormap()[dep.pregunta_disparadora_id];
    
    if (dep.opcion_disparadora_id) {
      if (Array.isArray(valorDisparadorActual)) {
        return valorDisparadorActual.includes(dep.opcion_disparadora_id);
      }
      return valorDisparadorActual === dep.opcion_disparadora_id;
    }

    const valorDisparador = (dep as any).valor_disparador;
    if (valorDisparador !== undefined && valorDisparador !== null) {
      return String(valorDisparadorActual).toLowerCase() === String(valorDisparador).toLowerCase();
    }

    return true;
  }

  private limpiarPreguntasOcultas(): void {
    this.dependencias().forEach(dep => {
      if (!this.esPreguntaVisible(dep.pregunta_dependiente_id)) {
        const ctrl = this.respuestasGroup.get(dep.pregunta_dependiente_id);
        if (ctrl) {
          if (ctrl instanceof FormArray) {
            if (ctrl.length > 0) ctrl.clear({ emitEvent: false });
          } else if (ctrl.value !== null && ctrl.value !== '') {
            ctrl.setValue('', { emitEvent: false });
          }
        }
        const matCtrl = this.matricesGroup.get(dep.pregunta_dependiente_id);
        if (matCtrl) matCtrl.reset({}, { emitEvent: false });
      }
    });
  }

  // --- HELPERS PARA MOSTRAR RESUMEN DE RESPUESTAS ---
  obtenerTextoRespuesta(pregunta: Pregunta): string {
    const val = this.respuestasGroup.get(pregunta.id)?.value;
    if (val === null || val === undefined || val === '') return 'Sin responder';

    if (Array.isArray(val)) {
      if (val.length === 0) return 'Sin responder';
      const textos = val.map(opcId => {
        const opc = pregunta.opciones?.find(o => o.id === opcId);
        return opc ? opc.texto_opcion : opcId;
      });
      return textos.join(', ');
    }

    if (pregunta.opciones && pregunta.opciones.length > 0) {
      const opc = pregunta.opciones.find(o => o.id === val);
      if (opc) return opc.texto_opcion;
    }

    return String(val);
  }

  descargarPdfResumen(fichaId: string): void {
    window.open(`${environment.apiUrl}/fichas-respondidas/${fichaId}/pdf`, '_blank');
  }

  /**
   * Procesa el guardado/envío de respuestas adaptado para soportar booleanos, arreglos, números,
   * objetos de matriz y permitiendo guardar borradores remotos (esFinal: false).
   */
  guardarYEnviar(esFinal: boolean = true): void {
    const ficha = this.fichaActiva();
    if (!ficha) return;

    this.enviando.set(true);

    const respuestasValores = this.respuestasGroup.value;
    const payloadRespuestas: any[] = [];

    Object.keys(respuestasValores).forEach(preguntaId => {
      if (this.esPreguntaVisible(preguntaId)) {
        const val = respuestasValores[preguntaId];

        if (val === null || val === undefined || val === '') return;

        if (Array.isArray(val) && val.length > 0) {
          payloadRespuestas.push({
            ficha_id: ficha.id,
            pregunta_id: preguntaId,
            opciones_seleccionadas: val
          });
        } else if (typeof val === 'number') {
          payloadRespuestas.push({
            ficha_id: ficha.id,
            pregunta_id: preguntaId,
            valor_numerico: val
          });
        } else if (typeof val === 'boolean') {
          payloadRespuestas.push({
            ficha_id: ficha.id,
            pregunta_id: preguntaId,
            valor_texto: val ? 'SI' : 'NO'
          });
        } else if (typeof val === 'string' && val.trim() !== '') {
          const esUuid = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(val);
          payloadRespuestas.push({
            ficha_id: ficha.id,
            pregunta_id: preguntaId,
            ...(esUuid ? { opciones_seleccionadas: [val] } : { valor_texto: val })
          });
        }
      }
    });

    const matricesValores = this.matricesGroup.value;
    const payloadMatriz: any[] = [];

    Object.keys(matricesValores).forEach(preguntaId => {
      if (this.esPreguntaVisible(preguntaId)) {
        const filasObj = matricesValores[preguntaId];
        if (filasObj && typeof filasObj === 'object') {
          Object.keys(filasObj).forEach(filaId => {
            const columnaId = filasObj[filaId];
            if (columnaId) {
              payloadMatriz.push({
                ficha_id: ficha.id,
                pregunta_id: preguntaId,
                fila_id: filaId,
                columna_id: columnaId
              });
            }
          });
        }
      }
    });

    const peticionRespuestas$ = this.fichaService.enviarBloqueRespuestas(payloadRespuestas, esFinal);
    const peticionMatriz$ = payloadMatriz.length > 0 
      ? this.matricesService.enviarRespuestasMatriz(payloadMatriz) 
      : of(null);

    forkJoin({
      respuestas: peticionRespuestas$,
      matrices: peticionMatriz$
    }).pipe(
      takeUntilDestroyed(this.destroyRef),
      catchError(() => {
        this.toastService.show('Ocurrió un error al guardar la ficha. Reintenta por favor.', 'error');
        this.enviando.set(false);
        return of(null);
      })
    ).subscribe({
      next: (res) => {
        if (res !== null) {
          if (esFinal) {
            this.finalizarEnvio();
          } else {
            this.enviando.set(false);
            this.toastService.show('Borrador guardado exitosamente en el servidor.', 'info');
          }
        }
      }
    });
  }

  private finalizarEnvio(): void {
    this.enviando.set(false);
    localStorage.removeItem(this.AUTOSAVE_KEY);
    this.toastService.show('¡Ficha socioeconómica enviada exitosamente a Bienestar!', 'success');
    this.cargarDatosEstudiante();
  }

  subirArchivoEvidencia(event: Event, preguntaId: string): void {
    const element = event.currentTarget as HTMLInputElement;
    const fileList: FileList | null = element.files;
    if (fileList && fileList.length > 0) {
      const file = fileList[0];
      this.documentosService.subirDocumento(preguntaId, file)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (docRes: any) => {
            this.respuestasGroup.get(preguntaId)?.setValue(docRes.url || file.name);
            this.toastService.show('Documento adjuntado correctamente.', 'success');
          },
          error: () => this.toastService.show('Error al subir el archivo.', 'error')
        });
    }
  }

  abrirSeleccionMisDocumentos(preguntaId: string): void {
    this.respuestaIdParaAdjunto.set(preguntaId);
    this.mostrarModalSeleccionDoc.set(true);
  }

  cerrarModalSeleccionDoc(): void {
    this.mostrarModalSeleccionDoc.set(false);
    this.respuestaIdParaAdjunto.set(null);
  }

  seleccionarDocumentoDeBiblioteca(doc: DocumentoEstudiante): void {
    const pregId = this.respuestaIdParaAdjunto();
    if (pregId) {
      this.respuestasGroup.get(pregId)?.setValue(doc.url || doc.nombreOriginal);
      this.toastService.show(`Se adjuntó "${doc.nombreOriginal}".`, 'info');
      this.cerrarModalSeleccionDoc();
    }
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  private generateStars(element: HTMLElement, count: number): void {
    if (!element) return;
    const shadows: string[] = [];
    for (let i = 0; i < count; i++) {
      const x = (Math.random() * 100).toFixed(2);
      const y = (Math.random() * 100).toFixed(2);
      shadows.push(`${x}vw ${y}vh #FFF`);
    }
    element.style.boxShadow = shadows.join(', ');
  }
}