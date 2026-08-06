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
import { ReportesService, DashboardResumenBackend } from '../../../core/services/reportes.service';
import { PeriodoMatricula } from '../../../core/models/periodo.model';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css'],
})
export class DashboardComponent implements OnInit, OnDestroy {
  private readonly reportesService = inject(ReportesService);
  private readonly cdRef = inject(ChangeDetectorRef);

  totalCarreras = signal<number>(0);
  totalFormularios = signal<number>(0);
  totalFichasEvaluadas = signal<number>(0);
  periodoActivo = signal<PeriodoMatricula | null>(null);
  isLoading = signal<boolean>(true);

  @ViewChild('pieChartCanvas') pieChartCanvas?: ElementRef<HTMLCanvasElement>;
  @ViewChild('pieChartVulnerabilidadCanvas') pieChartVulnerabilidadCanvas?: ElementRef<HTMLCanvasElement>;
  @ViewChild('barChartCanvas') barChartCanvas?: ElementRef<HTMLCanvasElement>;

  private pieChartInstance?: Chart;
  private pieChartVulnerabilidadInstance?: Chart;
  private barChartInstance?: Chart;
  private datosGraficos: DashboardResumenBackend['graficos'] | null = null;

  ngOnInit(): void {
    this.cargarResumen();
  }

  ngOnDestroy(): void {
    this.destruirGraficos();
  }

  cargarResumen(): void {
    this.isLoading.set(true);

    this.reportesService.getDashboardResumen().subscribe({
      next: (resumen: DashboardResumenBackend) => {
        this.totalCarreras.set(resumen.totalCarreras);
        this.totalFichasEvaluadas.set(resumen.totalFichasEvaluadas);
        this.totalFormularios.set(resumen.totalFormularios);
        this.periodoActivo.set(resumen.periodoActivo);
        
        this.datosGraficos = resumen.graficos;
        this.isLoading.set(false);
        this.cdRef.detectChanges();

        setTimeout(() => {
          if (this.datosGraficos) {
            this.inicializarGraficos(this.datosGraficos);
          }
        }, 50);
      },
      error: (err) => {
        console.error('Error al cargar datos del dashboard:', err);
        this.isLoading.set(false);
      }
    });
  }

  inicializarGraficos(graficos: DashboardResumenBackend['graficos']): void {
    if (!this.pieChartCanvas || !this.barChartCanvas || !this.pieChartVulnerabilidadCanvas) {
      console.warn('No se encontraron las referencias a los elementos canvas en el DOM.');
      return;
    }

    // 1. Gráfico de Pastel (Niveles Económicos)
    const ctxPie = this.pieChartCanvas.nativeElement.getContext('2d');
    if (ctxPie) {
      if (this.pieChartInstance) this.pieChartInstance.destroy();
      
      const { labels, data } = graficos.nivelesEconomicos;
      const tieneDatos = labels.length > 0 && data.some(val => val > 0);

      this.pieChartInstance = new Chart(ctxPie, {
        type: 'doughnut',
        data: {
          labels: tieneDatos ? labels : ['Sin Registros'],
          datasets: [{
            data: tieneDatos ? data : [1],
            backgroundColor: tieneDatos 
              ? ['#3b82f6', '#10b981', '#8b5cf6', '#64748b', '#ef4444', '#f59e0b'] 
              : ['#e2e8f0'],
            borderWidth: 2,
            borderColor: '#ffffff'
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'bottom', labels: { font: { family: 'Inter', size: 11 }, usePointStyle: true, padding: 15 } }
          }
        }
      });
    }

    // 2. Gráfico de Pastel (Vulnerabilidad)
    const ctxVuln = this.pieChartVulnerabilidadCanvas.nativeElement.getContext('2d');
    if (ctxVuln) {
      if (this.pieChartVulnerabilidadInstance) this.pieChartVulnerabilidadInstance.destroy();
      
      const { labels, data } = graficos.nivelesVulnerabilidad;
      const tieneDatos = labels.length > 0 && data.some(val => val > 0);

      this.pieChartVulnerabilidadInstance = new Chart(ctxVuln, {
        type: 'doughnut',
        data: {
          labels: tieneDatos ? labels : ['Sin Registros'],
          datasets: [{
            data: tieneDatos ? data : [1],
            backgroundColor: tieneDatos 
              ? ['#ef4444', '#f59e0b', '#10b981', '#94a3b8'] 
              : ['#e2e8f0'],
            borderWidth: 2,
            borderColor: '#ffffff'
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'bottom', labels: { font: { family: 'Inter', size: 11 }, usePointStyle: true, padding: 15 } }
          }
        }
      });
    }

    // 3. Gráfico de Barras (Fichas por Carrera)
    const ctxBar = this.barChartCanvas.nativeElement.getContext('2d');
    if (ctxBar) {
      if (this.barChartInstance) this.barChartInstance.destroy();

      const { labels, enviadas, validadas } = graficos.fichasPorCarrera;
      const tieneCarreras = labels.length > 0;

      this.barChartInstance = new Chart(ctxBar, {
        type: 'bar',
        data: {
          labels: tieneCarreras ? labels : ['Sin Carreras'],
          datasets: [
            { label: 'Fichas Enviadas', data: tieneCarreras ? enviadas : [0], backgroundColor: '#8b5cf6', borderRadius: 6 },
            { label: 'Fichas Validadas', data: tieneCarreras ? validadas : [0], backgroundColor: '#10b981', borderRadius: 6 }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { position: 'bottom', labels: { font: { family: 'Inter', size: 11 }, usePointStyle: true } } },
          scales: {
            x: { grid: { display: false } },
            y: { beginAtZero: true, ticks: { precision: 0 } }
          }
        }
      });
    }
  }

  private destruirGraficos(): void {
    if (this.pieChartInstance) {
      this.pieChartInstance.destroy();
      this.pieChartInstance = undefined;
    }
    if (this.pieChartVulnerabilidadInstance) {
      this.pieChartVulnerabilidadInstance.destroy();
      this.pieChartVulnerabilidadInstance = undefined;
    }
    if (this.barChartInstance) {
      this.barChartInstance.destroy();
      this.barChartInstance = undefined;
    }
  }
}