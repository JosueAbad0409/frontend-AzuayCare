import {
  Component,
  OnInit,
  inject,
  signal,
  computed,
  ElementRef,
  ViewChild,
  afterNextRender,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { CarreraService } from '../../../core/services/carrera.service';
import { CiclosService } from '../../../core/services/ciclos.service';
import { PeriodoService } from '../../../core/services/periodo.service';
import { RevisionService } from '../../../core/services/revision.service';
import { FormularioService } from '../../../core/services/formulario.service';
import { PeriodoMatricula } from '../../../core/models/periodo.model';
import { Carrera } from '../../../core/models/carrera.model';
import { Ciclo } from '../../../core/models/ciclo.model';
import { FichaRevision } from '../../../core/models/revision-ficha.model';
import { environment } from '../../../../environments/environment';
import { Chart, registerables } from 'chart.js';
import { forkJoin } from 'rxjs';
import Swal from 'sweetalert2';

Chart.register(...registerables);

export interface FiltrosDashboard {
  periodoId: string;
  carreraId: string;
  cicloId: string;
  etnia: string;
  sexo: string;
  zona: string;
  estadoFicha: string;
  nivelEconomico: string;
  busqueda: string;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css'],
})
export class DashboardComponent implements OnInit {
  private readonly carreraService = inject(CarreraService);
  private readonly ciclosService = inject(CiclosService);
  private readonly periodoService = inject(PeriodoService);
  private readonly revisionService = inject(RevisionService);
  private readonly formularioService = inject(FormularioService);

  isLoading = signal(true);

  // NUEVO: Signal para controlar el estado de generación/descarga de archivos
  isExporting = signal(false);

  periodoActivo = signal<PeriodoMatricula | null>(null);

  carrerasList = signal<Carrera[]>([]);
  ciclosList = signal<Ciclo[]>([]);
  periodosList = signal<PeriodoMatricula[]>([]);
  fichasList = signal<FichaRevision[]>([]);
  totalFormularios = signal(0);

  // --- Filtros demográficos (sin estado de ficha) ---
  filtrosPoblacion = signal({
    periodoId: '' as string,
    carreraId: '' as string,
    cicloId: '' as string,
    sexo: '' as string,
    etnia: '' as string,
    zona: '' as string,
    tieneDiscapacidad: '' as string, // '', 'true', 'false'
    busqueda: '' as string,
  });

  resultadosPoblacion = signal<any[]>([]);
  cargandoPoblacion = signal(false);
  errorPoblacion = signal('');

  /** Ciclos según carrera del filtro de población */
  ciclosPoblacion = computed(() => {
  const carreraId = this.filtrosPoblacion().carreraId;
  const todos = this.ciclosList();
  if (!carreraId) return todos;

  return todos.filter((c) =>
    (c.ciclosCarreras || []).some(
      (cc) => String(cc.carrera_id || cc.carrera?.id) === String(carreraId),
    ),
  );
});

  setFiltroPoblacion(key: string, value: string) {
    this.filtrosPoblacion.update((prev) => {
      const next: any = { ...prev, [key]: value };
      if (key === 'carreraId') next.cicloId = '';
      return next;
    });
    // Cada cambio recarga resultados
    this.buscarPoblacion();
  }

  limpiarFiltrosPoblacion() {
    const activo = this.periodoActivo();
    this.filtrosPoblacion.set({
      periodoId: activo?.id || '',
      carreraId: '',
      cicloId: '',
      sexo: '',
      etnia: '',
      zona: '',
      tieneDiscapacidad: '',
      busqueda: '',
    });
    this.buscarPoblacion();
  }

  /** Body para el backend: solo manda lo que el usuario eligió */
  private buildBodyPoblacion() {
    const f = this.filtrosPoblacion();
    const body: any = { vista: 'poblacion' };

    if (f.periodoId) body.periodo_id = f.periodoId;
    if (f.carreraId) body.carrera_id = f.carreraId;
    if (f.cicloId) body.ciclo_id = f.cicloId;
    if (f.sexo) body.sexo = f.sexo;
    if (f.etnia) body.etnia = f.etnia;
    if (f.zona) body.zona_residencia = f.zona;
    if (f.tieneDiscapacidad === 'true') body.tiene_discapacidad = true;
    if (f.tieneDiscapacidad === 'false') body.tiene_discapacidad = false;
    if (f.busqueda.trim()) body.busqueda = f.busqueda.trim();

    return body;
  }

