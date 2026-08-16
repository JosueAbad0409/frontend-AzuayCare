import {
  Component,
  OnInit,
  OnDestroy,
  inject,
  signal,
  computed,
  ChangeDetectionStrategy
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { RevisionService } from '../../../core/services/revision.service';
import { HistorialEstadoService } from '../../../core/services/historial-estado.service';
import { FormularioService } from '../../../core/services/formulario.service';
import { DependenciasService } from '../../../core/services/dependencias.service';
import { FichaRevision, EstadoFicha } from '../../../core/models/revision-ficha.model';
import { HistorialEstadoFicha } from '../../../core/models/historial-estado.model';
import { Seccion, Pregunta } from '../../../core/models/formulario.model';
import { PreguntaDependencia } from '../../../core/models/dependencia.model';
import { ToastService } from '../../../core/services/toast.service';
import { forkJoin, of, catchError, Subject, Subscription } from 'rxjs';
import { debounceTime } from 'rxjs/operators';

@Component({
  selector: 'app-revision-detalle',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './revision-detalle.html',
  styleUrls: ['./revision-detalle.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RevisionDetalleComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly revisionService = inject(RevisionService);
  private readonly historialService = inject(HistorialEstadoService);
  private readonly toastService = inject(ToastService);
  private readonly formularioService = inject(FormularioService);
  private readonly dependenciasService = inject(DependenciasService);

  readonly ficha = signal<FichaRevision | null>(null);
  readonly respuestas = signal<any[]>([]);
  readonly historial = signal<HistorialEstadoFicha[]>([]);
  readonly secciones = signal<Seccion[]>([]);
  readonly dependencias = signal<PreguntaDependencia[]>([]);
  readonly mapaRespuestas = signal<Record<string, any>>({});
  readonly isLoading = signal<boolean>(true);
  readonly tabActiva = signal<'DETALLE' | 'HISTORIAL'>('DETALLE');
  readonly comentario = signal<string>('');
  readonly guardando = signal<boolean>(false);

  readonly filterPregunta = signal<string>('');
  readonly filterEvidencias = signal<'TODAS' | 'CON_EVIDENCIA' | 'SIN_EVIDENCIA'>('TODAS');

  private readonly filterSubject = new Subject<string>();
  private filterSubscription?: Subscription;

  readonly puedeRevisar = computed(() => {
    const estado = this.ficha()?.estado_ficha?.toUpperCase();
    return estado === 'ENVIADA' || estado === 'ENVIADO';
  });

  private normalizarTexto(texto: string | null | undefined): string {
    if (!texto) return '';
    return texto
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  }

  readonly seccionesFiltradas = computed(() => {
    const term = this.normalizarTexto(this.filterPregunta());
    const filtroEv = this.filterEvidencias();
    const lista = this.secciones();

    return lista.map(sec => {
      const secNombreNorm = this.normalizarTexto(sec.nombre);
      const coincideSeccion = secNombreNorm.includes(term);

      const preguntasCoincidentes = (sec.preguntas || []).filter(p => {
        const tieneEv = this.tieneEvidencia(p.id);
        const subpreguntas = this.getSubpreguntas(p.id);
        const algunaSubTieneEv = subpreguntas.some(sub => this.tieneEvidencia(sub.id));
        const evidenciaMatch = tieneEv || algunaSubTieneEv;

        if (filtroEv === 'CON_EVIDENCIA' && !evidenciaMatch) return false;
        if (filtroEv === 'SIN_EVIDENCIA' && evidenciaMatch) return false;

        if (!term || coincideSeccion) return true;

        const enunciadoNorm = this.normalizarTexto(p.enunciado);
        const respNorm = this.normalizarTexto(this.obtenerTextoRespuesta(p));

        if (enunciadoNorm.includes(term) || respNorm.includes(term)) return true;

        return subpreguntas.some(sub => {
          const subEnunciadoNorm = this.normalizarTexto(sub.enunciado);
          const subRespNorm = this.normalizarTexto(this.obtenerTextoRespuesta(sub));
          return subEnunciadoNorm.includes(term) || subRespNorm.includes(term);
        });
      });

      return { ...sec, preguntas: preguntasCoincidentes };
    }).filter(sec => sec.preguntas && sec.preguntas.length > 0);
  });

  ngOnInit(): void {
    this.filterSubscription = this.filterSubject
      .pipe(debounceTime(400))
      .subscribe(val => this.filterPregunta.set(val));

    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.router.navigate(['/admin/revision-fichas']);
      return;
    }
    this.cargarTodo(id);
  }

  ngOnDestroy(): void {
    this.filterSubscription?.unsubscribe();
  }

  onFilterInput(event: Event): void {
    const val = (event.target as HTMLInputElement).value;
    this.filterSubject.next(val);
  }

  onEvidenciaFilterChange(event: Event): void {
    const val = (event.target as HTMLSelectElement).value as 'TODAS' | 'CON_EVIDENCIA' | 'SIN_EVIDENCIA';
    this.filterEvidencias.set(val);
  }

  limpiarFiltro(): void {
    this.filterPregunta.set('');
    this.filterEvidencias.set('TODAS');
  }

  private cargarTodo(id: string): void {
    this.isLoading.set(true);

    this.revisionService.getFichaDetalle(id).subscribe({
      next: (ficha) => {
        this.ficha.set(ficha);

        forkJoin({
          respuestas: this.revisionService.getRespuestasPorFicha(id).pipe(catchError(() => of([]))),
          historial: this.historialService.getHistorialByFicha(id).pipe(catchError(() => of([]))),
        }).subscribe({
          next: ({ respuestas, historial }) => {
            this.respuestas.set(respuestas);
            this.historial.set(historial);

            const mapa: Record<string, any> = {};
            respuestas.forEach((r: any) => {
              mapa[r.pregunta_id] = r;
            });
            this.mapaRespuestas.set(mapa);

            if (ficha.formulario_id) {
              this.cargarEstructuraFormulario(ficha.formulario_id);
            } else {
              this.isLoading.set(false);
            }
          }
        });
      },
      error: () => {
        this.toastService.show('No se pudo cargar la ficha.', 'error');
        this.router.navigate(['/admin/revision-fichas']);
      }
    });
  }

  private cargarEstructuraFormulario(formularioId: string): void {
    forkJoin({
      formulario: this.formularioService.getFormularioById(formularioId),
      dependencias: this.dependenciasService.getDependenciasByFormulario(formularioId).pipe(catchError(() => of([])))
    }).subscribe({
      next: ({ formulario, dependencias }) => {
        this.dependencias.set(dependencias);

        const secsDelForm = (formulario as any).secciones as Seccion[] | undefined;

        if (secsDelForm?.length && secsDelForm[0]?.preguntas) {
          this.secciones.set(secsDelForm);
          this.cargarOpciones(secsDelForm.flatMap(s => s.preguntas || []));
          this.isLoading.set(false);
          return;
        }

        this.formularioService.getSeccionesByFormulario(formularioId).subscribe({
          next: (secciones) => {
            if (!secciones.length) {
              this.secciones.set([]);
              this.isLoading.set(false);
              return;
            }

            forkJoin(
              secciones.map(s =>
                this.formularioService.getPreguntasBySeccion(s.id).pipe(catchError(() => of([] as Pregunta[])))
              )
            ).subscribe({
              next: (preguntasPorSeccion) => {
                const secs = secciones.map((s, i) => ({
                  ...s,
                  preguntas: preguntasPorSeccion[i] || []
                }));
                this.secciones.set(secs);
                this.cargarOpciones(secs.flatMap(s => s.preguntas || []));
                this.isLoading.set(false);
              },
              error: () => this.isLoading.set(false)
            });
          },
          error: () => this.isLoading.set(false)
        });
      },
      error: () => this.isLoading.set(false)
    });
  }

  private cargarOpciones(preguntas: Pregunta[]): void {
    const deSeleccion = preguntas.filter(
      p => (!p.opciones || p.opciones.length === 0) &&
           (p.tipoCampo?.nombre === 'SELECCION_UNICA' || p.tipoCampo?.nombre === 'SELECCION_MULTIPLE')
    );
    if (!deSeleccion.length) return;

    forkJoin(
      deSeleccion.map(p =>
        this.formularioService.getOpcionesByPregunta(p.id).pipe(catchError(() => of([])))
      )
    ).subscribe({
      next: (opcionesList) => {
        deSeleccion.forEach((p, i) => p.opciones = opcionesList[i] || []);
        this.secciones.update(secs =>
          secs.map(s => ({
            ...s,
            preguntas: (s.preguntas || []).map(pr => {
              const found = deSeleccion.find(x => x.id === pr.id);
              return found ? { ...pr, opciones: found.opciones } : pr;
            })
          }))
        );
      }
    });
  }

  setTab(tab: 'DETALLE' | 'HISTORIAL'): void {
    this.tabActiva.set(tab);
  }

  cambiarEstado(nuevoEstado: EstadoFicha): void {
    const f = this.ficha();
    if (!f || !this.puedeRevisar() || this.guardando()) return;

    this.guardando.set(true);
    this.revisionService.actualizarEstadoFicha(f.id, nuevoEstado, this.comentario()).subscribe({
      next: (actualizada) => {
        this.ficha.set(actualizada);
        this.guardando.set(false);
        this.comentario.set('');
        this.toastService.show(
          nuevoEstado === 'VALIDADO' ? 'Ficha validada con éxito.' : 'Ficha rechazada.',
          nuevoEstado === 'VALIDADO' ? 'success' : 'info'
        );
        this.historialService.getHistorialByFicha(f.id).subscribe({
          next: (h) => this.historial.set(h)
        });
      },
      error: (err) => {
        console.error(err);
        this.guardando.set(false);
        this.toastService.show('Error al cambiar el estado.', 'error');
      }
    });
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

  tieneEvidencia(preguntaId: string): boolean {
    const resp = this.mapaRespuestas()[preguntaId];
    if (!resp) return false;
    if (resp.documentos?.length > 0) return true;
    if (resp.valor_texto && String(resp.valor_texto).includes('[EVIDENCIA_URL:')) return true;
    return false;
  }

  obtenerEvidencias(preguntaId: string): { url: string; nombre: string; mime: string; esImagen: boolean }[] {
    const resp = this.mapaRespuestas()[preguntaId];
    if (!resp) return [];

    const lista: { url: string; nombre: string; mime: string; esImagen: boolean }[] = [];

    if (resp.documentos?.length) {
      for (const doc of resp.documentos) {
        if (doc.fecha_desactivacion) continue;
        const mime = doc.mime_type || '';
        lista.push({
          url: doc.ruta_archivo,
          nombre: doc.nombre_original || 'Archivo',
          mime,
          esImagen: mime.toLowerCase().startsWith('image/')
        });
      }
    }

    if (lista.length === 0 && resp.valor_texto) {
      const match = String(resp.valor_texto).match(/\[EVIDENCIA_URL:(.*?)\]/);
      if (match?.[1]) {
        const url = match[1];
        const esImagen = /\.(jpg|jpeg|png|gif|webp|bmp)(\?|$)/i.test(url);
        lista.push({
          url,
          nombre: 'Evidencia adjunta',
          mime: esImagen ? 'image/*' : 'application/octet-stream',
          esImagen
        });
      }
    }

    return lista;
  }

  obtenerUrlEvidencia(preguntaId: string): string {
    const resp = this.mapaRespuestas()[preguntaId];
    if (!resp) return '#';
    if (resp.documentos?.length > 0) return resp.documentos[0].ruta_archivo;
    const match = String(resp.valor_texto || '').match(/\[EVIDENCIA_URL:(.*?)\]/);
    return match?.[1] || '#';
  }

  numeroRomano(num: number): string {
    const romanos = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
    return romanos[num - 1] || String(num);
  }

  volver(): void {
    this.router.navigate(['/admin/revision-fichas']);
  }

  obtenerTextoRespuesta(pregunta: Pregunta): string {
    const resp = this.mapaRespuestas()[pregunta.id];
    if (!resp) return 'Sin respuesta';

    if (resp.respuestasMatriz?.length > 0) {
      return resp.respuestasMatriz
        .map((rm: any) => `${rm.fila?.texto_fila || 'Fila'}: ${rm.columna?.texto_columna || 'Columna'}`)
        .join('\n') || 'Sin respuesta';
    }

    if (resp.opcionesSeleccionadas?.length > 0) {
      return resp.opcionesSeleccionadas
        .map((opc: any) =>
          opc.opcion?.texto_opcion ||
          opc.texto_opcion ||
          opc.opcion_texto ||
          pregunta.opciones?.find(o => o.id === opc.opcion_id)?.texto_opcion ||
          'Opción seleccionada'
        )
        .join(', ');
    }

    if (resp.valor_texto) {
      let texto = String(resp.valor_texto);
      if (texto.includes('[EVIDENCIA_URL:')) {
        texto = texto.replace(/\[EVIDENCIA_URL:.*?\]/g, '').trim();
      }
      if (texto) return texto;
    }

    if (resp.valor_numerico !== null && resp.valor_numerico !== undefined) {
      return String(resp.valor_numerico);
    }

    if (pregunta.opciones?.length && resp.valor_texto) {
      const opc = pregunta.opciones.find(o => o.id === resp.valor_texto);
      if (opc) return opc.texto_opcion;
    }

    return 'Sin respuesta';
  }
}