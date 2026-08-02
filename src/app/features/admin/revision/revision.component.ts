import { 
  Component, 
  OnInit, 
  inject, 
  signal, 
  computed, 
  ChangeDetectionStrategy, 
  OnDestroy 
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { RevisionService } from '../../../core/services/revision.service';
import { HistorialEstadoService } from '../../../core/services/historial-estado.service';
import { FichaRevision, FichasPaginadasResponse, EstadoFicha } from '../../../core/models/revision-ficha.model';
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

  // Estados reactivos principales
  fichas = signal<FichaRevision[]>([]);
  isLoading = signal<boolean>(true);

  // Paginación y filtros
  searchTerm = signal<string>('');
  estadoFiltro = signal<string>('TODOS');
  paginaActual = signal<number>(1);
  limite = signal<number>(10);
  totalRegistros = signal<number>(0);

  // Cálculo derivado para el total de páginas
  totalPaginas = computed(() => Math.ceil(this.totalRegistros() / this.limite()) || 1);

  // Estado del Modal y Detalle
  fichaSeleccionada = signal<FichaRevision | null>(null);
  respuestasFicha = signal<any[]>([]);
  historialFicha = signal<HistorialEstadoFicha[]>([]);
  tabActiva = signal<'DETALLE' | 'HISTORIAL'>('DETALLE');
  comentarioCambio = signal<string>('');
  guardandoEstado = signal<boolean>(false);

  // Subject RxJS para la búsqueda optimizada (Debounce)
  private readonly searchSubject = new Subject<string>();
  private searchSubscription!: Subscription;

  ngOnInit(): void {
    // Configuración del Debounce para evitar saturar el backend NestJS con peticiones
    this.searchSubscription = this.searchSubject.pipe(
      debounceTime(400),
      distinctUntilChanged()
    ).subscribe(term => {
      this.searchTerm.set(term);
      this.paginaActual.set(1); // Reiniciar a la primera página tras una búsqueda
      this.cargarFichas();
    });

    this.cargarFichas();
  }

  ngOnDestroy(): void {
    if (this.searchSubscription) {
      this.searchSubscription.unsubscribe();
    }
  }

  onSearchChange(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.searchSubject.next(value);
  }

  onEstadoChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.estadoFiltro.set(value);
    this.paginaActual.set(1); // Reiniciar a la primera página
    this.cargarFichas();
  }

  cambiarPagina(nuevaPagina: number): void {
    if (nuevaPagina >= 1 && nuevaPagina <= this.totalPaginas()) {
      this.paginaActual.set(nuevaPagina);
      this.cargarFichas();
    }
  }

  cargarFichas(): void {
    this.isLoading.set(true);

    // Cálculo explícito de offset para NestJS (TypeORM/Prisma skip & take)
    const skip = (this.paginaActual() - 1) * this.limite();

    this.revisionService.getFichasPaginadas(
      skip,
      this.limite(),
      this.searchTerm(),
      this.estadoFiltro()
    ).subscribe({
      next: (response: FichasPaginadasResponse) => {
        this.fichas.set(response.data || []);
        this.totalRegistros.set(response.total || 0);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Error al cargar fichas paginadas:', err);
        this.isLoading.set(false);
      }
    });
  }

  verDetalleFicha(ficha: FichaRevision): void {
    this.fichaSeleccionada.set(ficha);
    this.tabActiva.set('DETALLE');
    this.comentarioCambio.set('');

    this.revisionService.getRespuestasPorFicha(ficha.id).subscribe({
      next: (respuestas) => this.respuestasFicha.set(respuestas),
      error: (err) => console.error('Error al cargar respuestas:', err)
    });

    this.cargarHistorial(ficha.id);
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
    if (!ficha) return;

    this.guardandoEstado.set(true);

    this.revisionService.actualizarEstadoFicha(ficha.id, nuevoEstado, this.comentarioCambio()).subscribe({
      next: (fichaActualizada) => {
        this.guardandoEstado.set(false);
        this.fichaSeleccionada.set(fichaActualizada);
        this.cargarHistorial(ficha.id);
        this.cargarFichas(); // Recargar lista paginada para reflejar cambios
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
  }
}