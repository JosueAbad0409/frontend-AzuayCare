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
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject, Subscription } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import { RevisionService } from '../../../core/services/revision.service';
import { HistorialEstadoService } from '../../../core/services/historial-estado.service';
import { FichaRevision, EstadoFicha } from '../../../core/models/revision-ficha.model';
import { HistorialEstadoFicha } from '../../../core/models/historial-estado.model';

@Component({
  selector: 'app-revision',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './revision.component.html',
  styleUrls: ['./revision.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RevisionComponent implements OnInit, OnDestroy {
  private readonly revisionService = inject(RevisionService);
  private readonly historialService = inject(HistorialEstadoService);
  private readonly router = inject(Router);

  readonly fichas = signal<FichaRevision[]>([]);
  readonly isLoading = signal<boolean>(true);

  readonly searchTerm = signal<string>('');
  readonly estadoFiltro = signal<string>('TODOS');
  readonly filterPeriodo = signal<string>('TODOS');
  readonly paginaActual = signal<number>(1);
  readonly limite = signal<number>(10);

  private readonly searchSubject = new Subject<string>();
  private searchSubscription?: Subscription;

  readonly periodosDisponibles = computed(() => {
    const set = new Set<string>();
    this.fichas().forEach(f => {
      const pNombre = f.periodo?.nombre;
      if (pNombre) {
        set.add(pNombre);
      }
    });
    return Array.from(set);
  });

  readonly fichasFiltradas = computed(() => {
    const term = this.searchTerm().toLowerCase().trim();
    const estado = this.estadoFiltro();
    const periodo = this.filterPeriodo();

    return this.fichas().filter(f => {
      if (estado !== 'TODOS' && f.estado_ficha !== estado) return false;
      
      const pNombre = f.periodo?.nombre || 'General';
      if (periodo !== 'TODOS' && pNombre !== periodo) return false;

      if (!term) return true;
      const nombre = f.usuario?.primer_nombre?.toLowerCase() || '';
      const apellido = f.usuario?.primer_apellido?.toLowerCase() || '';
      const cedula = f.usuario?.cedula?.toLowerCase() || '';
      const correo = f.usuario?.email_institucional?.toLowerCase() || '';

      return nombre.includes(term) || 
             apellido.includes(term) || 
             cedula.includes(term) || 
             correo.includes(term);
    });
  });

  readonly totalRegistros = computed(() => this.fichasFiltradas().length);
  readonly totalPaginas = computed(() => Math.ceil(this.totalRegistros() / this.limite()) || 1);
  
  readonly fichasPaginadas = computed(() => {
    const inicio = (this.paginaActual() - 1) * this.limite();
    const fin = inicio + this.limite();
    return this.fichasFiltradas().slice(inicio, fin);
  });

  readonly fichaSeleccionada = signal<FichaRevision | null>(null);
  readonly respuestasFicha = signal<any[]>([]);
  readonly historialFicha = signal<HistorialEstadoFicha[]>([]);
  readonly tabActiva = signal<'DETALLE' | 'HISTORIAL'>('DETALLE');
  readonly comentarioCambio = signal<string>('');
  readonly guardandoEstado = signal<boolean>(false);

  ngOnInit(): void {
    this.searchSubscription = this.searchSubject
      .pipe(debounceTime(400))
      .subscribe(val => {
        this.searchTerm.set(val);
        this.paginaActual.set(1);
      });

    this.cargarTodasLasFichas();
  }

  ngOnDestroy(): void {
    this.searchSubscription?.unsubscribe();
  }

  onSearchChange(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.searchSubject.next(value);
  }

  onEstadoChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.estadoFiltro.set(value);
    this.paginaActual.set(1);
  }

  onPeriodoChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.filterPeriodo.set(value);
    this.paginaActual.set(1);
  }

  limpiarFiltros(): void {
    this.searchTerm.set('');
    this.estadoFiltro.set('TODOS');
    this.filterPeriodo.set('TODOS');
    this.paginaActual.set(1);
  }

  cambiarPagina(nuevaPagina: number): void {
    if (nuevaPagina >= 1 && nuevaPagina <= this.totalPaginas()) {
      this.paginaActual.set(nuevaPagina);
    }
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