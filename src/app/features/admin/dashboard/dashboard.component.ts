import {
  Component,
  OnInit,
  OnDestroy,
  inject,
  signal,
  ElementRef,
  ViewChild,
  ChangeDetectorRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
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
  imports: [CommonModule, RouterModule],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css'],
})
export class DashboardComponent implements OnInit, OnDestroy {
  private readonly reportesService = inject(ReportesService);
  private readonly prioridadService = inject(PrioridadAtencionService);
  private readonly cdRef = inject(ChangeDetectorRef);
  private readonly revisionService = inject(RevisionService);

  // KPIs
  totalCarreras = signal(0);
  totalFormularios = signal(0);
  totalFichas = signal(0);
  totalFichasEvaluadas = signal(0);
  fichasBorrador = signal(0);
  fichasEnviadas = signal(0);
  fichasValidadas = signal(0);
  fichasRechazadas = signal(0);

  // NEE / Vulnerabilidad
  totalNee = signal(0);
  totalConRiesgo = signal(0);
  condiciones = signal<CondicionCount[]>([]);

  periodoActivo = signal<PeriodoMatricula | null>(null);
  isLoading = signal(true);

  // Datos para gráficos
  carrerasLabels = signal<string[]>([]);
  carrerasEnviadas = signal<number[]>([]);
  carrerasValidadas = signal<number[]>([]);
  economiaLabels = signal<string[]>([]);
  economiaData = signal<number[]>([]);

  // Referencias a los Canvas
  @ViewChild('estadoChartCanvas', { static: false }) estadoChartCanvas?: ElementRef<HTMLCanvasElement>;
  @ViewChild('economiaChartCanvas', { static: false }) economiaChartCanvas?: ElementRef<HTMLCanvasElement>;
  @ViewChild('carreraChartCanvas', { static: false }) carreraChartCanvas?: ElementRef<HTMLCanvasElement>;

  private estadoChart?: Chart;
  private economiaChart?: Chart;
  private carreraChart?: Chart;

  ngOnInit(): void {
    this.cargarTodo();
  }

  ngOnDestroy(): void {
    this.destruirGraficos();
  }