  private authHeaders(): HeadersInit {
    const token = localStorage.getItem('azuaycare_access_token') || '';
    return {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  }

  /** Resultados en vivo (tabla de abajo) */
  async buscarPoblacion() {
    this.cargandoPoblacion.set(true);
    this.errorPoblacion.set('');
    try {
      const res = await fetch(`${environment.apiUrl}/reportes/dataset-filtrado`, {
        method: 'POST',
        headers: this.authHeaders(),
        body: JSON.stringify(this.buildBodyPoblacion()),
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || `Error ${res.status}`);
      }
      const data = await res.json();
      this.resultadosPoblacion.set(Array.isArray(data) ? data : data?.datos || []);
    } catch (e: any) {
      this.errorPoblacion.set(e?.message || 'No se pudieron cargar los resultados.');
      this.resultadosPoblacion.set([]);
    } finally {
      this.cargandoPoblacion.set(false);
    }
  }

  private async descargarArchivo(url: string, nombre: string, titulo = 'Generando archivo...') {
  this.isExporting.set(true);

  Swal.fire({
    title: titulo,
    text: 'Esto puede tardar unos segundos. No cierres esta ventana.',
    allowOutsideClick: false,
    allowEscapeKey: false,
    didOpen: () => Swal.showLoading(),
  });

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: this.authHeaders(),
      body: JSON.stringify(this.buildBodyPoblacion()),
    });

    if (!res.ok) {
      const t = await res.text();
      throw new Error(t || `Error ${res.status}`);
    }

    const blob = await res.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = nombre;
    a.click();
    URL.revokeObjectURL(a.href);

    await Swal.fire({
      icon: 'success',
      title: 'Listo',
      text: 'El archivo se descargó correctamente.',
      timer: 1800,
      showConfirmButton: false,
    });
  } catch (e: any) {
    await Swal.fire({
      icon: 'error',
      title: 'No se pudo generar',
      text: e?.message || 'Ocurrió un error al exportar.',
    });
  } finally {
    this.isExporting.set(false);
  }
}


