import { Component, OnInit, inject, signal, computed, ChangeDetectionStrategy, DestroyRef, ViewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule, Router } from '@angular/router';
import { FormBuilder, FormGroup, FormArray, ReactiveFormsModule, Validators, AbstractControl } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom, Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import Swal from 'sweetalert2';

import { FormularioService } from '../../../../core/services/formulario.service';
import { MatricesService } from '../../../../core/services/matrices.service';
import { DependenciasService } from '../../../../core/services/dependencias.service';
import { RangosVariableService } from '../../../../core/services/rangos-variable.service';
import { ToastService } from '../../../../core/services/toast.service';
import { UbicacionesService } from '../../../../core/services/ubicaciones.service';
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
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly formularioService = inject(FormularioService);
  private readonly matricesService = inject(MatricesService);
  private readonly dependenciasService = inject(DependenciasService);
  private readonly rangosVariableService = inject(RangosVariableService);
  private readonly ubicacionesService = inject(UbicacionesService);
  private readonly toastService = inject(ToastService);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  // ✅ ViewChild para matriz-builder
  @ViewChild('matrizBuilder') matrizBuilder?: MatrizBuilderComponent;

  private readonly RANGOS_BALANCE_PREDETERMINADOS = [
    { variable_calculo: 'BALANCE', nombre: 'Crítico / Déficit', valor_min: 0, valor_max: 0, es_vulnerable: true, orden: 1 },
    { variable_calculo: 'BALANCE', nombre: 'Vulnerable', valor_min: 1, valor_max: 200, es_vulnerable: true, orden: 2 },
    { variable_calculo: 'BALANCE', nombre: 'Medio bajo', valor_min: 201, valor_max: 500, es_vulnerable: false, orden: 3 },
    { variable_calculo: 'BALANCE', nombre: 'Medio', valor_min: 501, valor_max: 1000, es_vulnerable: false, orden: 4 },
    { variable_calculo: 'BALANCE', nombre: 'Medio alto', valor_min: 1001, valor_max: 2000, es_vulnerable: false, orden: 5 },
    { variable_calculo: 'BALANCE', nombre: 'Alto / Holgado', valor_min: 2001, valor_max: 999999, es_vulnerable: false, orden: 6 },
  ];

  private readonly SWAL_CUSTOM_CLASS = {
    popup: 'custom-swal-popup',
    confirmButton: 'custom-swal-confirm',
    cancelButton: 'custom-swal-cancel',
    title: 'custom-swal-title',
    denyButton: 'custom-swal-confirm-danger'
  };

  // ✅ Properties para guardar datos de matriz
  private filasGuardar: any[] = [];
  private columnasGuardar: any[] = [];

  readonly formulario = signal<Formulario | null>(null);
  readonly secciones = signal<Seccion[]>([]);
  readonly tiposCampo = signal<TipoCampoForm[]>([]);
  readonly dependencias = signal<PreguntaDependencia[]>([]);
  readonly rangosVariable = signal<RangoVariableCalculada[]>([]);
  readonly isLoading = signal<boolean>(true);

  readonly seccionesColapsadas = signal<Record<string, boolean>>({});

  readonly esSoloLectura = computed(() => this.formulario()?.bloqueado === true);
  readonly tieneRespuestas = computed(() => Boolean((this.formulario() as any)?.tiene_respuestas));

  readonly isSavingSeccion = signal<boolean>(false);
  readonly isSavingQuestion = signal<boolean>(false);
  readonly isSavingRango = signal<boolean>(false);
  readonly showMenuPresets = signal<boolean>(false);
  readonly showRangosPanel = signal<boolean>(false);

  readonly activeSeccionIdForQuestion = signal<string | null>(null);
  readonly editingPreguntaId = signal<string | null>(null);
  readonly esSeccionFinancieraActiva = signal<boolean>(false);
  readonly editingOpcionId = signal<string | null>(null);
  readonly editingRangoId = signal<string | null>(null);
  readonly nuevaOpcionTexto = signal<string>('');

  readonly searchTermRango = signal<string>('');
  readonly filtroVariableRango = signal<string>('TODOS');
  private readonly searchRangoSubject = new Subject<string>();

  draggedSeccionIndex: number | null = null;
  draggedPreguntaIndex: number | null = null;

  readonly rangosFiltrados = computed(() => {
    const term = this.searchTermRango().toLowerCase().trim();
    const variable = this.filtroVariableRango();

    return this.rangosVariable().filter(rango => {
      const coincideTexto = !term ||
        rango.nombre.toLowerCase().includes(term) ||
        (rango.valor_min != null && rango.valor_min.toString().includes(term)) ||
        (rango.valor_max != null && rango.valor_max.toString().includes(term));
      const coincideVariable = variable === 'TODOS' || rango.variable_calculo === variable;
      return coincideTexto && coincideVariable;
    });
  });

  readonly variablesDisponiblesRangos = computed(() => {
    const vars = this.rangosVariable().map(r => r.variable_calculo);
    return Array.from(new Set(vars)).sort();
  });

  readonly hayFiltrosRangosActivos = computed(() => {
    return this.searchTermRango() !== '' || this.filtroVariableRango() !== 'TODOS';
  });

  readonly todasColapsadas = computed(() => {
    const map = this.seccionesColapsadas();
    const list = this.secciones();
    if (list.length === 0) return false;
    return list.every(s => map[s.id] === true);
  });

  rangoForm: FormGroup = this.fb.group({
    variable_calculo: [{ value: 'BALANCE', disabled: true }, Validators.required],
    nombre: ['', [Validators.required, Validators.maxLength(100)]],
    valor_min: [null],
    valor_max: [null],
    es_vulnerable: [false],
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

  get opcionesTempArray(): FormArray { return this.preguntaForm.get('opcionesTemp') as FormArray; }
  get filasTempArray(): FormArray { return this.preguntaForm.get('filasTemp') as FormArray; }
  get columnasTempArray(): FormArray { return this.preguntaForm.get('columnasTemp') as FormArray; }

  getSubOpciones(opcionIndex: number): FormArray { return this.opcionesTempArray.at(opcionIndex).get('subpregunta_opciones') as FormArray; }
  getSubFilas(opcionIndex: number): FormArray { return this.opcionesTempArray.at(opcionIndex).get('subpregunta_filas') as FormArray; }
  getSubColumnas(opcionIndex: number): FormArray { return this.opcionesTempArray.at(opcionIndex).get('subpregunta_columnas') as FormArray; }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.cargarTodo(id);
      this.escucharCambioTipoSeccion();
    } else {
      this.toastService.show('Formulario no encontrado. Redirigiendo...', 'warning');
      this.router.navigate(['/admin/formularios']);
    }

    this.searchRangoSubject.pipe(
      debounceTime(350),
      distinctUntilChanged(),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(term => {
      this.searchTermRango.set(term);
    });
  }

  // ✅ Métodos para capturar datos de matriz
  onGuardarFilas(filas: any[]): void {
    this.filasGuardar = filas;
  }

  onGuardarColumnas(columnas: any[]): void {
    this.columnasGuardar = columnas;
  }

  escucharCambioTipoSeccion(): void {
    this.seccionForm.get('tipo_seccion')?.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((tipo: string) => {
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
      error: (err) => {
        console.error('Error al cargar tipos de campo:', err);
        this.toastService.show('Error al cargar los tipos de campo.', 'error');
      }
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
      error: () => {
        this.toastService.show('Error al cargar el formulario.', 'error');
        this.router.navigate(['/admin/formularios']);
      }
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
        this.toastService.show('Error al cargar secciones.', 'error');
        this.isLoading.set(false);
      }
    });
  }

  private verificarSiSePuedeEliminar(): boolean {
    if (this.esSoloLectura()) {
      this.toastService.show('El formulario está bloqueado (versión anterior).', 'warning');
      return false;
    }
    if (this.tieneRespuestas()) {
      Swal.fire({
        title: '¡Acción Bloqueada!',
        text: 'No puedes eliminar este elemento porque el formulario ya tiene fichas respondidas por estudiantes. Eliminarlo corrompería los datos históricos.',
        icon: 'error',
        confirmButtonText: 'Entendido',
        customClass: this.SWAL_CUSTOM_CLASS
      });
      return false;
    }
    return true;
  }

  toggleSeccionColapso(seccionId: string): void {
    this.seccionesColapsadas.update(map => ({ ...map, [seccionId]: !map[seccionId] }));
  }

  toggleTodasSecciones(): void {
    const colapsar = !this.todasColapsadas();
    const nuevoMap: Record<string, boolean> = {};
    this.secciones().forEach(s => { nuevoMap[s.id] = colapsar; });
    this.seccionesColapsadas.set(nuevoMap);
  }

  isSeccionColapsada(seccionId: string): boolean { return !!this.seccionesColapsadas()[seccionId]; }

  moverSeccion(index: number, direccion: 'UP' | 'DOWN'): void {
    if (this.esSoloLectura()) return;
    const lista = [...this.secciones()];
    const targetIndex = direccion === 'UP' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= lista.length) return;

    const temp = lista[index];
    lista[index] = lista[targetIndex];
    lista[targetIndex] = temp;

    const reordenadas = lista.map((sec, idx) => ({ ...sec, orden: idx + 1 }));
    this.secciones.set(reordenadas);

    const payload = reordenadas.map(s => ({ id: s.id, orden: s.orden }));
    this.formularioService.reordenarSecciones(this.formulario()!.id, payload).subscribe({
      next: () => this.toastService.show('Orden de sección actualizado correctamente.', 'success'),
      error: (err) => this.toastService.show(this.extraerMensajeError(err, 'Error reordenando secciones.'), 'error')
    });
  }

  onSearchRangoChange(event: Event): void { this.searchRangoSubject.next((event.target as HTMLInputElement).value); }
  onVariableRangoChange(event: Event): void { this.filtroVariableRango.set((event.target as HTMLSelectElement).value); }

  limpiarFiltrosRangos(): void {
    this.searchTermRango.set('');
    this.filtroVariableRango.set('TODOS');
    this.searchRangoSubject.next('');
    const searchInput = document.getElementById('search-rango-input') as HTMLInputElement;
    if (searchInput) searchInput.value = '';
    this.toastService.show('Filtros de rangos limpiados.', 'info');
  }

  async generarSeccionPerfilPlantilla(): Promise<void> {
    if (this.esSoloLectura() || !this.formulario()) return;

    const result = await Swal.fire({
      title: '¿Generar Sección de Perfil Completa?',
      text: 'Se crearán todas las preguntas del perfil sociodemográfico.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: '<i class="fas fa-magic"></i> Sí, generar',
      cancelButtonText: 'Cancelar',
      customClass: this.SWAL_CUSTOM_CLASS
    });

    if (!result.isConfirmed) return;

    this.isSavingSeccion.set(true);

    try {
      const payloadSeccion = {
        formulario_id: this.formulario()!.id,
        nombre: '1. DATOS GENERALES DEL ESTUDIANTE',
        descripcion: 'Verifique que sus datos precargados sean correctos.',
        tipo_seccion: 'INFORMACION_GENERAL' as const,
        subcategoria_financiera: 'NINGUNO' as const,
        orden: 1
      };

      const nuevaSeccion = await firstValueFrom(this.formularioService.createSeccion(payloadSeccion));
      if (!nuevaSeccion?.id) throw new Error('No se pudo crear la sección');

      const tipoTexto = this.tiposCampo().find(t => t.nombre === 'TEXTO')?.id || this.tiposCampo()[0].id;
      const tipoFecha = this.tiposCampo().find(t => t.nombre === 'FECHA')?.id || tipoTexto;

      const preguntasPlantilla = [
        { enunciado: 'Número de Cédula o Pasaporte', tipo_campo_id: tipoTexto },
        { enunciado: 'Nombres Completos', tipo_campo_id: tipoTexto },
        { enunciado: 'Apellidos Completos', tipo_campo_id: tipoTexto },
        { enunciado: 'Número Celular', tipo_campo_id: tipoTexto },
        { enunciado: 'Correo Electrónico Institucional', tipo_campo_id: tipoTexto },
        { enunciado: 'Fecha de Nacimiento', tipo_campo_id: tipoFecha },
        { enunciado: 'Nacionalidad', tipo_campo_id: tipoTexto },
        { enunciado: 'País, Provincia y Ciudad de Nacimiento', tipo_campo_id: tipoTexto },
        { enunciado: 'Sexo y Estado de Gestación', tipo_campo_id: tipoTexto },
        { enunciado: 'Género', tipo_campo_id: tipoTexto },
        { enunciado: 'Estado Civil', tipo_campo_id: tipoTexto },
        { enunciado: '¿Tiene Hijos? (Menores de 5 años)', tipo_campo_id: tipoTexto },
        { enunciado: 'Etnia / Pueblo o Nacionalidad', tipo_campo_id: tipoTexto },
        { enunciado: 'Idioma(s)', tipo_campo_id: tipoTexto }
      ];

      let ordenPregunta = 1;
      for (const p of preguntasPlantilla) {
        await firstValueFrom(this.formularioService.createPregunta({
          seccion_id: nuevaSeccion.id,
          orden: ordenPregunta++,
          enunciado: p.enunciado,
          tipo_campo_id: p.tipo_campo_id,
          categoria_financiera: 'NINGUNO',
          es_obligatorio: true,
          requiere_evidencia: false,
          revision_manual_obligatoria: false
        }));
      }

      this.toastService.show('Sección de Perfil generada con éxito.', 'success');
      this.cargarSecciones(this.formulario()!.id);

    } catch (error: any) {
      this.toastService.show('Ocurrió un error al generar la plantilla.', 'error');
      console.error(error);
    } finally {
      this.isSavingSeccion.set(false);
    }
  }

  abrirModalNuevaSeccion(): void {
    if (this.esSoloLectura()) {
      this.toastService.show('Esta ficha es una versión anterior bloqueada; solo puede visualizarse.', 'info');
      return;
    }

    Swal.fire({
      title: 'Nueva Sección',
      html: `
      <div class="swal-form-card">
        <div style="text-align:left; display:flex; flex-direction:column; gap:1.25rem;">
          <div>
            <label class="swal-form-label">Nombre de Sección *</label>
            <input id="swal-nombre" class="swal2-input custom-input" placeholder="Ej: Información Financiera Familiar" style="margin:0;width:100%;box-sizing:border-box">
          </div>
          <div>
            <label class="swal-form-label">Descripción</label>
            <input id="swal-descripcion" class="swal2-input custom-input" placeholder="Breve explicación..." style="margin:0;width:100%;box-sizing:border-box">
          </div>
          <div>
            <label class="swal-form-label">Tipo de Sección *</label>
            <select id="swal-tipo" class="swal2-select custom-select" style="margin:0;width:100%;box-sizing:border-box">
              <option value="INFORMACION_GENERAL">Información General</option>
              <option value="FINANCIERA">Sección Financiera (Balances / Montos)</option>
            </select>
          </div>
          <div id="swal-subcat-container" style="display:none">
            <label class="swal-form-label">Subcategoría Financiera *</label>
            <select id="swal-subcat" class="swal2-select custom-select" style="margin:0;width:100%;box-sizing:border-box">
              <option value="INGRESOS">Exclusivamente Ingresos</option>
              <option value="GASTOS">Exclusivamente Egresos / Gastos</option>
              <option value="AMBOS">Ambos (Ingresos y Gastos)</option>
            </select>
          </div>
        </div>
      </div>
    `,
      showCancelButton: true,
      focusConfirm: false,
      confirmButtonText: '<i class="fas fa-save"></i> Guardar Sección',
      cancelButtonText: '<i class="fas fa-times"></i> Cancelar',
      width: '520px',
      customClass: this.SWAL_CUSTOM_CLASS,
      showLoaderOnConfirm: true,
      didOpen: () => {
        const tipoEl = document.getElementById('swal-tipo') as HTMLSelectElement | null;
        const subcatCont = document.getElementById('swal-subcat-container');
        tipoEl?.addEventListener('change', () => {
          if (subcatCont) subcatCont.style.display = tipoEl.value === 'FINANCIERA' ? 'block' : 'none';
        });
        (document.getElementById('swal-nombre') as HTMLInputElement | null)?.focus();
      },
      preConfirm: async () => {
        const nombre = (document.getElementById('swal-nombre') as HTMLInputElement)?.value?.trim() || '';
        const descripcion = (document.getElementById('swal-descripcion') as HTMLInputElement)?.value?.trim() || '';
        const tipo_seccion = (document.getElementById('swal-tipo') as HTMLSelectElement)?.value || 'INFORMACION_GENERAL';
        let subcategoria_financiera = (document.getElementById('swal-subcat') as HTMLSelectElement)?.value || 'NINGUNO';

        if (!nombre) {
          Swal.showValidationMessage('El nombre de la sección es obligatorio');
          return false;
        }
        if (tipo_seccion !== 'FINANCIERA') subcategoria_financiera = 'NINGUNO';

        try {
          await this.guardarSeccionDesdeSwal({ nombre, descripcion, tipo_seccion, subcategoria_financiera });
          return true;
        } catch (err: any) {
          const msg = this.extraerMensajeError(err, 'No se pudo crear la sección.');
          Swal.showValidationMessage(`Error: ${msg}`);
          return false;
        }
      }
    }).then((result) => {
      if (result.isConfirmed) {
        this.toastService.show('Sección creada exitosamente.', 'success');
      }
    });
  }

  private guardarSeccionDesdeSwal(data: { nombre: string; descripcion: string; tipo_seccion: string; subcategoria_financiera: string; }): Promise<Seccion> {
    this.isSavingSeccion.set(true);

    const payload = {
      formulario_id: this.formulario()!.id,
      nombre: data.nombre,
      descripcion: data.descripcion || '',
      tipo_seccion: data.tipo_seccion as 'INFORMACION_GENERAL' | 'FINANCIERA',
      subcategoria_financiera: data.subcategoria_financiera as 'NINGUNO' | 'INGRESOS' | 'GASTOS' | 'AMBOS',
      orden: this.secciones().length + 1
    };

    return new Promise((resolve, reject) => {
      this.formularioService.createSeccion(payload).subscribe({
        next: (nuevaSeccion) => {
          this.isSavingSeccion.set(false);
          this.cargarSecciones(this.formulario()!.id);
          resolve(nuevaSeccion);
        },
        error: (err: HttpErrorResponse) => {
          this.isSavingSeccion.set(false);
          reject(err);
        }
      });
    });
  }

  abrirModalEditarSeccion(seccion: Seccion): void {
    if (this.esSoloLectura()) return;

    Swal.fire({
      title: 'Editar Sección',
      html: `
      <div class="swal-form-card">
        <div style="text-align:left; display:flex; flex-direction:column; gap:1.25rem;">
          <div>
            <label class="swal-form-label">Nombre / Título de Sección *</label>
            <input id="swal-edit-nombre" class="swal2-input custom-input" value="${this.escapeHtml(seccion.nombre)}" style="margin:0;width:100%;box-sizing:border-box">
          </div>
          <div>
            <label class="swal-form-label">Descripción de Sección</label>
            <textarea id="swal-edit-descripcion" class="swal2-textarea custom-input" rows="3" style="margin:0;width:100%;box-sizing:border-box;resize:vertical">${this.escapeHtml(seccion.descripcion || '')}</textarea>
          </div>
        </div>
      </div>
      `,
      showCancelButton: true,
      confirmButtonText: '<i class="fas fa-save"></i> Actualizar',
      cancelButtonText: '<i class="fas fa-times"></i> Cancelar',
      width: '500px',
      customClass: this.SWAL_CUSTOM_CLASS,
      showLoaderOnConfirm: true,
      didOpen: () => {
        (document.getElementById('swal-edit-nombre') as HTMLInputElement | null)?.focus();
      },
      preConfirm: async () => {
        const nombre = (document.getElementById('swal-edit-nombre') as HTMLInputElement)?.value?.trim() || '';
        const descripcion = (document.getElementById('swal-edit-descripcion') as HTMLTextAreaElement)?.value?.trim() || '';

        if (!nombre) {
          Swal.showValidationMessage('El título de la sección es obligatorio');
          return false;
        }

        try {
          await this.actualizarSeccion(seccion, { nombre, descripcion });
          return true;
        } catch (err: any) {
          const msg = this.extraerMensajeError(err, 'No se pudo actualizar la sección.');
          Swal.showValidationMessage(`Error: ${msg}`);
          return false;
        }
      }
    }).then((result) => {
      if (result.isConfirmed) {
        this.toastService.show('Sección actualizada con éxito.', 'success');
      }
    });
  }

  private actualizarSeccion(seccionOriginal: Seccion, data: { nombre: string; descripcion: string }): Promise<Seccion> {
    this.isSavingSeccion.set(true);

    const payload = {
      nombre: data.nombre,
      descripcion: data.descripcion,
      formulario_id: this.formulario()!.id,
      tipo_seccion: seccionOriginal.tipo_seccion,
      subcategoria_financiera: seccionOriginal.subcategoria_financiera,
      orden: seccionOriginal.orden
    };

    return new Promise((resolve, reject) => {
      this.formularioService.updateSeccion(seccionOriginal.id, payload).subscribe({
        next: (seccionActualizada) => {
          this.isSavingSeccion.set(false);
          this.secciones.update(secs => secs.map(s => {
            if (s.id === seccionOriginal.id) {
              return { ...s, ...(seccionActualizada || {}), nombre: data.nombre, descripcion: data.descripcion };
            }
            return s;
          }));
          resolve(seccionActualizada);
        },
        error: (err: HttpErrorResponse) => {
          this.isSavingSeccion.set(false);
          reject(err);
        }
      });
    });
  }

  eliminarSeccion(seccionId: string, index: number): void {
    if (this.isSavingSeccion() || !this.verificarSiSePuedeEliminar()) return;

    Swal.fire({
      title: '¿Eliminar sección?',
      text: 'Se eliminarán también todas sus preguntas. Esta acción no se puede deshacer.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: '<i class="fas fa-trash-alt"></i> Sí, eliminar',
      cancelButtonText: '<i class="fas fa-times"></i> Cancelar',
      customClass: {
        popup: 'custom-swal-popup',
        confirmButton: 'custom-swal-confirm-danger',
        cancelButton: 'custom-swal-cancel',
        title: 'custom-swal-title'
      }
    }).then((result) => {
      if (result.isConfirmed) {
        if (seccionId) {
          this.isSavingSeccion.set(true);
          this.formularioService.deleteSeccion(seccionId).subscribe({
            next: () => {
              this.isSavingSeccion.set(false);
              this.toastService.show('Sección eliminada.', 'info');
              this.secciones.update(secs => secs.filter((_, i) => i !== index));
            },
            error: (err: HttpErrorResponse) => {
              this.isSavingSeccion.set(false);
              const errorReal = this.extraerMensajeError(err, 'No se pudo eliminar la sección por reglas de base de datos.');

              Swal.fire({
                title: 'Acción Rechazada',
                text: errorReal,
                icon: 'error',
                confirmButtonText: 'Entendido',
                customClass: this.SWAL_CUSTOM_CLASS
              });
            }
          });
        } else {
          this.secciones.update(secs => secs.filter((_, i) => i !== index));
          this.toastService.show('Sección removida.', 'info');
        }
      }
    });
  }

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

  abrirFormPregunta(seccionId: string, autoScroll = true): void {
    if (this.esSoloLectura()) {
      this.toastService.show('Esta ficha es una versión anterior bloqueada.', 'info');
      return;
    }

    this.seccionesColapsadas.update(map => ({ ...map, [seccionId]: false }));

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

    if (autoScroll) {
      setTimeout(() => {
        const box = document.getElementById(`pregunta-box-${seccionId}`);
        if (box) {
          box.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 100);
    }
  }

  abrirEditarPregunta(pregunta: Pregunta, seccionId: string): void {
    if (this.esSoloLectura()) {
      this.toastService.show('Esta ficha es una versión anterior bloqueada.', 'info');
      return;
    }

    if (this.formulario()?.id) {
      this.dependenciasService.getDependenciasByFormulario(this.formulario()!.id).subscribe({
        next: (deps) => {
          this.dependencias.set(deps);
          this.poblarFormularioEdicion(pregunta, seccionId);
        },
        error: () => this.poblarFormularioEdicion(pregunta, seccionId)
      });
    } else {
      this.poblarFormularioEdicion(pregunta, seccionId);
    }
  }

  private poblarFormularioEdicion(pregunta: Pregunta, seccionId: string): void {
    this.seccionesColapsadas.update(map => ({ ...map, [seccionId]: false }));

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
      (pregunta.filasMatriz || []).forEach(f => this.filasTempArray.push(this.fb.group({ id: [f.id], texto_fila: [f.texto_fila, Validators.required], es_multiple: [f.es_multiple ?? false] })));
      (pregunta.columnasMatriz || []).forEach(c => this.columnasTempArray.push(this.fb.group({ id: [c.id], texto_columna: [c.texto_columna, Validators.required] })));
    }
  }

  cancelarPregunta(): void {
    this.activeSeccionIdForQuestion.set(null);
    this.editingPreguntaId.set(null);
    this.editingOpcionId.set(null);
    this.toastService.show('Formulario de pregunta cerrado.', 'info');
  }

  eliminarPregunta(preguntaId: string, seccionId: string): void {
    if (this.isSavingQuestion() || !this.verificarSiSePuedeEliminar()) return;

    Swal.fire({
      title: '¿Eliminar pregunta?',
      text: 'Esta acción no se puede deshacer.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: '<i class="fas fa-trash-alt"></i> Sí, eliminar',
      cancelButtonText: '<i class="fas fa-times"></i> Cancelar',
      customClass: {
        popup: 'custom-swal-popup',
        confirmButton: 'custom-swal-confirm-danger',
        cancelButton: 'custom-swal-cancel',
        title: 'custom-swal-title'
      }
    }).then((result) => {
      if (result.isConfirmed) {
        this.isSavingQuestion.set(true);
        this.formularioService.deletePregunta(preguntaId).subscribe({
          next: () => {
            this.isSavingQuestion.set(false);
            this.toastService.show('Pregunta eliminada correctamente.', 'info');
            this.cargarPreguntasDeSeccion(seccionId);
          },
          error: (err: HttpErrorResponse) => {
            this.isSavingQuestion.set(false);
            const errorReal = this.extraerMensajeError(err, 'No se pudo eliminar la pregunta.');

            Swal.fire({
              title: 'No se puede eliminar',
              text: errorReal,
              icon: 'error',
              confirmButtonText: 'Entendido',
              customClass: this.SWAL_CUSTOM_CLASS
            });
          }
        });
      }
    });
  }

  guardarPregunta(seccionId: string): void {
    if (this.esSoloLectura() || this.isSavingQuestion()) return;
    if (this.preguntaForm.invalid) {
      this.toastService.show('Por favor completa todos los campos requeridos de la pregunta.', 'warning');
      return;
    }

    // ✅ Recopilar datos de matriz si existe
    if (this.matrizBuilder) {
      this.matrizBuilder.guardarMatriz();
    }

    const formValue = this.preguntaForm.getRawValue();
    const seccionPadre = this.secciones().find(s => s.id === seccionId);
    const esFinanciera = seccionPadre?.tipo_seccion === 'FINANCIERA';

    let tipoCampoIdFinal = formValue.tipo_campo_id;
    if (!tipoCampoIdFinal || typeof tipoCampoIdFinal !== 'string' || tipoCampoIdFinal.trim() === '') {
      const fallbackTipo = this.tiposCampo().find(t => t.nombre.toUpperCase().includes('NUMER')) || this.tiposCampo()[0];
      if (fallbackTipo) tipoCampoIdFinal = fallbackTipo.id;
      else {
        this.toastService.show('Error: No hay tipos de campo cargados.', 'error');
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
        ...(this.esTipoMatriz(tipoCampoIdFinal) ? {
          filasMatriz: this.filasGuardar,
          columnasMatriz: this.columnasGuardar,
        } : {}),
      };

      this.formularioService.updatePregunta(preguntaIdEditando, payloadUpdate).subscribe({
        next: async () => {
          try {
            if (this.esTipoSeleccion(tipoCampoIdFinal)) await this.sincronizarOpcionesYSubpreguntas(preguntaIdEditando, seccionId, formValue.opcionesTemp || []);
            if (this.esTipoMatriz(tipoCampoIdFinal)) await this.eliminarFilasColumnasQuitadas(preguntaIdEditando, this.filasGuardar, this.columnasGuardar);

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
            this.isSavingQuestion.set(false);
            this.toastService.show(error?.message || 'Fallo al guardar una opción o subpregunta.', 'error');
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
      filasMatriz: this.filasGuardar,
      columnasMatriz: this.columnasGuardar,
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

              if (opc.dispara_dependencia) {
                const subTipoId = opc.subpregunta_tipo_id && String(opc.subpregunta_tipo_id).trim() !== '' ? opc.subpregunta_tipo_id : tipoCampoIdFinal;
                if (!subTipoId) throw new Error('Falta el tipo de campo de la subpregunta.');

                const enunciadoSub = opc.subpregunta_enunciado?.trim() || `Especifique detalle para ${opc.texto_opcion.trim()}`;

                const subpreguntaGuardada = await firstValueFrom(
                  this.formularioService.createPregunta({
                    seccion_id: seccionId,
                    orden: orden + i + 1,
                    enunciado: enunciadoSub,
                    tipo_campo_id: subTipoId,
                    categoria_financiera: opc.subpregunta_categoria_financiera || 'NINGUNO',
                    es_obligatorio: Boolean(opc.subpregunta_es_obligatorio),
                    requiere_evidencia: Boolean(opc.subpregunta_requiere_evidencia),
                    revision_manual_obligatoria: Boolean(opc.subpregunta_revision_manual),
                  })
                );

                if (!subpreguntaGuardada?.id) throw new Error('La subpregunta no se creó.');

                await firstValueFrom(
                  this.dependenciasService.createDependencia({
                    pregunta_disparadora_id: preguntaCreada.id,
                    opcion_disparadora_id: opcionGuardada.id,
                    pregunta_id: subpreguntaGuardada.id,
                  })
                );

                if (this.esTipoSeleccion(subTipoId) && opc.subpregunta_opciones?.length > 0) {
                  for (let j = 0; j < opc.subpregunta_opciones.length; j++) {
                    const subOpc = opc.subpregunta_opciones[j];
                    if (!subOpc.texto_opcion?.trim()) continue;
                    await firstValueFrom(this.formularioService.createOpcion({
                      pregunta_id: subpreguntaGuardada.id,
                      texto_opcion: subOpc.texto_opcion.trim(),
                      orden: j + 1,
                      valor_ponderado: subOpc.valor_ponderado ? Number(subOpc.valor_ponderado) : 0,
                      es_correcta: Boolean(subOpc.es_correcta),
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
          this.isSavingQuestion.set(false);
          this.toastService.show(error?.message || 'Fallo una opción o subpregunta.', 'error');
          this.cancelarPregunta();
          this.cargarPreguntasDeSeccion(seccionId);
        }
      },
      error: (err: HttpErrorResponse) => {
        this.isSavingQuestion.set(false);
        this.toastService.show(this.extraerMensajeError(err, 'Error de validación al guardar la pregunta.'), 'error');
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
        texto_opcion: opc.texto_opcion.trim(),
        orden: i + 1,
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

      if (opc.dispara_dependencia) {
        const subTipoId = opc.subpregunta_tipo_id || (this.tiposCampo()[0]?.id || '');
        const enunciadoSub = opc.subpregunta_enunciado?.trim() || `Especifique detalle para ${opc.texto_opcion.trim()}`;

        const payloadSub = {
          enunciado: enunciadoSub,
          tipo_campo_id: subTipoId,
          categoria_financiera: opc.subpregunta_categoria_financiera || 'NINGUNO',
          es_obligatorio: Boolean(opc.subpregunta_es_obligatorio),
          requiere_evidencia: Boolean(opc.subpregunta_requiere_evidencia),
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
          texto_opcion: so.texto_opcion.trim(),
          orden: j + 1,
          valor_ponderado: so.valor_ponderado ? Number(so.valor_ponderado) : 0,
          es_correcta: Boolean(so.es_correcta),
          permite_texto_libre: Boolean(so.permite_texto_libre),
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

  // Solo elimina filas/columnas que el usuario quitó del builder;
  // la creación/actualización ya la hace el backend vía payloadUpdate en guardarPregunta.
  private async eliminarFilasColumnasQuitadas(preguntaId: string, filasTemp: any[], columnasTemp: any[]): Promise<void> {
    const preguntaOriginal = this.secciones().flatMap(s => s.preguntas || []).find(p => p.id === preguntaId);
    const idsFilasForm = filasTemp.filter(f => f.id).map(f => f.id);
    const idsColsForm = columnasTemp.filter(c => c.id).map(c => c.id);

    for (const f of preguntaOriginal?.filasMatriz || []) {
      if (f.id && !idsFilasForm.includes(f.id)) await firstValueFrom(this.matricesService.deleteFila(f.id));
    }
    for (const c of preguntaOriginal?.columnasMatriz || []) {
      if (c.id && !idsColsForm.includes(c.id)) await firstValueFrom(this.matricesService.deleteColumna(c.id));
    }
  }

  agregarOpcionTemp(texto = '', valorPonderado: number | null = null): void {
    const tipoTexto = this.tiposCampo().find(t => t.nombre.toUpperCase().includes('TEXTO')) || this.tiposCampo()[0];
    this.opcionesTempArray.push(this.fb.group({
      id: [null],
      texto_opcion: [texto, Validators.required],
      permite_texto_libre: [false],
      valor_ponderado: [valorPonderado],
      es_correcta: [false],
      dispara_dependencia: [false],
      subpregunta_id: [null],
      subpregunta_enunciado: [''],
      subpregunta_tipo_id: [tipoTexto ? tipoTexto.id : ''],
      subpregunta_categoria_financiera: ['NINGUNO'],
      subpregunta_requiere_evidencia: [false],
      subpregunta_es_obligatorio: [false],
      subpregunta_revision_manual: [false],
      subpregunta_opciones: this.fb.array([]),
      subpregunta_filas: this.fb.array([]),
      subpregunta_columnas: this.fb.array([])
    }));
  }

  eliminarOpcionTemp(index: number): void {
    this.opcionesTempArray.removeAt(index);
    this.toastService.show('Opción temporal removida.', 'info');
  }

  agregarSubOpcion(opcionIndex: number, texto = ''): void {
    this.getSubOpciones(opcionIndex).push(this.fb.group({ texto_opcion: [texto, Validators.required], valor_ponderado: [0], es_correcta: [false], permite_texto_libre: [false] }));
  }

  eliminarSubOpcion(opcionIndex: number, subIndex: number): void {
    this.getSubOpciones(opcionIndex).removeAt(subIndex);
  }

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
      case 'EDAD': presetData = [{ texto: 'Menor de 5 años' }, { texto: '6 a 12 años' }, { texto: '13 a 18 años' }, { texto: 'Mayor de 65 años' }]; break;
      case 'SI_NO': presetData = [{ texto: 'Sí' }, { texto: 'No' }]; break;
      case 'INGRESOS': presetData = [{ texto: 'Menos de $400' }, { texto: '$401 a $800' }, { texto: 'Más de $800' }]; break;
      case 'VIVIENDA': presetData = [{ texto: 'Propia' }, { texto: 'Arrendada' }, { texto: 'Cedida' }]; break;
    }
    presetData.forEach(item => this.agregarOpcionTemp(item.texto, item.pts || null));
    this.toastService.show(`Plantilla "${tipo}" cargada en las opciones.`, 'success');
  }

  async cargarCatalogoEnOpciones(tipo: 'PAISES' | 'PROVINCIAS_ECUADOR'): Promise<void> {
    this.showMenuPresets.set(false);
    this.toastService.show('Consultando base de datos...', 'info');

    try {
      if (tipo === 'PAISES') {
        const paises = await firstValueFrom(this.ubicacionesService.getPaises());
        this.opcionesTempArray.clear();
        paises.forEach((p: any) => this.agregarOpcionTemp(p.nombre, 0));
        this.toastService.show(`Se cargaron ${paises.length} países automáticamente.`, 'success');
      } else if (tipo === 'PROVINCIAS_ECUADOR') {
        const paises = await firstValueFrom(this.ubicacionesService.getPaises());
        const ecuador = paises.find((p: any) => p.nombre.toUpperCase().includes('ECUADOR'));
        if (!ecuador) {
          this.toastService.show('No se encontró Ecuador en la base de datos.', 'warning');
          return;
        }
        const provincias = await firstValueFrom(this.ubicacionesService.getProvincias(ecuador.id));
        this.opcionesTempArray.clear();
        provincias.forEach((prov: any) => this.agregarOpcionTemp(prov.nombre, 0));
        this.toastService.show(`Se cargaron ${provincias.length} provincias.`, 'success');
      }
    } catch (error) {
      console.error(error);
      this.toastService.show('Error al conectar con la base de datos.', 'error');
    }
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
    if (!this.verificarSiSePuedeEliminar()) return;
    this.formularioService.deleteOpcion(opcionId).subscribe({
      next: () => { this.toastService.show('Opción eliminada.', 'info'); this.cargarOpcionesPregunta(preguntaId); },
      error: (err: HttpErrorResponse) => this.toastService.show(this.extraerMensajeError(err, 'No se pudo eliminar la opción.'), 'error')
    });
  }

  abrirEditarOpcion(opcion: OpcionPregunta): void {
    if (this.esSoloLectura() || !opcion.id) return;
    this.editingOpcionId.set(opcion.id);
    this.editarOpcionForm.reset({
      texto_opcion: opcion.texto_opcion,
      valor_ponderado: opcion.valor_ponderado || 0,
      puntaje_riesgo: opcion.puntaje_riesgo || 0,
      es_correcta: Boolean(opcion.es_correcta),
      permite_texto_libre: Boolean(opcion.permite_texto_libre)
    });
  }

  cancelarEdicionOpcion(): void {
    this.editingOpcionId.set(null);
    this.toastService.show('Edición de opción cancelada.', 'info');
  }

  guardarEdicionOpcion(preguntaId: string): void {
    if (this.esSoloLectura()) return;
    const opcionId = this.editingOpcionId();
    if (!opcionId || this.editarOpcionForm.invalid) return;

    const raw = this.editarOpcionForm.getRawValue();
    const payload = {
      texto_opcion: String(raw.texto_opcion).trim(),
      valor_ponderado: raw.valor_ponderado ? Number(raw.valor_ponderado) : 0,
      puntaje_riesgo: raw.puntaje_riesgo ? Number(raw.puntaje_riesgo) : 0,
      es_correcta: Boolean(raw.es_correcta),
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

  agregarFilaMatriz(event: { preguntaId: string; texto: string; es_multiple: boolean }): void {
    if (this.esSoloLectura()) return;
    this.matricesService.createFila({
      pregunta_id: event.preguntaId,
      texto_fila: event.texto,
      es_multiple: event.es_multiple
    }).subscribe({
      next: () => {
        this.toastService.show('Fila agregada a la matriz.', 'success');
        this.cargarMatrizDetalles(event.preguntaId);
      },
      error: (err: HttpErrorResponse) => this.toastService.show(this.extraerMensajeError(err, 'No se pudo agregar la fila.'), 'error')
    });
  }

  // 🔧 CORREGIDO: recibe preguntaId como segundo parámetro (igual que eliminarFilaExistente),
  // porque el evento actualizarFila solo trae { filaId, es_multiple }, no el preguntaId.
  actualizarFilaExistente(event: { filaId: string; es_multiple: boolean }, preguntaId: string): void {
    if (this.esSoloLectura()) return;
    this.matricesService.updateFila(event.filaId, { es_multiple: event.es_multiple }).subscribe({
      next: () => {
        this.toastService.show('Fila actualizada.', 'success');
        this.cargarMatrizDetalles(preguntaId);
      },
      error: (err: HttpErrorResponse) => this.toastService.show(this.extraerMensajeError(err, 'No se pudo actualizar la fila.'), 'error')
    });
  }

  eliminarFilaExistente(filaId: string, preguntaId: string): void {
    if (!this.verificarSiSePuedeEliminar()) return;
    this.matricesService.deleteFila(filaId).subscribe({
      next: () => {
        this.toastService.show('Fila eliminada.', 'info');
        this.cargarMatrizDetalles(preguntaId);
      },
      error: (err: HttpErrorResponse) => this.toastService.show(this.extraerMensajeError(err, 'No se pudo eliminar la fila.'), 'error')
    });
  }

  agregarColumnaMatriz(event: { preguntaId: string; texto: string }): void {
    if (this.esSoloLectura()) return;
    this.matricesService.createColumna({ pregunta_id: event.preguntaId, texto_columna: event.texto }).subscribe({
      next: () => {
        this.toastService.show('Columna agregada a la matriz.', 'success');
        this.cargarMatrizDetalles(event.preguntaId);
      }
    });
  }

  eliminarColumnaExistente(columnaId: string, preguntaId: string): void {
    if (!this.verificarSiSePuedeEliminar()) return;
    this.matricesService.deleteColumna(columnaId).subscribe({
      next: () => {
        this.toastService.show('Columna eliminada.', 'info');
        this.cargarMatrizDetalles(preguntaId);
      },
      error: (err: HttpErrorResponse) => this.toastService.show(this.extraerMensajeError(err, 'No se pudo eliminar la columna.'), 'error')
    });
  }

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
      next: () => this.toastService.show('Preguntas reordenadas exitosamente.', 'success'),
      error: (err) => {
        console.error('Error al persistir el reordenamiento:', err);
        this.toastService.show('Error al guardar el reordenamiento.', 'error');
      }
    });
  }

  cargarRangosVariable(formularioId: string): void {
    this.rangosVariableService.getByFormulario(formularioId).subscribe({
      next: (rangos) => this.rangosVariable.set(rangos),
      error: (err) => console.error('Error al cargar rangos:', err)
    });
  }

  cargarRangosBalancePredeterminados(): void {
    if (this.esSoloLectura() || !this.formulario() || this.isSavingRango()) return;

    if (this.rangosVariable().length > 0) {
      Swal.fire({
        title: 'Rangos existentes',
        text: 'Ya existen rangos. ¿Deseas agregar los predeterminados de BALANCE de todas formas?',
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: '<i class="fas fa-plus"></i> Sí, agregar',
        cancelButtonText: '<i class="fas fa-times"></i> Cancelar',
        customClass: this.SWAL_CUSTOM_CLASS
      }).then((result) => {
        if (result.isConfirmed) this.ejecutarCargaRangosPredeterminados();
      });
    } else {
      this.ejecutarCargaRangosPredeterminados();
    }
  }

  private ejecutarCargaRangosPredeterminados(): void {
    this.isSavingRango.set(true);
    const formularioId = this.formulario()!.id;
    let pendientes = this.RANGOS_BALANCE_PREDETERMINADOS.length;
    let errores = 0;

    this.RANGOS_BALANCE_PREDETERMINADOS.forEach((rango, index) => {
      const payload = {
        variable_calculo: rango.variable_calculo,
        nombre: rango.nombre,
        valor_min: rango.valor_min,
        valor_max: rango.valor_max,
        es_vulnerable: rango.es_vulnerable,
        orden: this.rangosVariable().length + index + 1,
        formulario_id: formularioId,
      };

      this.rangosVariableService.createRango(payload).subscribe({
        next: () => {
          pendientes--;
          if (pendientes === 0) {
            this.isSavingRango.set(false);
            this.cargarRangosVariable(formularioId);
            if (errores === 0) this.toastService.show('Rangos cargados correctamente.', 'success');
            else this.toastService.show(`Cargados con ${errores} error(es).`, 'warning');
          }
        },
        error: () => {
          errores++; pendientes--;
          if (pendientes === 0) {
            this.isSavingRango.set(false);
            this.cargarRangosVariable(formularioId);
            this.toastService.show('Algunos rangos no se pudieron crear.', 'error');
          }
        },
      });
    });
  }

  guardarRangoVariable(): void {
    if (this.esSoloLectura() || this.rangoForm.invalid || !this.formulario() || this.isSavingRango()) return;

    const raw = this.rangoForm.getRawValue();
    const idEdit = this.editingRangoId();
    const valorMin = raw.valor_min != null && raw.valor_min !== '' ? Number(raw.valor_min) : 0;
    const valorMax = raw.valor_max != null && raw.valor_max !== '' ? Number(raw.valor_max) : 999999;
    const esVulnerable = Boolean(raw.es_vulnerable);

    const errorLocal = this.validarRangoLocal(valorMin, valorMax, String(raw.nombre).trim(), idEdit);
    if (errorLocal) {
      this.toastService.show(errorLocal, 'warning');
      return;
    }

    this.isSavingRango.set(true);

    if (idEdit) {
      const payloadUpdate = {
        variable_calculo: 'BALANCE',
        nombre: String(raw.nombre).trim(),
        valor_min: valorMin,
        valor_max: valorMax,
        es_vulnerable: esVulnerable,
        orden: raw.orden != null ? Number(raw.orden) : 1,
      };
      this.rangosVariableService.updateRango(idEdit, payloadUpdate).subscribe({
        next: () => {
          this.isSavingRango.set(false);
          this.toastService.show('Rango actualizado.', 'success');
          this.cancelarEdicionRango();
          this.cargarRangosVariable(this.formulario()!.id);
        },
        error: (err: HttpErrorResponse) => {
          this.isSavingRango.set(false);
          this.toastService.show(this.extraerMensajeError(err, 'Error al actualizar el rango.'), 'error');
        }
      });
      return;
    }

    const payloadCreate = {
      variable_calculo: 'BALANCE',
      nombre: String(raw.nombre).trim(),
      valor_min: valorMin,
      valor_max: valorMax,
      es_vulnerable: esVulnerable,
      orden: this.rangosVariable().length + 1,
      formulario_id: this.formulario()!.id,
    };

    this.rangosVariableService.createRango(payloadCreate).subscribe({
      next: () => {
        this.isSavingRango.set(false);
        this.toastService.show('Rango agregado.', 'success');
        this.cancelarEdicionRango();
        this.cargarRangosVariable(this.formulario()!.id);
      },
      error: (err: HttpErrorResponse) => {
        this.isSavingRango.set(false);
        this.toastService.show(this.extraerMensajeError(err, 'Error al guardar el rango.'), 'error');
      }
    });
  }

  abrirEditarRango(rango: RangoVariableCalculada): void {
    if (this.esSoloLectura()) return;
    this.editingRangoId.set(rango.id);
    this.rangoForm.patchValue({
      variable_calculo: 'BALANCE',
      nombre: rango.nombre,
      valor_min: rango.valor_min,
      valor_max: rango.valor_max ?? null,
      es_vulnerable: Boolean(rango.es_vulnerable),
      orden: rango.orden ?? 1,
    });
    this.rangoForm.get('variable_calculo')?.disable();
  }

  cancelarEdicionRango(): void {
    this.editingRangoId.set(null);
    this.rangoForm.reset({ variable_calculo: 'BALANCE', nombre: '', valor_min: null, valor_max: null, es_vulnerable: false, orden: 1 });
    this.rangoForm.get('variable_calculo')?.disable();
    this.toastService.show('Edición de rango cancelada.', 'info');
  }

  eliminarRangoVariable(id: string): void {
    if (!this.verificarSiSePuedeEliminar()) return;

    Swal.fire({
      title: '¿Eliminar rango?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: '<i class="fas fa-trash-alt"></i> Eliminar',
      cancelButtonText: '<i class="fas fa-times"></i> Cancelar',
      customClass: {
        popup: 'custom-swal-popup',
        confirmButton: 'custom-swal-confirm-danger',
        cancelButton: 'custom-swal-cancel',
        title: 'custom-swal-title'
      }
    }).then((result) => {
      if (result.isConfirmed) {
        this.isSavingRango.set(true);
        this.rangosVariableService.deleteRango(id).subscribe({
          next: () => {
            this.isSavingRango.set(false);
            this.toastService.show('Rango eliminado.', 'info');
            if (this.formulario()) this.cargarRangosVariable(this.formulario()!.id);
          },
          error: (err) => {
            this.isSavingRango.set(false);
            console.error('Error al eliminar rango:', err);
            this.toastService.show('Error al eliminar el rango.', 'error');
          }
        });
      }
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

  publicarFormulario(): void {
    if (this.esSoloLectura() || !this.formulario()) return;

    Swal.fire({
      title: '¿Publicar ficha?',
      text: 'Una vez publicada estará disponible para los estudiantes.',
      icon: 'info',
      showCancelButton: true,
      confirmButtonText: '<i class="fas fa-paper-plane"></i> Sí, publicar',
      cancelButtonText: '<i class="fas fa-times"></i> Cancelar',
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

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  private extraerMensajeError(err: HttpErrorResponse, fallback: string): string {
    let msg = fallback;

    if (err?.error) {
      if (typeof err.error === 'string') {
        msg = err.error;
      } else if (err.error.message) {
        msg = Array.isArray(err.error.message) ? err.error.message.join(' | ') : err.error.message;
      } else if (err.error.detail) {
        msg = err.error.detail;
      }
    }

    const msgLower = msg.toLowerCase();

    if (
      msgLower.includes('violates foreign key') ||
      msgLower.includes('llave foránea') ||
      msgLower.includes('está siendo usado') ||
      msgLower.includes('depende de') ||
      err.status === 409 ||
      err.status === 400
    ) {
      if (msg.length < 150 && !msgLower.includes('http failure')) {
        return msg;
      }
      return 'No se puede eliminar porque este elemento ya está siendo usado por estudiantes o tiene elementos que dependen de él.';
    }

    return msg;
  }
}