  private destruirGraficos(): void {
    if (this.estadoChart) {
      this.estadoChart.destroy();
      this.estadoChart = undefined;
    }
    if (this.economiaChart) {
      this.economiaChart.destroy();
      this.economiaChart = undefined;
    }
    if (this.carreraChart) {
      this.carreraChart.destroy();
      this.carreraChart = undefined;
    }
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

        // Carga de fichas
        this.revisionService.getFichasPaginadas(0, 10000, '', 'TODOS').subscribe({
          next: (response: any) => {
            const lista: any[] = response.data || response || [];
            this.contarEstadosDesdeFichas(lista);

            if (periodoId) {
              this.prioridadService.getReporteNee(periodoId).subscribe({
                next: (nee) => {
                  this.procesarNee(nee || []);
                  this.finalizarCarga();
                },
                error: () => {
                  this.procesarNee([]);
                  this.finalizarCarga();
                }
              });
            } else {
              this.finalizarCarga();
            }
          },
          error: () => {
            this.finalizarCarga();
          }
        });
      },
      error: (err) => {
        console.error('Error dashboard:', err);
        this.isLoading.set(false);
      }
    });
  }

  private calcularNivelesEconomicos(lista: any[]): void {
    const utiles = lista.filter((f) => {
      const e = String(f.estado_ficha || '').toUpperCase();
      return e === 'ENVIADA' || e === 'ENVIADO' || e === 'VALIDADO' ||
        e === 'RECHAZADO' || e === 'RECHAZADA';
    });

    let critico = 0;   
    let bajo = 0;      
    let medioBajo = 0; 
    let medio = 0;     
    let alto = 0;      

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
    let borrador = 0;
    let enviadas = 0;
    let validadas = 0;
    let rechazadas = 0;

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

  private finalizarCarga(): void {
    this.isLoading.set(false);
    this.cdRef.detectChanges(); // 1. Forza a Angular a actualizar el HTML e insertar/mostrar los canvas

    // 2. Espera a que el navegador complete el layout CSS antes de dibujar Chart.js
    setTimeout(() => {
      this.dibujarGraficos();
    }, 150);
  }

  private procesarNee(items: any[]): void {
    this.totalNee.set(items.length);
    this.totalConRiesgo.set(items.filter(i => (i.riesgo_total ?? 0) > 0).length);

    const contador: Record<string, number> = {};

    items.forEach((item) => {
      const detalles = item.detalles_vulnerabilidad || {};
      Object.keys(detalles).forEach((llave) => {
        const nombre = llave.trim() || 'Otra condición';
        contador[nombre] = (contador[nombre] || 0) + 1;
      });
    });

    const lista = Object.entries(contador)
      .map(([nombre, total]) => ({ nombre, total }))
      .sort((a, b) => b.total - a.total);

    this.condiciones.set(lista);
  }

  private dibujarGraficos(): void {
    this.destruirGraficos();

    Chart.defaults.font.family = "'Inter', system-ui, -apple-system, sans-serif";
    Chart.defaults.color = '#64748b';

    // 1. --- Estado de Fichas (Doughnut) ---
    if (this.estadoChartCanvas?.nativeElement) {
      const ctx = this.estadoChartCanvas.nativeElement.getContext('2d');
      if (ctx) {
        const data = [
          this.fichasBorrador(),
          this.fichasEnviadas(),
          this.fichasValidadas(),
          this.fichasRechazadas()
        ];
        const tiene = data.some(v => v > 0);

        this.estadoChart = new Chart(ctx, {
          type: 'doughnut',
          data: {
            labels: ['Borrador', 'Enviadas', 'Validadas', 'Rechazadas'],
            datasets: [{
              data: tiene ? data : [1],
              backgroundColor: tiene
                ? ['#f59e0b', '#3b82f6', '#10b981', '#ef4444']
                : ['#e2e8f0'],
              borderWidth: 2,
              borderColor: '#ffffff',
              hoverOffset: 6
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '70%',
            plugins: {
              legend: {
                position: 'bottom',
                labels: { font: { size: 12, weight: 600 }, usePointStyle: true, padding: 14 }
              }
            }
          }
        });
      }
    }

    // 2. --- Balance Nivel Socioeconómico (Doughnut) ---
    if (this.economiaChartCanvas?.nativeElement) {
      const ctx = this.economiaChartCanvas.nativeElement.getContext('2d');
      if (ctx) {
        const labels = this.economiaLabels();
        const data = this.economiaData();
        const tiene = data.some(v => v > 0);

        this.economiaChart = new Chart(ctx, {
          type: 'doughnut',
          data: {
            labels: tiene ? labels : ['Sin datos'],
            datasets: [{
              data: tiene ? data : [1],
              backgroundColor: tiene
                ? ['#ef4444', '#f97316', '#f59e0b', '#3b82f6', '#10b981']
                : ['#e2e8f0'],
              borderWidth: 2,
              borderColor: '#ffffff',
              hoverOffset: 6
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '70%',
            plugins: {
              legend: {
                position: 'bottom',
                labels: { font: { size: 12, weight: 600 }, usePointStyle: true, padding: 14 }
              }
            }
          }
        });
      }
    }

    // 3. --- Distribución por Carrera (Barras Horizontales) ---
    if (this.carreraChartCanvas?.nativeElement) {
      const ctx = this.carreraChartCanvas.nativeElement.getContext('2d');
      if (ctx) {
        const labels = this.carrerasLabels();
        const enviadas = this.carrerasEnviadas();
        const validadas = this.carrerasValidadas();
        const tiene = labels.length > 0;

        this.carreraChart = new Chart(ctx, {
          type: 'bar',
          data: {
            labels: tiene ? labels : ['Sin carreras'],
            datasets: [
              {
                label: 'Enviadas',
                data: tiene ? enviadas : [0],
                backgroundColor: '#8b5cf6',
                borderRadius: 6,
                barThickness: 14
              },
              {
                label: 'Validadas',
                data: tiene ? validadas : [0],
                backgroundColor: '#10b981',
                borderRadius: 6,
                barThickness: 14
              }
            ]
          },
          options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: {
                position: 'top',
                align: 'end',
                labels: { font: { size: 12, weight: 600 }, usePointStyle: true, padding: 12 }
              }
            },
            scales: {
              x: {
                beginAtZero: true,
                grid: { color: '#f1f5f9' },
                ticks: { precision: 0, font: { size: 11 } }
              },
              y: {
                grid: { display: false },
                ticks: {
                  font: { size: 11, weight: 600 },
                  callback: function(value) {
                    const label = this.getLabelForValue(value as number) || '';
                    return label.length > 24 ? label.substring(0, 24) + '…' : label;
                  }
                }
              }
            }
          }
        });
      }
    }
  }

  pctCondicion(total: number): number {
    const t = this.totalNee();
    if (!t) return 0;
    return Math.round((total / t) * 100);
  }
}