async exportarPdfPoblacion() {
  await this.descargarArchivo(
    `${environment.apiUrl}/reportes/dataset-filtrado/pdf`,
    `Poblacion_${Date.now()}.pdf`,
    'Generando PDF...',
  );
}

  async exportarExcelPoblacion() {
    try {
      await this.descargarArchivo(
        `${environment.apiUrl}/reportes/dataset-filtrado/excel`,
        `Poblacion_${Date.now()}.xlsx`,
      );
    } catch (e: any) {
      alert(e?.message || 'No se pudo exportar Excel');
    }
  }


  filtros = signal<FiltrosDashboard>({
    periodoId: '',
    carreraId: '',
    cicloId: '',
    etnia: '',
    sexo: '',
    zona: '',
    estadoFicha: '',
    nivelEconomico: '',
    busqueda: '',
  });

  readonly etnias = [
    'Mestizo/a',
    'Indígena',
    'Afroecuatoriano/a',
    'Montubio/a',
    'Blanco/a',
    'Mulato/a',
    'Otro',
  ];
  readonly sexos = ['Hombre', 'Mujer'];
  readonly zonas = ['Urbano', 'Rural'];
  readonly estadosFicha = ['BORRADOR', 'ENVIADA', 'VALIDADO', 'RECHAZADO', 'OBSERVADO'];

  // ---- Filtro económico ----
  ingresoMin = signal<number | null>(null);
  ingresoMax = signal<number | null>(null);
  egresoMin = signal<number | null>(null);
  egresoMax = signal<number | null>(null);

  tipoGraficoCarrera = signal<'bar' | 'pie'>('bar');

  // ---- Canvas del HTML ----
  @ViewChild('carreraChartCanvas') carreraChartCanvas?: ElementRef<HTMLCanvasElement>;
  @ViewChild('carreraEconomiaChartCanvas') carreraEconomiaChartCanvas?: ElementRef<HTMLCanvasElement>;
  @ViewChild('estadoChartCanvas') estadoChartCanvas?: ElementRef<HTMLCanvasElement>;
  @ViewChild('economiaChartCanvas') economiaChartCanvas?: ElementRef<HTMLCanvasElement>;

  private carreraChart?: Chart;
  private carreraEconomiaChart?: Chart;
  private estadoChart?: Chart;
  private economiaChart?: Chart;

  // ---- Ciclos por carrera ----
  ciclosFiltrados = computed(() => {
  const carreraId = this.filtros().carreraId;
  const todos = this.ciclosList();
  if (!carreraId) return todos;

  return todos.filter((c) =>
    (c.ciclosCarreras || []).some(
      (cc) => String(cc.carrera_id || cc.carrera?.id) === String(carreraId),
    ),
  );
});

  nivelesDisponibles = computed(() => {
    const set = new Set<string>();
    this.fichasList().forEach((f) => {
      const n = f.nivelEconomico?.nombre;
      if (n) set.add(n);
    });
    return Array.from(set).sort();
  });

  /** Fichas con filtros demográficos / académicos */
  fichasFiltradas = computed(() => {
    const f = this.filtros();
    let list = this.fichasList() as any[];

    if (f.periodoId) {
      list = list.filter(
        (x) => x.periodo_id === f.periodoId || x.periodo?.id === f.periodoId,
      );
    }
    if (f.carreraId) {
  list = list.filter((x) => {
    const carreraId =
      x.usuario?.carrera_id ||
      x.usuario?.carrera?.id ||
      x.carrera_id;
    return String(carreraId) === String(f.carreraId);
  });
}

if (f.cicloId) {
  list = list.filter((x) => {
    const cicloId =
      x.usuario?.ciclo_id ||
      x.usuario?.ciclo?.id ||
      x.ciclo_id;
    return String(cicloId) === String(f.cicloId);
  });
}
    if (f.estadoFicha) {
      list = list.filter((x) => x.estado_ficha === f.estadoFicha);
    }
    if (f.nivelEconomico) {
      list = list.filter((x) => x.nivelEconomico?.nombre === f.nivelEconomico);
    }
    if (f.etnia) {
      list = list.filter(
        (x) => x.usuario?.etnia === f.etnia || x.perfil?.etnia === f.etnia,
      );
    }
    if (f.sexo) {
      list = list.filter(
        (x) => x.usuario?.sexo === f.sexo || x.perfil?.sexo === f.sexo,
      );
    }
    if (f.zona) {
      list = list.filter(
        (x) =>
          x.usuario?.zona_residencia === f.zona ||
          x.perfil?.zona_residencia === f.zona,
      );
    }
    if (f.busqueda.trim()) {
      const q = f.busqueda.trim().toLowerCase();
      list = list.filter((x) => {
        const u = x.usuario || {};
        const nombre = `${u.primer_nombre || ''} ${u.primer_apellido || ''}`.toLowerCase();
        const cedula = (u.cedula || '').toLowerCase();
        const email = (u.email_institucional || '').toLowerCase();
        return nombre.includes(q) || cedula.includes(q) || email.includes(q);
      });
    }
    return list;
  });

  // ---- KPIs ----
  totalCarreras = computed(() => this.carrerasList().length);
  totalFichas = computed(() => this.fichasFiltradas().length);
  totalFichasEvaluadas = computed(() => this.fichasFiltradas().length);

  fichasEnviadas = computed(
  () =>
    this.fichasFiltradas().filter((f) => {
      const e = (f.estado_ficha || '').toUpperCase();
      return e === 'ENVIADA' || e === 'ENVIADO';
    }).length,
);

fichasValidadas = computed(
  () =>
    this.fichasFiltradas().filter(
      (f) => (f.estado_ficha || '').toUpperCase() === 'VALIDADO',
    ).length,
);

