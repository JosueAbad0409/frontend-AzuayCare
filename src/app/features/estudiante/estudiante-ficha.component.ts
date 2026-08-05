import { Component, OnInit, inject, signal, computed, ChangeDetectionStrategy, DestroyRef, OnDestroy } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormArray, ReactiveFormsModule, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { Router, RouterModule } from '@angular/router'; // 👈 IMPORTANTE: Agregado RouterModule
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
import { DescargaArchivosService } from '../../core/services/descarga-archivos.service';
import { forkJoin, of, debounceTime, catchError } from 'rxjs';
import Swal from 'sweetalert2'; 

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
  // ✅ CORRECCIÓN: Quitamos EstudiantePerfilModalComponent y agregamos RouterModule para el enlace <a>
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

  isDescargandoPdf = this.descargaService.isDescargando;

  formulariosDisponibles = signal<Formulario[]>([]);
  vistaActual = signal<'LISTA' | 'FORMULARIO'>('LISTA');

  misFichas = signal<FichaRevision[]>([]);
  fichaActiva = signal<FichaRevision | null>(null);
  formularioActivo = signal<Formulario | null>(null);
  secciones = signal<Seccion[]>([]);
  dependencias = signal<PreguntaDependencia[]>([]);
  periodoActivo = signal<PeriodoMatricula | null>(null);

  isLoading = signal<boolean>(true);
  enviando = signal<boolean>(false);
  isSavingLocal = signal<boolean>(false);
  mostrarBannerPrecarga = signal<boolean>(false);

  misDocumentosGuardados = signal<DocumentoEstudiante[]>([]);
  mostrarModalSeleccionDoc = signal<boolean>(false);
  respuestaIdParaAdjunto = signal<string | null>(null);

  perfilEstudiante = signal<EstudiantePerfil | null>(null);

  seccionActualIndex = signal<number>(0);

  progreso = computed(() => {
    const totalPasos = this.secciones().length + 1;
    if (totalPasos === 1) return 0;
    return ((this.seccionActualIndex() + 1) / totalPasos) * 100;
  });

  esPasoResumen = computed(() => {
    return this.secciones().length > 0 && this.seccionActualIndex() === this.secciones().length;
  });

  private autosaveData: any = null;
  private respuestasBDCache: any[] = [];
  private readonly AUTOSAVE_KEY = 'azuaycare_autosave_ficha';

  respuestasForm: FormGroup = this.fb.group({
    respuestas: this.fb.group({}),
    matrices: this.fb.group({})
  });

  valormap = signal<Record<string, any>>({});

  ngOnInit(): void {
    this.recuperarAutosaveValido();
    this.cargarPerfilUsuario();
    this.cargarDatosEstudiante();

    this.respuestasForm.valueChanges
      .pipe(debounceTime(600), takeUntilDestroyed(this.destroyRef))
      .subscribe(val => {
        if (this.fichaActiva()?.estado_ficha !== 'BORRADOR') return;

        this.isSavingLocal.set(true);
        this.valormap.set(val.respuestas || {});
        this.limpiarPreguntasOcultas();
        const dataToSave = { ...val, seccionIndex: this.seccionActualIndex() };
        localStorage.setItem(this.AUTOSAVE_KEY, JSON.stringify(dataToSave));
        setTimeout(() => this.isSavingLocal.set(false), 800);
      });
  }

  private recuperarAutosaveValido(): void {
    const saved = localStorage.getItem(this.AUTOSAVE_KEY);
    if (saved) {
      try {
        this.autosaveData = JSON.parse(saved);
      } catch (e) {
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
        carrera: (user as any).carrera || 'General',
        ciclo: (user as any).ciclo || 'N/A',
        periodoAcademico: (user as any).periodo || 'Actual',
        estadoMatricula: (user as any).estadoMatricula || 'MATRICULADO'
      });
    }
  }

  get respuestasGroup(): FormGroup { return this.respuestasForm.get('respuestas') as FormGroup; }
  get matricesGroup(): FormGroup { return this.respuestasForm.get('matrices') as FormGroup; }

  irAPaso(index: number): void {
    if (index <= this.seccionActualIndex() || this.validarSeccionActual()) {
      this.seccionActualIndex.set(index);
      this.guardarPasoEnLocal();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      this.toastService.show('Por favor, completa los campos obligatorios antes de avanzar.', 'warning');
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

  validarSeccionActual(): boolean {
    if (this.esPasoResumen() || this.fichaActiva()?.estado_ficha !== 'BORRADOR') return true;

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
  private guardarPasoEnLocal(): void {
    if (this.fichaActiva()?.estado_ficha !== 'BORRADOR') return;
    const currentData = JSON.parse(localStorage.getItem(this.AUTOSAVE_KEY) || '{}');
    currentData.seccionIndex = this.seccionActualIndex();
    localStorage.setItem(this.AUTOSAVE_KEY, JSON.stringify(currentData));
  }

  cargarDatosEstudiante(): void {
    this.isLoading.set(true);

    forkJoin({
      periodos: this.periodoService.getPeriodos(),
      fichas: this.fichaService.getMisFichas(),
      formularios: this.formularioService.getFormularios()
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ periodos, fichas, formularios }) => {
          const pActivo = periodos.find(p => p.activo);
          this.periodoActivo.set(pActivo || null);
          this.misFichas.set(fichas);

          const formsPublicados = formularios.filter(f => {
            const fPeriodoId = f.periodo_id || (f as any).periodo?.id;
            return f.publicado === true && (!pActivo || fPeriodoId === pActivo.id);
          });

          this.formulariosDisponibles.set(formsPublicados);
          this.vistaActual.set('LISTA');
          this.isLoading.set(false);
        },
        error: (err) => {
          console.error('Error al cargar datos iniciales del estudiante:', err);
          this.toastService.show('Error de conexión al cargar tus datos.', 'error');
          this.isLoading.set(false);
        }
      });
  }

  seleccionarFormulario(formularioId: string): void {
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
      this.cargarEstructuraFormulario(formularioId);
      this.evaluarPrecarga(fichaExistente.periodo_id, this.misFichas());
    } else {
      this.crearNuevaFicha(pActivo.id, formularioId);
    }
  }

  volverALista(): void {
    this.vistaActual.set('LISTA');
    this.fichaActiva.set(null);
    this.formularioActivo.set(null);
    this.seccionActualIndex.set(0);

    this.respuestasForm = this.fb.group({
      respuestas: this.fb.group({}),
      matrices: this.fb.group({})
    });

    this.recuperarAutosaveValido();
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

    this.toastService.show('Importando datos...', 'info');
    this.mostrarBannerPrecarga.set(false);

    this.http.get<any>(`${environment.apiUrl}/respuestas-formulario/precarga/${periodoNuevoId}`)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          if (data && data.respuestas_transferidas) {
            this.toastService.show('Ficha precargada exitosamente.', 'success');
            window.location.reload();
          } else {
            this.toastService.show('No hay datos para precargar.', 'info');
          }
        },
        error: () => this.toastService.show('Error al intentar precargar la ficha.', 'error')
      });
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
          this.cargarEstructuraFormulario(formularioId);
        },
        error: (err) => {
          this.fichaService.getMisFichas().subscribe(fichas => {
            const found = fichas.find(f => f.periodo_id === periodoId && f.formulario_id === formularioId);
            if (found) {
              this.fichaActiva.set(found);
              this.cargarEstructuraFormulario(found.formulario_id);
            } else {
              console.error('Error al inicializar la ficha:', err);
              this.toastService.show('Error al crear o buscar tu ficha.', 'error');
              this.isLoading.set(false);
            }
          });
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

            const fichaActual = this.fichaActiva();

            const construirTodo = () => {
              preguntasTodas.forEach((p: Pregunta) => this.construirControlesPreguntas(p));

              if (fichaActual) {
                this.aplicarRespuestasGuardadas(this.respuestasBDCache, fichaActual.estado_ficha);

                if (fichaActual.estado_ficha !== 'BORRADOR') {
                  this.seccionActualIndex.set(this.secciones().length);
                } else if (this.autosaveData?.seccionIndex !== undefined) {
                  const savedStep = this.autosaveData.seccionIndex;
                  const maxStep = this.secciones().length;
                  this.seccionActualIndex.set(savedStep <= maxStep ? savedStep : 0);
                }
              }
              this.isLoading.set(false);
            };

            if (fichaActual) {
              this.http.get<any[]>(`${environment.apiUrl}/respuestas-formulario/ficha/${fichaActual.id}`)
                .pipe(takeUntilDestroyed(this.destroyRef))
                .subscribe({
                  next: (respuestasBD) => {
                    this.respuestasBDCache = respuestasBD || [];
                    construirTodo();
                  },
                  error: () => {
                    this.toastService.show('No se pudieron cargar las respuestas guardadas.', 'error');
                    this.respuestasBDCache = [];
                    construirTodo();
                  }
                });
            } else {
              construirTodo();
            }
          },
          error: () => {
            this.toastService.show('Error al cargar preguntas de la ficha.', 'error');
            this.isLoading.set(false);
          }
        });
    },
    error: () => {
      this.toastService.show('Error de conexión con el formulario.', 'error');
      this.isLoading.set(false);
    }
  });
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
      if (!this.respuestasGroup.contains(p.id)) {
        const savedVal = this.autosaveData?.respuestas?.[p.id] ?? '';
        this.respuestasGroup.addControl(p.id, this.fb.control(savedVal, validators));
      }
    }

    this.valormap.set(this.respuestasGroup.getRawValue());
  }

  onToggleSeleccionMultiple(preguntaId: string, opcionId: string, event: Event): void {
    if (this.fichaActiva()?.estado_ficha !== 'BORRADOR') return;

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
    if (this.fichaActiva()?.estado_ficha !== 'BORRADOR') return;

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

        if (this.fichaActiva()?.estado_ficha !== 'BORRADOR') {
          matrizFormGroup.disable({ emitEvent: false });
        }
      }
    }
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
    if (this.fichaActiva()?.estado_ficha !== 'BORRADOR') return;

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

  obtenerTextoRespuesta(pregunta: Pregunta): string {
    if (pregunta.tipoCampo?.nombre === 'MATRIZ') {
      const matrizValores = this.matricesGroup.getRawValue()[pregunta.id];
      if (!matrizValores) return 'Sin responder';

      const resumenFilas: string[] = [];

      Object.keys(matrizValores).forEach(filaId => {
        const columnasSeleccionadas = matrizValores[filaId];

        if (Array.isArray(columnasSeleccionadas) && columnasSeleccionadas.length > 0) {
          const fila = pregunta.filasMatriz?.find((f: any) => f.id === filaId);
          const textoFila = fila ? fila.texto_fila : 'Fila';

          const textosColumnas = columnasSeleccionadas.map((colId: string) => {
            const col = pregunta.columnasMatriz?.find((c: any) => c.id === colId);
            return col ? col.texto_columna : colId;
          });

          resumenFilas.push(`${textoFila}: ${textosColumnas.join(', ')}`);
        }
      });

      return resumenFilas.length > 0 ? resumenFilas.join('\n') : 'Sin responder';
    }

    const val = this.respuestasGroup.getRawValue()[pregunta.id];
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

  aplicarRespuestasGuardadas(respuestasBD: any[], estadoFicha: string): void {
  if (!respuestasBD || respuestasBD.length === 0) return;

  const valoresParaElFormulario: any = {};

  respuestasBD.forEach(resp => {
    if (resp.respuestasMatriz && resp.respuestasMatriz.length > 0) return;

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
    } else if (resp.documentos && resp.documentos.length > 0) {
      valoresParaElFormulario[resp.pregunta_id] = resp.documentos[0].ruta_archivo;
    } else {
      valoresParaElFormulario[resp.pregunta_id] = resp.valor_texto !== null ? resp.valor_texto : resp.valor_numerico;
    }
  });

  this.respuestasGroup.patchValue(valoresParaElFormulario, { emitEvent: false });
  this.valormap.set(this.respuestasGroup.getRawValue());

  if (estadoFicha !== 'BORRADOR') {
    this.respuestasGroup.disable({ emitEvent: false });
    this.matricesGroup.disable({ emitEvent: false });
  } else {
    this.respuestasGroup.enable({ emitEvent: false });
    this.matricesGroup.enable({ emitEvent: false });
  }
}

  descargarPdfResumen(fichaId: string): void {
    const ficha = this.fichaActiva();
    const cedula = ficha?.usuario?.cedula || fichaId.slice(0, 8);
    this.descargaService.descargar(
      `${environment.apiUrl}/fichas-respondidas/${fichaId}/pdf`,
      `Ficha_Socioeconomica_${cedula}.pdf`,
      'Hubo un problema al generar tu comprobante PDF.'
    );
  }

