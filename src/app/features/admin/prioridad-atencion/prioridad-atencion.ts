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
import { Subject, Subscription, forkJoin, of } from 'rxjs';
import { debounceTime, catchError } from 'rxjs/operators';
import { PrioridadAtencionService, ReporteNeeSalud } from '../../../core/services/prioridad-atencion.service';
import { PeriodoService } from '../../../core/services/periodo.service';
import { ToastService } from '../../../core/services/toast.service';
import { FormularioService } from '../../../core/services/formulario.service';
import { AuthService } from '../../../core/services/auth.service';
import { CoordinadorCarreraService } from '../../../core/services/coordinador-carrera.service';
import { Formulario } from '../../../core/models/formulario.model';

export interface CarreraConFichas {
  nombre: string;
  totalFichas: number;
}

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
  private readonly formularioService = inject(FormularioService);
  private readonly authService = inject(AuthService);
  private readonly coordinadorCarreraService = inject(CoordinadorCarreraService);
  private readonly toastService = inject(ToastService);
  private readonly router = inject(Router);

  readonly reporteNee = signal<ReporteNeeSalud[]>([]);
  readonly formularios = signal<Formulario[]>([]);
  readonly isLoading = signal<boolean>(true);

  readonly esCoordinadorCarrera = computed(() => {
    const user: any = this.authService.user();
    const rolStr = typeof user?.rol === 'string' ? user.rol : JSON.stringify(user?.rol || '');
    return rolStr.includes('COORDINADOR_CARRERA');
  });

  readonly filterEstudianteInput = signal<string>('');
  readonly filterCedulaInput = signal<string>('');
  readonly filterEstado = signal<string>('TODOS');
  readonly showMobileFilters = signal<boolean>(false);

  readonly filtroCarreraControl = new FormControl('', { nonNullable: true });
  readonly filtroCarreraText = signal<string>('');
  readonly dropdownCarreraAbierto = signal<boolean>(false);

  readonly filtroFormularioControl = new FormControl('', { nonNullable: true });
  readonly filtroFormularioText = signal<string>('');
  readonly formularioSeleccionadoId = signal<string>('');
  readonly dropdownFormularioAbierto = signal<boolean>(false);

  private readonly searchSubject = new Subject<string>();
  private readonly cedulaSubject = new Subject<string>();
  private searchSubscription?: Subscription;
  private cedulaSubscription?: Subscription;

  readonly filterEstudiante = signal<string>('');
  readonly filterCedula = signal<string>('');

  /**
   * Extrae únicamente las carreras con casos activos del periodo lectivo en curso
   */
  readonly carrerasDisponibles = computed<CarreraConFichas[]>(() => {
    const mapa = new Map<string, number>();

    this.reporteNee().forEach(item => {
      const nombre = (item.carrera || 'Sin Carrera').trim();
      if (nombre) {
        mapa.set(nombre, (mapa.get(nombre) || 0) + 1);
      }
    });

    return Array.from(mapa.entries())
      .map(([nombre, totalFichas]) => ({ nombre, totalFichas }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre));
  });

  readonly carrerasFiltradas = computed(() => {
    const termino = this.filtroCarreraText().toLowerCase().trim();
    const lista = this.carrerasDisponibles();
    if (!termino) return lista;
    return lista.filter((c) => c.nombre.toLowerCase().includes(termino));
  });

  readonly formulariosFiltrados = computed(() => {
    const termino = this.filtroFormularioText().toLowerCase().trim();
    const lista = this.formularios();
    if (!termino) return lista;
    return lista.filter((f) => 
      (f.titulo || '').toLowerCase().includes(termino) || 
      String(f.version || '').includes(termino)
    );
  });

  getFormularioNombre(item: any): string {
    if (item?.formulario?.titulo) {
      const ver = item.formulario.version ? ` (v${item.formulario.version})` : '';
      return `${item.formulario.titulo}${ver}`;
    }

    const formId = item?.formulario_id || item?.formulario?.id;
    if (formId && this.formularios().length > 0) {
      const encontrado = this.formularios().find(f => String(f.id) === String(formId));
      if (encontrado?.titulo) {
        return `${encontrado.titulo} (v${encontrado.version})`;
      }
    }
    return 'Ficha Socioeconómica';
  }

  readonly reporteFiltrado = computed(() => {
    const term = this.filterEstudiante().toLowerCase().trim();
    const cedulaTerm = this.filterCedula().toLowerCase().trim();
    const carreraTerm = this.filtroCarreraText().toLowerCase().trim();
    const formSelectedId = this.formularioSeleccionadoId();
    const formText = this.filtroFormularioText().toLowerCase().trim();
    const estado = this.filterEstado();

    return this.reporteNee().filter(item => {
      if (estado !== 'TODOS' && item.estado_ficha !== estado) return false;

      if (carreraTerm) {
        const carreraNombre = (item.carrera || '').toLowerCase();
        if (!carreraNombre.includes(carreraTerm)) return false;
      }

      if (formSelectedId) {
        const fId = (item as any)?.formulario_id || (item as any)?.formulario?.id;
        if (String(fId) !== String(formSelectedId)) return false;
      } else if (formText) {
        const fNombre = this.getFormularioNombre(item).toLowerCase();
        if (!fNombre.includes(formText)) return false;
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
    const carreraActiva = this.esCoordinadorCarrera() ? false : !!this.filtroCarreraText();

    return !!this.filterEstudiante() ||
           !!this.filterCedula() ||
           carreraActiva ||
           !!this.filtroFormularioText() ||
           !!this.formularioSeleccionadoId() ||
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

    this.filtroFormularioControl.valueChanges.subscribe(value => {
      this.filtroFormularioText.set((value || '').trim());
      if (this.formularioSeleccionadoId()) {
        this.formularioSeleccionadoId.set('');
      }
    });

    this.cargarAuxiliares();
    this.cargarReporteEspecializado();
  }

  ngOnDestroy(): void {
    this.searchSubscription?.unsubscribe();
    this.cedulaSubscription?.unsubscribe();
  }

  @HostListener('document:keydown.escape')
  onEscapePress(): void {
    this.dropdownCarreraAbierto.set(false);
    this.dropdownFormularioAbierto.set(false);
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

  seleccionarCarrera(c: CarreraConFichas): void {
    if (!c || !c.nombre || this.esCoordinadorCarrera()) return;
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
    if (this.esCoordinadorCarrera()) return;
    this.filtroCarreraControl.setValue('');
    this.filtroCarreraText.set('');
    this.dropdownCarreraAbierto.set(false);
  }

  seleccionarFormulario(f: Formulario): void {
    if (!f || !f.id) return;
    const label = `${f.titulo} (v${f.version})`;
    this.filtroFormularioControl.setValue(label, { emitEvent: false });
    this.filtroFormularioText.set(label);
    this.formularioSeleccionadoId.set(f.id);
    this.dropdownFormularioAbierto.set(false);
  }

  cerrarDropdownFormulario(): void {
    setTimeout(() => {
      this.dropdownFormularioAbierto.set(false);
    }, 200);
  }

  limpiarFiltroFormulario(): void {
    this.filtroFormularioControl.setValue('', { emitEvent: false });
    this.filtroFormularioText.set('');
    this.formularioSeleccionadoId.set('');
    this.dropdownFormularioAbierto.set(false);
  }

  onEstadoChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.filterEstado.set(value);
  }

  limpiarFiltros(): void {
    this.filterEstudianteInput.set('');
    this.filterCedulaInput.set('');
    if (!this.esCoordinadorCarrera()) {
      this.limpiarFiltroCarrera();
    }
    this.limpiarFiltroFormulario();
    this.searchSubject.next('');
    this.cedulaSubject.next('');
    this.filterEstado.set('TODOS');
  }

  toggleMobileFilters(): void {
    this.showMobileFilters.update(v => !v);
  }

  cargarAuxiliares(): void {
    forkJoin({
      formularios: this.formularioService.getFormularios().pipe(catchError(() => of([]))),
      asignaciones: this.coordinadorCarreraService.getAsignaciones().pipe(catchError(() => of([])))
    }).subscribe({
      next: ({ formularios, asignaciones }) => {
        const user: any = this.authService.user();
        this.formularios.set(formularios || []);

        if (this.esCoordinadorCarrera()) {
          const userId = user?.id;

          const asignacionActiva = (asignaciones || []).find((a: any) => {
            const uId = a.usuario_id || (a.usuario as any)?.id;
            return String(uId) === String(userId) && !a.fecha_fin;
          });

          let carreraNombreAsignada = '';

          if (asignacionActiva?.carrera?.nombre) {
            carreraNombreAsignada = asignacionActiva.carrera.nombre;
          } else if (user?.carrera?.nombre) {
            carreraNombreAsignada = user.carrera.nombre;
          }

          if (carreraNombreAsignada) {
            this.filtroCarreraControl.setValue(carreraNombreAsignada);
            this.filtroCarreraText.set(carreraNombreAsignada);
            this.filtroCarreraControl.disable({ emitEvent: false });
          }
        }
      },
      error: (err) => console.error('Error al cargar datos auxiliares:', err)
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
    this.router.navigate(['/admin/revision-fichas', fichaId], {
      state: { soloLectura: this.esCoordinadorCarrera() }
    });
  }

  exportarReporte(): void {
    if (this.esCoordinadorCarrera()) {
      this.toastService.show('No tienes permisos para exportar reportes.', 'warning');
      return;
    }

    if (this.totalCasos() === 0) {
      this.toastService.show('No hay datos disponibles para exportar.', 'warning');
      return;
    }
    this.toastService.show('Exportación iniciada correctamente.', 'success');
  }
}