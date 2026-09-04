import { 
  Component, 
  OnInit, 
  inject, 
  signal, 
  computed, 
  ChangeDetectionStrategy,
  HostListener
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormControl } from '@angular/forms';
import { Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { Subject, forkJoin, of } from 'rxjs';
import { debounceTime, catchError } from 'rxjs/operators';

import { RevisionService } from '../../../core/services/revision.service';
import { HistorialEstadoService } from '../../../core/services/historial-estado.service';
import { CarreraService } from '../../../core/services/carrera.service';
import { CiclosService } from '../../../core/services/ciclos.service';
import { FormularioService } from '../../../core/services/formulario.service';
import { PeriodoService } from '../../../core/services/periodo.service';
import { AuthService } from '../../../core/services/auth.service';
import { CoordinadorCarreraService } from '../../../core/services/coordinador-carrera.service';

import { FichaRevision, EstadoFicha } from '../../../core/models/revision-ficha.model';
import { HistorialEstadoFicha } from '../../../core/models/historial-estado.model';
import { Carrera } from '../../../core/models/carrera.model';
import { Ciclo } from '../../../core/models/ciclo.model';
import { Formulario } from '../../../core/models/formulario.model';
import { PeriodoMatricula } from '../../../core/models/periodo.model';
import { CoordinadorCarreraAsignacion } from '../../../core/models/coordinador-carrera.model';

export interface CarreraConFichas {
  nombre: string;
  totalFichas: number;
}

@Component({
  selector: 'app-revision',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './revision.component.html',
  styleUrls: ['./revision.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RevisionComponent implements OnInit {
  private readonly revisionService = inject(RevisionService);
  private readonly historialService = inject(HistorialEstadoService);
  private readonly carreraService = inject(CarreraService);
  private readonly ciclosService = inject(CiclosService);
  private readonly formularioService = inject(FormularioService);
  private readonly periodoService = inject(PeriodoService);
  private readonly authService = inject(AuthService);
  private readonly coordinadorCarreraService = inject(CoordinadorCarreraService);
  private readonly router = inject(Router);

  // Estados reactivos primarios
  readonly fichas = signal<FichaRevision[]>([]);
  readonly carreras = signal<Carrera[]>([]);
  readonly ciclos = signal<Ciclo[]>([]);
  readonly formularios = signal<Formulario[]>([]);
  readonly periodos = signal<PeriodoMatricula[]>([]);
  readonly asignaciones = signal<CoordinadorCarreraAsignacion[]>([]);
  readonly periodoActivoNombre = signal<string>('');
  readonly isLoading = signal<boolean>(true);

  // Detección del rol del usuario
  readonly esCoordinadorCarrera = computed(() => {
    const user: any = this.authService.user();
    const rolStr = typeof user?.rol === 'string' ? user.rol : JSON.stringify(user?.rol || '');
    return rolStr.includes('COORDINADOR_CARRERA');
  });

  // Filtros
  readonly searchTermInput = signal<string>('');
  readonly filterCedulaInput = signal<string>('');
  readonly filterCicloSelect = signal<string>('TODOS');

  readonly filtroCarreraControl = new FormControl('', { nonNullable: true });
  readonly filtroCarreraText = signal<string>('');
  readonly dropdownCarreraAbierto = signal<boolean>(false);

  readonly filtroFormularioControl = new FormControl('', { nonNullable: true });
  readonly filtroFormularioText = signal<string>('');
  readonly formularioSeleccionadoId = signal<string>('');
  readonly dropdownFormularioAbierto = signal<boolean>(false);

  private readonly searchSubject = new Subject<string>();
  private readonly cedulaSubject = new Subject<string>();

  readonly searchTerm = toSignal(this.searchSubject.pipe(debounceTime(300)), { initialValue: '' });
  readonly filterCedula = toSignal(this.cedulaSubject.pipe(debounceTime(300)), { initialValue: '' });

  readonly estadoFiltro = signal<string>('TODOS');
  readonly filterPeriodo = signal<string>('TODOS');
  readonly showMobileFilters = signal<boolean>(false);

  // Paginación
  readonly paginaActual = signal<number>(1);
  readonly limite = signal<number>(10);

  // Modal y Detalle
  readonly fichaSeleccionada = signal<FichaRevision | null>(null);
  readonly respuestasFicha = signal<any[]>([]);
  readonly historialFicha = signal<HistorialEstadoFicha[]>([]);
  readonly tabActiva = signal<'DETALLE' | 'HISTORIAL'>('DETALLE');
  readonly comentarioCambio = signal<string>('');
  readonly guardandoEstado = signal<boolean>(false);

  readonly periodosDisponibles = computed(() => {
    const set = new Set<string>();
    this.periodos().forEach(p => {
      if (p.nombre) set.add(p.nombre);
    });
    if (set.size === 0) {
      this.fichas().forEach(f => {
        if (f.periodo?.nombre) set.add(f.periodo.nombre);
      });
    }
    return Array.from(set);
  });

  /**
   * Obtiene las fichas pre-filtradas por periodo lectivo, estado, ciclo, formulario, cédula y búsqueda
   * (sin aplicar el filtro de carrera para poder calcular los contadores por carrera correctamente)
   */
  readonly fichasBaseSinCarrera = computed(() => {
    const term = this.searchTerm().toLowerCase().trim();
    const cedulaTerm = this.filterCedula().toLowerCase().trim();
    const formSelectedId = this.formularioSeleccionadoId();
    const formText = this.filtroFormularioText().toLowerCase().trim();
    const cicloSel = this.filterCicloSelect();
    const estado = this.estadoFiltro();
    const periodo = this.filterPeriodo();

    return this.fichas().filter(f => {
      // Estado
      if (estado !== 'TODOS') {
        const estFicha = String(f.estado_ficha || (f as any).estado || '').toUpperCase();
        if (estado === 'ENVIADA') {
          if (estFicha !== 'ENVIADA' && estFicha !== 'ENVIADO' && estFicha !== 'POR VALIDAR') return false;
        } else if (estFicha !== estado.toUpperCase()) {
          return false;
        }
      }

      // Periodo Lectivo
      const pNombre = f.periodo?.nombre || (f as any).periodo_nombre || (f as any).periodo || 'General';
      if (periodo !== 'TODOS' && String(pNombre) !== String(periodo)) return false;

      // Formulario
      if (formSelectedId) {
        const fId = f.formulario_id || (f as any).formulario?.id;
        if (String(fId) !== String(formSelectedId)) return false;
      } else if (formText) {
        const fNombre = this.getFormularioNombre(f).toLowerCase();
        if (!fNombre.includes(formText)) return false;
      }

      // Cédula
      if (cedulaTerm) {
        const cedula = f.usuario?.cedula?.toLowerCase() || '';
        if (!cedula.includes(cedulaTerm)) return false;
      }

      // Ciclo
      if (cicloSel !== 'TODOS') {
        const cicloNombre = this.getCicloNombre(f).toLowerCase();
        if (!cicloNombre.includes(cicloSel.toLowerCase())) return false;
      }

      // Texto general
      if (!term) return true;
      const nombre = f.usuario?.primer_nombre?.toLowerCase() || '';
      const apellido = f.usuario?.primer_apellido?.toLowerCase() || '';
      const correo = f.usuario?.email_institucional?.toLowerCase() || '';

      return nombre.includes(term) || apellido.includes(term) || correo.includes(term);
    });
  });

  /**
   * Extrae dinámicamente ÚNICAMENTE las carreras con fichas que corresponden AL PERIODO Y FILTROS SELECCIONADOS
   */
  readonly carrerasDisponibles = computed<CarreraConFichas[]>(() => {
    const mapa = new Map<string, number>();

    // Contamos solo sobre la lista de fichas que ya pertenecen al periodo lectivo actual/filtrado
    this.fichasBaseSinCarrera().forEach(f => {
      const nombre = this.getCarreraNombre(f);
      if (nombre && nombre !== 'No asignada') {
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

  esPeriodoActivo(nombre: string): boolean {
    return !!this.periodoActivoNombre() && this.periodoActivoNombre() === nombre;
  }

  getCarreraNombre(ficha: FichaRevision): string {
    const usuario = ficha.usuario as any;
    if (usuario?.carrera?.nombre) return usuario.carrera.nombre;
    if ((ficha as any)?.carrera?.nombre) return (ficha as any).carrera.nombre;

    const carreraId = usuario?.carrera_id || usuario?.carrera?.id || (ficha as any)?.carrera_id;
    if (carreraId && this.carreras().length > 0) {
      const encontrada = this.carreras().find(c => String(c.id) === String(carreraId));
      if (encontrada?.nombre) return encontrada.nombre;
    }
    return 'No asignada';
  }

  getCicloNombre(ficha: FichaRevision): string {
    const usuario = ficha.usuario as any;
    if (usuario?.ciclo?.nombre) return usuario.ciclo.nombre;
    if ((ficha as any)?.ciclo?.nombre) return (ficha as any).ciclo.nombre;

    const cicloId = usuario?.ciclo_id || usuario?.ciclo?.id || (ficha as any)?.ciclo_id;
    if (cicloId && this.ciclos().length > 0) {
      const encontrado = this.ciclos().find(c => String(c.id) === String(cicloId));
      if (encontrado?.nombre) return encontrado.nombre;
    }
    return 'No asignado';
  }

  getFormularioNombre(ficha: FichaRevision): string {
    if ((ficha as any)?.formulario?.titulo) {
      const titulo = (ficha as any).formulario.titulo;
      const ver = (ficha as any).formulario.version ? ` (v${(ficha as any).formulario.version})` : '';
      return `${titulo}${ver}`;
    }

    const formId = ficha.formulario_id || (ficha as any)?.formulario_id || (ficha as any)?.formulario?.id;
    if (formId && this.formularios().length > 0) {
      const encontrado = this.formularios().find(f => String(f.id) === String(formId));
      if (encontrado?.titulo) {
        return `${encontrado.titulo} (v${encontrado.version})`;
      }
    }
    return 'Ficha Socioeconómica';
  }

  /**
   * Filtro final de fichas a mostrar en la tabla
   */
  readonly fichasFiltradas = computed(() => {
    const carreraTerm = this.filtroCarreraText().toLowerCase().trim();
    const base = this.fichasBaseSinCarrera();

    if (!carreraTerm) return base;

    return base.filter(f => {
      const carreraNombre = this.getCarreraNombre(f).toLowerCase();
      return carreraNombre.includes(carreraTerm);
    });
  });

  readonly totalRegistros = computed(() => this.fichasFiltradas().length);
  readonly totalPaginas = computed(() => Math.ceil(this.totalRegistros() / this.limite()) || 1);

  readonly fichasPaginadas = computed(() => {
    const inicio = (this.paginaActual() - 1) * this.limite();
    return this.fichasFiltradas().slice(inicio, inicio + this.limite());
  });

  readonly tieneFiltrosActivos = computed(() => {
    const carreraActiva = this.esCoordinadorCarrera() ? false : !!this.filtroCarreraText();

    return !!this.searchTerm() ||
           !!this.filterCedula() ||
           carreraActiva ||
           !!this.filtroFormularioText() ||
           !!this.formularioSeleccionadoId() ||
           this.filterCicloSelect() !== 'TODOS' ||
           this.estadoFiltro() !== 'TODOS' ||
           (this.periodoActivoNombre() 
             ? this.filterPeriodo() !== this.periodoActivoNombre() 
             : this.filterPeriodo() !== 'TODOS');
  });

  ngOnInit(): void {
    this.cargarAuxiliares();
    this.cargarTodasLasFichas();

    this.filtroCarreraControl.valueChanges.subscribe(value => {
      this.filtroCarreraText.set((value || '').trim());
      this.paginaActual.set(1);
    });

    this.filtroFormularioControl.valueChanges.subscribe(value => {
      this.filtroFormularioText.set((value || '').trim());
      if (this.formularioSeleccionadoId()) {
        this.formularioSeleccionadoId.set('');
      }
      this.paginaActual.set(1);
    });
  }

  @HostListener('document:keydown.escape')
  onEscapePress(): void {
    if (this.fichaSeleccionada()) {
      this.cerrarModal();
    }
  }

  seleccionarCarrera(c: CarreraConFichas): void {
    if (!c || !c.nombre || this.esCoordinadorCarrera()) return;
    this.filtroCarreraControl.setValue(c.nombre);
    this.filtroCarreraText.set(c.nombre.trim());
    this.dropdownCarreraAbierto.set(false);
    this.paginaActual.set(1);
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
    this.paginaActual.set(1);
  }

  seleccionarFormulario(f: Formulario): void {
    if (!f || !f.id) return;
    const label = `${f.titulo} (v${f.version})`;
    this.filtroFormularioControl.setValue(label, { emitEvent: false });
    this.filtroFormularioText.set(label);
    this.formularioSeleccionadoId.set(f.id);
    this.dropdownFormularioAbierto.set(false);
    this.paginaActual.set(1);
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
    this.paginaActual.set(1);
  }

  onSearchChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const val = input.value.replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ@._\s-]/g, '');
    if (input.value !== val) {
      input.value = val;
    }
    this.searchTermInput.set(val);
    this.searchSubject.next(val);
    this.paginaActual.set(1);
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
    this.paginaActual.set(1);
  }

  onCicloSelectChange(event: Event): void {
    this.filterCicloSelect.set((event.target as HTMLSelectElement).value);
    this.paginaActual.set(1);
  }

  onEstadoChange(event: Event): void {
    this.estadoFiltro.set((event.target as HTMLSelectElement).value);
    this.paginaActual.set(1);
  }

  onPeriodoChange(event: Event): void {
    this.filterPeriodo.set((event.target as HTMLSelectElement).value);
    this.paginaActual.set(1);
  }

  limpiarFiltros(): void {
    this.searchTermInput.set('');
    this.filterCedulaInput.set('');

    if (!this.esCoordinadorCarrera()) {
      this.limpiarFiltroCarrera();
    }

    this.limpiarFiltroFormulario();
    this.filterCicloSelect.set('TODOS');
    this.searchSubject.next('');
    this.cedulaSubject.next('');
    this.estadoFiltro.set('TODOS');

    if (this.periodoActivoNombre()) {
      this.filterPeriodo.set(this.periodoActivoNombre());
    } else {
      this.filterPeriodo.set('TODOS');
    }

    this.paginaActual.set(1);
  }

  toggleMobileFilters(): void {
    this.showMobileFilters.update(v => !v);
  }

  cambiarPagina(nuevaPagina: number): void {
    if (nuevaPagina >= 1 && nuevaPagina <= this.totalPaginas()) {
      this.paginaActual.set(nuevaPagina);
    }
  }

  cargarAuxiliares(): void {
    forkJoin({
      carreras: this.carreraService.getCarreras().pipe(catchError(() => of([]))),
      ciclos: this.ciclosService.getCiclos().pipe(catchError(() => of([]))),
      formularios: this.formularioService.getFormularios().pipe(catchError(() => of([]))),
      periodos: this.periodoService.getPeriodos().pipe(catchError(() => of([]))),
      asignaciones: this.coordinadorCarreraService.getAsignaciones().pipe(catchError(() => of([])))
    }).subscribe({
      next: ({ carreras, ciclos, formularios, periodos, asignaciones }) => {
        const user: any = this.authService.user();
        let listaCarreras = (carreras || []).filter(c => !c.fecha_desactivacion);

        this.asignaciones.set(asignaciones || []);
        this.carreras.set(listaCarreras);
        this.ciclos.set(ciclos || []);
        this.formularios.set(formularios || []);

        const listaPeriodos = periodos || [];
        this.periodos.set(listaPeriodos);
        
        // Asignación de periodo activo predeterminado
        const activo = listaPeriodos.find(p => p.activo);
        if (activo?.nombre) {
          this.periodoActivoNombre.set(activo.nombre);
          this.filterPeriodo.set(activo.nombre);
        }

        if (this.esCoordinadorCarrera()) {
          const userId = user?.id;

          const asignacionActiva = (asignaciones || []).find((a: any) => {
            const uId = a.usuario_id || (a.usuario as any)?.id;
            return String(uId) === String(userId) && !a.fecha_fin;
          });

          let carreraNombreAsignada = '';

          if (asignacionActiva?.carrera?.nombre) {
            carreraNombreAsignada = asignacionActiva.carrera.nombre;
          } else if (asignacionActiva?.carrera_id) {
            const carreraMatch = listaCarreras.find(c => String(c.id) === String(asignacionActiva.carrera_id));
            if (carreraMatch?.nombre) carreraNombreAsignada = carreraMatch.nombre;
          }

          if (!carreraNombreAsignada) {
            if (user?.carrera?.nombre) {
              carreraNombreAsignada = user.carrera.nombre;
            } else if (user?.carrera_id) {
              const cFound = listaCarreras.find(c => String(c.id) === String(user.carrera_id));
              if (cFound?.nombre) carreraNombreAsignada = cFound.nombre;
            }
          }

          if (carreraNombreAsignada) {
            this.filtroCarreraControl.setValue(carreraNombreAsignada);
            this.filtroCarreraText.set(carreraNombreAsignada);
            this.filtroCarreraControl.disable({ emitEvent: false });
          }
        }
      },
      error: (err) => console.error('Error al cargar auxiliares:', err)
    });
  }

  cargarTodasLasFichas(): void {
    this.isLoading.set(true);
    this.revisionService.getFichasPaginadas(0, 10000, '', 'TODOS').subscribe({
      next: (response: any) => {
        this.fichas.set(response.data || []);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Error al cargar fichas:', err);
        this.isLoading.set(false);
      }
    });
  }

  verDetalleFicha(ficha: FichaRevision): void {
    this.router.navigate(['/admin/revision-fichas', ficha.id], { 
      state: { soloLectura: this.esCoordinadorCarrera() } 
    });
  }

  cargarHistorial(fichaId: string): void {
    this.historialService.getHistorialByFicha(fichaId).subscribe({
      next: (historial) => this.historialFicha.set(historial),
      error: (err) => console.error('Error al cargar historial:', err)
    });
  }

  setTab(tab: 'DETALLE' | 'HISTORIAL'): void {
    this.tabActiva.set(tab);
  }

  cambiarEstado(nuevoEstado: EstadoFicha): void {
    const ficha = this.fichaSeleccionada();
    if (!ficha || this.guardandoEstado() || this.esCoordinadorCarrera()) return;

    this.guardandoEstado.set(true);
    this.revisionService.actualizarEstadoFicha(ficha.id, nuevoEstado, this.comentarioCambio()).subscribe({
      next: (fichaActualizada) => {
        this.guardandoEstado.set(false);
        this.fichaSeleccionada.set(fichaActualizada);
        this.cargarHistorial(ficha.id);
        this.fichas.update(fichas => 
          fichas.map(f => f.id === ficha.id ? fichaActualizada : f)
        );
      },
      error: (err) => {
        console.error('Error al actualizar el estado:', err);
        this.guardandoEstado.set(false);
      }
    });
  }

  cerrarModal(): void {
    this.fichaSeleccionada.set(null);
    this.respuestasFicha.set([]);
    this.historialFicha.set([]);
    this.comentarioCambio.set('');
    document.body.style.overflow = '';
  }
}