guardarYEnviar(esFinal: boolean = true): void {
    const ficha = this.fichaActiva();
    if (!ficha) return;

    const ejecutar = () => {
      this.enviando.set(true);

      const respuestasValores = this.respuestasGroup.getRawValue();
      const payloadRespuestas: any[] = [];

      Object.keys(respuestasValores).forEach(preguntaId => {
        if (this.esPreguntaVisible(preguntaId)) {
          const val = respuestasValores[preguntaId];
          if (val === null || val === undefined || val === '') return;

          if (Array.isArray(val) && val.length > 0) {
            payloadRespuestas.push({ ficha_id: ficha.id, pregunta_id: preguntaId, opciones_seleccionadas: val });
          } else if (typeof val === 'number') {
            payloadRespuestas.push({ ficha_id: ficha.id, pregunta_id: preguntaId, valor_numerico: val });
          } else if (typeof val === 'boolean') {
            payloadRespuestas.push({ ficha_id: ficha.id, pregunta_id: preguntaId, valor_texto: val ? 'SI' : 'NO' });
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
      Swal.fire({
        title: '¿Seguro que quieres terminar la ficha?',
        text: 'Una vez enviada, no podrás modificar tus respuestas a menos que Bienestar Estudiantil te la reabra.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#2563eb',
        cancelButtonColor: '#e11d48',
        confirmButtonText: 'Sí, terminar ficha',
        cancelButtonText: 'Revisar de nuevo',
        customClass: {
          popup: 'rounded-2xl',
          confirmButton: 'rounded-xl',
          cancelButton: 'rounded-xl'
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
    localStorage.removeItem(this.AUTOSAVE_KEY);
    this.toastService.show('¡Ficha socioeconómica enviada exitosamente a Bienestar!', 'success');
    this.volverALista();
    this.cargarDatosEstudiante();
  }

  subirArchivoEvidencia(event: Event, preguntaId: string): void {
    if (this.fichaActiva()?.estado_ficha !== 'BORRADOR') return;

    const element = event.currentTarget as HTMLInputElement;
    const fileList: FileList | null = element.files;
    if (fileList && fileList.length > 0) {
      const file = fileList[0];
      this.documentosService.subirDocumentoDeRespuesta(preguntaId, file)
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

  logout(): void {
    Swal.fire({
      title: '¿Cerrar sesión?',
      text: 'Tendrás que volver a ingresar tus credenciales para continuar.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#2563eb',
      cancelButtonColor: '#e11d48',
      confirmButtonText: 'Sí, salir',
      cancelButtonText: 'Cancelar',
      customClass: {
        popup: 'rounded-2xl',
        confirmButton: 'rounded-xl',
        cancelButton: 'rounded-xl'
      }
    }).then((result) => {
      if (result.isConfirmed) {
        this.authService.logout();
        this.router.navigate(['/login']);
      }
    });
  }

  getIconoSeccion(nombre: string): string {
    const n = nombre.toLowerCase();
    if (n.includes('consentimiento')) return 'far fa-user';
    if (n.includes('personales') || n.includes('identificativos')) return 'far fa-address-card';
    if (n.includes('salud') || n.includes('discapacidad')) return 'far fa-heart';
    if (n.includes('familiar') || n.includes('hijos')) return 'fas fa-users';
    if (n.includes('econom')) return 'fas fa-coins';
    return 'far fa-folder';
  }

  numeroRomano(num: number): string {
    const romanos = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
    return romanos[num - 1] || num.toString();
  }

  ngOnDestroy(): void {
    if (this.fichaActiva()?.estado_ficha === 'BORRADOR') {
      const val = this.respuestasForm.getRawValue();
      const dataToSave = { ...val, seccionIndex: this.seccionActualIndex() };
      localStorage.setItem(this.AUTOSAVE_KEY, JSON.stringify(dataToSave));
    }
  }
}