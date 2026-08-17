import {
  Component,
  OnInit,
  OnDestroy,
  inject,
  signal,
  computed,
  ElementRef,
  ViewChild,
  ChangeDetectorRef,
  ChangeDetectionStrategy
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import {
  ReportesService,
  DashboardResumenBackend
} from '../../../core/services/reportes.service';
import { PrioridadAtencionService } from '../../../core/services/prioridad-atencion.service';
import { PeriodoMatricula } from '../../../core/models/periodo.model';
import { Chart, registerables } from 'chart.js';
import { RevisionService } from '../../../core/services/revision.service';

Chart.register(...registerables);

interface CondicionCount {
  nombre: string;
  total: number;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DashboardComponent implements OnInit, OnDestroy {
  private readonly reportesService = inject(ReportesService);
  private readonly prioridadService = inject(PrioridadAtencionService);
  private readonly cdRef = inject(ChangeDetectorRef);
  private readonly revisionService = inject(RevisionService);

  readonly totalCarreras = signal<number>(0);
  readonly totalFormularios = signal<number>(0);
  readonly totalFichas = signal<number>(0);
  readonly totalFichasEvaluadas = signal<number>(0);
  readonly fichasBorrador = signal<number>(0);
  readonly fichasEnviadas = signal<number>(0);
  readonly fichasValidadas = signal<number>(0);
  readonly fichasRechazadas = signal<number>(0);

  readonly totalNee = signal<number>(0);
  readonly totalConRiesgo = signal<number>(0);
  readonly condiciones = signal<CondicionCount[]>([]);
  readonly periodoActivo = signal<PeriodoMatricula | null>(null);
  readonly isLoading = signal<boolean>(true);

  readonly carrerasLabels = signal<string[]>([]);
  readonly carrerasEnviadas = signal<number[]>([]);
  readonly carrerasValidadas = signal<number[]>([]);
  readonly economiaLabels = signal<string[]>([]);
  readonly economiaData = signal<number[]>([]);

  readonly todasLasFichas = signal<any[]>([]);
  readonly tipoGraficoCarrera = signal<string>('bar');
  readonly tipoGraficoEstado = signal<string>('doughnut');

  readonly ingresoMin = signal<number | null>(null);
  readonly ingresoMax = signal<number | null>(null);
  readonly egresoMin = signal<number | null>(null);
  readonly egresoMax = signal<number | null>(null);

  readonly estudiantesFiltradosList = computed(() => {
  const minIng = this.ingresoMin() ?? -Infinity;
  const maxIng = this.ingresoMax() ?? Infinity;
  const minEgr = this.egresoMin() ?? -Infinity;
  const maxEgr = this.egresoMax() ?? Infinity;

  return this.todasLasFichas().filter(f => {
    const i = Number(f.total_ingresos || 0);
    const e = Number(f.total_egresos || 0);
    return i >= minIng && i <= maxIng && e >= minEgr && e <= maxEgr;
  });
});

readonly estudiantesFiltrados = computed(() => this.estudiantesFiltradosList().length);

readonly hayFiltrosActivos = computed(() =>
  this.ingresoMin() !== null || this.ingresoMax() !== null ||
  this.egresoMin() !== null || this.egresoMax() !== null
);

  @ViewChild('estadoChartCanvas', { static: false }) estadoChartCanvas?: ElementRef<HTMLCanvasElement>;
  @ViewChild('economiaChartCanvas', { static: false }) economiaChartCanvas?: ElementRef<HTMLCanvasElement>;
  @ViewChild('carreraChartCanvas', { static: false }) carreraChartCanvas?: ElementRef<HTMLCanvasElement>;
  @ViewChild('carreraEconomiaChartCanvas', { static: false }) carreraEconomiaChartCanvas?: ElementRef<HTMLCanvasElement>;

  private charts: { estado?: Chart; economia?: Chart; carrera?: Chart; carreraEcon?: Chart } = {};

  ngOnInit(): void {
    this.cargarTodo();
    Chart.defaults.font.family = "'Inter', system-ui, -apple-system, sans-serif";
    Chart.defaults.color = '#64748b';
  }

  ngOnDestroy(): void {
    this.destruirGraficos();
  }

  private destruirGraficos(): void {
    Object.values(this.charts).forEach(chart => chart?.destroy());
    this.charts = {};
  }

  cargarTodo(): void {
    this.isLoading.set(true);

    this.reportesService.getDashboardResumen().subscribe({
      next: (resumen) => {
        this.totalCarreras.set(resumen.totalCarreras ?? 0);
        this.totalFormularios.set(resumen.totalFormularios ?? 0);
        this.totalFichasEvaluadas.set(resumen.totalFichasEvaluadas ?? 0);
        this.periodoActivo.set(resumen.periodoActivo ?? null);

        const fc = resumen.graficos?.fichasPorCarrera;
        this.carrerasLabels.set(fc?.labels ?? []);
        this.carrerasEnviadas.set(fc?.enviadas ?? []);
        this.carrerasValidadas.set(fc?.validadas ?? []);

        const periodoId = resumen.periodoActivo?.id;

        this.revisionService.getFichasPaginadas(0, 10000, '', 'TODOS').subscribe({
          next: (response: any) => {
            const lista: any[] = response.data || response || [];
            this.todasLasFichas.set(lista);
            this.contarEstadosDesdeFichas(lista);

            if (periodoId) {
              this.prioridadService.getReporteNee(periodoId).subscribe({
                next: (nee) => { this.procesarNee(nee || []); this.finalizarCarga(); },
                error: () => { this.procesarNee([]); this.finalizarCarga(); }
              });
            } else { this.finalizarCarga(); }
          },
          error: () => this.finalizarCarga()
        });
      },
      error: (err) => {
        console.error('Error dashboard:', err);
        this.isLoading.set(false);
        this.cdRef.markForCheck();
      }
    });
  }

  limpiarFiltros(): void {
    this.ingresoMin.set(null);
    this.ingresoMax.set(null);
    this.egresoMin.set(null);
    this.egresoMax.set(null);
  }

  nombreEstudiante(f: any): string {
  const u = f?.usuario || {};
  const nombres = [u.primer_nombre, u.segundo_nombre].filter(Boolean).join(' ');
  const apellidos = [u.primer_apellido, u.segundo_apellido].filter(Boolean).join(' ');
  return `${nombres} ${apellidos}`.trim() || 'Sin nombre';
}

cedulaEstudiante(f: any): string {
  return f?.usuario?.cedula || 'Sin cédula';
}

carreraEstudiante(f: any): string {
  // Intentamos varios posibles lugares
  return f.carrera_nombre
    || f.carrera?.nombre
    || f.usuario?.carrera?.nombre
    || f.usuario?.carrera_nombre
    || 'Sin carrera';
}

cicloEstudiante(f: any): string {
  return f.ciclo_nombre
    || f.ciclo?.nombre
    || f.usuario?.ciclo?.nombre
    || f.usuario?.ciclo_nombre
    || 'Sin ciclo';
}


  cambiarTipoGrafico(grafico: string, nuevoTipo: string): void {
    if (grafico === 'carrera') {
      this.tipoGraficoCarrera.set(nuevoTipo);
      this.charts.carrera?.destroy();
      this.dibujarGraficoCarrera();
    } else if (grafico === 'estado') {
      this.tipoGraficoEstado.set(nuevoTipo);
      this.charts.estado?.destroy();
      this.dibujarGraficoEstado();
    }
  }

  private calcularNivelesEconomicos(lista: any[]): void {
    const utiles = lista.filter(f => ['ENVIADA', 'ENVIADO', 'VALIDADO', 'RECHAZADO', 'RECHAZADA'].includes(String(f.estado_ficha || '').toUpperCase()));
    let critico = 0, bajo = 0, medioBajo = 0, medio = 0, alto = 0;

    utiles.forEach((f) => {
      const balance = Number(f.balance_final ?? 0);
      if (balance < 0) critico++;
      else if (balance <= 100) bajo++;
      else if (balance <= 300) medioBajo++;
      else if (balance <= 600) medio++;
      else alto++;
    });

    this.economiaLabels.set(['Crítico', 'Bajo', 'Medio-Bajo', 'Medio', 'Alto']);
    this.economiaData.set([critico, bajo, medioBajo, medio, alto]);
  }

  private contarEstadosDesdeFichas(lista: any[]): void {
    let borrador = 0, enviadas = 0, validadas = 0, rechazadas = 0;
    lista.forEach((f) => {
      const e = String(f.estado_ficha || '').toUpperCase();
      if (e === 'BORRADOR') borrador++;
      else if (e === 'ENVIADA' || e === 'ENVIADO') enviadas++;
      else if (e === 'VALIDADO') validadas++;
      else if (e === 'RECHAZADO' || e === 'RECHAZADA') rechazadas++;
    });

    this.totalFichas.set(lista.length);
    this.fichasBorrador.set(borrador);
    this.fichasEnviadas.set(enviadas);
    this.fichasValidadas.set(validadas);
    this.fichasRechazadas.set(rechazadas);
    this.calcularNivelesEconomicos(lista);
  }

  private procesarNee(items: any[]): void {
    this.totalNee.set(items.length);
    this.totalConRiesgo.set(items.filter(i => (i.riesgo_total ?? 0) > 0).length);

    const contador: Record<string, number> = {};
    items.forEach((item) => {
      Object.keys(item.detalles_vulnerabilidad || {}).forEach(llave => {
        const nombre = llave.trim() || 'Otra condición';
        contador[nombre] = (contador[nombre] || 0) + 1;
      });
    });

    this.condiciones.set(Object.entries(contador).map(([nombre, total]) => ({ nombre, total })).sort((a, b) => b.total - a.total));
  }

  private finalizarCarga(): void {
    this.isLoading.set(false);
    this.cdRef.markForCheck();
    setTimeout(() => { this.dibujarTodosLosGraficos(); }, 150);
  }

  private dibujarTodosLosGraficos(): void {
    this.destruirGraficos();
    this.dibujarGraficoEstado();
    this.dibujarGraficoEconomia();
    this.dibujarGraficoCarrera();
    this.dibujarGraficoCarreraApilado();
  }

  private dibujarGraficoEstado(): void {
    if (!this.estadoChartCanvas?.nativeElement) return;
    const ctx = this.estadoChartCanvas.nativeElement.getContext('2d');
    if (!ctx) return;

    const data = [this.fichasBorrador(), this.fichasEnviadas(), this.fichasValidadas(), this.fichasRechazadas()];
    const tiene = data.some(v => v > 0);

    this.charts.estado = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Borrador', 'Enviadas', 'Validadas', 'Rechazadas'],
        datasets: [{ data: tiene ? data : [1], backgroundColor: tiene ? ['#f59e0b', '#3b82f6', '#10b981', '#ef4444'] : ['#e2e8f0'], borderWidth: 2, borderColor: '#ffffff', hoverOffset: 6 }]
      },
      options: { responsive: true, maintainAspectRatio: false, cutout: '70%', plugins: { legend: { position: 'bottom', labels: { font: { size: 12, weight: 600 }, usePointStyle: true, padding: 14 } } } }
    });
  }

  private dibujarGraficoEconomia(): void {
    if (!this.economiaChartCanvas?.nativeElement) return;
    const ctx = this.economiaChartCanvas.nativeElement.getContext('2d');
    if (!ctx) return;

    const labels = this.economiaLabels();
    const data = this.economiaData();
    const tiene = data.some(v => v > 0);

    this.charts.economia = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: tiene ? labels : ['Sin datos'],
        datasets: [{ data: tiene ? data : [1], backgroundColor: tiene ? ['#ef4444', '#f97316', '#f59e0b', '#3b82f6', '#10b981'] : ['#e2e8f0'], borderWidth: 2, borderColor: '#ffffff', hoverOffset: 6 }]
      },
      options: { responsive: true, maintainAspectRatio: false, cutout: '70%', plugins: { legend: { position: 'bottom', labels: { font: { size: 12, weight: 600 }, usePointStyle: true, padding: 14 } } } }
    });
  }

  private dibujarGraficoCarrera(): void {
    if (!this.carreraChartCanvas?.nativeElement) return;
    const ctx = this.carreraChartCanvas.nativeElement.getContext('2d');
    if (!ctx) return;

    const labels = this.carrerasLabels();
    const tiene = labels.length > 0;
    const tipo = this.tipoGraficoCarrera() as any;
    const esCircular = tipo === 'pie' || tipo === 'doughnut';

    const coloresPastel = [
      '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#3b82f6', 
      '#ec4899', '#14b8a6', '#6366f1', '#84cc16', '#a855f7',
      '#06b6d4', '#f97316', '#64748b', '#d946ef', '#059669',
      '#fbbf24', '#f87171', '#34d399', '#818cf8'
    ];

    this.charts.carrera = new Chart(ctx, {
      type: tipo,
      data: {
        labels: tiene ? labels : ['Sin carreras'],
        datasets: esCircular ? [
          {
            label: 'Validadas por Carrera',
            data: tiene ? this.carrerasValidadas() : [0],
            backgroundColor: coloresPastel,
            borderWidth: 2,
            borderColor: '#ffffff'
          }
        ] : [
          { label: 'Enviadas', data: tiene ? this.carrerasEnviadas() : [0], backgroundColor: '#8b5cf6', borderRadius: 4 },
          { label: 'Validadas', data: tiene ? this.carrerasValidadas() : [0], backgroundColor: '#10b981', borderRadius: 4 }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            align: 'center',
            labels: {
              font: { size: 11, weight: 600 },
              usePointStyle: true,
              padding: 14,
              boxWidth: 8,
              generateLabels: (chart: any) => {
                const original = Chart.defaults.plugins.legend.labels.generateLabels(chart);
                return original.map((label: any) => {
                  if (label.text && label.text.length > 22) {
                    label.text = label.text.substring(0, 22) + '…';
                  }
                  return label;
                });
              }
            }
          }
        },
        scales: esCircular ? {
          x: { display: false },
          y: { display: false }
        } : {
          x: { 
            grid: { display: false },
            ticks: {
              font: { size: 10, weight: 600 },
              maxRotation: 45,
              minRotation: 45,
              callback: function(this: any, value: any) {
                const label = this.getLabelForValue(value as number) || '';
                return label.length > 18 ? label.substring(0, 18) + '…' : label;
              }
            }
          },
          y: {
            beginAtZero: true, 
            grid: { color: '#f1f5f9' }, 
            ticks: { precision: 0, font: { size: 11 } }
          }
        }
      }
    });
  }

  private dibujarGraficoCarreraApilado(): void {
    if (!this.carreraEconomiaChartCanvas?.nativeElement) return;
    const ctx = this.carreraEconomiaChartCanvas.nativeElement.getContext('2d');
    if (!ctx) return;

    const mapa = new Map<string, { alto: number, medio: number, bajo: number }>();
    this.todasLasFichas()
      .filter(f => ['ENVIADA', 'ENVIADO', 'VALIDADO'].includes(String(f.estado_ficha || '').toUpperCase()))
      .forEach(f => {
        const carrera = f.carrera_nombre || f.carrera?.nombre || f.estudiante?.carrera || 'Desconocida';
        const balance = Number(f.balance_final ?? 0);
        if (!mapa.has(carrera)) mapa.set(carrera, { alto: 0, medio: 0, bajo: 0 });
        const conteo = mapa.get(carrera)!;
        if (balance <= 150) conteo.bajo++; else if (balance <= 400) conteo.medio++; else conteo.alto++;
      });

    const labels = Array.from(mapa.keys());
    const tiene = labels.length > 0;

    this.charts.carreraEcon = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: tiene ? labels : ['Sin carreras'],
        datasets: [
          { label: 'Alto (> $400)', data: tiene ? labels.map(l => mapa.get(l)!.alto) : [0], backgroundColor: '#10b981', borderRadius: 4 },
          { label: 'Medio ($150-$400)', data: tiene ? labels.map(l => mapa.get(l)!.medio) : [0], backgroundColor: '#f59e0b', borderRadius: 4 },
          { label: 'Bajo (< $150)', data: tiene ? labels.map(l => mapa.get(l)!.bajo) : [0], backgroundColor: '#ef4444', borderRadius: 4 }
        ]
      },
      options: {
        responsive: true, 
        maintainAspectRatio: false,
        plugins: { 
          legend: { 
            position: 'bottom',
            labels: { font: { size: 11, weight: 600 }, usePointStyle: true, padding: 14 } 
          }, 
          tooltip: { 
            mode: 'index', 
            intersect: false,
            callbacks: {
              title: function(tooltipItems) {
                return tooltipItems[0].label; 
              }
            }
          } 
        },
        scales: {
          x: { 
            stacked: true, 
            grid: { display: false }, 
            ticks: { 
              font: { size: 10, weight: 600 },
              maxRotation: 45, 
              minRotation: 45,
              callback: function(this: any, value: any) { 
                const label = this.getLabelForValue(value as number) || ''; 
                return label.length > 18 ? label.substring(0, 18) + '…' : label; 
              } 
            } 
          },
          y: { 
            stacked: true, 
            beginAtZero: true, 
            grid: { color: '#f1f5f9' }, 
            ticks: { precision: 0, font: { size: 11 } } 
          }
        }
      }
    });
  }

  pctCondicion(total: number): number {
    const t = this.totalNee();
    return t ? Math.round((total / t) * 100) : 0;
  }
}