import { Component, OnInit, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule, Router } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { FormularioService } from '../formulario.service';
import { MatricesService } from '../../../../core/services/matrices.service';
import { DependenciasService } from '../../../../core/services/dependencias.service';
import { Formulario, Seccion, Pregunta, TipoCampoForm, OpcionPregunta } from '../../../../core/models/formulario.model';
import { PreguntaDependencia } from '../../../../core/models/dependencia.model';

@Component({
  selector: 'app-formulario-builder',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
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
  private readonly fb = inject(FormBuilder);

  formulario = signal<Formulario | null>(null);
  secciones = signal<Seccion[]>([]);
  tiposCampo = signal<TipoCampoForm[]>([]);
  dependencias = signal<PreguntaDependencia[]>([]);
  isLoading = signal<boolean>(true);

  showSeccionModal = signal<boolean>(false);
  seccionForm: FormGroup = this.fb.group({
    nombre: ['', [Validators.required, Validators.maxLength(200)]],
    descripcion: ['']
  });

  activeSeccionIdForQuestion = signal<string | null>(null);
  preguntaForm: FormGroup = this.fb.group({
    enunciado: ['', Validators.required],
    tipo_campo_id: ['', Validators.required],
    categoria_financiera: ['NINGUNO', Validators.required],
    es_obligatorio: [true],
    requiere_evidencia: [false]
  });

  nuevaOpcionTexto = signal<string>('');
  nuevaFilaTexto = signal<string>('');
  nuevaColumnaTexto = signal<string>('');

  showDependenciaModal = signal<boolean>(false);
  opcionesDisparadoras = signal<OpcionPregunta[]>([]);
  dependenciaForm: FormGroup = this.fb.group({
    pregunta_disparadora_id: ['', Validators.required],
    opcion_disparadora_id: ['', Validators.required],
    pregunta_dependiente_id: ['', Validators.required]
  });

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.cargarTodo(id);
      this.escucharCambioPreguntaDisparadora();
    } else {
      this.router.navigate(['/admin/formularios']);
    }
  }

  cargarTodo(formularioId: string) {
    this.isLoading.set(true);

    this.formularioService.getTiposCampo().subscribe({
      next: (tipos) => this.tiposCampo.set(tipos)
    });

    this.dependenciasService.getDependenciasByFormulario(formularioId).subscribe({
      next: (deps) => this.dependencias.set(deps)
    });

    this.formularioService.getFormularioById(formularioId).subscribe({
      next: (form) => {
        this.formulario.set(form);
        this.cargarSecciones(formularioId);
      },
      error: () => this.router.navigate(['/admin/formularios'])
    });
  }

  cargarSecciones(formularioId: string) {
    this.formularioService.getSeccionesByFormulario(formularioId).subscribe({
      next: (seccs) => {
        this.secciones.set(seccs);
        seccs.forEach(sec => this.cargarPreguntasDeSeccion(sec.id));
        this.isLoading.set(false);
      }
    });
  }

  cargarPreguntasDeSeccion(seccionId: string) {
    this.formularioService.getPreguntasBySeccion(seccionId).subscribe({
      next: (preguntas) => {
        this.secciones.update(actuales =>
          actuales.map(s => s.id === seccionId ? { ...s, preguntas } : s)
        );

        preguntas.forEach(preg => {
          if (this.esTipoMatriz(preg.tipo_campo_id)) {
            this.cargarMatrizDetalles(preg.id);
          } else if (this.esTipoSeleccion(preg.tipo_campo_id)) {
            this.cargarOpcionesPregunta(preg.id);
          }
        });
      }
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

  cargarOpcionesPregunta(preguntaId: string) {
    this.formularioService.getOpcionesByPregunta(preguntaId).subscribe(opciones => {
      this.secciones.update(secs => secs.map(s => ({
        ...s,
        preguntas: s.preguntas?.map(p => p.id === preguntaId ? { ...p, opciones } : p)
      })));
    });
  }

  agregarOpcion(preguntaId: string) {
    if (!this.nuevaOpcionTexto().trim()) return;
    this.formularioService.createOpcion({
      pregunta_id: preguntaId,
      texto_opcion: this.nuevaOpcionTexto().trim()
    }).subscribe(() => {
      this.nuevaOpcionTexto.set('');
      this.cargarOpcionesPregunta(preguntaId);
    });
  }

  cargarMatrizDetalles(preguntaId: string) {
    this.matricesService.getFilas(preguntaId).subscribe(filas => {
      this.secciones.update(secs => secs.map(s => ({
        ...s,
        preguntas: s.preguntas?.map(p => p.id === preguntaId ? { ...p, filasMatriz: filas } : p)
      })));
    });

    this.matricesService.getColumnas(preguntaId).subscribe(columnas => {
      this.secciones.update(secs => secs.map(s => ({
        ...s,
        preguntas: s.preguntas?.map(p => p.id === preguntaId ? { ...p, columnasMatriz: columnas } : p)
      })));
    });
  }

  agregarFilaMatriz(preguntaId: string) {
    if (!this.nuevaFilaTexto().trim()) return;
    this.matricesService.createFila({ pregunta_id: preguntaId, texto_fila: this.nuevaFilaTexto().trim() }).subscribe(() => {
      this.nuevaFilaTexto.set('');
      this.cargarMatrizDetalles(preguntaId);
    });
  }

  agregarColumnaMatriz(preguntaId: string) {
    if (!this.nuevaColumnaTexto().trim()) return;
    this.matricesService.createColumna({ pregunta_id: preguntaId, texto_columna: this.nuevaColumnaTexto().trim() }).subscribe(() => {
      this.nuevaColumnaTexto.set('');
      this.cargarMatrizDetalles(preguntaId);
    });
  }

  escucharCambioPreguntaDisparadora() {
    this.dependenciaForm.get('pregunta_disparadora_id')?.valueChanges.subscribe(preguntaId => {
      if (preguntaId) {
        this.formularioService.getOpcionesByPregunta(preguntaId).subscribe(opciones => {
          this.opcionesDisparadoras.set(opciones);
        });
      } else {
        this.opcionesDisparadoras.set([]);
      }
      this.dependenciaForm.get('opcion_disparadora_id')?.setValue('');
    });
  }

  guardarDependencia() {
    if (this.dependenciaForm.invalid) return;
    this.dependenciasService.createDependencia(this.dependenciaForm.value).subscribe({
      next: () => {
        this.showDependenciaModal.set(false);
        this.dependenciaForm.reset();
        this.cargarTodo(this.formulario()!.id);
      }
    });
  }

  eliminarDependencia(id: string) {
    this.dependenciasService.deleteDependencia(id).subscribe(() => {
      this.cargarTodo(this.formulario()!.id);
    });
  }

  guardarSeccion() {
    if (this.seccionForm.invalid || !this.formulario()) return;
    this.formularioService.createSeccion({
      formulario_id: this.formulario()!.id,
      nombre: this.seccionForm.value.nombre,
      descripcion: this.seccionForm.value.descripcion,
      orden: this.secciones().length + 1
    }).subscribe(() => {
      this.seccionForm.reset();
      this.showSeccionModal.set(false);
      this.cargarSecciones(this.formulario()!.id);
    });
  }

  eliminarSeccion(seccionId: string, index: number): void {
    if (confirm('¿Estás seguro de eliminar esta sección y todas sus preguntas?')) {
      if (seccionId) {
        this.formularioService.deleteSeccion(seccionId).subscribe({
          next: () => {
            this.secciones.update(secs => secs.filter((_, i) => i !== index));
          },
          error: (err) => console.error('Error al eliminar sección:', err)
        });
      } else {
        this.secciones.update(secs => secs.filter((_, i) => i !== index));
      }
    }
  }

  abrirFormPregunta(seccionId: string) {
    this.activeSeccionIdForQuestion.set(seccionId);
    this.preguntaForm.reset({ categoria_financiera: 'NINGUNO', es_obligatorio: true, requiere_evidencia: false });
  }

  cancelarPregunta() {
    this.activeSeccionIdForQuestion.set(null);
  }

  guardarPregunta(seccionId: string) {
    if (this.preguntaForm.invalid) return;
    const orden = (this.secciones().find(s => s.id === seccionId)?.preguntas?.length || 0) + 1;
    this.formularioService.createPregunta({ seccion_id: seccionId, orden, ...this.preguntaForm.value }).subscribe(() => {
      this.cancelarPregunta();
      this.cargarPreguntasDeSeccion(seccionId);
    });
  }

  eliminarPregunta(preguntaId: string, seccionId: string) {
    if (confirm('¿Eliminar esta pregunta?')) {
      this.formularioService.deletePregunta(preguntaId).subscribe(() => this.cargarPreguntasDeSeccion(seccionId));
    }
  }

  publicarFormulario() {
    if (!this.formulario()) return;
    this.formularioService.publicarFormulario(this.formulario()!.id).subscribe(form => {
      this.formulario.set(form);
      alert('¡Formulario publicado exitosamente!');
    });
  }
}