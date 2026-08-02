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

// Registrar los módulos necesarios de Chart.js
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

  // Estados reactivos mediante Signals
  totalCarreras = signal<number>(0);
  totalFormularios = signal<number>(0);
  totalFichasEvaluadas = signal<number>(0);
  periodoActivo = signal<PeriodoMatricula | null>(null);
  isLoading = signal<boolean>(true);

  // Referencias al DOM para los elementos <canvas>
  @ViewChild('pieChartCanvas') pieChartCanvas?: ElementRef<HTMLCanvasElement>;
  @ViewChild('barChartCanvas') barChartCanvas?: ElementRef<HTMLCanvasElement>;

  // Instancias de Chart.js
  private pieChartInstance?: Chart;
  private barChartInstance?: Chart;
  private datosGraficos: DashboardResumenBackend['graficos'] | null = null;

  ngOnInit(): void {
    this.cargarResumen();
  }

  ngOnDestroy(): void {
    // Limpieza de gráficos al destruir el componente
    this.destruirGraficos();
  }

  /**
   * Carga la información del Dashboard desde el Backend
   */
  cargarResumen(): void {
    this.isLoading.set(true);

    this.reportesService.getDashboardResumen().subscribe({
      next: (resumen: DashboardResumenBackend) => {
        this.totalCarreras.set(resumen.totalCarreras);
        this.totalFichasEvaluadas.set(resumen.totalFichasEvaluadas);
        this.totalFormularios.set(resumen.totalFormularios);
        this.periodoActivo.set(resumen.periodoActivo);
        
        this.datosGraficos = resumen.graficos;
        
        // Finalizamos el estado de carga
        this.isLoading.set(false);
        
        // Forzamos la detección de cambios para que Angular renderice los <canvas> en la plantilla
        this.cdRef.detectChanges();

        // Esperamos al siguiente ciclo de renderizado para asegurar que los <canvas> existen en el DOM
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

  /**
   * Inicializa o actualiza las instancias de Chart.js
   */
  inicializarGraficos(graficos: DashboardResumenBackend['graficos']): void {
    if (!this.pieChartCanvas || !this.barChartCanvas) {
      console.warn('No se encontraron las referencias a los elementos canvas en el DOM.');
      return;
    }

    // 1. Gráfico de Pastel (Doughnut)
    const ctxPie = this.pieChartCanvas.nativeElement.getContext('2d');
    if (ctxPie) {
      if (this.pieChartInstance) {
        this.pieChartInstance.destroy();
      }
      
      const { labels, data } = graficos.nivelesEconomicos;
      const tieneDatos = labels.length > 0 && data.some(val => val > 0);

      this.pieChartInstance = new Chart(ctxPie, {
        type: 'doughnut',
        data: {
          labels: tieneDatos ? labels : ['Sin Registros'],
          datasets: [{
            data: tieneDatos ? data : [1],
            backgroundColor: tieneDatos 
              ? ['#ef4444', '#f59e0b', '#3b82f6', '#10b981', '#8b5cf6', '#64748b'] 
              : ['#e2e8f0'],
            borderWidth: 2,
            borderColor: '#ffffff'
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'bottom',
              labels: { 
                font: { family: 'Inter', size: 11 }, 
                usePointStyle: true, 
                padding: 15 
              }
            }
          }
        }
      });
    }

    // 2. Gráfico de Barras (Fichas por Carrera)
    const ctxBar = this.barChartCanvas.nativeElement.getContext('2d');
    if (ctxBar) {
      if (this.barChartInstance) {
        this.barChartInstance.destroy();
      }

      const { labels, enviadas, validadas } = graficos.fichasPorCarrera;
      const tieneCarreras = labels.length > 0;

      this.barChartInstance = new Chart(ctxBar, {
        type: 'bar',
        data: {
          labels: tieneCarreras ? labels : ['Sin Carreras'],
          datasets: [
            {
              label: 'Fichas Enviadas',
              data: tieneCarreras ? enviadas : [0],
              backgroundColor: '#8b5cf6',
              borderRadius: 6
            },
            {
              label: 'Fichas Validadas',
              data: tieneCarreras ? validadas : [0],
              backgroundColor: '#10b981',
              borderRadius: 6
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'bottom',
              labels: { 
                font: { family: 'Inter', size: 11 }, 
                usePointStyle: true 
              }
            }
          },
          scales: {
            x: { grid: { display: false } },
            y: { beginAtZero: true, ticks: { precision: 0 } }
          }
        }
      });
    }
  }

  /**
   * Genera y descarga el archivo Excel socioeconómico
   */
  descargarReporteExcel(): void {
    const periodo = this.periodoActivo();
    if (!periodo) {
      alert('No se encontró un período académico activo.');
      return;
    }
    this.reportesService.descargarExcelMatriz(periodo.id);
  }

  /**
   * Destruye las instancias existentes de Chart.js
   */
  private destruirGraficos(): void {
    if (this.pieChartInstance) {
      this.pieChartInstance.destroy();
      this.pieChartInstance = undefined;
    }
    if (this.barChartInstance) {
      this.barChartInstance.destroy();
      this.barChartInstance = undefined;
    }
  }
}