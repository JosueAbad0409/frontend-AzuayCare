// src/app/features/admin/formularios/builder/formulario-builder.component.ts
import { Component, OnInit, inject, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule, Router } from '@angular/router';
import { FormBuilder, FormGroup, FormArray, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

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
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly formularioService = inject(FormularioService);
  private readonly matricesService = inject(MatricesService);
  private readonly dependenciasService = inject(DependenciasService);
  private readonly rangosVariableService = inject(RangosVariableService);
  private readonly toastService = inject(ToastService);
  private readonly fb = inject(FormBuilder);

  formulario = signal<Formulario | null>(null);
  secciones = signal<Seccion[]>([]);
  tiposCampo = signal<TipoCampoForm[]>([]);
  dependencias = signal<PreguntaDependencia[]>([]);
  rangosVariable = signal<RangoVariableCalculada[]>([]);
  isLoading = signal<boolean>(true);

  // NUEVO: true si el formulario cargado es una versión bloqueada (solo lectura)
  esSoloLectura = computed(() => this.formulario()?.bloqueado === true);

  // Estados para UI / UX
  isSavingSeccion = signal<boolean>(false);
  isSavingQuestion = signal<boolean>(false);
  showMenuPresets = signal<boolean>(false);
  showRangosPanel = signal<boolean>(false);

  // Formulario de Rangos
  rangoForm: FormGroup = this.fb.group({
    variable_calculo: ['BALANCE', Validators.required],
    nombre: ['', [Validators.required, Validators.maxLength(100)]],
    valor_min: [0, [Validators.required, Validators.min(0)]],
    valor_max: [null],
    orden: [1]
  });

  showSeccionModal = signal<boolean>(false);
  seccionForm: FormGroup = this.fb.group({
    nombre: ['', [Validators.required, Validators.maxLength(200)]],
    descripcion: [''],
    tipo_seccion: ['INFORMACION_GENERAL', Validators.required],
    subcategoria_financiera: ['NINGUNO']
  });

  activeSeccionIdForQuestion = signal<string | null>(null);
  editingPreguntaId = signal<string | null>(null);
  esSeccionFinancieraActiva = signal<boolean>(false);

  preguntaForm: FormGroup = this.fb.group({
    enunciado: ['', Validators.required],
    tipo_campo_id: ['', Validators.required],
    categoria_financiera: ['NINGUNO', Validators.required],
    es_obligatorio: [true],
    requiere_evidencia: [false],
    opcionesTemp: this.fb.array([]),
    filasTemp: this.fb.array([]),
    columnasTemp: this.fb.array([])
  });

  nuevaOpcionTexto = signal<string>('');

  // Drag & Drop State
  draggedSeccionIndex: number | null = null;
  draggedPreguntaIndex: number | null = null;

  get opcionesTempArray(): FormArray {
    return this.preguntaForm.get('opcionesTemp') as FormArray;
  }

  get filasTempArray(): FormArray {
    return this.preguntaForm.get('filasTemp') as FormArray;
  }

  get columnasTempArray(): FormArray {
    return this.preguntaForm.get('columnasTemp') as FormArray;
  }

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

  abrirModalNuevaSeccion(): void {
    if (this.esSoloLectura()) {
      this.toastService.show('Esta ficha es una versión anterior bloqueada; solo puede visualizarse.', 'info');
      return;
    }
    this.seccionForm.reset({
      nombre: '',
      descripcion: '',
      tipo_seccion: 'INFORMACION_GENERAL',
      subcategoria_financiera: 'NINGUNO'
    });
    this.showSeccionModal.set(true);
  }

  cargarTodo(formularioId: string): void {
    this.isLoading.set(true);

    this.formularioService.getTiposCampo().subscribe({
      next: (tipos: TipoCampoForm[]) => this.tiposCampo.set(tipos),
      error: (err) => console.error('Error al cargar tipos de campo:', err)
    });

    this.dependenciasService.getDependenciasByFormulario(formularioId).subscribe({
      next: (deps: PreguntaDependencia[]) => this.dependencias.set(deps),
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

  cargarRangosVariable(formularioId: string): void {
    this.rangosVariableService.getByFormulario(formularioId).subscribe({
      next: (rangos) => this.rangosVariable.set(rangos),
      error: (err) => console.error('Error al cargar rangos:', err)
    });
  }

  guardarRangoVariable(): void {
    if (this.esSoloLectura()) return;
    if (this.rangoForm.invalid || !this.formulario()) return;

    const payload = {
      ...this.rangoForm.value,
      formulario_id: this.formulario()!.id,
      orden: this.rangosVariable().length + 1
    };

    this.rangosVariableService.createRango(payload).subscribe({
      next: () => {
        this.toastService.show('Rango de variable agregado correctamente.', 'success');
        this.rangoForm.reset({
          variable_calculo: 'BALANCE',
          valor_min: 0,
          valor_max: null
        });
        this.cargarRangosVariable(this.formulario()!.id);
      },
      error: (err: HttpErrorResponse) => {
        this.toastService.show(this.extraerMensajeError(err, 'Error al guardar el rango.'), 'error');
      }
    });
  }

  eliminarRangoVariable(id: string): void {
    if (this.esSoloLectura()) return;

    this.rangosVariableService.deleteRango(id).subscribe({
      next: () => {
        this.toastService.show('Rango eliminado.', 'info');
        if (this.formulario()) {
          this.cargarRangosVariable(this.formulario()!.id);
        }
      },
      error: (err) => console.error('Error al eliminar rango:', err)
    });
  }

  cargarPreguntasDeSeccion(seccionId: string): void {
    this.formularioService.getPreguntasBySeccion(seccionId).subscribe({
      next: (preguntas: Pregunta[]) => {
        this.secciones.update(actuales =>
          actuales.map(s => s.id === seccionId ? { ...s, preguntas } : s)
        );

        preguntas.forEach((preg: Pregunta) => {
          if (this.esTipoMatriz(preg.tipo_campo_id)) {
            this.cargarMatrizDetalles(preg.id);
          } else if (this.esTipoSeleccion(preg.tipo_campo_id)) {
            this.cargarOpcionesPregunta(preg.id);
          }
        });
      },
      error: (err) => console.error(`Error al cargar preguntas de la sección ${seccionId}:`, err)
    });
  }

  esTipoMatriz(tipoCampoId: string): boolean {
    const tipo = this.tiposCampo().find(t => t.id === tipoCampoId);
    return tipo?.nombre === 'MATRIZ';
  }

  esTipoSeleccion(tipoCampoId: string): boolean {
    const tipo = this.tiposCampo().find(t => t.id === tipoCampoId);
    return tipo?.nombre === 'SELECCION_UNICA' || tipo?.nombre === 'SELECCION_MULTIPLE';
  }

  getNombreTipoCampo(tipoCampoId: string): string {
    const tipo = this.tiposCampo().find(t => t.id === tipoCampoId);
    return tipo ? tipo.nombre : 'PREGUNTA';
  }

  agregarOpcionTemp(texto = '', valorPonderado: number | null = null): void {
    const tipoTexto = this.tiposCampo().find(t => t.nombre.toUpperCase().includes('TEXTO')) || this.tiposCampo()[0];
    
    this.opcionesTempArray.push(this.fb.group({
      texto_opcion: [texto, Validators.required],
      permite_texto_libre: [false],
      valor_ponderado: [valorPonderado],
      es_correcta: [false],
      dispara_dependencia: [false],
      subpregunta_enunciado: [''],
      subpregunta_tipo_id: [tipoTexto ? tipoTexto.id : ''],
      subpregunta_categoria_financiera: ['NINGUNO'],
      subpregunta_requiere_evidencia: [false]
    }));
  }

  eliminarOpcionTemp(index: number): void {
    this.opcionesTempArray.removeAt(index);
  }

  toggleMenuPresets(): void {
    this.showMenuPresets.update(v => !v);
  }

  cargarPreset(tipo: 'EDAD' | 'SI_NO' | 'INGRESOS' | 'VIVIENDA'): void {
    this.opcionesTempArray.clear();
    this.showMenuPresets.set(false);

    let presetData: { texto: string; pts?: number }[] = [];

    switch (tipo) {
      case 'EDAD':
        presetData = [
          { texto: '0 a 5 años' },
          { texto: '6 a 12 años' },
          { texto: '13 a 18 años' },
          { texto: 'Mayor de 18 años' }
        ];
        break;
      case 'SI_NO':
        presetData = [
          { texto: 'Sí' },
          { texto: 'No' }
        ];
        break;
      case 'INGRESOS':
        presetData = [
          { texto: 'Menos de $400' },
          { texto: '$401 a $800' },
          { texto: 'Más de $800' }
        ];
        break;
      case 'VIVIENDA':
        presetData = [
          { texto: 'Propia' },
          { texto: 'Arrendada' },
          { texto: 'Cedida' }
        ];
        break;
    }

    presetData.forEach(item => this.agregarOpcionTemp(item.texto, item.pts || null));
  }

  cargarOpcionesPregunta(preguntaId: string): void {
    this.formularioService.getOpcionesByPregunta(preguntaId).subscribe({
      next: (opciones: OpcionPregunta[]) => {
        this.secciones.update(secs => secs.map(s => ({
          ...s,
          preguntas: s.preguntas?.map(p => p.id === preguntaId ? { ...p, opciones } : p)
        })));
      },
      error: (err) => console.error(`Error al cargar opciones de ${preguntaId}:`, err)
    });
  }

  agregarOpcion(preguntaId: string): void {
    if (this.esSoloLectura()) return;
    if (!this.nuevaOpcionTexto().trim()) return;

    this.formularioService.createOpcion({
      pregunta_id: preguntaId,
      texto_opcion: this.nuevaOpcionTexto().trim()
    }).subscribe({
      next: () => {
        this.toastService.show('Opción agregada correctamente.', 'success');
        this.nuevaOpcionTexto.set('');
        this.cargarOpcionesPregunta(preguntaId);
      },
      error: (err: HttpErrorResponse) => {
        this.toastService.show(
          this.extraerMensajeError(err, 'Error al agregar la opción.'),
          'error'
        );
      }
    });
  }

  eliminarOpcionExistente(opcionId: string, preguntaId: string): void {
    if (this.esSoloLectura()) return;

    this.formularioService.deleteOpcion(opcionId).subscribe({
      next: () => {
        this.toastService.show('Opción eliminada.', 'info');
        this.cargarOpcionesPregunta(preguntaId);
      },
      error: (err) => console.error('Error al eliminar opción:', err)
    });
  }

  cargarMatrizDetalles(preguntaId: string): void {
    this.matricesService.getFilas(preguntaId).subscribe({
      next: (filas) => {
        this.secciones.update(secs => secs.map(s => ({
          ...s,
          preguntas: s.preguntas?.map(p => p.id === preguntaId ? { ...p, filasMatriz: filas } : p)
        })));
      }
    });

    this.matricesService.getColumnas(preguntaId).subscribe({
      next: (columnas) => {
        this.secciones.update(secs => secs.map(s => ({
          ...s,
          preguntas: s.preguntas?.map(p => p.id === preguntaId ? { ...p, columnasMatriz: columnas } : p)
        })));
      }
    });
  }

  agregarFilaMatriz(event: { preguntaId: string; texto: string }): void {
    if (this.esSoloLectura()) return;

    this.matricesService.createFila({ pregunta_id: event.preguntaId, texto_fila: event.texto }).subscribe({
      next: () => this.cargarMatrizDetalles(event.preguntaId)
    });
  }

  eliminarFilaExistente(filaId: string, preguntaId: string): void {
    if (this.esSoloLectura()) return;

    this.matricesService.deleteFila(filaId).subscribe({
      next: () => this.cargarMatrizDetalles(preguntaId)
    });
  }

  agregarColumnaMatriz(event: { preguntaId: string; texto: string }): void {
    if (this.esSoloLectura()) return;

    this.matricesService.createColumna({ pregunta_id: event.preguntaId, texto_columna: event.texto }).subscribe({
      next: () => this.cargarMatrizDetalles(event.preguntaId)
    });
  }

  eliminarColumnaExistente(columnaId: string, preguntaId: string): void {
    if (this.esSoloLectura()) return;

    this.matricesService.deleteColumna(columnaId).subscribe({
      next: () => this.cargarMatrizDetalles(preguntaId)
    });
  }

  guardarSeccion(): void {
    if (this.esSoloLectura()) return;
    if (this.seccionForm.invalid || !this.formulario()) return;
    this.isSavingSeccion.set(true);

    const rawValue = this.seccionForm.value;
    let subcategoriaFinanciera: 'NINGUNO' | 'INGRESOS' | 'GASTOS' | 'AMBOS' = 'NINGUNO';
    
    if (rawValue.tipo_seccion === 'FINANCIERA') {
      subcategoriaFinanciera = rawValue.subcategoria_financiera || 'INGRESOS';
    }

    const payload = {
      formulario_id: this.formulario()!.id,
      nombre: rawValue.nombre,
      descripcion: rawValue.descripcion || '',
      tipo_seccion: rawValue.tipo_seccion,
      subcategoria_financiera: subcategoriaFinanciera,
      orden: this.secciones().length + 1
    };

    this.formularioService.createSeccion(payload).subscribe({
      next: () => {
        this.isSavingSeccion.set(false);
        this.toastService.show('Sección creada exitosamente.', 'success');
        this.seccionForm.reset({ tipo_seccion: 'INFORMACION_GENERAL', subcategoria_financiera: 'NINGUNO' });
        this.showSeccionModal.set(false);
        this.cargarSecciones(this.formulario()!.id);
      },
      error: (err: HttpErrorResponse) => {
        this.isSavingSeccion.set(false);
        this.toastService.show(this.extraerMensajeError(err, 'Ocurrió un error al crear la sección.'), 'error');
      }
    });
  }

  eliminarSeccion(seccionId: string, index: number): void {
    if (this.esSoloLectura()) return;

    if (confirm('¿Estás seguro de eliminar esta sección y todas sus preguntas?')) {
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
  }

  abrirFormPregunta(seccionId: string): void {
    if (this.esSoloLectura()) {
      this.toastService.show('Esta ficha es una versión anterior bloqueada; solo puede visualizarse.', 'info');
      return;
    }

    this.activeSeccionIdForQuestion.set(seccionId);
    this.editingPreguntaId.set(null);
    
    const seccionPadre = this.secciones().find(s => s.id === seccionId);
    const esFinanciera = seccionPadre?.tipo_seccion === 'FINANCIERA';
    this.esSeccionFinancieraActiva.set(esFinanciera);

    const tipoNumerico = this.tiposCampo().find(t => 
      t.nombre.toUpperCase().includes('NUMER')
    ) || this.tiposCampo()[0];

    const initialTipoId = tipoNumerico ? tipoNumerico.id : (this.tiposCampo()[0]?.id || '');

    let categoriaInicial: 'INGRESO' | 'EGRESO' | 'NINGUNO' = 'NINGUNO';
    if (esFinanciera) {
      if (seccionPadre?.subcategoria_financiera === 'GASTOS') {
        categoriaInicial = 'EGRESO';
      } else {
        categoriaInicial = 'INGRESO';
      }
    }

    this.preguntaForm.reset({ 
      enunciado: '',
      tipo_campo_id: initialTipoId,
      categoria_financiera: categoriaInicial, 
      es_obligatorio: true, 
      requiere_evidencia: false 
    });

    if (esFinanciera) {
      if (tipoNumerico) {
        this.preguntaForm.get('tipo_campo_id')?.setValue(tipoNumerico.id);
      }
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
      this.toastService.show('Esta ficha es una versión anterior bloqueada; solo puede visualizarse.', 'info');
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
      requiere_evidencia: pregunta.requiere_evidencia
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
  }

  cancelarPregunta(): void {
    this.activeSeccionIdForQuestion.set(null);
    this.editingPreguntaId.set(null);
  }

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
      const tipoNumerico = this.tiposCampo().find(t => t.nombre.toUpperCase().includes('NUMER'));
      const fallbackTipo = tipoNumerico || this.tiposCampo()[0];
      if (fallbackTipo) {
        tipoCampoIdFinal = fallbackTipo.id;
      } else {
        this.toastService.show('Error: No hay tipos de campo cargados en la aplicación.', 'error');
        return;
      }
    }

    const categoriaFinancieraFinal = esFinanciera ? (formValue.categoria_financiera || 'INGRESO') : 'NINGUNO';

    this.isSavingQuestion.set(true);

    if (this.editingPreguntaId()) {
      const payloadUpdate = {
        enunciado: formValue.enunciado.trim(),
        tipo_campo_id: tipoCampoIdFinal,
        categoria_financiera: categoriaFinancieraFinal,
        es_obligatorio: Boolean(formValue.es_obligatorio),
        requiere_evidencia: Boolean(formValue.requiere_evidencia)
      };

      this.formularioService.updatePregunta(this.editingPreguntaId()!, payloadUpdate).subscribe({
        next: () => {
          this.isSavingQuestion.set(false);
          this.toastService.show('Pregunta actualizada correctamente.', 'success');
          this.cancelarPregunta();
          this.cargarPreguntasDeSeccion(seccionId);
        },
        error: (err: HttpErrorResponse) => {
          this.isSavingQuestion.set(false);
          console.error('Error de backend al actualizar:', err.error);
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
      requiere_evidencia: Boolean(formValue.requiere_evidencia)
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
                  es_correcta: Boolean(opc.es_correcta)
                })
              );

              const subTipoId = (opc.subpregunta_tipo_id && opc.subpregunta_tipo_id.trim() !== '') 
                ? opc.subpregunta_tipo_id 
                : tipoCampoIdFinal;

              if (opc.dispara_dependencia && opc.subpregunta_enunciado?.trim() && opcionGuardada?.id) {
                const subpreguntaGuardada = await firstValueFrom(
                  this.formularioService.createPregunta({
                    seccion_id: seccionId,
                    orden: orden + i + 1,
                    enunciado: opc.subpregunta_enunciado.trim(),
                    tipo_campo_id: subTipoId,
                    categoria_financiera: 'NINGUNO',
                    es_obligatorio: false,
                    requiere_evidencia: Boolean(opc.subpregunta_requiere_evidencia)
                  })
                );

                if (subpreguntaGuardada?.id) {
                  await firstValueFrom(
                    this.dependenciasService.createDependencia({
                      pregunta_disparadora_id: preguntaCreada.id,
                      opcion_disparadora_id: opcionGuardada.id,
                      pregunta_dependiente_id: subpreguntaGuardada.id
                    })
                  );
                }
              }
            }
          }

          if (this.esTipoMatriz(tipoCampoIdFinal)) {
            for (let i = 0; i < (formValue.filasTemp || []).length; i++) {
              if (formValue.filasTemp[i]?.texto_fila?.trim()) {
                await firstValueFrom(
                  this.matricesService.createFila({
                    pregunta_id: preguntaCreada.id,
                    texto_fila: formValue.filasTemp[i].texto_fila.trim()
                  })
                );
              }
            }

            for (let i = 0; i < (formValue.columnasTemp || []).length; i++) {
              if (formValue.columnasTemp[i]?.texto_columna?.trim()) {
                await firstValueFrom(
                  this.matricesService.createColumna({
                    pregunta_id: preguntaCreada.id,
                    texto_columna: formValue.columnasTemp[i].texto_columna.trim()
                  })
                );
              }
            }
          }

          this.isSavingQuestion.set(false);
          this.toastService.show('Pregunta guardada con éxito.', 'success');
          this.cancelarPregunta();
          this.cargarPreguntasDeSeccion(seccionId);
          if (this.formulario()?.id) {
            this.cargarTodo(this.formulario()!.id);
          }
        } catch (error) {
          console.error('Error al guardar componentes hijos de la pregunta:', error);
          this.isSavingQuestion.set(false);
          this.toastService.show('Pregunta guardada con advertencias en opciones o subpreguntas.', 'warning');
          this.cancelarPregunta();
          this.cargarPreguntasDeSeccion(seccionId);
        }
      },
      error: (err: HttpErrorResponse) => {
        this.isSavingQuestion.set(false);
        console.error('Fallo de validación devuelto por NestJS:', err.error);
        const msj = this.extraerMensajeError(err, 'Error de validación al guardar la pregunta principal.');
        this.toastService.show(msj, 'error');
      }
    });
  }

  eliminarPregunta(preguntaId: string, seccionId: string): void {
    if (this.esSoloLectura()) return;

    if (confirm('¿Eliminar esta pregunta?')) {
      this.formularioService.deletePregunta(preguntaId).subscribe({
        next: () => {
          this.toastService.show('Pregunta eliminada.', 'info');
          this.cargarPreguntasDeSeccion(seccionId);
        },
        error: (err) => console.error('Error al eliminar pregunta:', err)
      });
    }
  }

  publicarFormulario(): void {
    if (this.esSoloLectura()) return;
    if (!this.formulario()) return;

    if (confirm('¿Estás seguro de publicar esta ficha? Una vez publicada estará disponible para los estudiantes.')) {
      this.formularioService.publicarFormulario(this.formulario()!.id).subscribe({
        next: (form: Formulario) => {
          this.formulario.set(form);
          this.toastService.show('¡Formulario publicado exitosamente!', 'success');
        },
        error: (err: HttpErrorResponse) => {
          this.toastService.show(
            this.extraerMensajeError(err, 'Error al publicar el formulario.'),
            'error'
          );
        }
      });
    }
  }

  private extraerMensajeError(err: HttpErrorResponse, fallback: string): string {
    if (!err?.error) return fallback;
    if (Array.isArray(err.error.message)) {
      return err.error.message.join(' | ');
    }
    if (typeof err.error.message === 'string') {
      return err.error.message;
    }
    return fallback;
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
    if (this.esSoloLectura()) return;

    if (
      this.draggedSeccionIndex === null || 
      this.draggedPreguntaIndex === null || 
      this.draggedSeccionIndex !== targetSeccionIndex
    ) {
      return;
    }

    const targetSeccion = this.secciones()[targetSeccionIndex];
    if (!targetSeccion || !targetSeccion.preguntas) return;

    const preguntasNuevas = [...targetSeccion.preguntas];
    const [preguntaMovida] = preguntasNuevas.splice(this.draggedPreguntaIndex, 1);
    preguntasNuevas.splice(targetPreguntaIndex, 0, preguntaMovida);

    const preguntasReordenadas = preguntasNuevas.map((p, idx) => ({
      ...p,
      orden: idx + 1
    }));

    this.secciones.update(secs => {
      const copia = [...secs];
      copia[targetSeccionIndex] = {
        ...copia[targetSeccionIndex],
        preguntas: preguntasReordenadas
      };
      return copia;
    });

    this.draggedSeccionIndex = null;
    this.draggedPreguntaIndex = null;

    const payloadOrdenes = preguntasReordenadas.map(p => ({
      id: p.id,
      orden: p.orden
    }));

    this.formularioService.reordenarPreguntas(targetSeccion.id, payloadOrdenes).subscribe({
      error: (err) => console.error('Error al persistir el reordenamiento:', err)
    });
  }

  calcularTotalPuntos(): number {
    let total = 0;
    for (const ctrl of this.opcionesTempArray.controls) {
      if (ctrl.get('es_correcta')?.value) {
        total += Number(ctrl.get('valor_ponderado')?.value) || 0;
      }
    }
    return total;
  }
}