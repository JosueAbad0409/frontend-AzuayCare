import { Component, OnInit, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { FichaService } from '../../core/services/ficha/ficha.service';
import { FormularioService } from '../admin/formulario/formulario.service';
import { PeriodoService } from '../../core/services/periodo/periodo.service';
import { DocumentosService } from '../../core/services/documentos.service';
import { DependenciasService } from '../../core/services/dependencias.service';
import { MatricesService } from '../../core/services/matrices.service';
import { Formulario, Seccion, Pregunta } from '../../core/models/formulario.model';
import { FichaRevision } from '../../core/models/revision-ficha.model';
import { PreguntaDependencia } from '../../core/models/dependencia.model';

@Component({
  selector: 'app-estudiante-ficha',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
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
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);

  misFichas = signal<FichaRevision[]>([]);
  fichaActiva = signal<FichaRevision | null>(null);
  formularioActivo = signal<Formulario | null>(null);
  secciones = signal<Seccion[]>([]);
  dependencias = signal<PreguntaDependencia[]>([]);
  
  isLoading = signal<boolean>(true);
  enviando = signal<boolean>(false);

  respuestasForm: FormGroup = this.fb.group({
    respuestas: this.fb.group({}),
    matrices: this.fb.group({})
  });

  valormap = signal<Record<string, any>>({});

  ngOnInit(): void {
    this.cargarDatosEstudiante();

    this.respuestasForm.valueChanges.subscribe(val => {
      this.valormap.set(val.respuestas || {});
    });
  }

  get respuestasGroup(): FormGroup {
    return this.respuestasForm.get('respuestas') as FormGroup;
  }

  get matricesGroup(): FormGroup {
    return this.respuestasForm.get('matrices') as FormGroup;
  }

  cargarDatosEstudiante(): void {
    this.isLoading.set(true);
    this.fichaService.getMisFichas().subscribe({
      next: (fichas) => {
        this.misFichas.set(fichas);
        const borradorOEnviado = fichas.find(f => f.estado_ficha === 'BORRADOR' || f.estado_ficha === 'ENVIADO');
        
        if (borradorOEnviado) {
          this.fichaActiva.set(borradorOEnviado);
          this.cargarEstructuraFormulario(borradorOEnviado.formulario_id);
        } else {
          this.buscarFormularioVigente();
        }
      },
      error: (err) => {
        console.error('Error al cargar fichas del estudiante:', err);
        this.isLoading.set(false);
      }
    });
  }

  buscarFormularioVigente(): void {
    this.periodoService.getPeriodos().subscribe({
      next: (periodos) => {
        const pActivo = periodos.find(p => p.activo);
        if (pActivo) {
          this.formularioService.getFormularios().subscribe({
            next: (formularios) => {
              const formPublicado = formularios.find(f => f.periodo_id === pActivo.id && f.publicado);
              if (formPublicado) {
                this.crearNuevaFicha(pActivo.id, formPublicado.id);
              } else {
                this.isLoading.set(false);
              }
            },
            error: () => this.isLoading.set(false)
          });
        } else {
          this.isLoading.set(false);
        }
      },
      error: () => this.isLoading.set(false)
    });
  }

  crearNuevaFicha(periodoId: string, formularioId: string): void {
    this.fichaService.crearFicha({ periodo_id: periodoId, formulario_id: formularioId }).subscribe({
      next: (nuevaFicha) => {
        this.fichaActiva.set(nuevaFicha);
        this.cargarEstructuraFormulario(formularioId);
      },
      error: (err) => {
        console.error('Error al crear ficha:', err);
        this.isLoading.set(false);
      }
    });
  }

  cargarEstructuraFormulario(formularioId: string): void {
    this.dependenciasService.getDependenciasByFormulario(formularioId).subscribe({
      next: (deps) => this.dependencias.set(deps)
    });

    this.formularioService.getFormularioById(formularioId).subscribe({
      next: (form) => {
        this.formularioActivo.set(form);
        this.formularioService.getSeccionesByFormulario(formularioId).subscribe({
          next: (seccs) => {
            this.secciones.set(seccs);
            seccs.forEach(s => {
              this.formularioService.getPreguntasBySeccion(s.id).subscribe(preguntas => {
                this.secciones.update(list => list.map(item => item.id === s.id ? { ...item, preguntas } : item));
                this.construirControlesPreguntas(preguntas);
              });
            });
            this.isLoading.set(false);
          }
        });
      },
      error: () => this.isLoading.set(false)
    });
  }

  construirControlesPreguntas(preguntas: Pregunta[]): void {
    preguntas.forEach(p => {
      const validators = p.es_obligatorio ? [Validators.required] : [];

      if (!this.respuestasGroup.contains(p.id)) {
        this.respuestasGroup.addControl(p.id, this.fb.control('', validators));
      }

      if (p.tipoCampo?.nombre === 'MATRIZ') {
        this.cargarEstructuraMatriz(p);
      }
    });
  }

  cargarEstructuraMatriz(pregunta: Pregunta): void {
    this.matricesService.getFilas(pregunta.id).subscribe(filas => {
      this.matricesService.getColumnas(pregunta.id).subscribe(columnas => {
        this.secciones.update(secs => secs.map(s => ({
          ...s,
          preguntas: s.preguntas?.map(p => p.id === pregunta.id ? { ...p, filasMatriz: filas, columnasMatriz: columnas } : p)
        })));

        if (!this.matricesGroup.contains(pregunta.id)) {
          const matrizFormGroup = this.fb.group({});
          filas.forEach(fila => {
            const validator = pregunta.es_obligatorio ? [Validators.required] : [];
            matrizFormGroup.addControl(fila.id, this.fb.control('', validator));
          });
          this.matricesGroup.addControl(pregunta.id, matrizFormGroup);
        }
      });
    });
  }

  esPreguntaVisible(preguntaId: string): boolean {
    const dep = this.dependencias().find(d => d.pregunta_dependiente_id === preguntaId);
    if (!dep) return true;

    const valorDisparadorActual = this.valormap()[dep.pregunta_disparadora_id];
    
    if (dep.opcion_disparadora_id) {
      return valorDisparadorActual === dep.opcion_disparadora_id;
    }

    const valorDisparador = (dep as any).valor_disparador;
    if (valorDisparador) {
      return String(valorDisparadorActual).toLowerCase() === String(valorDisparador).toLowerCase();
    }

    return true;
  }

  guardarYEnviar(): void {
    if (this.respuestasForm.invalid) {
      this.respuestasForm.markAllAsTouched();
      alert('Por favor, completa todas las preguntas obligatorias.');
      return;
    }

    const ficha = this.fichaActiva();
    if (!ficha) return;

    this.enviando.set(true);

    const respuestasValores = this.respuestasGroup.value;
    const payloadRespuestas = Object.keys(respuestasValores)
      .filter(pId => this.esPreguntaVisible(pId) && respuestasValores[pId] !== null)
      .map(preguntaId => ({
        ficha_id: ficha.id,
        pregunta_id: preguntaId,
        valor_texto: typeof respuestasValores[preguntaId] === 'string' ? respuestasValores[preguntaId] : null,
        valor_numerico: typeof respuestasValores[preguntaId] === 'number' ? respuestasValores[preguntaId] : null
      }));

    const matricesValores = this.matricesGroup.value;
    const payloadMatriz: any[] = [];

    Object.keys(matricesValores).forEach(preguntaId => {
      if (this.esPreguntaVisible(preguntaId)) {
        const filasObj = matricesValores[preguntaId];
        Object.keys(filasObj).forEach(filaId => {
          const columnaId = filasObj[filaId];
          if (columnaId) {
            payloadMatriz.push({
              ficha_id: ficha.id,
              fila_id: filaId,
              columna_id: columnaId
            });
          }
        });
      }
    });

    this.fichaService.enviarBloqueRespuestas(payloadRespuestas).subscribe({
      next: () => {
        if (payloadMatriz.length > 0) {
          this.matricesService.enviarRespuestasMatriz(payloadMatriz).subscribe({
            next: () => this.finalizarEnvio(),
            error: (err) => {
              console.error('Error al guardar matriz:', err);
              this.enviando.set(false);
            }
          });
        } else {
          this.finalizarEnvio();
        }
      },
      error: (err) => {
        console.error('Error al guardar respuestas:', err);
        this.enviando.set(false);
      }
    });
  }

  private finalizarEnvio(): void {
    this.enviando.set(false);
    alert('Ficha socioeconómica enviada exitosamente.');
    this.cargarDatosEstudiante();
  }

  subirArchivoEvidencia(event: Event, respuestaId: string): void {
    const element = event.currentTarget as HTMLInputElement;
    const fileList: FileList | null = element.files;
    if (fileList && fileList.length > 0) {
      const file = fileList[0];
      this.documentosService.subirDocumento(respuestaId, file).subscribe({
        next: () => alert('Documento adjuntado correctamente.'),
        error: (err) => console.error('Error al subir evidencia:', err)
      });
    }
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}