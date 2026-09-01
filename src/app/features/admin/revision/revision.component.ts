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
import { Subject } from 'rxjs';
import { debounceTime } from 'rxjs/operators';

import { RevisionService } from '../../../core/services/revision.service';
import { HistorialEstadoService } from '../../../core/services/historial-estado.service';
import { CarreraService } from '../../../core/services/carrera.service';
import { CiclosService } from '../../../core/services/ciclos.service';

import { FichaRevision, EstadoFicha } from '../../../core/models/revision-ficha.model';
import { HistorialEstadoFicha } from '../../../core/models/historial-estado.model';
import { Carrera } from '../../../core/models/carrera.model';
import { Ciclo } from '../../../core/models/ciclo.model';

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
  private readonly router = inject(Router);

  // Estados reactivos primarios
  readonly fichas = signal<FichaRevision[]>([]);
  readonly carreras = signal<Carrera[]>([]);
  readonly ciclos = signal<Ciclo[]>([]);
  readonly isLoading = signal<boolean>(true);

  // Filtros de búsqueda simples
  readonly searchTermInput = signal<string>('');
  readonly filterCedulaInput = signal<string>('');
  readonly filterCicloSelect = signal<string>('TODOS');
  
  // PATRÓN COMPLETAR-PERFIL: Filtro y Dropdown Dinámico para Carrera
  readonly filtroCarreraControl = new FormControl('', { nonNullable: true });
  readonly filtroCarreraText = signal<string>('');
  readonly dropdownCarreraAbierto = signal<boolean>(false);

  readonly carrerasFiltradas = computed(() => {
    const termino = this.filtroCarreraText().toLowerCase().trim();
    const lista = this.carreras();
    if (!termino) return lista;
    return lista.filter((c) => (c.nombre || '').toLowerCase().includes(termino));
  });

  // Debounced Signals mediante RxJS Subject
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
    this.fichas().forEach(f => {
      if (f.periodo?.nombre) set.add(f.periodo.nombre);
    });
    return Array.from(set);
  });

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

  readonly fichasFiltradas = computed(() => {
    const term = this.searchTerm().toLowerCase().trim();
    const cedulaTerm = this.filterCedula().toLowerCase().trim();
    const carreraTerm = this.filtroCarreraText().toLowerCase().trim();
    const cicloSel = this.filterCicloSelect();
    const estado = this.estadoFiltro();
    const periodo = this.filterPeriodo();

    return this.fichas().filter(f => {
      if (estado !== 'TODOS' && f.estado_ficha !== estado) return false;

      const pNombre = f.periodo?.nombre || 'General';
      if (periodo !== 'TODOS' && pNombre !== periodo) return false;

      if (cedulaTerm) {
        const cedula = f.usuario?.cedula?.toLowerCase() || '';
        if (!cedula.includes(cedulaTerm)) return false;
      }

      if (carreraTerm) {
        const carreraNombre = this.getCarreraNombre(f).toLowerCase();
        if (!carreraNombre.includes(carreraTerm)) return false;
      }

      if (cicloSel !== 'TODOS') {
        const cicloNombre = this.getCicloNombre(f).toLowerCase();
        if (!cicloNombre.includes(cicloSel.toLowerCase())) return false;
      }

      if (!term) return true;
      const nombre = f.usuario?.primer_nombre?.toLowerCase() || '';
      const apellido = f.usuario?.primer_apellido?.toLowerCase() || '';
      const correo = f.usuario?.email_institucional?.toLowerCase() || '';

      return nombre.includes(term) || apellido.includes(term) || correo.includes(term);
    });
  });

  readonly totalRegistros = computed(() => this.fichasFiltradas().length);
  readonly totalPaginas = computed(() => Math.ceil(this.totalRegistros() / this.limite()) || 1);

  readonly fichasPaginadas = computed(() => {
    const inicio = (this.paginaActual() - 1) * this.limite();
    return this.fichasFiltradas().slice(inicio, inicio + this.limite());
  });

  readonly tieneFiltrosActivos = computed(() => {
    return !!this.searchTerm() ||
           !!this.filterCedula() ||
           !!this.filtroCarreraText() ||
           this.filterCicloSelect() !== 'TODOS' ||
           this.estadoFiltro() !== 'TODOS' ||
           this.filterPeriodo() !== 'TODOS';
  });

  ngOnInit(): void {
    this.cargarAuxiliares();
    this.cargarTodasLasFichas();

    this.filtroCarreraControl.valueChanges.subscribe(value => {
      this.filtroCarreraText.set((value || '').trim());
      this.paginaActual.set(1);
    });
  }

  @HostListener('document:keydown.escape')
  onEscapePress(): void {
    if (this.fichaSeleccionada()) {
      this.cerrarModal();
    }
  }

  seleccionarCarrera(c: Carrera): void {
    if (!c || !c.nombre) return;
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
    this.filtroCarreraControl.setValue('');
    this.filtroCarreraText.set('');
    this.dropdownCarreraAbierto.set(false);
    this.paginaActual.set(1);
  }

  /**
   * VALIDACIONES Y SANITIZACIÓN EN TIEMPO REAL
   */
  onSearchChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    // Sanitizar texto: remover caracteres extraños que puedan romper la consulta
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
    // Validar Cédula Ecuatoriana: Solo números y máximo 10 dígitos
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
    this.limpiarFiltroCarrera();
    this.filterCicloSelect.set('TODOS');
    this.searchSubject.next('');
    this.cedulaSubject.next('');
    this.estadoFiltro.set('TODOS');
    this.filterPeriodo.set('TODOS');
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
    this.carreraService.getCarreras().subscribe({
      next: (data) => this.carreras.set((data || []).filter(c => !c.fecha_desactivacion)),
      error: (err) => console.error('Error al cargar carreras:', err)
    });

    this.ciclosService.getCiclos().subscribe({
      next: (data) => this.ciclos.set(data || []),
      error: (err) => console.error('Error al cargar ciclos:', err)
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
    this.router.navigate(['/admin/revision-fichas', ficha.id]);
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
    if (!ficha || this.guardandoEstado()) return;

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