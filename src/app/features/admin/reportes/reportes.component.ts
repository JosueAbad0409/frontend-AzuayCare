import { Component, OnInit, OnDestroy, inject, signal, computed, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { forkJoin, of, Subject, Subscription } from 'rxjs';
import { catchError, debounceTime } from 'rxjs/operators';
import { ReportesService, EstadisticasPeriodo } from '../../../core/services/reportes.service';
import { PeriodoService } from '../../../core/services/periodo.service';
import { CarreraService } from '../../../core/services/carrera.service';
import { CiclosService } from '../../../core/services/ciclos.service';
import { ToastService } from '../../../core/services/toast.service';
import { PeriodoMatricula } from '../../../core/models/periodo.model';
import { Carrera } from '../../../core/models/carrera.model';
import { Ciclo } from '../../../core/models/ciclo.model';
import { DescargaArchivosService } from '../../../core/services/descarga-archivos.service';
import { FormularioService } from '../../../core/services/formulario.service';
import { Formulario } from '../../../core/models/formulario.model';
import { RevisionService } from '../../../core/services/revision.service';
import {
  AgregadoPorPregunta,
  DatasetFiltradoResponse,
  FiltroPreguntaDisponible,
  FiltroReporteRequest
} from '../../../core/models/reportes.model';

@Component({
  selector: 'app-reportes',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './reportes.component.html',
  styleUrls: ['./reportes.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ReportesComponent implements OnInit, OnDestroy {
  private readonly reportesService = inject(ReportesService);
  private readonly periodoService = inject(PeriodoService);
  private readonly carreraService = inject(CarreraService);
  private readonly ciclosService = inject(CiclosService);
  private readonly formularioService = inject(FormularioService);
  private readonly revisionService = inject(RevisionService);
  private readonly toastService = inject(ToastService);
  private readonly fb = inject(FormBuilder);
  private readonly descargaService = inject(DescargaArchivosService);
  private readonly cdRef = inject(ChangeDetectorRef);

  private filtrosPreguntaValues: Record<string, string> = {};
  private readonly tableSearchSubject = new Subject<string>();
  private tableSearchSubscription?: Subscription;

  private readonly filtrosChangedSubject = new Subject<void>();
  private filtrosChangedSubscription?: Subscription;

  readonly periodos = signal<PeriodoMatricula[]>([]);
  readonly carreras = signal<Carrera[]>([]);
  readonly ciclos = signal<Ciclo[]>([]);
  readonly formularios = signal<Formulario[]>([]);
  readonly filtrosDisponibles = signal<FiltroPreguntaDisponible[]>([]);
  readonly datasetFiltrado = signal<DatasetFiltradoResponse | null>(null);
  readonly agregadosPorPregunta = signal<AgregadoPorPregunta[]>([]);
  readonly estadisticas = signal<EstadisticasPeriodo | null>(null);

  readonly tableSearchTerm = signal<string>('');
  readonly tableEstadoFiltro = signal<string>('TODOS');

  readonly isLoading = signal<boolean>(true);
  readonly isLoadingStats = signal<boolean>(false);
  readonly isLoadingFilters = signal<boolean>(false);
  readonly isAplicandoFiltros = signal<boolean>(false);
  readonly isDescargandoExcel = this.descargaService.isDescargando;
  readonly mostrarAvanzado = signal<boolean>(false);
  // 🔥 Mantiene los formularios filtrados según el periodo activo (Señal normal)
  readonly formulariosDelPeriodo = signal<Formulario[]>([]);

  readonly filterForm: FormGroup = this.fb.group({
    periodo_id: [''],
    carrera_id: [''],
    ciclo_id: [''],
    estado_ficha: ['TODOS'],
    nivel_economico: ['TODOS'], // 🔥 ESTA LÍNEA ES LA QUE FALTA PARA QUE NO DE ERROR
    formulario_id: ['']
  });
  readonly COLUMNAS_BASE_DISPONIBLES: Array<{ clave: string; etiqueta: string }> = [
    { clave: 'periodo', etiqueta: 'Periodo' },
    { clave: 'carrera', etiqueta: 'Carrera' },
    { clave: 'ciclo', etiqueta: 'Ciclo' },
    { clave: 'estado', etiqueta: 'Estado de la Ficha' },
    { clave: 'nivel_economico', etiqueta: 'Quintil / Nivel Económico' },
  ];

  readonly columnasBaseSeleccionadas = signal<string[]>([]);
  readonly preguntasSeleccionadasIds = signal<string[]>([]);

  readonly registrosProcesados = computed(() => {
    const dataset = this.datasetFiltrado();
    if (!dataset || !dataset.registros) return [];

    const term = this.tableSearchTerm().toLowerCase().trim();
    const estado = this.tableEstadoFiltro().toUpperCase();
    const nivelFiltroSelect = this.filterForm.get('nivel_economico')?.value;

    return dataset.registros.filter((row: any) => {
      // 1. Filtro de Estado global (de arriba)
      if (estado !== 'TODOS') {
        const rowEstado = String(row.estado_ficha || row.estado || '').toUpperCase();
        if (estado === 'ENVIADA' && rowEstado !== 'ENVIADA' && rowEstado !== 'ENVIADO') return false;
        if (estado === 'VALIDADO' && rowEstado !== 'VALIDADO') return false;
        if (estado === 'RECHAZADO' && rowEstado !== 'RECHAZADO' && rowEstado !== 'RECHAZADA' && rowEstado !== 'OBSERVADO') return false;
        if (estado === 'BORRADOR' && rowEstado !== 'BORRADOR') return false;
      }

      // 2. Filtro de Quintil/Nivel global (de arriba)
      if (nivelFiltroSelect && nivelFiltroSelect !== 'TODOS' && nivelFiltroSelect !== 'Sin Rango') {
        const rowNivel = String(row.nivel_economico || '').trim();
        if (rowNivel.toUpperCase() !== nivelFiltroSelect.toUpperCase()) return false;
      }

      // 3. Búsqueda global o de cajita de la tabla
      if (!term) return true;

      return Object.values(row).some(val =>
        String(val ?? '').toLowerCase().includes(term)
      );
    });
  });


  readonly totalRegistrosTabla = computed(() => this.registrosProcesados().length);

  readonly periodoSeleccionadoNombre = computed(() => {
    const id = this.filterForm.get('periodo_id')?.value;
    const p = this.periodos().find(x => x.id === id);
    return p?.nombre || '—';
  });

  ngOnInit(): void {
    this.tableSearchSubscription = this.tableSearchSubject
      .pipe(debounceTime(400))
      .subscribe(val => {
        this.tableSearchTerm.set(val);
        this.cdRef.markForCheck();
      });

    // 🔴 EN VIVO: cualquier cambio en filtros/columnas dispara una nueva consulta
    // automáticamente (sin toast, sin necesidad de botones), medio segundo
    // después de que el usuario deja de interactuar.
    this.filtrosChangedSubscription = this.filtrosChangedSubject
      .pipe(debounceTime(900))
      .subscribe(() => this.ejecutarConsulta(false));

    this.cargarFiltrosIniciales();

    this.filterForm.get('periodo_id')?.valueChanges.subscribe((periodoId: string) => {
      // 🔥 Si cambiamos de periodo, limpiamos el formulario y las preguntas
      this.filterForm.patchValue({ formulario_id: '' }, { emitEvent: false });
      this.filtrosPreguntaValues = {};
      this.filtrosDisponibles.set([]);

      if (periodoId) {
        // 🔥 CORRECCIÓN: Filtrar los formularios que pertenecen AL NUEVO periodo seleccionado
        const filtrados = this.formularios().filter(f => f.periodo_id === periodoId);
        this.formulariosDelPeriodo.set(filtrados);
        
        this.cargarEstadisticas(periodoId);
      } else {
        // Si se limpia el periodo, limpiamos la lista de formularios
        this.formulariosDelPeriodo.set([]); 
        this.estadisticas.set(null);
      }
      this.cdRef.markForCheck(); // Asegurarnos de renderizar los cambios
    });

    this.filterForm.get('carrera_id')?.valueChanges.subscribe((carreraId: string) => {
      if (!carreraId) {
        this.ciclos.set([]);
        this.filterForm.patchValue({ ciclo_id: '' }, { emitEvent: false });
        this.cdRef.markForCheck();
        return;
      }
      this.cargarCiclosPorCarrera(carreraId);
    });

    this.filterForm.get('formulario_id')?.valueChanges.subscribe((formularioId: string) => {
      this.filtrosPreguntaValues = {};
      if (!formularioId) {
        this.filtrosDisponibles.set([]);
        this.cdRef.markForCheck();
        return;
      }
      this.cargarFiltrosDisponibles(formularioId);
    });

    // Cualquier cambio en periodo/carrera/ciclo/estado/formulario también
    // dispara la actualización automática del reporte.
    this.filterForm.valueChanges
      .pipe(debounceTime(300))
      .subscribe(() => this.dispararActualizacionAutomatica());
  }

  private dispararActualizacionAutomatica(): void {
    if (!this.filterForm.get('periodo_id')?.value) return;
    this.filtrosChangedSubject.next();
  }

  ngOnDestroy(): void {
    this.tableSearchSubscription?.unsubscribe();
    this.filtrosChangedSubscription?.unsubscribe();
  }

  onTableSearchChange(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.tableSearchSubject.next(value);
  }

  onTableEstadoChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.tableEstadoFiltro.set(value);
  }

  limpiarFiltrosTabla(): void {
    this.tableSearchTerm.set('');
    this.tableEstadoFiltro.set('TODOS');
  }

  cargarFiltrosIniciales(): void {
    this.isLoading.set(true);

    forkJoin({
      carreras: this.carreraService.getCarreras().pipe(catchError(() => of([]))),
      periodos: this.periodoService.getPeriodos().pipe(catchError(() => of([]))),
      formularios: this.formularioService.getFormularios().pipe(catchError(() => of([])))
    }).subscribe({
      next: ({ carreras, periodos, formularios }) => {
        this.carreras.set(carreras || []);
        this.periodos.set(periodos || []);
        this.formularios.set(formularios || []);

        const periodoActivo = (periodos || []).find((p: PeriodoMatricula) => p.activo) || (periodos || [])[0];
        if (periodoActivo) {
          // 🔥 NUEVO: Llenamos los formularios de este periodo en la carga inicial de la página
          const filtrados = (formularios || []).filter((f: Formulario) => f.periodo_id === periodoActivo.id);
          this.formulariosDelPeriodo.set(filtrados);

          this.filterForm.patchValue({ periodo_id: periodoActivo.id }, { emitEvent: true });
        }

        this.isLoading.set(false);
        this.cdRef.markForCheck();
      },
      error: () => {
        this.toastService.show('Error al cargar filtros del sistema.', 'error');
        this.isLoading.set(false);
        this.cdRef.markForCheck();
      }
    });
  }

  cargarEstadisticas(periodoId: string): void {
    this.isLoadingStats.set(true);

    // 🔥 Simplificamos: Confiamos 100% en el endpoint que construimos en el backend
    // porque ya nos trae los totales correctos y consolidados.
    this.reportesService.getEstadisticasGenerales(periodoId).pipe(
      catchError((error) => {
        console.error('Error cargando estadísticas:', error);
        return of(null);
      })
    ).subscribe((stats) => {
      if (stats) {
        this.estadisticas.set({
          total_fichas: stats.total_fichas || 0,
          fichas_borrador: stats.fichas_borrador || 0,
          fichas_enviadas: stats.fichas_enviadas || 0,
          fichas_validadas: stats.fichas_validadas || 0,
          fichas_rechazadas: stats.fichas_rechazadas || 0,
          distribucion_rangos: stats.distribucion_rangos || []
        });
      } else {
        this.estadisticas.set(null);
      }
      
      this.isLoadingStats.set(false);
      this.cdRef.markForCheck();
    });
  }

  private contarEstados(lista: any[]): {
    total: number;
    borrador: number;
    enviadas: number;
    validadas: number;
    rechazadas: number;
  } {
    let borrador = 0, enviadas = 0, validadas = 0, rechazadas = 0;

    lista.forEach((f) => {
      const e = String(f.estado_ficha || '').toUpperCase();
      if (e === 'BORRADOR') borrador++;
      else if (e === 'ENVIADA' || e === 'ENVIADO') enviadas++;
      else if (e === 'VALIDADO') validadas++;
      else if (e === 'RECHAZADO' || e === 'RECHAZADA') rechazadas++;
    });

    return { total: lista.length, borrador, enviadas, validadas, rechazadas };
  }

  cargarCiclosPorCarrera(carreraId: string): void {
    this.ciclos.set([]);
    this.filterForm.patchValue({ ciclo_id: '' }, { emitEvent: false });

    this.ciclosService.getCiclosByCarrera(carreraId).subscribe({
      next: (ciclos) => {
        this.ciclos.set(ciclos || []);
        this.cdRef.markForCheck();
      },
      error: () => this.toastService.show('No se pudieron cargar los ciclos de la carrera.', 'warning')
    });
  }

  cargarFiltrosDisponibles(formularioId: string): void {
    this.isLoadingFilters.set(true);

    this.reportesService.getFiltrosDisponibles(formularioId).subscribe({
      next: (filtros) => {
        this.filtrosDisponibles.set(filtros || []);
        this.isLoadingFilters.set(false);
        this.cdRef.markForCheck();
      },
      error: () => {
        this.filtrosDisponibles.set([]);
        this.isLoadingFilters.set(false);
        this.toastService.show('No se pudieron cargar los filtros del formulario.', 'warning');
        this.cdRef.markForCheck();
      }
    });
  }

  aplicarFiltros(): void {
    this.ejecutarConsulta(true);
  }

  private ejecutarConsulta(mostrarToast: boolean): void {
    const filtros = this.construirPayload();

    if (!filtros.periodo_id) {
      if (mostrarToast) this.toastService.show('Seleccione un periodo académico.', 'warning');
      return;
    }

    this.isAplicandoFiltros.set(true);

    // Solo pedimos el "agregado por pregunta" (endpoint pesado, 44 consultas)
    // si hay un formulario seleccionado. Sin formulario no hay nada que agregar.
    const agregados$ = filtros.formulario_id
      ? this.reportesService.getAgregadoPorPregunta(filtros).pipe(catchError(() => of([])))
      : of([]);

    forkJoin({
      dataset: this.reportesService.getDatasetFiltrado(filtros).pipe(catchError(() => of(null))),
      agregados: agregados$,
    }).subscribe({
      next: ({ dataset, agregados }) => {
        const normalizado = this.normalizarDataset(dataset);
        this.datasetFiltrado.set(normalizado);

        const listaAgregados = (agregados as any)?.estructura_agregada ?? [];
        this.agregadosPorPregunta.set(listaAgregados);

        const totalFiltrado = normalizado?.total_registros ?? normalizado?.registros?.length ?? 0;
        const regs = normalizado?.registros ?? [];

        // 🔥 CORRECCIÓN: Tomar los KPIs que el backend acaba de mandarnos
        const kpisBack = (dataset as any)?.kpis;
        const contados = kpisBack ? kpisBack : this.contarEstadosDesdeRegistros(regs);

        this.estadisticas.set({
          total_fichas: totalFiltrado,
          fichas_borrador: contados.borrador,
          fichas_enviadas: contados.enviadas,
          fichas_validadas: contados.validadas,
          fichas_rechazadas: contados.rechazadas,
          distribucion_rangos: this.estadisticas()?.distribucion_rangos ?? [],
        });

        this.isAplicandoFiltros.set(false);
        this.cdRef.markForCheck();

        if (mostrarToast) {
          this.toastService.show(`Reporte generado: ${totalFiltrado} registro(s).`, 'success');
        }
      },
      error: () => {
        this.isAplicandoFiltros.set(false);
        if (mostrarToast) this.toastService.show('No se pudo generar el reporte.', 'warning');
        this.cdRef.markForCheck();
      }
    });
  }

  private contarEstadosDesdeRegistros(regs: any[]): {
  total: number;
  borrador: number;
  enviadas: number;
  validadas: number;
  rechazadas: number;
} {
  // 🔥 Aplica esto tanto en contarEstados como en contarEstadosDesdeRegistros
  let borrador = 0, enviadas = 0, validadas = 0, rechazadas = 0;

  for (const r of regs) { // o `lista.forEach` si es el otro método
    const e = String(r.estado_ficha || r.estado || '').toUpperCase();
    if (e === 'BORRADOR') borrador++;
    else if (e === 'ENVIADA' || e === 'ENVIADO') enviadas++;
    else if (e === 'VALIDADO') validadas++;
    // 🔥 CORRECCIÓN
    else if (e === 'RECHAZADO' || e === 'RECHAZADA' || e === 'OBSERVADO') rechazadas++;
  }

  return {
    total: regs.length,
    borrador,
    enviadas,
    validadas,
    rechazadas,
  };
}

  private actualizarKpisDesdeFichas(lista: any[], filtros: FiltroReporteRequest): void {
    const filtradas = lista.filter((f) => {
      const periodoId = f.periodo_id || f.periodo?.id;
      if (filtros.periodo_id && periodoId !== filtros.periodo_id) return false;

      const carreraId = f.carrera_id || f.usuario?.carrera_id || f.carrera?.id;
      if (filtros.carrera_id && carreraId && carreraId !== filtros.carrera_id) return false;

      const cicloId = f.ciclo_id || f.usuario?.ciclo_id || f.ciclo?.id;
      if (filtros.ciclo_id && cicloId && cicloId !== filtros.ciclo_id) return false;

      const formId = f.formulario_id || f.formulario?.id;
      if (filtros.formulario_id && formId && formId !== filtros.formulario_id) return false;

      if (filtros.estado_ficha) {
        const e = String(f.estado_ficha || '').toUpperCase();
        const wanted = String(filtros.estado_ficha).toUpperCase();

        if (wanted === 'ENVIADA' || wanted === 'ENVIADO') {
          if (e !== 'ENVIADA' && e !== 'ENVIADO') return false;
        // 🔥 CORRECCIÓN
        } else if (wanted === 'RECHAZADO' || wanted === 'RECHAZADA' || wanted === 'OBSERVADO') {
          if (e !== 'RECHAZADO' && e !== 'RECHAZADA' && e !== 'OBSERVADO') return false;
        } else if (e !== wanted) {
          return false;
        }
      }

      return true;
    });

    const contados = this.contarEstados(filtradas);

    this.estadisticas.set({
      total_fichas: contados.total,
      fichas_borrador: contados.borrador,
      fichas_enviadas: contados.enviadas,
      fichas_validadas: contados.validadas,
      fichas_rechazadas: contados.rechazadas,
      distribucion_rangos: this.estadisticas()?.distribucion_rangos ?? []
    });
  }

  exportarPdfResultado(): void {
    const data = this.datasetFiltrado();
    if (!data || !(data.registros || []).length) {
      this.toastService.show('No hay resultados para exportar a PDF.', 'warning');
      return;
    }

    const filtros = this.construirPayload();
    if (filtros.periodo_id) {
      this.reportesService.descargarPdfFiltrado(filtros);
    }

    this.abrirVistaImpresionPdf(data);
  }

  obtenerEtiquetaEstado(estado: any): string {
    if (!estado) return '—';
    const e = String(estado).toUpperCase();
    
    if (e === 'ENVIADA' || e === 'ENVIADO') return 'POR VALIDAR';
    if (e === 'BORRADOR') return 'POR COMPLETAR';
    if (e === 'RECHAZADO' || e === 'RECHAZADA' || e === 'OBSERVADO') return 'RECHAZADO';
    if (e === 'VALIDADO') return 'VALIDADO';
    
    return e;
  }

  private abrirVistaImpresionPdf(data: DatasetFiltradoResponse): void {
  const columnas = data.columnas || [];
  const registros = data.registros || [];
  const periodo = this.periodoSeleccionadoNombre();
  const fecha = new Date().toLocaleString('es-EC');

  // Contar desde las filas que realmente se imprimen
  const contados = this.contarEstadosDesdeRegistros(registros);

  const thead = columnas.map(c => `<th>${this.esc(c)}</th>`).join('');
  const rows = registros.map((r: any) => {
    const tds = columnas.map(c => {
      let valor = r[c] ?? '';
      // Si la columna es de estado, la transformamos
      if (c === 'estado_ficha' || c === 'estado') {
        valor = this.obtenerEtiquetaEstado(valor);
      }
      return `<td>${this.esc(String(valor))}</td>`;
    }).join('');
    return `<tr>${tds}</tr>`;
  }).join('');

  const html = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>Reporte Socioeconómico - ${this.esc(periodo)}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; color: #0f172a; margin: 24px; font-size: 11px; }
    h1 { font-size: 18px; margin: 0 0 4px; }
    .meta { color: #64748b; margin-bottom: 16px; }
    .kpis { display: flex; gap: 12px; margin-bottom: 16px; flex-wrap: wrap; }
    .kpi { border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px 12px; min-width: 120px; }
    .kpi b { display: block; font-size: 16px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #cbd5e1; padding: 6px 8px; text-align: left; vertical-align: top; }
    th { background: #f1f5f9; font-size: 10px; text-transform: uppercase; }
    tr:nth-child(even) { background: #f8fafc; }
    @media print { body { margin: 12px; } .no-print { display: none; } }
  </style>
</head>
<body>
  <h1>Instituto Superior Tecnológico del Azuay</h1>
  <div class="meta">
    <div><strong>Reporte socioeconómico</strong> · Periodo: ${this.esc(periodo)}</div>
    <div>Generado: ${this.esc(fecha)} · Registros: ${registros.length}</div>
  </div>

  <div class="kpis">
    <div class="kpi">Total<br><b>${registros.length}</b></div>
    <div class="kpi">Enviadas<br><b>${contados.enviadas}</b></div>
    <div class="kpi">Validadas<br><b>${contados.validadas}</b></div>
    <div class="kpi">Rechazadas<br><b>${contados.rechazadas}</b></div>
  </div>

  <table>
    <thead><tr>${thead}</tr></thead>
    <tbody>${rows}</tbody>
  </table>

  <p class="no-print" style="margin-top:16px;">
    <button onclick="window.print()">Imprimir / Guardar PDF</button>
  </p>
  <script>setTimeout(() => window.print(), 300);</script>
</body>
</html>`;

  const win = window.open('', '_blank');
  if (!win) {
    this.toastService.show('Permite ventanas emergentes para generar el PDF.', 'warning');
    return;
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
}

  private esc(text: string): string {
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  descargarMatrizExcel(): void {
    const periodoId = this.filterForm.get('periodo_id')?.value;
    if (!periodoId) {
      this.toastService.show('Seleccione un periodo académico para descargar.', 'warning');
      return;
    }
    this.reportesService.descargarExcelMatriz(periodoId);
  }

  exportarExcelFiltrado(): void {
    const filtros = this.construirPayload();
    if (!filtros.periodo_id) {
      this.toastService.show('Seleccione un periodo académico para exportar.', 'warning');
      return;
    }
    this.reportesService.descargarExcelFiltrado(filtros);
  }

  exportarPdfFiltrado(): void {
    const filtros = this.construirPayload();
    if (!filtros.periodo_id) {
      this.toastService.show('Seleccione un periodo académico para exportar.', 'warning');
      return;
    }
    this.reportesService.descargarPdfFiltrado(filtros);
  }

  private construirPayload(): FiltroReporteRequest {
    const formValue = this.filterForm.getRawValue();

    let estado = formValue.estado_ficha;
    if (!estado || estado === 'TODOS') estado = undefined;

    const payload: FiltroReporteRequest = {
      periodo_id: formValue.periodo_id || '',
      formulario_id: formValue.formulario_id || undefined,
      carrera_id: formValue.carrera_id || undefined,
      ciclo_id: formValue.ciclo_id || undefined,
      estado_ficha: estado,
    };

    const preguntas = this.construirFiltrosPregunta();
    if (preguntas.length > 0) {
      payload.preguntas = preguntas;
    }

    // Solo lo marcado se envía (modo estricto)
    if (this.columnasBaseSeleccionadas().length > 0) {
      payload.columnas_base = this.columnasBaseSeleccionadas();
    }

    if (this.preguntasSeleccionadasIds().length > 0) {
      payload.columnas_pregunta_ids = this.preguntasSeleccionadasIds();
    }

    return payload;
  }

  private construirFiltrosPregunta(): Array<{
    pregunta_id: string;
    opcion_id?: string;
    valor_min?: number;
    valor_max?: number;
    texto?: string;
  }> {
    const resultado: Array<{
      pregunta_id: string;
      opcion_id?: string;
      valor_min?: number;
      valor_max?: number;
      texto?: string;
    }> = [];

    for (const filtro of this.filtrosDisponibles()) {
      const valorCrudo = this.filtrosPreguntaValues[filtro.pregunta_id];
      if (valorCrudo === undefined || valorCrudo === null || valorCrudo === '') continue;

      const esNumerico = filtro.es_numerico;
      const esTexto = !esNumerico && (!filtro.opciones || filtro.opciones.length === 0);

      if (esNumerico) {
        const [minStr, maxStr] = valorCrudo.split(',');
        const min = minStr !== '' && minStr !== undefined ? Number(minStr) : undefined;
        const max = maxStr !== '' && maxStr !== undefined ? Number(maxStr) : undefined;
        if (min === undefined && max === undefined) continue;

        resultado.push({
          pregunta_id: filtro.pregunta_id,
          ...(min !== undefined && !Number.isNaN(min) ? { valor_min: min } : {}),
          ...(max !== undefined && !Number.isNaN(max) ? { valor_max: max } : {}),
        });
        continue;
      }

      if (esTexto) {
        resultado.push({ pregunta_id: filtro.pregunta_id, texto: valorCrudo });
        continue;
      }

      // Selección única/múltiple: el <select> guarda opcion_id (caso normal)
      // o texto_opcion como respaldo (si el backend no trajo un opcion_id real).
      const opcionCoincidente = (filtro.opciones || []).find(
        (op) => (op.opcion_id || op.texto_opcion) === valorCrudo
      );

      if (opcionCoincidente?.opcion_id) {
        resultado.push({ pregunta_id: filtro.pregunta_id, opcion_id: opcionCoincidente.opcion_id });
      } else {
        resultado.push({ pregunta_id: filtro.pregunta_id, texto: valorCrudo });
      }
    }

    return resultado;
  }

  private normalizarDataset(dataset: DatasetFiltradoResponse | null): DatasetFiltradoResponse | null {
    if (!dataset) return null;

    const raw = dataset as any;
    const registrosIn = Array.isArray(raw.registros)
      ? raw.registros
      : Array.isArray(raw.datos)
        ? raw.datos
        : [];

    const registros = registrosIn.map((row: any) => this.aplanarFila(row));

    // Todas las claves que realmente existen en los datos
    const colSet = new Set<string>();
    registros.forEach((r: any) => Object.keys(r).forEach((k) => colSet.add(k)));

    // 1) Columnas base en el orden del catálogo (solo las que existen en los datos)
    const ordenBase = this.COLUMNAS_BASE_DISPONIBLES
      .map((c) => c.clave)
      .filter((c) => colSet.has(c));

    // 2) Preguntas en el orden del formulario (filtrosDisponibles)
    //    Matcheamos por enunciado limpio o por clave presente
    const ordenPreguntas: string[] = [];
    for (const f of this.filtrosDisponibles()) {
      const claveLimpia = this.limpiarNombreColumna(f.enunciado);
      if (colSet.has(claveLimpia) && !ordenBase.includes(claveLimpia)) {
        ordenPreguntas.push(claveLimpia);
      } else if (colSet.has(f.enunciado) && !ordenBase.includes(f.enunciado)) {
        ordenPreguntas.push(f.enunciado);
      }
    }

    // 3) Cualquier otra columna que haya quedado fuera
    const yaOrdenadas = new Set([...ordenBase, ...ordenPreguntas]);
    const resto = [...colSet].filter((c) => !yaOrdenadas.has(c)).sort();

    const columnas = [...ordenBase, ...ordenPreguntas, ...resto];

    return {
      ...dataset,
      registros,
      columnas,
      total_registros:
        typeof dataset.total_registros === 'number'
          ? dataset.total_registros
          : typeof raw.total === 'number'
            ? raw.total
            : registros.length,
    };
  }

  private aplanarFila(row: any): Record<string, string | number> {
    const out: Record<string, string | number> = {};

    Object.keys(row || {}).forEach((key) => {
      const val = row[key];

      if (key === 'respuestas_dinamicas' || key === 'respuestas') {
        if (val && typeof val === 'object' && !Array.isArray(val)) {
          Object.keys(val).forEach((preg) => {
            out[this.limpiarNombreColumna(preg)] = this.valorATexto(val[preg]);
          });
        } else if (Array.isArray(val)) {
          val.forEach((item: any, i: number) => {
            const nombre = item?.enunciado || item?.pregunta || `respuesta_${i + 1}`;
            out[this.limpiarNombreColumna(nombre)] = this.valorATexto(
              item?.respuesta ?? item?.valor ?? item
            );
          });
        }
        return;
      }

      if (val !== null && typeof val === 'object' && !Array.isArray(val)) {
        if ('valor' in val || 'respuesta' in val || 'texto' in val) {
          out[key] = this.valorATexto(val.valor ?? val.respuesta ?? val.texto);
        } else {
          Object.keys(val).forEach((k) => {
            out[`${key}_${k}`] = this.valorATexto(val[k]);
          });
        }
        return;
      }

      if (Array.isArray(val)) {
        out[key] = val.map(v => this.valorATexto(v)).join(', ');
        return;
      }

      out[key] = val ?? '';
    });

    return out;
  }

  private valorATexto(v: any): string {
    if (v === null || v === undefined) return '';
    if (typeof v === 'object') {
      if (Array.isArray(v)) return v.map(x => this.valorATexto(x)).join(', ');
      return v.texto_opcion || v.texto || v.valor || v.respuesta || JSON.stringify(v);
    }
    return String(v);
  }

  private limpiarNombreColumna(nombre: string): string {
    return String(nombre).trim().replace(/\s+/g, ' ').substring(0, 80);
  }

  setFiltroPreguntaValor(preguntaId: string, value: string): void {
    this.filtrosPreguntaValues[preguntaId] = value;
    this.filtrosChangedSubject.next();
  }

  setFiltroPreguntaRango(preguntaId: string, min: string, max: string): void {
    this.filtrosPreguntaValues[preguntaId] = `${min || ''},${max || ''}`;
    this.filtrosChangedSubject.next();
  }

  getFiltroPreguntaValor(preguntaId: string): string {
    return this.filtrosPreguntaValues[preguntaId] || '';
  }

  getFiltroPreguntaRango(preguntaId: string): { min: string; max: string } {
    const valor = this.getFiltroPreguntaValor(preguntaId);
    const [min = '', max = ''] = valor.split(',');
    return { min, max };
  }

  toggleAvanzado(): void {
    this.mostrarAvanzado.update(v => !v);
  }
  toggleColumnaBase(clave: string): void {
    this.columnasBaseSeleccionadas.update((actuales) =>
      actuales.includes(clave)
        ? actuales.filter((c) => c !== clave)
        : [...actuales, clave],
    );
    this.filtrosChangedSubject.next();
  }

  esColumnaBaseSeleccionada(clave: string): boolean {
    return this.columnasBaseSeleccionadas().includes(clave);
  }

  toggleColumnaPregunta(preguntaId: string): void {
    this.preguntasSeleccionadasIds.update((actuales) =>
      actuales.includes(preguntaId)
        ? actuales.filter((id) => id !== preguntaId)
        : [...actuales, preguntaId],
    );
    this.filtrosChangedSubject.next();
  }

  esColumnaPreguntaSeleccionada(preguntaId: string): boolean {
    return this.preguntasSeleccionadasIds().includes(preguntaId);
  }

  limpiarSeleccionColumnas(): void {
    this.columnasBaseSeleccionadas.set([]);
    this.preguntasSeleccionadasIds.set([]);
    this.filtrosChangedSubject.next();
  }

}