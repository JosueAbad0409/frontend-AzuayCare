import { Component, OnInit, inject, signal, ElementRef, ViewChild, afterNextRender } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { CarreraService } from '../../../core/services/carrera.service';
import { PeriodoService } from '../../../core/services/periodo.service';
import { RevisionService } from '../../../core/services/revision.service';
import { FormularioService } from '../../../core/services/formulario.service';
import { PeriodoMatricula } from '../../../core/models/periodo.model';
import { Carrera } from '../../../core/models/carrera.model';
import { FichaRevision } from '../../../core/models/revision-ficha.model';
import { environment } from '../../../../environments/environment';
import { Chart, registerables } from 'chart.js';
import { forkJoin } from 'rxjs';

Chart.register(...registerables);

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css'],
})
export class DashboardComponent implements OnInit {
  private readonly carreraService = inject(CarreraService);
  private readonly periodoService = inject(PeriodoService);
  private readonly revisionService = inject(RevisionService);
  private readonly formularioService = inject(FormularioService);

  totalCarreras = signal<number>(0);
  totalFormularios = signal<number>(0);
  totalFichasEvaluadas = signal<number>(0);
  periodoActivo = signal<PeriodoMatricula | null>(null);
  isLoading = signal<boolean>(true);

  carrerasList = signal<Carrera[]>([]);
  fichasList = signal<FichaRevision[]>([]);

  @ViewChild('pieChartCanvas') pieChartCanvas?: ElementRef<HTMLCanvasElement>;
  @ViewChild('barChartCanvas') barChartCanvas?: ElementRef<HTMLCanvasElement>;

  private pieChartInstance?: Chart;
  private barChartInstance?: Chart;

  constructor() {
    afterNextRender(() => {
      if (!this.isLoading()) {
        this.inicializarGraficos();
      }
    });
  }

  ngOnInit() {
    this.cargarResumen();
  }

  cargarResumen() {
    this.isLoading.set(true);

    forkJoin({
      carreras: this.carreraService.getCarreras(),
      fichas: this.revisionService.getTodasLasFichas(),
      periodos: this.periodoService.getPeriodos(),
      formularios: this.formularioService.getFormularios()
    }).subscribe({
      next: ({ carreras, fichas, periodos, formularios }: any) => {
        this.carrerasList.set(carreras || []);
        this.fichasList.set(fichas || []);

        this.totalCarreras.set(carreras?.length || 0);
        this.totalFichasEvaluadas.set(fichas?.length || 0);
        this.totalFormularios.set(formularios?.length || 0);

        const activo = periodos?.find((p: any) => p.activo);
        if (activo) {
          this.periodoActivo.set(activo);
        }

        this.isLoading.set(false);
        setTimeout(() => this.inicializarGraficos(), 50);
      },
      error: (err) => {
        console.error('Error al cargar datos del dashboard:', err);
        this.isLoading.set(false);
      }
    });
  }

  inicializarGraficos() {
    if (!this.pieChartCanvas || !this.barChartCanvas) return;

    const fichas = this.fichasList();
    const carreras = this.carrerasList();

    // 1. GRÁFICO DE PASTEL (NIVELES SOCIOECONÓMICOS)
    const conteoNiveles: Record<string, number> = {};

    fichas.forEach(f => {
      const nombreNivel = f.nivelEconomico?.nombre || 'SIN CLASIFICAR';
      conteoNiveles[nombreNivel] = (conteoNiveles[nombreNivel] || 0) + 1;
    });

    const labelsPie = Object.keys(conteoNiveles);
    const dataPie = Object.values(conteoNiveles);

    const finalLabelsPie = labelsPie.length > 0 ? labelsPie : ['Sin Fichas Registradas'];
    const finalDataPie = dataPie.length > 0 ? dataPie : [0];
    const bgPie = labelsPie.length > 0 
      ? ['#ef4444', '#f59e0b', '#3b82f6', '#10b981', '#8b5cf6', '#64748b']
      : ['#cbd5e1'];

    const ctxPie = this.pieChartCanvas.nativeElement.getContext('2d');
    if (ctxPie) {
      if (this.pieChartInstance) this.pieChartInstance.destroy();

      this.pieChartInstance = new Chart(ctxPie, {
        type: 'doughnut',
        data: {
          labels: finalLabelsPie,
          datasets: [{
            data: finalDataPie,
            backgroundColor: bgPie,
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

    // 2. GRÁFICO DE BARRAS (FICHAS POR CARRERA)
    const labelsCarreras: string[] = [];
    const enviadasPorCarrera: number[] = [];
    const validadasPorCarrera: number[] = [];

    carreras.forEach(carrera => {
      labelsCarreras.push(carrera.nombre);

      const fichasDeCarrera = fichas.filter(f => (f.usuario as any)?.carrera_id === carrera.id);

      const enviadas = fichasDeCarrera.filter(f => f.estado_ficha === 'ENVIADA').length;
      const validadas = fichasDeCarrera.filter(f => f.estado_ficha === 'VALIDADO').length;

      enviadasPorCarrera.push(enviadas);
      validadasPorCarrera.push(validadas);
    });

    const ctxBar = this.barChartCanvas.nativeElement.getContext('2d');
    if (ctxBar) {
      if (this.barChartInstance) this.barChartInstance.destroy();

      this.barChartInstance = new Chart(ctxBar, {
        type: 'bar',
        data: {
          labels: labelsCarreras.length > 0 ? labelsCarreras : ['Sin Carreras'],
          datasets: [
            {
              label: 'Fichas Enviadas',
              data: enviadasPorCarrera.length > 0 ? enviadasPorCarrera : [0],
              backgroundColor: '#8b5cf6',
              borderRadius: 6
            },
            {
              label: 'Fichas Validadas',
              data: validadasPorCarrera.length > 0 ? validadasPorCarrera : [0],
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
              labels: { font: { family: 'Inter', size: 11 }, usePointStyle: true }
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

  descargarReporteExcel() {
    const periodo = this.periodoActivo();
    if (!periodo) {
      alert('No se encontró un periodo de matrícula activo para generar el reporte Excel.');
      return;
    }
    window.open(`${environment.apiUrl}/reportes/socioeconomico/periodo/${periodo.id}`, '_blank');
  }
}