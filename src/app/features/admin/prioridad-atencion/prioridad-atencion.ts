import { 
  Component, 
  OnInit, 
  OnDestroy, 
  inject, 
  signal, 
  computed, 
  ChangeDetectionStrategy 
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subject, Subscription } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import { PrioridadAtencionService, ReporteNeeSalud } from '../../../core/services/prioridad-atencion.service';
import { PeriodoService } from '../../../core/services/periodo.service';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-prioridad-atencion',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './prioridad-atencion.html',
  styleUrls: ['./prioridad-atencion.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PrioridadAtencionComponent implements OnInit, OnDestroy {
  private readonly prioridadService = inject(PrioridadAtencionService);
  private readonly periodoService = inject(PeriodoService);
  private readonly toastService = inject(ToastService);
  private readonly router = inject(Router);

  readonly reporteNee = signal<ReporteNeeSalud[]>([]);
  readonly isLoading = signal<boolean>(true);

  readonly filterEstudiante = signal<string>('');
  readonly filterCarrera = signal<string>('TODOS');
  readonly filterRiesgo = signal<string>('TODOS');

  private readonly searchSubject = new Subject<string>();
  private searchSubscription?: Subscription;

  readonly carrerasDisponibles = computed(() => {
    const set = new Set<string>();
    this.reporteNee().forEach(item => {
      if (item.carrera) {
        set.add(item.carrera);
      }
    });
    return Array.from(set);
  });

  readonly reporteFiltrado = computed(() => {
    const term = this.filterEstudiante().toLowerCase().trim();
    const carrera = this.filterCarrera();
    const riesgo = this.filterRiesgo();

    return this.reporteNee().filter(item => {
      if (carrera !== 'TODOS' && item.carrera !== carrera) return false;

      if (riesgo === 'CON_RIESGO' && item.riesgo_total <= 0) return false;
      if (riesgo === 'SIN_RIESGO' && item.riesgo_total > 0) return false;

      if (!term) return true;

      const estudiante = item.estudiante?.toLowerCase() || '';
      const cedula = item.cedula?.toLowerCase() || '';

      return estudiante.includes(term) || cedula.includes(term);
    });
  });

  readonly totalCasos = computed(() => this.reporteFiltrado().length);

  ngOnInit(): void {
    this.searchSubscription = this.searchSubject
      .pipe(debounceTime(400))
      .subscribe(val => {
        this.filterEstudiante.set(val);
      });

    this.cargarReporteEspecializado();
  }

  ngOnDestroy(): void {
    this.searchSubscription?.unsubscribe();
  }

  onSearchChange(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.searchSubject.next(value);
  }

  onCarreraChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.filterCarrera.set(value);
  }

  onRiesgoChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.filterRiesgo.set(value);
  }

  limpiarFiltros(): void {
    this.filterEstudiante.set('');
    this.filterCarrera.set('TODOS');
    this.filterRiesgo.set('TODOS');
  }

  cargarReporteEspecializado(): void {
    this.isLoading.set(true);
    
    this.periodoService.getPeriodos().subscribe({
      next: (periodos) => {
        const periodoActivo = periodos.find(p => p.activo);
        if (periodoActivo) {
          this.prioridadService.getReporteNee(periodoActivo.id).subscribe({
            next: (data) => {
              this.reporteNee.set(data || []);
              this.isLoading.set(false);
            },
            error: (err) => {
              console.error('Error al cargar reporte NEE', err);
              this.isLoading.set(false);
            }
          });
        } else {
          this.isLoading.set(false);
        }
      },
      error: () => this.isLoading.set(false)
    });
  }

  obtenerLlavesVulnerabilidad(detalles: Record<string, any>): string[] {
    return detalles ? Object.keys(detalles) : [];
  }

  verFicha(fichaId: string): void {
    if (!fichaId) return;
    this.router.navigate(['/admin/revision-fichas', fichaId]);
  }

  exportarReporte(): void {
    if (this.totalCasos() === 0) {
      this.toastService.show('No hay datos disponibles para exportar.', 'warning');
      return;
    }
    this.toastService.show('Exportación simulada iniciada correctamente.', 'success');
  }
}