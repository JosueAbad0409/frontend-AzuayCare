import { Component, OnInit, inject, signal,computed, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { UiTableComponent } from '../../../shared/components/ui/ui-table/ui-table.component';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
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
  imports: [CommonModule, ReactiveFormsModule, UiTableComponent],
  templateUrl: './reportes.component.html',
  styleUrls: ['./reportes.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ReportesComponent implements OnInit {
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

  periodos = signal<PeriodoMatricula[]>([]);
  carreras = signal<Carrera[]>([]);
  ciclos = signal<Ciclo[]>([]);
  formularios = signal<Formulario[]>([]);
  filtrosDisponibles = signal<FiltroPreguntaDisponible[]>([]);
  datasetFiltrado = signal<DatasetFiltradoResponse | null>(null);
  agregadosPorPregunta = signal<AgregadoPorPregunta[]>([]);
  estadisticas = signal<EstadisticasPeriodo | null>(null);

  isLoading = signal(true);
  isLoadingStats = signal(false);
  isLoadingFilters = signal(false);
  isAplicandoFiltros = signal(false);
  isDescargandoExcel = this.descargaService.isDescargando;

  filterForm: FormGroup = this.fb.group({
    periodo_id: [''],
    carrera_id: [''],
    ciclo_id: [''],
    estado_ficha: ['TODOS'],
    formulario_id: ['']
  });

  ngOnInit(): void {
    this.cargarFiltrosIniciales();

    this.filterForm.get('periodo_id')?.valueChanges.subscribe((periodoId: string) => {
      if (periodoId) {
        this.cargarEstadisticas(periodoId);
      } else {
        this.estadisticas.set(null);
        this.cdRef.markForCheck();
      }
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

  /**
   * Estadísticas del periodo.
   * Si el backend trae rechazadas en 0, las recalculamos desde las fichas reales.
   */
  cargarEstadisticas(periodoId: string): void {
    this.isLoadingStats.set(true);

    forkJoin({
      stats: this.reportesService.getEstadisticasGenerales(periodoId).pipe(catchError(() => of(null))),
      fichas: this.revisionService.getFichasPaginadas(0, 10000, '', 'TODOS').pipe(catchError(() => of({ data: [] })))
    }).subscribe({
      next: ({ stats, fichas }) => {
        const lista: any[] = (fichas as any)?.data || (fichas as any) || [];

        // Solo del periodo seleccionado
        const delPeriodo = lista.filter((f) => {
          const pid = f.periodo_id || f.periodo?.id;
          return !periodoId || pid === periodoId;
        });

        const contados = this.contarEstados(delPeriodo);

        const finalStats: EstadisticasPeriodo = {
          total_fichas: stats?.total_fichas ?? contados.total,
          fichas_borrador: stats?.fichas_borrador ?? contados.borrador,
          fichas_enviadas: stats?.fichas_enviadas ?? contados.enviadas,
          fichas_validadas: stats?.fichas_validadas ?? contados.validadas,
          // 🔥 Si el backend manda 0, usamos el conteo real
          fichas_rechazadas: (stats?.fichas_rechazadas && stats.fichas_rechazadas > 0)
            ? stats.fichas_rechazadas
            : contados.rechazadas,
          distribucion_rangos: stats?.distribucion_rangos ?? []
        };

        // Si total viene mal, usamos el conteo real
        if (!finalStats.total_fichas) {
          finalStats.total_fichas = contados.total;
          finalStats.fichas_borrador = contados.borrador;
          finalStats.fichas_enviadas = contados.enviadas;
          finalStats.fichas_validadas = contados.validadas;
          finalStats.fichas_rechazadas = contados.rechazadas;
        }

        this.estadisticas.set(finalStats);
        this.isLoadingStats.set(false);
        this.cdRef.markForCheck();
      },
      error: () => {
        this.toastService.show('No se pudieron obtener las estadísticas del periodo.', 'warning');
        this.estadisticas.set(null);
        this.isLoadingStats.set(false);
        this.cdRef.markForCheck();
      }
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
  const filtros = this.construirPayload();

  if (!filtros.periodo_id) {
    this.toastService.show('Seleccione un periodo académico.', 'warning');
    return;
  }

  this.isAplicandoFiltros.set(true);

  forkJoin({
    dataset: this.reportesService.getDatasetFiltrado(filtros).pipe(catchError(() => of(null))),
    agregados: this.reportesService.getAgregadoPorPregunta(filtros).pipe(catchError(() => of([]))),
    // 🔥 misma fuente que Revisión
    fichas: this.revisionService.getFichasPaginadas(0, 10000, '', 'TODOS').pipe(catchError(() => of({ data: [] })))
  }).subscribe({
    next: ({ dataset, agregados, fichas }) => {
      this.datasetFiltrado.set(this.normalizarDataset(dataset));
      this.agregadosPorPregunta.set(agregados || []);

      // Recalcular KPIs con filtros aplicados
      const lista: any[] = (fichas as any)?.data || (fichas as any) || [];
      this.actualizarKpisDesdeFichas(lista, filtros);

      this.isAplicandoFiltros.set(false);
      this.cdRef.markForCheck();

      const total = this.datasetFiltrado()?.total_registros || 0;
      this.toastService.show(`Reporte generado: ${total} registro(s).`, 'success');
    },
    error: () => {
      this.isAplicandoFiltros.set(false);
      this.toastService.show('No se pudo generar el reporte.', 'warning');
      this.cdRef.markForCheck();
    }
  });
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
      } else if (wanted === 'RECHAZADO' || wanted === 'RECHAZADA') {
        if (e !== 'RECHAZADO' && e !== 'RECHAZADA') return false;
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

  // 1) Intenta PDF del backend (filtrado)
  const filtros = this.construirPayload();
  if (filtros.periodo_id) {
    this.reportesService.descargarPdfFiltrado(filtros);
  }

  // 2) Además (o en su lugar) genera un PDF simple imprimible del resultado en pantalla
  this.abrirVistaImpresionPdf(data);
}

/** Abre una vista limpia para imprimir / guardar como PDF */
private abrirVistaImpresionPdf(data: DatasetFiltradoResponse): void {
  const columnas = data.columnas || [];
  const registros = data.registros || [];
  const periodo = this.periodoSeleccionadoNombre();
  const fecha = new Date().toLocaleString('es-EC');

  const thead = columnas.map(c => `<th>${this.esc(c)}</th>`).join('');
  const rows = registros.map((r: any) => {
    const tds = columnas.map(c => `<td>${this.esc(String(r[c] ?? ''))}</td>`).join('');
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
    @media print {
      body { margin: 12px; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <h1>Instituto Superior Tecnológico del Azuay</h1>
  <div class="meta">
    <div><strong>Reporte socioeconómico</strong> · Periodo: ${this.esc(periodo)}</div>
    <div>Generado: ${this.esc(fecha)} · Registros: ${registros.length}</div>
  </div>

  <div class="kpis">
    <div class="kpi">Total<br><b>${this.estadisticas()?.total_fichas ?? registros.length}</b></div>
    <div class="kpi">Enviadas<br><b>${this.estadisticas()?.fichas_enviadas ?? 0}</b></div>
    <div class="kpi">Validadas<br><b>${this.estadisticas()?.fichas_validadas ?? 0}</b></div>
    <div class="kpi">Rechazadas<br><b>${this.estadisticas()?.fichas_rechazadas ?? 0}</b></div>
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

  return {
    periodo_id: formValue.periodo_id || '',
    formulario_id: formValue.formulario_id || undefined,
    carrera_id: formValue.carrera_id || undefined,
    ciclo_id: formValue.ciclo_id || undefined,
    estado_ficha: estado
    // sin "preguntas: [...]" para el reporte general
  };
}

  private normalizarDataset(dataset: DatasetFiltradoResponse | null): DatasetFiltradoResponse | null {
  if (!dataset) return null;

  const raw = dataset as any;
  const registrosIn = Array.isArray(raw.registros)
    ? raw.registros
    : Array.isArray(raw.datos)
      ? raw.datos
      : [];

  // Aplanar cada fila
  const registros = registrosIn.map((row: any) => this.aplanarFila(row));

  // Columnas = unión de todas las keys aplanadas (orden estable)
  const colSet = new Set<string>();
  registros.forEach((r: any) => Object.keys(r).forEach(k => colSet.add(k)));

  // Prioridad de columnas “bonitas” primero
  const prioritarias = [
    'cedula', 'nombres', 'apellidos', 'email',
    'carrera', 'ciclo', 'estado_ficha', 'balance', 'nivel_economico'
  ];
  const resto = [...colSet].filter(c => !prioritarias.includes(c)).sort();
  const columnas = [
    ...prioritarias.filter(c => colSet.has(c)),
    ...resto
  ];

  return {
    ...dataset,
    registros,
    columnas,
    total_registros: typeof dataset.total_registros === 'number'
      ? dataset.total_registros
      : typeof raw.total === 'number'
        ? raw.total
        : registros.length
  };
}

/** Convierte objetos anidados en texto legible para la tabla */
private aplanarFila(row: any): Record<string, string | number> {
  const out: Record<string, string | number> = {};

  Object.keys(row || {}).forEach((key) => {
    const val = row[key];

    // respuestas_dinamicas / objetos de preguntas
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

    // objeto genérico
    if (val !== null && typeof val === 'object' && !Array.isArray(val)) {
      // si es { enunciado, valor } etc.
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
  return String(nombre)
    .replace(/\s+/g, '_')
    .replace(/[^\wáéíóúñÁÉÍÓÚÑ]/gi, '')
    .substring(0, 40);
}

  setFiltroPreguntaValor(preguntaId: string, value: string): void {
    this.filtrosPreguntaValues[preguntaId] = value;
  }

  setFiltroPreguntaRango(preguntaId: string, min: string, max: string): void {
    this.filtrosPreguntaValues[preguntaId] = `${min || ''},${max || ''}`;
  }

  getFiltroPreguntaValor(preguntaId: string): string {
    return this.filtrosPreguntaValues[preguntaId] || '';
  }

  getFiltroPreguntaRango(preguntaId: string): { min: string; max: string } {
    const valor = this.getFiltroPreguntaValor(preguntaId);
    const [min = '', max = ''] = valor.split(',');
    return { min, max };
  }

  mostrarAvanzado = signal(false);

periodoSeleccionadoNombre = computed(() => {
  const id = this.filterForm.get('periodo_id')?.value;
  const p = this.periodos().find(x => x.id === id);
  return p?.nombre || '—';
});

toggleAvanzado(): void {
  this.mostrarAvanzado.update(v => !v);
}

}