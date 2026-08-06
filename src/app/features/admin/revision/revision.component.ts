import { 
  Component, 
  OnInit, 
  inject, 
  signal, 
  computed, 
  ChangeDetectionStrategy 
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RevisionService } from '../../../core/services/revision.service';
import { HistorialEstadoService } from '../../../core/services/historial-estado.service';
import { FichaRevision, EstadoFicha } from '../../../core/models/revision-ficha.model';
import { HistorialEstadoFicha } from '../../../core/models/historial-estado.model';
import { Router } from '@angular/router';

@Component({
  selector: 'app-revision',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './revision.component.html',
  styleUrls: ['./revision.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RevisionComponent implements OnInit {
  private readonly revisionService = inject(RevisionService);
  private readonly historialService = inject(HistorialEstadoService);
  private readonly router = inject(Router);

  // Estado principal: Guarda TODAS las fichas traídas del servidor
  fichas = signal<FichaRevision[]>([]);
  isLoading = signal<boolean>(true);

  // Controles de interfaz
  searchTerm = signal<string>('');
  estadoFiltro = signal<string>('TODOS');
  paginaActual = signal<number>(1);
  limite = signal<number>(10);

  // 1. FILTRO COMPUTADO (Igual que en usuarios)
  fichasFiltradas = computed(() => {
    const term = this.searchTerm().toLowerCase().trim();
    const estado = this.estadoFiltro();

    return this.fichas().filter(f => {
      // Filtrar por estado
      if (estado !== 'TODOS' && f.estado_ficha !== estado) return false;

      // Filtrar por texto
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

  // 2. PAGINACIÓN EN MEMORIA COMPUTADA
  totalRegistros = computed(() => this.fichasFiltradas().length);
  totalPaginas = computed(() => Math.ceil(this.totalRegistros() / this.limite()) || 1);
  
  fichasPaginadas = computed(() => {
    const inicio = (this.paginaActual() - 1) * this.limite();
    const fin = inicio + this.limite();
    return this.fichasFiltradas().slice(inicio, fin);
  });

  // Estado del Modal y Detalle
  fichaSeleccionada = signal<FichaRevision | null>(null);
  respuestasFicha = signal<any[]>([]);
  historialFicha = signal<HistorialEstadoFicha[]>([]);
  tabActiva = signal<'DETALLE' | 'HISTORIAL'>('DETALLE');
  comentarioCambio = signal<string>('');
  guardandoEstado = signal<boolean>(false);

  ngOnInit(): void {
    this.cargarTodasLasFichas();
  }

  onSearchChange(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.searchTerm.set(value);
    this.paginaActual.set(1); // Regresa a la página 1 al buscar
  }

  onEstadoChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.estadoFiltro.set(value);
    this.paginaActual.set(1); // Regresa a la página 1 al filtrar
  }

  cambiarPagina(nuevaPagina: number): void {
    if (nuevaPagina >= 1 && nuevaPagina <= this.totalPaginas()) {
      this.paginaActual.set(nuevaPagina);
    }
  }

  cargarTodasLasFichas(): void {
    this.isLoading.set(true);
    
    // Pedimos un límite muy alto para traer todo a la memoria (ej: 10,000)
    // Ya no enviamos el search ni el estado, traemos TODO.
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
    if (!ficha) return;

    this.guardandoEstado.set(true);

    this.revisionService.actualizarEstadoFicha(ficha.id, nuevoEstado, this.comentarioCambio()).subscribe({
      next: (fichaActualizada) => {
        this.guardandoEstado.set(false);
        this.fichaSeleccionada.set(fichaActualizada);
        this.cargarHistorial(ficha.id);
        
        // Actualizamos la ficha localmente en memoria sin volver a llamar al servidor
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