fichasRechazadas = computed(
  () =>
    this.fichasFiltradas().filter((f) => {
      const e = (f.estado_ficha || '').toUpperCase();
      return e === 'RECHAZADO' || e === 'RECHAZADA';
    }).length,
);
  fichasBorrador = computed(
    () => this.fichasFiltradas().filter((f) => f.estado_ficha === 'BORRADOR').length,
  );

  totalNee = computed(() => {
    return this.fichasFiltradas().filter((f: any) => {
      const p = f.perfil || f.usuario || {};
      return (
        p.tiene_discapacidad === true ||
        p.esta_embarazada === true ||
        f.prioridad_atencion === true ||
        f.es_nee === true
      );
    }).length;
  });

  hayFiltrosActivos = computed(() => {
    return (
      this.ingresoMin() != null ||
      this.ingresoMax() != null ||
      this.egresoMin() != null ||
      this.egresoMax() != null
    );
  });

  estudiantesFiltradosList = computed(() => {
    let list = this.fichasFiltradas() as any[];
    const iMin = this.ingresoMin();
    const iMax = this.ingresoMax();
    const eMin = this.egresoMin();
    const eMax = this.egresoMax();

    if (iMin != null) list = list.filter((f) => Number(f.total_ingresos ?? 0) >= iMin);
    if (iMax != null) list = list.filter((f) => Number(f.total_ingresos ?? 0) <= iMax);
    if (eMin != null) list = list.filter((f) => Number(f.total_egresos ?? 0) >= eMin);
    if (eMax != null) list = list.filter((f) => Number(f.total_egresos ?? 0) <= eMax);
    return list;
  });

  estudiantesFiltrados = computed(() => this.estudiantesFiltradosList().length);

  condiciones = computed(() => {
    const map = new Map<string, number>();
    const bump = (nombre: string) => map.set(nombre, (map.get(nombre) || 0) + 1);

    this.fichasFiltradas().forEach((f: any) => {
      const p = f.perfil || {};
      if (p.tiene_discapacidad) bump('Discapacidad');
      if (p.esta_embarazada) bump('Embarazo');
      if (p.tiene_hijos) bump('Tiene hijos/as');
      if (f.prioridad_atencion || f.es_nee) bump('Prioridad de atención');
    });

    return Array.from(map.entries())
      .map(([nombre, total]) => ({ nombre, total }))
      .sort((a, b) => b.total - a.total);
  });

  constructor() {
    afterNextRender(() => {
      if (!this.isLoading()) this.inicializarGraficos();
    });
  }

  ngOnInit(): void {
    this.cargarResumen();
  }

  cargarResumen(): void {
    this.isLoading.set(true);

    forkJoin({
      carreras: this.carreraService.getCarreras(),
      ciclos: this.ciclosService.getCiclos(),
      fichas: this.revisionService.getTodasLasFichas(),
      periodos: this.periodoService.getPeriodos(),
      formularios: this.formularioService.getFormularios(),
    }).subscribe({
      next: ({ carreras, ciclos, fichas, periodos, formularios }: any) => {
        this.carrerasList.set(
          (carreras || []).filter((c: Carrera) => !c.fecha_desactivacion),
        );
        this.ciclosList.set(
          (ciclos || [])
            .filter((c: Ciclo) => !c.fecha_desactivacion)
            .map((c: any) => {
              if (c.carreras) return c;
              if (c.ciclosCarreras) {
                return {
                  ...c,
                  carreras: c.ciclosCarreras
                    .map((cc: any) => cc.carrera || { id: cc.carrera_id, nombre: '—' })
                    .filter(Boolean),
                };
              }
              return { ...c, carreras: [] };
            })
        );
        this.fichasList.set(fichas || []);
        this.periodosList.set(periodos || []);
        this.totalFormularios.set(formularios?.length || 0);

        const activo = (periodos || []).find((p: any) => p.activo);
        if (activo) {
          this.periodoActivo.set(activo);
          this.filtros.update((prev) => ({ ...prev, periodoId: activo.id }));
          this.filtrosPoblacion.update((prev) => ({ ...prev, periodoId: activo.id }));
        }

        this.isLoading.set(false);
        setTimeout(() => this.inicializarGraficos(), 80);
        this.buscarPoblacion();
      },
      error: (err) => {
        console.error('Error al cargar datos del dashboard:', err);
        this.isLoading.set(false);
      },
    });
  }

  setFiltro<K extends keyof FiltrosDashboard>(key: K, value: FiltrosDashboard[K]): void {
    this.filtros.update((prev) => {
      const next = { ...prev, [key]: value };
      if (key === 'carreraId') next.cicloId = '';
      return next;
    });
    setTimeout(() => this.inicializarGraficos(), 30);
  }

  limpiarFiltros(): void {
    const activo = this.periodoActivo();
    this.filtros.set({
      periodoId: activo?.id || '',
      carreraId: '',
      cicloId: '',
      etnia: '',
      sexo: '',
      zona: '',
      estadoFicha: '',
      nivelEconomico: '',
      busqueda: '',
    });
    this.limpiarFiltrosEconomicos();
    setTimeout(() => this.inicializarGraficos(), 30);
  }

  limpiarFiltrosEconomicos(): void {
    this.ingresoMin.set(null);
    this.ingresoMax.set(null);
    this.egresoMin.set(null);
    this.egresoMax.set(null);
  }

  pctCondicion(total: number): number {
    const base = this.fichasFiltradas().length || 1;
    return Math.round((total / base) * 100);
  }

  nombreEstudiante(f: any): string {
    const u = f.usuario || {};
    return `${u.primer_nombre || ''} ${u.primer_apellido || ''}`.trim() || 'Sin nombre';
  }

  cedulaEstudiante(f: any): string {
    return f.usuario?.cedula || '—';
  }

  carreraEstudiante(f: any): string {
    return (
      f.usuario?.carrera?.nombre ||
      this.carrerasList().find((c) => c.id === f.usuario?.carrera_id)?.nombre ||
      '—'
    );
  }

  cicloEstudiante(f: any): string {
    return (
      f.usuario?.ciclo?.nombre ||
      this.ciclosList().find((c) => c.id === f.usuario?.ciclo_id)?.nombre ||
      '—'
    );
  }

  cambiarTipoGrafico(_cual: string, tipo: 'bar' | 'pie'): void {
    this.tipoGraficoCarrera.set(tipo);
    setTimeout(() => this.inicializarGraficos(), 30);
  }

  // ===================== GRÁFICOS =====================

  inicializarGraficos(): void {
    const fichas = this.fichasFiltradas() as any[];
    const carreras = this.carrerasList();

    this.renderCarreraChart(fichas, carreras);
    this.renderCarreraEconomiaChart(fichas, carreras);
    this.renderEstadoChart(fichas);
    this.renderEconomiaChart(fichas);
  }

  private renderCarreraChart(fichas: any[], carreras: Carrera[]): void {
  if (!this.carreraChartCanvas) return;

  const labels: string[] = [];
  const enviadas: number[] = [];
  const validadas: number[] = [];

  const carreraFiltro = this.filtros().carreraId;
  const lista = carreraFiltro
    ? carreras.filter((c) => c.id === carreraFiltro)
    : carreras;

  const esEnviada = (estado: string | undefined) => {
    const e = (estado || '').toUpperCase();
    return e === 'ENVIADA' || e === 'ENVIADO';
  };

  const esValidada = (estado: string | undefined) => {
    return (estado || '').toUpperCase() === 'VALIDADO';
  };

  lista.forEach((carrera) => {
    labels.push(carrera.nombre);

    const deCarrera = fichas.filter((x) => {
      const carreraId =
        x.usuario?.carrera_id ||
        x.usuario?.carrera?.id ||
        x.carrera_id;
      return String(carreraId) === String(carrera.id);
    });

    enviadas.push(deCarrera.filter((x) => esEnviada(x.estado_ficha)).length);
    validadas.push(deCarrera.filter((x) => esValidada(x.estado_ficha)).length);
  });

  const ctx = this.carreraChartCanvas.nativeElement.getContext('2d');
  if (!ctx) return;
  this.carreraChart?.destroy();

  const tipo = this.tipoGraficoCarrera();

  // Si no hay datos, muestra mensaje limpio
  const hayDatos = enviadas.some((n) => n > 0) || validadas.some((n) => n > 0);

  if (tipo === 'pie') {
    const totales = labels.map((_, i) => enviadas[i] + validadas[i]);
    this.carreraChart = new Chart(ctx, {
      type: 'pie',
      data: {
        labels: labels.length && hayDatos ? labels : ['Sin datos'],
        datasets: [
          {
            data: hayDatos ? totales : [1],
            backgroundColor: hayDatos
              ? ['#6366f1', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#64748b']
              : ['#e2e8f0'],
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { usePointStyle: true } },
        },
      },
    });
  } else {
    this.carreraChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels.length ? labels : ['Sin carreras'],
        datasets: [
          {
            label: 'Enviadas',
            data: enviadas.length ? enviadas : [0],
            backgroundColor: '#8b5cf6',
            borderRadius: 6,
          },
          {
            label: 'Validadas',
            data: validadas.length ? validadas : [0],
            backgroundColor: '#10b981',
            borderRadius: 6,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { usePointStyle: true } },
          tooltip: {
            callbacks: {
              footer: (items) => {
                const i = items[0]?.dataIndex ?? 0;
                const total = (enviadas[i] || 0) + (validadas[i] || 0);
                return `Total: ${total}`;
              },
            },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: {
              maxRotation: 45,
              minRotation: 0,
              autoSkip: true,
              callback: function (value) {
                const label = this.getLabelForValue(value as number) || '';
                return label.length > 18 ? label.slice(0, 16) + '…' : label;
              },
            },
          },
          y: {
            beginAtZero: true,
            ticks: { precision: 0, stepSize: 1 },
          },
        },
      },
    });
  }
}

  private renderCarreraEconomiaChart(fichas: any[], carreras: Carrera[]): void {
    if (!this.carreraEconomiaChartCanvas) return;

    const labels: string[] = [];
    const altos: number[] = [];
    const medios: number[] = [];
    const bajos: number[] = [];

    const carreraFiltro = this.filtros().carreraId;
    const lista = carreraFiltro
      ? carreras.filter((c) => c.id === carreraFiltro)
      : carreras;

    lista.forEach((carrera) => {
      labels.push(carrera.nombre);
      const deCarrera = fichas.filter((x) => x.usuario?.carrera_id === carrera.id);
      altos.push(
        deCarrera.filter((x) =>
          (x.nivelEconomico?.nombre || '').toLowerCase().includes('alto'),
        ).length,
      );
      medios.push(
        deCarrera.filter((x) =>
          (x.nivelEconomico?.nombre || '').toLowerCase().includes('medio'),
        ).length,
      );
      bajos.push(
        deCarrera.filter((x) =>
          (x.nivelEconomico?.nombre || '').toLowerCase().includes('bajo'),
        ).length,
      );
    });

    const ctx = this.carreraEconomiaChartCanvas.nativeElement.getContext('2d');
    if (!ctx) return;
    this.carreraEconomiaChart?.destroy();

    this.carreraEconomiaChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels.length ? labels : ['Sin datos'],
        datasets: [
          { label: 'Alto', data: altos.length ? altos : [0], backgroundColor: '#10b981', borderRadius: 4 },
          { label: 'Medio', data: medios.length ? medios : [0], backgroundColor: '#f59e0b', borderRadius: 4 },
          { label: 'Bajo', data: bajos.length ? bajos : [0], backgroundColor: '#ef4444', borderRadius: 4 },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { usePointStyle: true } },
        },
        scales: {
          x: { stacked: true, grid: { display: false } },
          y: { stacked: true, beginAtZero: true, ticks: { precision: 0 } },
        },
      },
    });
  }

  private renderEstadoChart(fichas: any[]): void {
    if (!this.estadoChartCanvas) return;

    const estados = ['BORRADOR', 'ENVIADA', 'VALIDADO', 'RECHAZADO', 'OBSERVADO'];
    const colores = ['#f59e0b', '#6366f1', '#10b981', '#ef4444', '#64748b'];
    const data = estados.map(
      (e) => fichas.filter((f) => f.estado_ficha === e).length,
    );

    const ctx = this.estadoChartCanvas.nativeElement.getContext('2d');
    if (!ctx) return;
    this.estadoChart?.destroy();

    this.estadoChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: estados,
        datasets: [{ data, backgroundColor: colores, borderWidth: 2, borderColor: '#fff' }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { usePointStyle: true, padding: 12 } },
        },
      },
    });
  }

  private renderEconomiaChart(fichas: any[]): void {
    if (!this.economiaChartCanvas) return;

    const conteo: Record<string, number> = {};
    fichas.forEach((f) => {
      const n = f.nivelEconomico?.nombre || 'SIN CLASIFICAR';
      conteo[n] = (conteo[n] || 0) + 1;
    });

    const labels = Object.keys(conteo);
    const data = Object.values(conteo);

    const ctx = this.economiaChartCanvas.nativeElement.getContext('2d');
    if (!ctx) return;
    this.economiaChart?.destroy();

    this.economiaChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: labels.length ? labels : ['Sin datos'],
        datasets: [
          {
            data: data.length ? data : [0],
            backgroundColor: labels.length
              ? ['#ef4444', '#f59e0b', '#3b82f6', '#10b981', '#8b5cf6', '#64748b']
              : ['#cbd5e1'],
            borderWidth: 2,
            borderColor: '#fff',
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { usePointStyle: true, padding: 12 } },
        },
      },
    });
  }

  // ===================== EXPORT =====================

  private buildQueryParams(): string {
    const f = this.filtros();
    const params = new URLSearchParams();
    if (f.periodoId) params.set('periodo_id', f.periodoId);
    if (f.carreraId) params.set('carrera_id', f.carreraId);
    if (f.cicloId) params.set('ciclo_id', f.cicloId);
    if (f.etnia) params.set('etnia', f.etnia);
    if (f.sexo) params.set('sexo', f.sexo);
    if (f.zona) params.set('zona_residencia', f.zona);
    if (f.estadoFicha) params.set('estado_ficha', f.estadoFicha);
    if (f.nivelEconomico) params.set('nivel_economico', f.nivelEconomico);
    return params.toString();
  }

  private getAuthHeaders(): HeadersInit {
    const token =
      localStorage.getItem('azuaycare_access_token') ||
      localStorage.getItem('access_token') ||
      '';
    return {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  }

  private async descargarBlob(url: string, options: RequestInit, nombreArchivo: string) {
    // ACTUALIZADO: Activamos el estado de exportación
    this.isExporting.set(true);
    try {
      const res = await fetch(url, options);
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Error ${res.status} al descargar`);
      }
      const blob = await res.blob();
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = nombreArchivo;
      link.click();
      URL.revokeObjectURL(link.href);
    } finally {
      // ACTUALIZADO: Desactivamos el estado de exportación al terminar (éxito o error)
      this.isExporting.set(false);
    }
  }

  /** Body alineado a FiltroReporteDto */
  private buildFiltroBody() {
    const f = this.filtros();
    return {
      periodo_id: f.periodoId || this.periodoActivo()?.id || undefined,
      carrera_id: f.carreraId || undefined,
      ciclo_id: f.cicloId || undefined,
      etnia: f.etnia || undefined,
      sexo: f.sexo || undefined,
      zona_residencia: f.zona || undefined,
      estado_ficha: f.estadoFicha || undefined,
      nivel_economico: f.nivelEconomico || undefined,
    };
  }

  /** Excel oficial de matriz socioeconómica (GET, solo periodo) */
  async descargarReporteExcel(): Promise<void> {
    const periodo = this.filtros().periodoId || this.periodoActivo()?.id;
    if (!periodo) {
      alert('Selecciona un periodo para exportar el Excel.');
      return;
    }
    try {
      await this.descargarBlob(
        `${environment.apiUrl}/reportes/socioeconomico/periodo/${periodo}`,
        { method: 'GET', headers: this.getAuthHeaders() },
        `Matriz_Socioeconomica_${periodo}.xlsx`,
      );
    } catch (e: any) {
      alert(e?.message || 'No se pudo descargar el Excel.');
    }
  }

  /** PDF filtrado (POST que SÍ existe en tu controller) */
  async descargarReportePdf(): Promise<void> {
    const periodo = this.filtros().periodoId || this.periodoActivo()?.id;
    if (!periodo) {
      alert('Selecciona un periodo para exportar el PDF.');
      return;
    }
    try {
      await this.descargarBlob(
        `${environment.apiUrl}/reportes/dataset-filtrado/pdf`,
        {
          method: 'POST',
          headers: this.getAuthHeaders(),
          body: JSON.stringify(this.buildFiltroBody()),
        },
        `Reporte_Filtrado_${Date.now()}.pdf`,
      );
    } catch (e: any) {
      alert(e?.message || 'No se pudo descargar el PDF.');
    }
  }

  /** (Opcional) Excel con los mismos filtros del panel */
  async descargarExcelFiltrado(): Promise<void> {
    try {
      await this.descargarBlob(
        `${environment.apiUrl}/reportes/dataset-filtrado/excel`,
        {
          method: 'POST',
          headers: this.getAuthHeaders(),
          body: JSON.stringify(this.buildFiltroBody()),
        },
        `Reporte_Filtrado_${Date.now()}.xlsx`,
      );
    } catch (e: any) {
      alert(e?.message || 'No se pudo descargar el Excel filtrado.');
    }
  }
}