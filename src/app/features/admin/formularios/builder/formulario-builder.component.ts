import { Component, OnInit, inject, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule, Router } from '@angular/router';
import { FormBuilder, FormGroup, FormArray, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import Swal from 'sweetalert2';

import { FormularioService } from '../../../../core/services/formulario.service';
import { MatricesService } from '../../../../core/services/matrices.service';
import { DependenciasService } from '../../../../core/services/dependencias.service';
import { RangosVariableService } from '../../../../core/services/rangos-variable.service';
import { ToastService } from '../../../../core/services/toast.service';
import { Formulario, Seccion, Pregunta, TipoCampoForm, OpcionPregunta } from '../../../../core/models/formulario.model';
import { PreguntaDependencia } from '../../../../core/models/dependencia.model';
import { RangoVariableCalculada } from '../../../../core/models/rango-variable.model';
import { MatrizBuilderComponent } from './components/matriz-builder/matriz-builder.component';

@Component({
  selector: 'app-formulario-builder',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, MatrizBuilderComponent],
  templateUrl: './formulario-builder.component.html',
  styleUrls: ['./formulario-builder.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FormularioBuilderComponent implements OnInit {
  // ==========================================
  // INYECCIONES Y SERVICIOS
  // ==========================================
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly formularioService = inject(FormularioService);
  private readonly matricesService = inject(MatricesService);
  private readonly dependenciasService = inject(DependenciasService);
  private readonly rangosVariableService = inject(RangosVariableService);
  private readonly toastService = inject(ToastService);
  private readonly fb = inject(FormBuilder);

  // ==========================================
  // CONSTANTES GLOBALES
  // ==========================================
  private readonly RANGOS_BALANCE_PREDETERMINADOS = [
    { variable_calculo: 'BALANCE', nombre: 'Crítico / Déficit', valor_min: 0, valor_max: 0, orden: 1 },
    { variable_calculo: 'BALANCE', nombre: 'Vulnerable', valor_min: 1, valor_max: 200, orden: 2 },
    { variable_calculo: 'BALANCE', nombre: 'Medio bajo', valor_min: 201, valor_max: 500, orden: 3 },
    { variable_calculo: 'BALANCE', nombre: 'Medio', valor_min: 501, valor_max: 1000, orden: 4 },
    { variable_calculo: 'BALANCE', nombre: 'Medio alto', valor_min: 1001, valor_max: 2000, orden: 5 },
    { variable_calculo: 'BALANCE', nombre: 'Alto / Holgado', valor_min: 2001, valor_max: 999999, orden: 6 },
  ];

  private readonly SWAL_CUSTOM_CLASS = {
    popup: 'rounded-2xl',
    confirmButton: 'rounded-xl',
    cancelButton: 'rounded-xl',
    htmlContainer: 'swal-html-container-custom'
  };

  // ==========================================
  // ESTADO (SIGNALS)
  // ==========================================
  formulario = signal<Formulario | null>(null);
  secciones = signal<Seccion[]>([]);
  tiposCampo = signal<TipoCampoForm[]>([]);
  dependencias = signal<PreguntaDependencia[]>([]);
  rangosVariable = signal<RangoVariableCalculada[]>([]);
  isLoading = signal<boolean>(true);

  esSoloLectura = computed(() => this.formulario()?.bloqueado === true);

  // UI / UX States
  isSavingSeccion = signal<boolean>(false);
  isSavingQuestion = signal<boolean>(false);
  showMenuPresets = signal<boolean>(false);
  showRangosPanel = signal<boolean>(false);
  showSeccionModal = signal<boolean>(false);

  activeSeccionIdForQuestion = signal<string | null>(null);
  editingPreguntaId = signal<string | null>(null);
  esSeccionFinancieraActiva = signal<boolean>(false);
  editingOpcionId = signal<string | null>(null);
  editingRangoId = signal<string | null>(null);
  nuevaOpcionTexto = signal<string>('');

  // Drag & Drop State
  draggedSeccionIndex: number | null = null;
  draggedPreguntaIndex: number | null = null;

  // ==========================================
  // FORMULARIOS (REACTIVE FORMS)
  // ==========================================
  rangoForm: FormGroup = this.fb.group({
    variable_calculo: [{ value: 'BALANCE', disabled: true }, Validators.required],
    nombre: ['', [Validators.required, Validators.maxLength(100)]],
    valor_min: [null],
    valor_max: [null],
    orden: [1],
  });

  seccionForm: FormGroup = this.fb.group({
    nombre: ['', [Validators.required, Validators.maxLength(200)]],
    descripcion: [''],
    tipo_seccion: ['INFORMACION_GENERAL', Validators.required],
    subcategoria_financiera: ['NINGUNO']
  });

  preguntaForm: FormGroup = this.fb.group({
    enunciado: ['', Validators.required],
    tipo_campo_id: ['', Validators.required],
    categoria_financiera: ['NINGUNO', Validators.required],
    es_obligatorio: [true],
    requiere_evidencia: [false],
    revision_manual_obligatoria: [false],
    opcionesTemp: this.fb.array([]),
    filasTemp: this.fb.array([]),
    columnasTemp: this.fb.array([])
  });

  editarOpcionForm: FormGroup = this.fb.group({
    texto_opcion: ['', Validators.required],
    valor_ponderado: [0],
    puntaje_riesgo: [0],
    es_correcta: [false],
    permite_texto_libre: [false]
  });

  // ==========================================
  // GETTERS PARA FORMARRAYS
  // ==========================================
  get opcionesTempArray(): FormArray { return this.preguntaForm.get('opcionesTemp') as FormArray; }
  get filasTempArray(): FormArray { return this.preguntaForm.get('filasTemp') as FormArray; }
  get columnasTempArray(): FormArray { return this.preguntaForm.get('columnasTemp') as FormArray; }

  getSubOpciones(opcionIndex: number): FormArray { return this.opcionesTempArray.at(opcionIndex).get('subpregunta_opciones') as FormArray; }
  getSubFilas(opcionIndex: number): FormArray { return this.opcionesTempArray.at(opcionIndex).get('subpregunta_filas') as FormArray; }
  getSubColumnas(opcionIndex: number): FormArray { return this.opcionesTempArray.at(opcionIndex).get('subpregunta_columnas') as FormArray; }

  // ==========================================
  // LIFECYCLE & INITIALIZATION
  // ==========================================
  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.cargarTodo(id);
      this.escucharCambioTipoSeccion();
    } else {
      this.router.navigate(['/admin/formularios']);
    }
  }

  escucharCambioTipoSeccion(): void {
    this.seccionForm.get('tipo_seccion')?.valueChanges.subscribe((tipo: string) => {
      const subcatControl = this.seccionForm.get('subcategoria_financiera');
      if (tipo === 'FINANCIERA') {
        if (subcatControl?.value === 'NINGUNO' || !subcatControl?.value) {
          subcatControl?.setValue('INGRESOS');
        }
      } else {
        subcatControl?.setValue('NINGUNO');
      }
    });
  }

  cargarTodo(formularioId: string): void {
    this.isLoading.set(true);

    this.formularioService.getTiposCampo().subscribe({
      next: (tipos) => this.tiposCampo.set(tipos),
      error: (err) => console.error('Error al cargar tipos de campo:', err)
    });

    this.dependenciasService.getDependenciasByFormulario(formularioId).subscribe({
      next: (deps) => this.dependencias.set(deps),
      error: (err) => console.error('Error al cargar dependencias:', err)
    });

    this.cargarRangosVariable(formularioId);

    this.formularioService.getFormularioById(formularioId).subscribe({
      next: (form: Formulario) => {
        this.formulario.set(form);
        this.cargarSecciones(formularioId);
      },
      error: () => this.router.navigate(['/admin/formularios'])
    });
  }

  cargarSecciones(formularioId: string): void {
    this.formularioService.getSeccionesByFormulario(formularioId).subscribe({
      next: (seccs: Seccion[]) => {
        this.secciones.set(seccs);
        seccs.forEach((sec: Seccion) => this.cargarPreguntasDeSeccion(sec.id));
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Error al cargar secciones:', err);
        this.isLoading.set(false);
      }
    });
  }

  // ==========================================
  // LÓGICA DE SECCIONES (SWEETALERTS)
  // ==========================================
  abrirModalNuevaSeccion(): void {
    if (this.esSoloLectura()) {
      this.toastService.show('Esta ficha es una versión anterior bloqueada; solo puede visualizarse.', 'info');
      return;
    }

    Swal.fire({
      title: 'Nueva Sección',
      html: `
      <div class="text-left space-y-4" style="text-align:left">
        <div>
          <label style="display:block;font-size:0.75rem;font-weight:600;margin-bottom:0.35rem;color:#334155">Nombre de Sección *</label>
          <input id="swal-nombre" class="swal2-input" placeholder="Ej: Información Financiera Familiar" style="margin:0;width:100%;box-sizing:border-box">
        </div>
        <div>
          <label style="display:block;font-size:0.75rem;font-weight:600;margin-bottom:0.35rem;color:#334155">Descripción</label>
          <input id="swal-descripcion" class="swal2-input" placeholder="Breve explicación..." style="margin:0;width:100%;box-sizing:border-box">
        </div>
        <div>
          <label style="display:block;font-size:0.75rem;font-weight:600;margin-bottom:0.35rem;color:#334155">Tipo de Sección *</label>
          <select id="swal-tipo" class="swal2-select" style="margin:0;width:100%;box-sizing:border-box">
            <option value="INFORMACION_GENERAL">Información General</option>
            <option value="FINANCIERA">Sección Financiera (Balances / Montos)</option>
          </select>
        </div>
        <div id="swal-subcat-container" style="display:none">
          <label style="display:block;font-size:0.75rem;font-weight:600;margin-bottom:0.35rem;color:#334155">Subcategoría Financiera *</label>
          <select id="swal-subcat" class="swal2-select" style="margin:0;width:100%;box-sizing:border-box">
            <option value="INGRESOS">Exclusivamente Ingresos</option>
            <option value="GASTOS">Exclusivamente Egresos / Gastos</option>
            <option value="AMBOS">Ambos (Ingresos y Gastos)</option>
          </select>
        </div>
      </div>
    `,
      showCancelButton: true,
      focusConfirm: false,
      confirmButtonText: 'Guardar Sección',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#8b5cf6',
      cancelButtonColor: '#64748b',
      width: '520px',
      customClass: this.SWAL_CUSTOM_CLASS,
      didOpen: () => {
        const tipoEl = document.getElementById('swal-tipo') as HTMLSelectElement | null;
        const subcatCont = document.getElementById('swal-subcat-container');
        tipoEl?.addEventListener('change', () => {
          if (subcatCont) subcatCont.style.display = tipoEl.value === 'FINANCIERA' ? 'block' : 'none';
        });
        (document.getElementById('swal-nombre') as HTMLInputElement | null)?.focus();
      },
      preConfirm: () => {
        const nombre = (document.getElementById('swal-nombre') as HTMLInputElement)?.value?.trim() || '';
        const descripcion = (document.getElementById('swal-descripcion') as HTMLInputElement)?.value?.trim() || '';
        const tipo_seccion = (document.getElementById('swal-tipo') as HTMLSelectElement)?.value || 'INFORMACION_GENERAL';
        let subcategoria_financiera = (document.getElementById('swal-subcat') as HTMLSelectElement)?.value || 'NINGUNO';

        if (!nombre) {
          Swal.showValidationMessage('El nombre de la sección es obligatorio');
          return false;
        }
        if (tipo_seccion !== 'FINANCIERA') subcategoria_financiera = 'NINGUNO';
        return { nombre, descripcion, tipo_seccion, subcategoria_financiera };
      }
    }).then((result) => {
      if (result.isConfirmed && result.value) {
        this.guardarSeccionDesdeSwal(result.value);
      }
    });
  }

  private guardarSeccionDesdeSwal(data: { nombre: string; descripcion: string; tipo_seccion: string; subcategoria_financiera: string; }): void {
    if (this.esSoloLectura() || !this.formulario()) return;
    this.isSavingSeccion.set(true);

    const payload = {
      formulario_id: this.formulario()!.id,
      nombre: data.nombre,
      descripcion: data.descripcion || '',
      tipo_seccion: data.tipo_seccion as 'INFORMACION_GENERAL' | 'FINANCIERA',
      subcategoria_financiera: data.subcategoria_financiera as 'NINGUNO' | 'INGRESOS' | 'GASTOS' | 'AMBOS',
      orden: this.secciones().length + 1
    };

    this.formularioService.createSeccion(payload).subscribe({
      next: () => {
        this.isSavingSeccion.set(false);
        this.toastService.show('Sección creada exitosamente.', 'success');
        this.cargarSecciones(this.formulario()!.id);
      },
      error: (err: HttpErrorResponse) => {
        this.isSavingSeccion.set(false);
        this.toastService.show(this.extraerMensajeError(err, 'Ocurrió un error al crear la sección.'), 'error');
      }
    });
  }

  abrirModalEditarSeccion(seccion: Seccion): void {
    if (this.esSoloLectura()) return;

    Swal.fire({
      title: 'Editar Sección',
      html: `
      <div class="text-left space-y-4" style="text-align:left">
        <div>
          <label style="display:block;font-size:0.75rem;font-weight:600;margin-bottom:0.35rem;color:#334155">Nombre de Sección *</label>
          <input id="swal-edit-nombre" class="swal2-input" value="${seccion.nombre}" style="margin:0;width:100%;box-sizing:border-box">
        </div>
        <div>
          <label style="display:block;font-size:0.75rem;font-weight:600;margin-bottom:0.35rem;color:#334155">Descripción</label>
          <input id="swal-edit-descripcion" class="swal2-input" value="${seccion.descripcion || ''}" style="margin:0;width:100%;box-sizing:border-box">
        </div>
      </div>
      `,
      showCancelButton: true,
      confirmButtonText: 'Actualizar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#8b5cf6',
      cancelButtonColor: '#64748b',
      width: '500px',
      customClass: this.SWAL_CUSTOM_CLASS,
      preConfirm: () => {
        const nombre = (document.getElementById('swal-edit-nombre') as HTMLInputElement).value.trim();
        const descripcion = (document.getElementById('swal-edit-descripcion') as HTMLInputElement).value.trim();

        if (!nombre) {
          Swal.showValidationMessage('El nombre de la sección es obligatorio');
          return false;
        }
        return { nombre, descripcion };
      }
    }).then((result) => {
      if (result.isConfirmed && result.value) {
        this.actualizarSeccion(seccion.id, result.value);
      }
    });
  }

  private actualizarSeccion(seccionId: string, data: { nombre: string, descripcion: string }): void {
    this.formularioService.updateSeccion(seccionId, data).subscribe({
      next: () => {
        this.toastService.show('Sección actualizada con éxito.', 'success');
        this.cargarSecciones(this.formulario()!.id);
      },
      error: (err: HttpErrorResponse) => {
        this.toastService.show(this.extraerMensajeError(err, 'Error al actualizar la sección.'), 'error');
      }
    });
  }

  eliminarSeccion(seccionId: string, index: number): void {
    if (this.esSoloLectura()) return;

    Swal.fire({
      title: '¿Eliminar sección?',
      text: 'Se eliminarán también todas sus preguntas. Esta acción no se puede deshacer.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
      customClass: this.SWAL_CUSTOM_CLASS
    }).then((result) => {
      if (result.isConfirmed) {
        if (seccionId) {
          this.formularioService.deleteSeccion(seccionId).subscribe({
            next: () => {
              this.toastService.show('Sección eliminada.', 'info');
              this.secciones.update(secs => secs.filter((_, i) => i !== index));
            },
            error: (err: HttpErrorResponse) => console.error('Error al eliminar sección:', err)
          });
        } else {
          this.secciones.update(secs => secs.filter((_, i) => i !== index));
        }
      }
    });
  }

  // ==========================================
  // LÓGICA DE PREGUNTAS Y SUBPREGUNTAS
  // ==========================================
  cargarPreguntasDeSeccion(seccionId: string): void {
    this.formularioService.getPreguntasBySeccion(seccionId).subscribe({
      next: (preguntas: Pregunta[]) => {
        this.secciones.update(actuales => actuales.map(s => s.id === seccionId ? { ...s, preguntas } : s));
        preguntas.forEach((preg: Pregunta) => {
          if (this.esTipoMatriz(preg.tipo_campo_id)) this.cargarMatrizDetalles(preg.id);
          else if (this.esTipoSeleccion(preg.tipo_campo_id)) this.cargarOpcionesPregunta(preg.id);
        });
      },
      error: (err) => console.error(`Error al cargar preguntas de la sección ${seccionId}:`, err)
    });
  }

  esSubpregunta(preguntaId: string): boolean {
    return this.dependencias().some(d => d.pregunta_id === preguntaId);
  }

  preguntasVisibles(seccion: Seccion): Pregunta[] {
    return (seccion.preguntas || []).filter(p => !this.esSubpregunta(p.id));
  }

  obtenerSubpreguntaDeOpcion(opcionId: string): Pregunta | undefined {
    const dep = this.dependencias().find(d => d.opcion_disparadora_id === opcionId);
    if (!dep) return undefined;
    for (const s of this.secciones()) {
      const encontrada = s.preguntas?.find(p => p.id === dep.pregunta_id);
      if (encontrada) return encontrada;
    }
    return undefined;
  }

  esTipoMatriz(tipoCampoId: string): boolean {
    return this.tiposCampo().find(t => t.id === tipoCampoId)?.nombre === 'MATRIZ';
  }

  esTipoSeleccion(tipoCampoId: string): boolean {
    const nombre = this.tiposCampo().find(t => t.id === tipoCampoId)?.nombre;
    return nombre === 'SELECCION_UNICA' || nombre === 'SELECCION_MULTIPLE';
  }

  getNombreTipoCampo(tipoCampoId: string): string {
    return this.tiposCampo().find(t => t.id === tipoCampoId)?.nombre || 'PREGUNTA';
  }

  abrirFormPregunta(seccionId: string): void {
    if (this.esSoloLectura()) {
      this.toastService.show('Esta ficha es una versión anterior bloqueada.', 'info');
      return;
    }
    this.activeSeccionIdForQuestion.set(seccionId);
    this.editingPreguntaId.set(null);

    const seccionPadre = this.secciones().find(s => s.id === seccionId);
    const esFinanciera = seccionPadre?.tipo_seccion === 'FINANCIERA';
    this.esSeccionFinancieraActiva.set(esFinanciera);

    const tipoNumerico = this.tiposCampo().find(t => t.nombre.toUpperCase().includes('NUMER')) || this.tiposCampo()[0];
    const initialTipoId = tipoNumerico ? tipoNumerico.id : (this.tiposCampo()[0]?.id || '');

    let categoriaInicial: 'INGRESO' | 'EGRESO' | 'NINGUNO' = 'NINGUNO';
    if (esFinanciera) {
      categoriaInicial = seccionPadre?.subcategoria_financiera === 'GASTOS' ? 'EGRESO' : 'INGRESO';
    }

    this.preguntaForm.reset({
      enunciado: '',
      tipo_campo_id: initialTipoId,
      categoria_financiera: categoriaInicial,
      es_obligatorio: true,
      requiere_evidencia: false,
      revision_manual_obligatoria: false,
    });

    if (esFinanciera) {
      if (tipoNumerico) this.preguntaForm.get('tipo_campo_id')?.setValue(tipoNumerico.id);
      this.preguntaForm.get('tipo_campo_id')?.disable();
      this.preguntaForm.get('categoria_financiera')?.enable();
    } else {
      this.preguntaForm.get('tipo_campo_id')?.enable();
      this.preguntaForm.get('categoria_financiera')?.disable();
    }

    this.opcionesTempArray.clear();
    this.filasTempArray.clear();
    this.columnasTempArray.clear();
  }

  abrirEditarPregunta(pregunta: Pregunta, seccionId: string): void {
    if (this.esSoloLectura()) {
      this.toastService.show('Esta ficha es una versión anterior bloqueada.', 'info');
      return;
    }

    this.activeSeccionIdForQuestion.set(seccionId);
    this.editingPreguntaId.set(pregunta.id);

    const seccionPadre = this.secciones().find(s => s.id === seccionId);
    const esFinanciera = seccionPadre?.tipo_seccion === 'FINANCIERA';
    this.esSeccionFinancieraActiva.set(esFinanciera);

    this.preguntaForm.patchValue({
      enunciado: pregunta.enunciado,
      tipo_campo_id: pregunta.tipo_campo_id,
      categoria_financiera: pregunta.categoria_financiera || 'NINGUNO',
      es_obligatorio: pregunta.es_obligatorio,
      requiere_evidencia: pregunta.requiere_evidencia,
      revision_manual_obligatoria: Boolean(pregunta.revision_manual_obligatoria),
    });

    if (esFinanciera) {
      this.preguntaForm.get('tipo_campo_id')?.disable();
      this.preguntaForm.get('categoria_financiera')?.enable();
    } else {
      this.preguntaForm.get('tipo_campo_id')?.enable();
      this.preguntaForm.get('categoria_financiera')?.disable();
    }

    this.opcionesTempArray.clear();
    this.filasTempArray.clear();
    this.columnasTempArray.clear();

    if (this.esTipoSeleccion(pregunta.tipo_campo_id) && pregunta.opciones?.length) {
      pregunta.opciones.forEach(opcion => {
        const subpregunta = opcion.id ? this.obtenerSubpreguntaDeOpcion(opcion.id) : undefined;
        this.opcionesTempArray.push(this.fb.group({
          id: [opcion.id],
          texto_opcion: [opcion.texto_opcion, Validators.required],
          permite_texto_libre: [Boolean(opcion.permite_texto_libre)],
          valor_ponderado: [opcion.valor_ponderado ?? null],
          es_correcta: [Boolean(opcion.es_correcta)],
          dispara_dependencia: [!!subpregunta],
          subpregunta_id: [subpregunta?.id || null],
          subpregunta_enunciado: [subpregunta?.enunciado || ''],
          subpregunta_tipo_id: [subpregunta?.tipo_campo_id || (this.tiposCampo()[0]?.id || '')],
          subpregunta_categoria_financiera: [subpregunta?.categoria_financiera || 'NINGUNO'],
          subpregunta_requiere_evidencia: [Boolean(subpregunta?.requiere_evidencia)],
          subpregunta_es_obligatorio: [Boolean(subpregunta?.es_obligatorio)],
          subpregunta_revision_manual: [Boolean(subpregunta?.revision_manual_obligatoria)],
          subpregunta_opciones: this.fb.array(
            (subpregunta?.opciones || []).map(so => this.fb.group({
              id: [so.id], texto_opcion: [so.texto_opcion, Validators.required],
              valor_ponderado: [so.valor_ponderado ?? 0], es_correcta: [Boolean(so.es_correcta)],
              permite_texto_libre: [Boolean(so.permite_texto_libre)]
            }))
          ),
          subpregunta_filas: this.fb.array(
            (subpregunta?.filasMatriz || []).map(f => this.fb.group({ id: [f.id], texto_fila: [f.texto_fila, Validators.required] }))
          ),
          subpregunta_columnas: this.fb.array(
            (subpregunta?.columnasMatriz || []).map(c => this.fb.group({ id: [c.id], texto_columna: [c.texto_columna, Validators.required] }))
          )
        }));
      });
    }

    if (this.esTipoMatriz(pregunta.tipo_campo_id)) {
      (pregunta.filasMatriz || []).forEach(f => this.filasTempArray.push(this.fb.group({ id: [f.id], texto_fila: [f.texto_fila, Validators.required] })));
      (pregunta.columnasMatriz || []).forEach(c => this.columnasTempArray.push(this.fb.group({ id: [c.id], texto_columna: [c.texto_columna, Validators.required] })));
    }
  }

  cancelarPregunta(): void {
    this.activeSeccionIdForQuestion.set(null);
    this.editingPreguntaId.set(null);
    this.editingOpcionId.set(null);
  }

  eliminarPregunta(preguntaId: string, seccionId: string): void {
    if (this.esSoloLectura()) return;

    Swal.fire({
      title: '¿Eliminar pregunta?',
      text: 'Esta acción no se puede deshacer.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
      customClass: this.SWAL_CUSTOM_CLASS
    }).then((result) => {
      if (result.isConfirmed) {
        this.formularioService.deletePregunta(preguntaId).subscribe({
          next: () => {
            this.toastService.show('Pregunta eliminada.', 'info');
            this.cargarPreguntasDeSeccion(seccionId);
          },
          error: (err) => console.error('Error al eliminar pregunta:', err)
        });
      }
    });
  }

  // ==========================================
  // CORE GUARDAR PREGUNTA Y SINCRONIZACIÓN
  // ==========================================
  guardarPregunta(seccionId: string): void {
    if (this.esSoloLectura()) return;
    if (this.preguntaForm.invalid) {
      this.toastService.show('Por favor completa todos los campos requeridos de la pregunta.', 'warning');
      return;
    }

    const formValue = this.preguntaForm.getRawValue();
    const seccionPadre = this.secciones().find(s => s.id === seccionId);
    const esFinanciera = seccionPadre?.tipo_seccion === 'FINANCIERA';

    let tipoCampoIdFinal = formValue.tipo_campo_id;
    if (!tipoCampoIdFinal || typeof tipoCampoIdFinal !== 'string' || tipoCampoIdFinal.trim() === '') {
      const fallbackTipo = this.tiposCampo().find(t => t.nombre.toUpperCase().includes('NUMER')) || this.tiposCampo()[0];
      if (fallbackTipo) tipoCampoIdFinal = fallbackTipo.id;
      else {
        this.toastService.show('Error: No hay tipos de campo cargados en la aplicación.', 'error');
        return;
      }
    }

    const categoriaFinancieraFinal = esFinanciera ? (formValue.categoria_financiera || 'INGRESO') : 'NINGUNO';
    this.isSavingQuestion.set(true);

    if (this.editingPreguntaId()) {
      const preguntaIdEditando = this.editingPreguntaId()!;
      const payloadUpdate = {
        enunciado: formValue.enunciado.trim(),
        tipo_campo_id: tipoCampoIdFinal,
        categoria_financiera: categoriaFinancieraFinal,
        es_obligatorio: Boolean(formValue.es_obligatorio),
        requiere_evidencia: Boolean(formValue.requiere_evidencia),
        revision_manual_obligatoria: Boolean(formValue.revision_manual_obligatoria),
      };

      this.formularioService.updatePregunta(preguntaIdEditando, payloadUpdate).subscribe({
        next: async () => {
          try {
            if (this.esTipoSeleccion(tipoCampoIdFinal)) await this.sincronizarOpcionesYSubpreguntas(preguntaIdEditando, seccionId, formValue.opcionesTemp || []);
            if (this.esTipoMatriz(tipoCampoIdFinal)) await this.sincronizarFilasColumnasMatriz(preguntaIdEditando, formValue.filasTemp || [], formValue.columnasTemp || []);

            this.isSavingQuestion.set(false);
            this.toastService.show('Pregunta actualizada correctamente.', 'success');
            this.cancelarPregunta();
            this.cargarPreguntasDeSeccion(seccionId);
            if (this.formulario()?.id) {
              this.dependenciasService.getDependenciasByFormulario(this.formulario()!.id).subscribe({
                next: (deps) => this.dependencias.set(deps)
              });
            }
          } catch (error: any) {
            console.error('Error al sincronizar opciones/subpreguntas:', error);
            this.isSavingQuestion.set(false);
            this.toastService.show(error?.message || 'La pregunta se actualizó, pero falló una opción/subpregunta.', 'error');
            this.cancelarPregunta();
            this.cargarPreguntasDeSeccion(seccionId);
          }
        },
        error: (err: HttpErrorResponse) => {
          this.isSavingQuestion.set(false);
          this.toastService.show(this.extraerMensajeError(err, 'Error al actualizar la pregunta.'), 'error');
        }
      });
      return;
    }

    // Flujo de Creación de Pregunta
    const orden = (seccionPadre?.preguntas?.length || 0) + 1;
    const payloadPreguntaPadre = {
      seccion_id: seccionId,
      orden,
      enunciado: formValue.enunciado.trim(),
      tipo_campo_id: tipoCampoIdFinal,
      categoria_financiera: categoriaFinancieraFinal,
      es_obligatorio: Boolean(formValue.es_obligatorio),
      requiere_evidencia: Boolean(formValue.requiere_evidencia),
      revision_manual_obligatoria: Boolean(formValue.revision_manual_obligatoria),
    };

    this.formularioService.createPregunta(payloadPreguntaPadre).subscribe({
      next: async (preguntaCreada: Pregunta) => {
        try {
          if (this.esTipoSeleccion(tipoCampoIdFinal) && formValue.opcionesTemp?.length > 0) {
            for (let i = 0; i < formValue.opcionesTemp.length; i++) {
              const opc = formValue.opcionesTemp[i];
              const opcionGuardada = await firstValueFrom(
                this.formularioService.createOpcion({
                  pregunta_id: preguntaCreada.id,
                  texto_opcion: opc.texto_opcion.trim(),
                  orden: i + 1,
                  permite_texto_libre: Boolean(opc.permite_texto_libre),
                  valor_ponderado: opc.valor_ponderado ? Number(opc.valor_ponderado) : 0,
                  es_correcta: Boolean(opc.es_correcta),
                })
              );

              if (!opcionGuardada?.id) throw new Error(`La opción "${opc.texto_opcion}" no devolvió id.`);

              if (opc.dispara_dependencia && opc.subpregunta_enunciado?.trim()) {
                const subTipoId = opc.subpregunta_tipo_id && String(opc.subpregunta_tipo_id).trim() !== '' ? opc.subpregunta_tipo_id : tipoCampoIdFinal;
                if (!subTipoId) throw new Error('Falta el tipo de campo de la subpregunta.');

                const subpreguntaGuardada = await firstValueFrom(
                  this.formularioService.createPregunta({
                    seccion_id: seccionId, orden: orden + i + 1, enunciado: opc.subpregunta_enunciado.trim(),
                    tipo_campo_id: subTipoId, categoria_financiera: opc.subpregunta_categoria_financiera || 'NINGUNO',
                    es_obligatorio: Boolean(opc.subpregunta_es_obligatorio), requiere_evidencia: Boolean(opc.subpregunta_requiere_evidencia),
                    revision_manual_obligatoria: Boolean(opc.subpregunta_revision_manual),
                  })
                );

                if (!subpreguntaGuardada?.id) throw new Error('La subpregunta no se creó.');

                await firstValueFrom(
                  this.dependenciasService.createDependencia({
                    pregunta_disparadora_id: preguntaCreada.id, opcion_disparadora_id: opcionGuardada.id, pregunta_id: subpreguntaGuardada.id,
                  })
                );

                if (this.esTipoSeleccion(subTipoId) && opc.subpregunta_opciones?.length > 0) {
                  for (let j = 0; j < opc.subpregunta_opciones.length; j++) {
                    const subOpc = opc.subpregunta_opciones[j];
                    if (!subOpc.texto_opcion?.trim()) continue;
                    await firstValueFrom(this.formularioService.createOpcion({
                      pregunta_id: subpreguntaGuardada.id, texto_opcion: subOpc.texto_opcion.trim(), orden: j + 1,
                      valor_ponderado: subOpc.valor_ponderado ? Number(subOpc.valor_ponderado) : 0, es_correcta: Boolean(subOpc.es_correcta),
                      permite_texto_libre: Boolean(subOpc.permite_texto_libre),
                    }));
                  }
                }

                if (this.esTipoMatriz(subTipoId)) {
                  for (let j = 0; j < (opc.subpregunta_filas || []).length; j++) {
                    if (opc.subpregunta_filas[j]?.texto_fila?.trim()) await firstValueFrom(this.matricesService.createFila({ pregunta_id: subpreguntaGuardada.id, texto_fila: opc.subpregunta_filas[j].texto_fila.trim() }));
                  }
                  for (let j = 0; j < (opc.subpregunta_columnas || []).length; j++) {
                    if (opc.subpregunta_columnas[j]?.texto_columna?.trim()) await firstValueFrom(this.matricesService.createColumna({ pregunta_id: subpreguntaGuardada.id, texto_columna: opc.subpregunta_columnas[j].texto_columna.trim() }));
                  }
                }
              }
            }
          }

          if (this.esTipoMatriz(tipoCampoIdFinal)) {
            for (let i = 0; i < (formValue.filasTemp || []).length; i++) {
              if (formValue.filasTemp[i]?.texto_fila?.trim()) await firstValueFrom(this.matricesService.createFila({ pregunta_id: preguntaCreada.id, texto_fila: formValue.filasTemp[i].texto_fila.trim() }));
            }
            for (let i = 0; i < (formValue.columnasTemp || []).length; i++) {
              if (formValue.columnasTemp[i]?.texto_columna?.trim()) await firstValueFrom(this.matricesService.createColumna({ pregunta_id: preguntaCreada.id, texto_columna: formValue.columnasTemp[i].texto_columna.trim() }));
            }
          }

          this.isSavingQuestion.set(false);
          this.toastService.show('Pregunta guardada con éxito.', 'success');
          this.cancelarPregunta();
          this.cargarPreguntasDeSeccion(seccionId);
          if (this.formulario()?.id) {
            this.dependenciasService.getDependenciasByFormulario(this.formulario()!.id).subscribe({
              next: (deps) => this.dependencias.set(deps)
            });
          }
        } catch (error: any) {
          console.error('Error al guardar opciones/subpreguntas:', error);
          this.isSavingQuestion.set(false);
          this.toastService.show(error?.message || 'La pregunta se creó, pero falló una opción o subpregunta.', 'error');
          this.cancelarPregunta();
          this.cargarPreguntasDeSeccion(seccionId);
          if (this.formulario()?.id) {
            this.dependenciasService.getDependenciasByFormulario(this.formulario()!.id).subscribe({
              next: (deps) => this.dependencias.set(deps),
            });
          }
        }
      },
      error: (err: HttpErrorResponse) => {
        this.isSavingQuestion.set(false);
        this.toastService.show(this.extraerMensajeError(err, 'Error de validación al guardar la pregunta principal.'), 'error');
      },
    });
  }

  private async sincronizarOpcionesYSubpreguntas(preguntaPadreId: string, seccionId: string, opcionesTempValue: any[]): Promise<void> {
    const opcionesOriginales = this.secciones().find(s => s.id === seccionId)?.preguntas?.find(p => p.id === preguntaPadreId)?.opciones || [];
    const idsEnForm = opcionesTempValue.filter(o => o.id).map(o => o.id);

    for (const original of opcionesOriginales) {
      if (original.id && !idsEnForm.includes(original.id)) await firstValueFrom(this.formularioService.deleteOpcion(original.id));
    }

    for (let i = 0; i < opcionesTempValue.length; i++) {
      const opc = opcionesTempValue[i];
      if (!opc.texto_opcion?.trim()) continue;

      let opcionId = opc.id;
      const payloadOpcion = {
        texto_opcion: opc.texto_opcion.trim(), orden: i + 1,
        permite_texto_libre: Boolean(opc.permite_texto_libre),
        valor_ponderado: opc.valor_ponderado ? Number(opc.valor_ponderado) : 0,
        es_correcta: Boolean(opc.es_correcta),
      };

      if (opcionId) {
        await firstValueFrom(this.formularioService.updateOpcion(opcionId, payloadOpcion, preguntaPadreId));
      } else {
        const nueva = await firstValueFrom(this.formularioService.createOpcion({ pregunta_id: preguntaPadreId, ...payloadOpcion }));
        opcionId = nueva?.id;
      }
      if (!opcionId) continue;

      if (opc.dispara_dependencia && opc.subpregunta_enunciado?.trim()) {
        const subTipoId = opc.subpregunta_tipo_id;
        const payloadSub = {
          enunciado: opc.subpregunta_enunciado.trim(), tipo_campo_id: subTipoId,
          categoria_financiera: opc.subpregunta_categoria_financiera || 'NINGUNO',
          es_obligatorio: Boolean(opc.subpregunta_es_obligatorio), requiere_evidencia: Boolean(opc.subpregunta_requiere_evidencia),
          revision_manual_obligatoria: Boolean(opc.subpregunta_revision_manual),
        };

        if (opc.subpregunta_id) {
          await firstValueFrom(this.formularioService.updatePregunta(opc.subpregunta_id, payloadSub));
          await this.sincronizarSubOpcionesYMatriz(opc.subpregunta_id, subTipoId, opc);
        } else {
          const subGuardada = await firstValueFrom(this.formularioService.createPregunta({ seccion_id: seccionId, orden: i + 1, ...payloadSub }));
          if (subGuardada?.id) {
            await firstValueFrom(this.dependenciasService.createDependencia({ pregunta_disparadora_id: preguntaPadreId, opcion_disparadora_id: opcionId, pregunta_id: subGuardada.id }));
            await this.sincronizarSubOpcionesYMatriz(subGuardada.id, subTipoId, opc);
          }
        }
      } else if (opc.subpregunta_id && !opc.dispara_dependencia) {
        await firstValueFrom(this.formularioService.deletePregunta(opc.subpregunta_id));
      }
    }
  }

  private async sincronizarSubOpcionesYMatriz(subpreguntaId: string, subTipoId: string, opc: any): Promise<void> {
    if (this.esTipoSeleccion(subTipoId)) {
      for (let j = 0; j < (opc.subpregunta_opciones || []).length; j++) {
        const so = opc.subpregunta_opciones[j];
        if (!so.texto_opcion?.trim()) continue;
        const payload = {
          texto_opcion: so.texto_opcion.trim(), orden: j + 1,
          valor_ponderado: so.valor_ponderado ? Number(so.valor_ponderado) : 0,
          es_correcta: Boolean(so.es_correcta), permite_texto_libre: Boolean(so.permite_texto_libre),
        };
        if (so.id) await firstValueFrom(this.formularioService.updateOpcion(so.id, payload, subpreguntaId));
        else await firstValueFrom(this.formularioService.createOpcion({ pregunta_id: subpreguntaId, ...payload }));
      }
    }

    if (this.esTipoMatriz(subTipoId)) {
      for (const fila of (opc.subpregunta_filas || [])) {
        if (fila?.texto_fila?.trim() && !fila.id) await firstValueFrom(this.matricesService.createFila({ pregunta_id: subpreguntaId, texto_fila: fila.texto_fila.trim() }));
      }
      for (const col of (opc.subpregunta_columnas || [])) {
        if (col?.texto_columna?.trim() && !col.id) await firstValueFrom(this.matricesService.createColumna({ pregunta_id: subpreguntaId, texto_columna: col.texto_columna.trim() }));
      }
    }
  }

  private async sincronizarFilasColumnasMatriz(preguntaId: string, filasTemp: any[], columnasTemp: any[]): Promise<void> {
    const preguntaOriginal = this.secciones().flatMap(s => s.preguntas || []).find(p => p.id === preguntaId);
    const idsFilasForm = filasTemp.filter(f => f.id).map(f => f.id);
    const idsColsForm = columnasTemp.filter(c => c.id).map(c => c.id);

    for (const f of preguntaOriginal?.filasMatriz || []) {
      if (f.id && !idsFilasForm.includes(f.id)) await firstValueFrom(this.matricesService.deleteFila(f.id));
    }
    for (const c of preguntaOriginal?.columnasMatriz || []) {
      if (c.id && !idsColsForm.includes(c.id)) await firstValueFrom(this.matricesService.deleteColumna(c.id));
    }
    for (const f of filasTemp) {
      if (!f.id && f.texto_fila?.trim()) await firstValueFrom(this.matricesService.createFila({ pregunta_id: preguntaId, texto_fila: f.texto_fila.trim() }));
    }
    for (const c of columnasTemp) {
      if (!c.id && c.texto_columna?.trim()) await firstValueFrom(this.matricesService.createColumna({ pregunta_id: preguntaId, texto_columna: c.texto_columna.trim() }));
    }
  }

  // ==========================================
  // MANEJO DE OPCIONES DE SELECCIÓN Y MATRICES (NIVEL 1)
  // ==========================================
  agregarOpcionTemp(texto = '', valorPonderado: number | null = null): void {
    const tipoTexto = this.tiposCampo().find(t => t.nombre.toUpperCase().includes('TEXTO')) || this.tiposCampo()[0];
    this.opcionesTempArray.push(this.fb.group({
      id: [null], texto_opcion: [texto, Validators.required], permite_texto_libre: [false], valor_ponderado: [valorPonderado],
      es_correcta: [false], dispara_dependencia: [false], subpregunta_id: [null], subpregunta_enunciado: [''],
      subpregunta_tipo_id: [tipoTexto ? tipoTexto.id : ''], subpregunta_categoria_financiera: ['NINGUNO'],
      subpregunta_requiere_evidencia: [false], subpregunta_es_obligatorio: [false], subpregunta_revision_manual: [false],
      subpregunta_opciones: this.fb.array([]), subpregunta_filas: this.fb.array([]), subpregunta_columnas: this.fb.array([])
    }));
  }

  eliminarOpcionTemp(index: number): void { this.opcionesTempArray.removeAt(index); }
  
  agregarSubOpcion(opcionIndex: number, texto = ''): void { this.getSubOpciones(opcionIndex).push(this.fb.group({ texto_opcion: [texto, Validators.required], valor_ponderado: [0], es_correcta: [false], permite_texto_libre: [false] })); }
  eliminarSubOpcion(opcionIndex: number, subIndex: number): void { this.getSubOpciones(opcionIndex).removeAt(subIndex); }
  
  agregarSubFila(opcionIndex: number, texto = ''): void { this.getSubFilas(opcionIndex).push(this.fb.group({ texto_fila: [texto, Validators.required] })); }
  eliminarSubFila(opcionIndex: number, filaIndex: number): void { this.getSubFilas(opcionIndex).removeAt(filaIndex); }
  
  agregarSubColumna(opcionIndex: number, texto = ''): void { this.getSubColumnas(opcionIndex).push(this.fb.group({ texto_columna: [texto, Validators.required] })); }
  eliminarSubColumna(opcionIndex: number, colIndex: number): void { this.getSubColumnas(opcionIndex).removeAt(colIndex); }

  esSubTipoMatriz(opcionIndex: number): boolean { return this.esTipoMatriz(this.opcionesTempArray.at(opcionIndex).get('subpregunta_tipo_id')?.value); }
  esSubTipoSeleccion(opcionIndex: number): boolean { return this.esTipoSeleccion(this.opcionesTempArray.at(opcionIndex).get('subpregunta_tipo_id')?.value); }

  toggleMenuPresets(): void { this.showMenuPresets.update(v => !v); }

  cargarPreset(tipo: 'EDAD' | 'SI_NO' | 'INGRESOS' | 'VIVIENDA'): void {
    this.opcionesTempArray.clear();
    this.showMenuPresets.set(false);
    let presetData: { texto: string; pts?: number }[] = [];
    switch (tipo) {
      case 'EDAD': presetData = [{ texto: '0 a 5 años' }, { texto: '6 a 12 años' }, { texto: '13 a 18 años' }, { texto: 'Mayor de 18 años' }]; break;
      case 'SI_NO': presetData = [{ texto: 'Sí' }, { texto: 'No' }]; break;
      case 'INGRESOS': presetData = [{ texto: 'Menos de $400' }, { texto: '$401 a $800' }, { texto: 'Más de $800' }]; break;
      case 'VIVIENDA': presetData = [{ texto: 'Propia' }, { texto: 'Arrendada' }, { texto: 'Cedida' }]; break;
    }
    presetData.forEach(item => this.agregarOpcionTemp(item.texto, item.pts || null));
  }

  cargarOpcionesPregunta(preguntaId: string): void {
    this.formularioService.getOpcionesByPregunta(preguntaId).subscribe({
      next: (opciones: OpcionPregunta[]) => {
        this.secciones.update(secs => secs.map(s => ({ ...s, preguntas: s.preguntas?.map(p => p.id === preguntaId ? { ...p, opciones } : p) })));
      },
      error: (err) => console.error(`Error al cargar opciones de ${preguntaId}:`, err)
    });
  }

  agregarOpcion(preguntaId: string): void {
    if (this.esSoloLectura() || !this.nuevaOpcionTexto().trim()) return;
    this.formularioService.createOpcion({ pregunta_id: preguntaId, texto_opcion: this.nuevaOpcionTexto().trim() }).subscribe({
      next: () => {
        this.toastService.show('Opción agregada correctamente.', 'success');
        this.nuevaOpcionTexto.set('');
        this.cargarOpcionesPregunta(preguntaId);
      },
      error: (err: HttpErrorResponse) => this.toastService.show(this.extraerMensajeError(err, 'Error al agregar la opción.'), 'error')
    });
  }

  eliminarOpcionExistente(opcionId: string, preguntaId: string): void {
    if (this.esSoloLectura()) return;
    this.formularioService.deleteOpcion(opcionId).subscribe({
      next: () => { this.toastService.show('Opción eliminada.', 'info'); this.cargarOpcionesPregunta(preguntaId); }
    });
  }

  abrirEditarOpcion(opcion: OpcionPregunta): void {
    if (this.esSoloLectura() || !opcion.id) return;
    this.editingOpcionId.set(opcion.id);
    this.editarOpcionForm.reset({
      texto_opcion: opcion.texto_opcion, valor_ponderado: opcion.valor_ponderado || 0,
      puntaje_riesgo: opcion.puntaje_riesgo || 0, es_correcta: Boolean(opcion.es_correcta),
      permite_texto_libre: Boolean(opcion.permite_texto_libre)
    });
  }

  cancelarEdicionOpcion(): void { this.editingOpcionId.set(null); }

  guardarEdicionOpcion(preguntaId: string): void {
    if (this.esSoloLectura()) return;
    const opcionId = this.editingOpcionId();
    if (!opcionId || this.editarOpcionForm.invalid) return;

    const raw = this.editarOpcionForm.getRawValue();
    const payload = {
      texto_opcion: String(raw.texto_opcion).trim(), valor_ponderado: raw.valor_ponderado ? Number(raw.valor_ponderado) : 0,
      puntaje_riesgo: raw.puntaje_riesgo ? Number(raw.puntaje_riesgo) : 0, es_correcta: Boolean(raw.es_correcta),
      permite_texto_libre: Boolean(raw.permite_texto_libre)
    };

    this.formularioService.updateOpcion(opcionId, payload, preguntaId).subscribe({
      next: () => {
        this.toastService.show('Opción actualizada correctamente.', 'success');
        this.editingOpcionId.set(null);
        this.cargarOpcionesPregunta(preguntaId);
      },
      error: (err: HttpErrorResponse) => this.toastService.show(this.extraerMensajeError(err, 'Error al actualizar la opción.'), 'error')
    });
  }

  calcularTotalPuntos(): number {
    let total = 0;
    for (const ctrl of this.opcionesTempArray.controls) {
      if (ctrl.get('es_correcta')?.value) total += Number(ctrl.get('valor_ponderado')?.value) || 0;
    }
    return total;
  }

  cargarMatrizDetalles(preguntaId: string): void {
    this.matricesService.getFilas(preguntaId).subscribe({
      next: (filas) => this.secciones.update(secs => secs.map(s => ({ ...s, preguntas: s.preguntas?.map(p => p.id === preguntaId ? { ...p, filasMatriz: filas } : p) })))
    });
    this.matricesService.getColumnas(preguntaId).subscribe({
      next: (columnas) => this.secciones.update(secs => secs.map(s => ({ ...s, preguntas: s.preguntas?.map(p => p.id === preguntaId ? { ...p, columnasMatriz: columnas } : p) })))
    });
  }

  agregarFilaMatriz(event: { preguntaId: string; texto: string }): void {
    if (this.esSoloLectura()) return;
    this.matricesService.createFila({ pregunta_id: event.preguntaId, texto_fila: event.texto }).subscribe({ next: () => this.cargarMatrizDetalles(event.preguntaId) });
  }

  eliminarFilaExistente(filaId: string, preguntaId: string): void {
    if (this.esSoloLectura()) return;
    this.matricesService.deleteFila(filaId).subscribe({ next: () => this.cargarMatrizDetalles(preguntaId) });
  }

  agregarColumnaMatriz(event: { preguntaId: string; texto: string }): void {
    if (this.esSoloLectura()) return;
    this.matricesService.createColumna({ pregunta_id: event.preguntaId, texto_columna: event.texto }).subscribe({ next: () => this.cargarMatrizDetalles(event.preguntaId) });
  }

  eliminarColumnaExistente(columnaId: string, preguntaId: string): void {
    if (this.esSoloLectura()) return;
    this.matricesService.deleteColumna(columnaId).subscribe({ next: () => this.cargarMatrizDetalles(preguntaId) });
  }

  // ==========================================
  // DRAG & DROP
  // ==========================================
  onDragStart(seccionIndex: number, preguntaIndex: number): void {
    if (this.esSoloLectura()) return;
    this.draggedSeccionIndex = seccionIndex;
    this.draggedPreguntaIndex = preguntaIndex;
  }

  onDragOver(event: DragEvent): void {
    if (this.esSoloLectura()) return;
    event.preventDefault();
  }

  onDrop(targetSeccionIndex: number, targetPreguntaIndex: number): void {
    if (this.esSoloLectura() || this.draggedSeccionIndex === null || this.draggedPreguntaIndex === null || this.draggedSeccionIndex !== targetSeccionIndex) return;

    const targetSeccion = this.secciones()[targetSeccionIndex];
    if (!targetSeccion || !targetSeccion.preguntas) return;

    const preguntasNuevas = [...targetSeccion.preguntas];
    const [preguntaMovida] = preguntasNuevas.splice(this.draggedPreguntaIndex, 1);
    preguntasNuevas.splice(targetPreguntaIndex, 0, preguntaMovida);

    const preguntasReordenadas = preguntasNuevas.map((p, idx) => ({ ...p, orden: idx + 1 }));

    this.secciones.update(secs => {
      const copia = [...secs];
      copia[targetSeccionIndex] = { ...copia[targetSeccionIndex], preguntas: preguntasReordenadas };
      return copia;
    });

    this.draggedSeccionIndex = null;
    this.draggedPreguntaIndex = null;

    const payloadOrdenes = preguntasReordenadas.map(p => ({ id: p.id, orden: p.orden }));
    this.formularioService.reordenarPreguntas(targetSeccion.id, payloadOrdenes).subscribe({
      error: (err) => console.error('Error al persistir el reordenamiento:', err)
    });
  }

  // ==========================================
  // LÓGICA DE RANGOS VARIABLES
  // ==========================================
  cargarRangosVariable(formularioId: string): void {
    this.rangosVariableService.getByFormulario(formularioId).subscribe({
      next: (rangos) => this.rangosVariable.set(rangos),
      error: (err) => console.error('Error al cargar rangos:', err)
    });
  }

  cargarRangosBalancePredeterminados(): void {
    if (this.esSoloLectura() || !this.formulario()) return;

    if (this.rangosVariable().length > 0) {
      Swal.fire({
        title: 'Rangos existentes',
        text: 'Ya existen rangos. ¿Deseas agregar los predeterminados de BALANCE de todas formas? (Puedes borrar o editar después.)',
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#8b5cf6',
        cancelButtonColor: '#64748b',
        confirmButtonText: 'Sí, agregar',
        cancelButtonText: 'Cancelar',
        customClass: this.SWAL_CUSTOM_CLASS
      }).then((result) => {
        if (result.isConfirmed) this.ejecutarCargaRangosPredeterminados();
      });
    } else {
      this.ejecutarCargaRangosPredeterminados();
    }
  }

  private ejecutarCargaRangosPredeterminados(): void {
    const formularioId = this.formulario()!.id;
    let pendientes = this.RANGOS_BALANCE_PREDETERMINADOS.length;
    let errores = 0;

    this.RANGOS_BALANCE_PREDETERMINADOS.forEach((rango, index) => {
      const payload = {
        variable_calculo: rango.variable_calculo, nombre: rango.nombre,
        valor_min: rango.valor_min, valor_max: rango.valor_max,
        orden: this.rangosVariable().length + index + 1, formulario_id: formularioId,
      };

      this.rangosVariableService.createRango(payload).subscribe({
        next: () => {
          pendientes--;
          if (pendientes === 0) {
            this.cargarRangosVariable(formularioId);
            if (errores === 0) this.toastService.show('Rangos de estatus económico cargados. Puedes editarlos antes de publicar.', 'success');
            else this.toastService.show(`Rangos cargados con ${errores} error(es). Revisa la lista.`, 'warning');
          }
        },
        error: () => {
          errores++; pendientes--;
          if (pendientes === 0) {
            this.cargarRangosVariable(formularioId);
            this.toastService.show('Algunos rangos no se pudieron crear.', 'error');
          }
        },
      });
    });
  }

  guardarRangoVariable(): void {
    if (this.esSoloLectura() || this.rangoForm.invalid || !this.formulario()) return;

    const raw = this.rangoForm.getRawValue();
    const idEdit = this.editingRangoId();
    const valorMin = raw.valor_min != null && raw.valor_min !== '' ? Number(raw.valor_min) : 0;
    const valorMax = raw.valor_max != null && raw.valor_max !== '' ? Number(raw.valor_max) : 999999;

    const errorLocal = this.validarRangoLocal(valorMin, valorMax, String(raw.nombre).trim(), idEdit);
    if (errorLocal) {
      this.toastService.show(errorLocal, 'warning');
      return;
    }

    if (idEdit) {
      const payloadUpdate = {
        variable_calculo: 'BALANCE', nombre: String(raw.nombre).trim(),
        valor_min: valorMin, valor_max: valorMax, orden: raw.orden != null ? Number(raw.orden) : 1,
      };
      this.rangosVariableService.updateRango(idEdit, payloadUpdate).subscribe({
        next: () => {
          this.toastService.show('Rango actualizado.', 'success');
          this.cancelarEdicionRango();
          this.cargarRangosVariable(this.formulario()!.id);
        },
        error: (err: HttpErrorResponse) => this.toastService.show(this.extraerMensajeError(err, 'Error al actualizar el rango.'), 'error'),
      });
      return;
    }

    const payloadCreate = {
      variable_calculo: 'BALANCE', nombre: String(raw.nombre).trim(),
      valor_min: valorMin, valor_max: valorMax, orden: this.rangosVariable().length + 1,
      formulario_id: this.formulario()!.id,
    };

    this.rangosVariableService.createRango(payloadCreate).subscribe({
      next: () => {
        this.toastService.show('Rango agregado.', 'success');
        this.cancelarEdicionRango();
        this.cargarRangosVariable(this.formulario()!.id);
      },
      error: (err: HttpErrorResponse) => this.toastService.show(this.extraerMensajeError(err, 'Error al guardar el rango.'), 'error'),
    });
  }

  abrirEditarRango(rango: RangoVariableCalculada): void {
    if (this.esSoloLectura()) return;
    this.editingRangoId.set(rango.id);
    this.rangoForm.patchValue({
      variable_calculo: 'BALANCE', nombre: rango.nombre,
      valor_min: rango.valor_min, valor_max: rango.valor_max ?? null, orden: rango.orden ?? 1,
    });
    this.rangoForm.get('variable_calculo')?.disable();
  }

  cancelarEdicionRango(): void {
    this.editingRangoId.set(null);
    this.rangoForm.reset({ variable_calculo: 'BALANCE', nombre: '', valor_min: null, valor_max: null, orden: 1 });
    this.rangoForm.get('variable_calculo')?.disable();
  }

  eliminarRangoVariable(id: string): void {
    if (this.esSoloLectura()) return;
    this.rangosVariableService.deleteRango(id).subscribe({
      next: () => {
        this.toastService.show('Rango eliminado.', 'info');
        if (this.formulario()) this.cargarRangosVariable(this.formulario()!.id);
      },
      error: (err) => console.error('Error al eliminar rango:', err)
    });
  }

  private validarRangoLocal(valorMin: number, valorMax: number, nombre: string, excludeId?: string | null): string | null {
    if (valorMin > valorMax) return 'El mínimo no puede ser mayor que el máximo.';
    const nombreNorm = nombre.trim().toLowerCase();
    const otros = this.rangosVariable().filter(r => r.id !== excludeId);
    for (const r of otros) {
      if (r.nombre.trim().toLowerCase() === nombreNorm) return `Ya existe un rango llamado "${r.nombre}".`;
      const rMin = Number(r.valor_min);
      const rMax = Number(r.valor_max);
      if (valorMin <= rMax && valorMax >= rMin) return `Se solapa con "${r.nombre}" [${rMin} – ${rMax}].`;
    }
    return null;
  }

  // ==========================================
  // PUBLICACIÓN Y UTILERÍAS GLOBALES
  // ==========================================
  publicarFormulario(): void {
    if (this.esSoloLectura() || !this.formulario()) return;

    Swal.fire({
      title: '¿Publicar ficha?',
      text: 'Una vez publicada estará disponible para los estudiantes.',
      icon: 'info',
      showCancelButton: true,
      confirmButtonColor: '#10b981',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Sí, publicar',
      cancelButtonText: 'Cancelar',
      customClass: this.SWAL_CUSTOM_CLASS
    }).then((result) => {
      if (result.isConfirmed) {
        this.formularioService.publicarFormulario(this.formulario()!.id).subscribe({
          next: (form: Formulario) => {
            this.formulario.set(form);
            this.toastService.show('¡Formulario publicado exitosamente!', 'success');
          },
          error: (err: HttpErrorResponse) => {
            this.toastService.show(this.extraerMensajeError(err, 'Error al publicar el formulario.'), 'error');
          }
        });
      }
    });
  }

  private extraerMensajeError(err: HttpErrorResponse, fallback: string): string {
    if (!err?.error) return fallback;
    if (Array.isArray(err.error.message)) return err.error.message.join(' | ');
    if (typeof err.error.message === 'string') return err.error.message;
    return fallback;
  }
}