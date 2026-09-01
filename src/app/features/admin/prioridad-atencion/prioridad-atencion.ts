import { 
  Component, 
  OnInit, 
  OnDestroy, 
  inject, 
  signal, 
  computed, 
  ChangeDetectionStrategy,
  HostListener
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FormsModule, ReactiveFormsModule, FormControl } from '@angular/forms';
import { Subject, Subscription } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import { PrioridadAtencionService, ReporteNeeSalud } from '../../../core/services/prioridad-atencion.service';
import { PeriodoService } from '../../../core/services/periodo.service';
import { ToastService } from '../../../core/services/toast.service';
import { CarreraService } from '../../../core/services/carrera.service';
import { Carrera } from '../../../core/models/carrera.model';

@Component({
  selector: 'app-prioridad-atencion',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, ReactiveFormsModule],
  templateUrl: './prioridad-atencion.html',
  styleUrls: ['./prioridad-atencion.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PrioridadAtencionComponent implements OnInit, OnDestroy {
  private readonly prioridadService = inject(PrioridadAtencionService);
  private readonly periodoService = inject(PeriodoService);
  private readonly carreraService = inject(CarreraService);
  private readonly toastService = inject(ToastService);
  private readonly router = inject(Router);

  readonly reporteNee = signal<ReporteNeeSalud[]>([]);
  readonly carreras = signal<Carrera[]>([]);
  readonly isLoading = signal<boolean>(true);

  // Signals de filtros simples
  readonly filterEstudianteInput = signal<string>('');
  readonly filterCedulaInput = signal<string>('');
  readonly filterRiesgo = signal<string>('TODOS');
  readonly filterEstado = signal<string>('TODOS');
  readonly showMobileFilters = signal<boolean>(false);

  // Control reactivo y dropdown para Carrera
  readonly filtroCarreraControl = new FormControl('', { nonNullable: true });
  readonly filtroCarreraText = signal<string>('');
  readonly dropdownCarreraAbierto = signal<boolean>(false);

  private readonly searchSubject = new Subject<string>();
  private readonly cedulaSubject = new Subject<string>();
  private searchSubscription?: Subscription;
  private cedulaSubscription?: Subscription;

  readonly filterEstudiante = signal<string>('');
  readonly filterCedula = signal<string>('');

  readonly carrerasFiltradas = computed(() => {
    const termino = this.filtroCarreraText().toLowerCase().trim();
    const lista = this.carreras();
    if (!termino) return lista;
    return lista.filter((c) => (c.nombre || '').toLowerCase().includes(termino));
  });

  readonly estadosDisponibles = computed(() => {
    const set = new Set<string>();
    this.reporteNee().forEach(item => {
      if (item.estado_ficha) { 
        set.add(item.estado_ficha);
      }
    });
    return Array.from(set);
  });

  readonly reporteFiltrado = computed(() => {
    const term = this.filterEstudiante().toLowerCase().trim();
    const cedulaTerm = this.filterCedula().toLowerCase().trim();
    const carreraTerm = this.filtroCarreraText().toLowerCase().trim();
    const estado = this.filterEstado();

    return this.reporteNee().filter(item => {
      if (estado !== 'TODOS' && item.estado_ficha !== estado) return false;

      if (carreraTerm) {
        const carreraNombre = (item.carrera || '').toLowerCase();
        if (!carreraNombre.includes(carreraTerm)) return false;
      }

      if (cedulaTerm) {
        const cedula = item.cedula?.toLowerCase() || '';
        if (!cedula.includes(cedulaTerm)) return false;
      }

      if (!term) return true;

      const estudiante = item.estudiante?.toLowerCase() || '';
      return estudiante.includes(term);
    });
  });

  readonly totalCasos = computed(() => this.reporteFiltrado().length);

  readonly tieneFiltrosActivos = computed(() => {
    return !!this.filterEstudiante() ||
           !!this.filterCedula() ||
           !!this.filtroCarreraText() ||
           this.filterRiesgo() !== 'TODOS' ||
           this.filterEstado() !== 'TODOS';
  });

  ngOnInit(): void {
    this.searchSubscription = this.searchSubject
      .pipe(debounceTime(300))
      .subscribe(val => this.filterEstudiante.set(val));

    this.cedulaSubscription = this.cedulaSubject
      .pipe(debounceTime(300))
      .subscribe(val => this.filterCedula.set(val));

    this.filtroCarreraControl.valueChanges.subscribe(value => {
      this.filtroCarreraText.set((value || '').trim());
    });

    this.cargarCarreras();
    this.cargarReporteEspecializado();
  }

  ngOnDestroy(): void {
    this.searchSubscription?.unsubscribe();
    this.cedulaSubscription?.unsubscribe();
  }

  @HostListener('document:keydown.escape')
  onEscapePress(): void {
    this.dropdownCarreraAbierto.set(false);
  }

  onSearchChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const val = input.value.replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ@._\s-]/g, '');
    if (input.value !== val) {
      input.value = val;
    }
    this.filterEstudianteInput.set(val);
    this.searchSubject.next(val);
  }

  onCedulaSearchChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    let val = input.value.replace(/\D/g, '');
    if (val.length > 10) {
      val = val.substring(0, 10);
    }
    input.value = val;
    this.filterCedulaInput.set(val);
    this.cedulaSubject.next(val);
  }

  seleccionarCarrera(c: Carrera): void {
    if (!c || !c.nombre) return;
    this.filtroCarreraControl.setValue(c.nombre);
    this.filtroCarreraText.set(c.nombre.trim());
    this.dropdownCarreraAbierto.set(false);
  }

  cerrarDropdownCarrera(): void {
    setTimeout(() => {
      this.dropdownCarreraAbierto.set(false);
    }, 200);
  }

  limpiarFiltroCarrera(): void {
    this.filtroCarreraControl.setValue('');
    this.filtroCarreraText.set('');
    this.dropdownCarreraAbierto.set(false);
  }

  onRiesgoChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.filterRiesgo.set(value);
  }

  onEstadoChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.filterEstado.set(value);
  }

  limpiarFiltros(): void {
    this.filterEstudianteInput.set('');
    this.filterCedulaInput.set('');
    this.limpiarFiltroCarrera();
    this.searchSubject.next('');
    this.cedulaSubject.next('');
    this.filterRiesgo.set('TODOS');
    this.filterEstado.set('TODOS');
  }

  toggleMobileFilters(): void {
    this.showMobileFilters.update(v => !v);
  }

  cargarCarreras(): void {
    this.carreraService.getCarreras().subscribe({
      next: (data) => this.carreras.set((data || []).filter(c => !c.fecha_desactivacion)),
      error: (err) => console.error('Error al cargar carreras:', err)
    });
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