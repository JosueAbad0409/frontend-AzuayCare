import { Component, OnInit, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ReportesService, EstadisticasPeriodo } from '../../../core/services/reportes.service';
import { PeriodoService } from '../../../core/services/periodo.service';
import { CarreraService } from '../../../core/services/carrera.service';
import { ToastService } from '../../../core/services/toast.service';
import { PeriodoMatricula } from '../../../core/models/periodo.model';
import { Carrera } from '../../../core/models/carrera.model';

@Component({
  selector: 'app-reportes',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './reportes.component.html',
  styleUrls: ['./reportes.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ReportesComponent implements OnInit {
  private readonly reportesService = inject(ReportesService);
  private readonly periodoService = inject(PeriodoService);
  private readonly carreraService = inject(CarreraService);
  private readonly toastService = inject(ToastService);
  private readonly fb = inject(FormBuilder);

  periodos = signal<PeriodoMatricula[]>([]);
  carreras = signal<Carrera[]>([]);
  estadisticas = signal<EstadisticasPeriodo | null>(null);
  
  isLoading = signal<boolean>(true);
  isLoadingStats = signal<boolean>(false);

  filterForm: FormGroup = this.fb.group({
    periodo_id: [''],
    carrera_id: [''],
    estado_ficha: ['TODOS']
  });

  ngOnInit(): void {
    this.cargarFiltrosIniciales();
    
    // Escuchar cambios en el filtro de Periodo para recargar estadísticas
    this.filterForm.get('periodo_id')?.valueChanges.subscribe((periodoId: string) => {
      if (periodoId) {
        this.cargarEstadisticas(periodoId);
      }
    });
  }

  cargarFiltrosIniciales(): void {
    this.isLoading.set(true);

    this.carreraService.getCarreras().subscribe({
      next: (carrs: Carrera[]) => this.carreras.set(carrs),
      error: (err: unknown) => console.error('Error al cargar carreras:', err)
    });

    this.periodoService.getPeriodos().subscribe({
      next: (pers: PeriodoMatricula[]) => {
        this.periodos.set(pers);
        const periodoActivo = pers.find(p => p.activo) || pers[0];
        if (periodoActivo) {
          this.filterForm.patchValue({ periodo_id: periodoActivo.id }, { emitEvent: true });
        }
        this.isLoading.set(false);
      },
      error: (err: unknown) => {
        console.error('Error al cargar periodos:', err);
        this.toastService.show('Error al cargar filtros de periodos.', 'error');
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

  descargarMatrizExcel(): void {
    const periodoId = this.filterForm.get('periodo_id')?.value;
    if (!periodoId) {
      this.toastService.show('Por favor seleccione un periodo académico para descargar.', 'warning');
      return;
    }
    this.toastService.show('Generando descarga del reporte Excel...', 'info');
    this.reportesService.descargarExcelMatriz(periodoId);
  }
}