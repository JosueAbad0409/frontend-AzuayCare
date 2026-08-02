import { Component, OnInit, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { UiButtonComponent } from '../../../shared/components/ui/ui-button/ui-button.component';
import { UiCardComponent } from '../../../shared/components/ui/ui-card/ui-card.component';
import { UiTableComponent } from '../../../shared/components/ui/ui-table/ui-table.component';
import { forkJoin } from 'rxjs';
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
import {
  AgregadoPorPregunta,
  DatasetFiltradoResponse,
  FiltroPreguntaDisponible,
  FiltroReporteRequest
} from '../../../core/models/reportes.model';

@Component({
  selector: 'app-reportes',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, UiButtonComponent, UiCardComponent, UiTableComponent],
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
  private readonly toastService = inject(ToastService);
  private readonly fb = inject(FormBuilder);
  private readonly descargaService = inject(DescargaArchivosService);

  private filtrosPreguntaValues: Record<string, string> = {};

  periodos = signal<PeriodoMatricula[]>([]);
  carreras = signal<Carrera[]>([]);
  ciclos = signal<Ciclo[]>([]);
  formularios = signal<Formulario[]>([]);
  filtrosDisponibles = signal<FiltroPreguntaDisponible[]>([]);
  datasetFiltrado = signal<DatasetFiltradoResponse | null>(null);
  agregadosPorPregunta = signal<AgregadoPorPregunta[]>([]);
  estadisticas = signal<EstadisticasPeriodo | null>(null);
  
  isLoading = signal<boolean>(true);
  isLoadingStats = signal<boolean>(false);
  isLoadingFilters = signal<boolean>(false);
  isAplicandoFiltros = signal<boolean>(false);
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
      }
    });

    this.filterForm.get('carrera_id')?.valueChanges.subscribe((carreraId: string) => {
      if (!carreraId) {
        this.ciclos.set([]);
        this.filterForm.patchValue({ ciclo_id: '' }, { emitEvent: false });
        return;
      }
      this.cargarCiclosPorCarrera(carreraId);
    });

    this.filterForm.get('formulario_id')?.valueChanges.subscribe((formularioId: string) => {
      if (!formularioId) {
        this.filtrosDisponibles.set([]);
        return;
      }
      this.cargarFiltrosDisponibles(formularioId);
    });
  }

  cargarFiltrosIniciales(): void {
    this.isLoading.set(true);

    forkJoin({
      carreras: this.carreraService.getCarreras(),
      periodos: this.periodoService.getPeriodos(),
      formularios: this.formularioService.getFormularios()
    }).subscribe({
      next: ({ carreras, periodos, formularios }) => {
        this.carreras.set(carreras || []);
        this.periodos.set(periodos || []);
        this.formularios.set(formularios || []);
        
        const periodoActivo = periodos.find((p: PeriodoMatricula) => p.activo) || periodos[0];
        
        if (periodoActivo) {
          this.filterForm.patchValue({ periodo_id: periodoActivo.id }, { emitEvent: true });
        }
        
        this.isLoading.set(false);
      },
      error: (err: unknown) => {
        console.error('Error al cargar filtros iniciales:', err);
        this.toastService.show('Error al cargar filtros del sistema.', 'error');
        this.isLoading.set(false);
      }
    });
  }

  cargarEstadisticas(periodoId: string): void {
    this.isLoadingStats.set(true);
    this.reportesService.getEstadisticasGenerales(periodoId).subscribe({
      next: (stats: EstadisticasPeriodo) => {
        this.estadisticas.set(stats);
        this.isLoadingStats.set(false);
      },
      error: (err: unknown) => {
        console.error('Error al cargar estadísticas:', err);
        this.toastService.show('No se pudieron obtener las estadísticas del periodo.', 'warning');
        this.estadisticas.set(null);
        this.isLoadingStats.set(false);
      }
    });
  }

  cargarCiclosPorCarrera(carreraId: string): void {
    this.ciclos.set([]);
    this.filterForm.patchValue({ ciclo_id: '' }, { emitEvent: false });
    this.ciclosService.getCiclosByCarrera(carreraId).subscribe({
      next: (ciclos) => this.ciclos.set(ciclos || []),
      error: () => this.toastService.show('No se pudieron cargar los ciclos de la carrera.', 'warning')
    });
  }

  cargarFiltrosDisponibles(formularioId: string): void {
    this.isLoadingFilters.set(true);
    this.reportesService.getFiltrosDisponibles(formularioId).subscribe({
      next: (filtros) => {
        this.filtrosDisponibles.set(filtros || []);
        this.isLoadingFilters.set(false);
      },
      error: () => {
        this.filtrosDisponibles.set([]);
        this.isLoadingFilters.set(false);
        this.toastService.show('No se pudieron cargar los filtros del formulario.', 'warning');
      }
    });
  }

  aplicarFiltros(): void {
    const filtros = this.construirPayload();
    if (!filtros.periodo_id) {
      this.toastService.show('Seleccione un periodo académico para aplicar los filtros.', 'warning');
      return;
    }

    this.isAplicandoFiltros.set(true);

    forkJoin({
      dataset: this.reportesService.getDatasetFiltrado(filtros),
      agregados: this.reportesService.getAgregadoPorPregunta(filtros)
    }).subscribe({
      next: ({ dataset, agregados }) => {
        const datasetNormalizado = this.normalizarDataset(dataset);
        this.datasetFiltrado.set(datasetNormalizado);
        this.agregadosPorPregunta.set(agregados || []);
        this.isAplicandoFiltros.set(false);
      },
      error: () => {
        this.isAplicandoFiltros.set(false);
        this.toastService.show('No se pudo aplicar la combinación de filtros.', 'warning');
      }
    });
  }

  descargarMatrizExcel(): void {
    const periodoId = this.filterForm.get('periodo_id')?.value;
    if (!periodoId) {
      this.toastService.show('Por favor seleccione un periodo académico para descargar.', 'warning');
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
    const preguntas: NonNullable<FiltroReporteRequest['preguntas']> = [];
    let filtroPrincipal: { pregunta_id?: string; valor_pregunta?: string | number | null } | undefined;
    const payload: FiltroReporteRequest & Record<string, unknown> = {
      periodo_id: formValue.periodo_id || '',
      formulario_id: formValue.formulario_id || undefined,
      carrera_id: formValue.carrera_id || undefined,
      ciclo_id: formValue.ciclo_id || undefined,
      estado_ficha: formValue.estado_ficha === 'TODOS' ? undefined : formValue.estado_ficha,
      preguntas
    };

    this.filtrosDisponibles().forEach((filtro) => {
      const preguntaFiltro: { pregunta_id: string; opcion_id?: string; valor_min?: number; valor_max?: number; texto?: string } = {
        pregunta_id: filtro.pregunta_id
      };

      if (filtro.tipo_campo === 'NUMERIC' || filtro.es_numerico) {
        const rango = this.getFiltroPreguntaValor(filtro.pregunta_id);
        const [min, max] = (rango || '').split(',');
        if (min) preguntaFiltro.valor_min = Number(min);
        if (max) preguntaFiltro.valor_max = Number(max);
      } else if (filtro.tipo_campo === 'TEXTO' || filtro.tipo_campo === 'TEXTO_LIBRE') {
        const texto = this.getFiltroPreguntaValor(filtro.pregunta_id);
        if (texto) preguntaFiltro.texto = texto;
      } else if (filtro.tipo_campo && (filtro.tipo_campo.includes('OPCION') || filtro.tipo_campo.includes('SELECT') || filtro.tipo_campo.includes('RADIO') || filtro.tipo_campo.includes('CHECKBOX'))) {
        const opcionId = this.getFiltroPreguntaValor(filtro.pregunta_id);
        if (opcionId) preguntaFiltro.opcion_id = opcionId;
      }

      if (Object.keys(preguntaFiltro).length > 1) {
        preguntas.push(preguntaFiltro);
        if (!filtroPrincipal) {
          filtroPrincipal = {
            pregunta_id: filtro.pregunta_id,
            valor_pregunta: this.obtenerValorPreguntaParaBackend(filtro)
          };
        }
      }
    });

    if (filtroPrincipal && typeof filtroPrincipal.pregunta_id === 'string' && filtroPrincipal.pregunta_id.length > 0) {
      payload['pregunta_id'] = filtroPrincipal.pregunta_id;
      payload['valor_pregunta'] = filtroPrincipal.valor_pregunta ?? null;
    }

    return payload as FiltroReporteRequest;
  }

  private obtenerValorPreguntaParaBackend(filtro: FiltroPreguntaDisponible): string | number | undefined {
    if (filtro.tipo_campo === 'NUMERIC' || filtro.es_numerico) {
      const { min, max } = this.getFiltroPreguntaRango(filtro.pregunta_id);
      if (min || max) {
        return `${min || ''},${max || ''}`;
      }
      return undefined;
    }

    if (filtro.tipo_campo === 'TEXTO' || filtro.tipo_campo === 'TEXTO_LIBRE') {
      return this.getFiltroPreguntaValor(filtro.pregunta_id) || undefined;
    }

    const opcionId = this.getFiltroPreguntaValor(filtro.pregunta_id);
    return opcionId || undefined;
  }

  private normalizarDataset(dataset: DatasetFiltradoResponse | null): DatasetFiltradoResponse | null {
    if (!dataset) {
      return null;
    }

    const datasetConCompatibilidad = dataset as DatasetFiltradoResponse & {
      datos?: Array<Record<string, unknown>>;
      registros?: Array<Record<string, unknown>>;
      columnas_dataset?: string[];
      total?: number;
    };

    const registros = Array.isArray(datasetConCompatibilidad.registros)
      ? datasetConCompatibilidad.registros
      : Array.isArray(datasetConCompatibilidad.datos)
        ? datasetConCompatibilidad.datos
        : [];

    const columnas = Array.isArray(dataset.columnas)
      ? dataset.columnas
      : Array.isArray(datasetConCompatibilidad.columnas_dataset)
        ? datasetConCompatibilidad.columnas_dataset
        : [];

    const totalRegistros = typeof dataset.total_registros === 'number'
      ? dataset.total_registros
      : typeof datasetConCompatibilidad.total === 'number'
        ? datasetConCompatibilidad.total
        : registros.length;

    return {
      ...dataset,
      registros,
      columnas,
      total_registros: totalRegistros
    };
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
}