import { Component, OnInit, inject, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RevisionService } from '../../../core/services/revision/revision.service';
import { HistorialEstadoService } from '../../../core/services/historial-estado/historial-estado.service';
import { FichaRevision } from '../../../core/models/revision-ficha.model';
import { HistorialEstadoFicha } from '../../../core/models/historial-estado.model';

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

  fichas = signal<FichaRevision[]>([]);
  isLoading = signal<boolean>(true);
  searchTerm = signal<string>('');
  
  fichaSeleccionada = signal<FichaRevision | null>(null);
  respuestasFicha = signal<any[]>([]);
  historialFicha = signal<HistorialEstadoFicha[]>([]);
  
  tabActiva = signal<'DETALLE' | 'HISTORIAL'>('DETALLE');
  comentarioCambio = signal<string>('');
  guardandoEstado = signal<boolean>(false);

  fichasFiltradas = computed(() => {
    const term = this.searchTerm().toLowerCase().trim();
    if (!term) return this.fichas();
    return this.fichas().filter(f => {
      const nombre = `${f.usuario?.primer_nombre || ''} ${f.usuario?.primer_apellido || ''}`.toLowerCase();
      const cedula = (f.usuario?.cedula || '').toLowerCase();
      const email = (f.usuario?.email_institucional || '').toLowerCase();
      return nombre.includes(term) || cedula.includes(term) || email.includes(term);
    });
  });

  ngOnInit(): void {
    this.cargarFichas();
  }

  onSearchChange(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.searchTerm.set(value);
  }

  cargarFichas(): void {
    this.isLoading.set(true);
    this.revisionService.getTodasLasFichas().subscribe({
      next: (data) => {
        this.fichas.set(data);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Error al cargar fichas:', err);
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

  cambiarEstado(nuevoEstado: 'VALIDADO' | 'RECHAZADO' | 'BORRADOR'): void {
    const ficha = this.fichaSeleccionada();
    if (!ficha) return;

    this.guardandoEstado.set(true);
    this.revisionService.actualizarEstadoFicha(ficha.id, nuevoEstado, this.comentarioCambio()).subscribe({
      next: (fichaActualizada) => {
        this.guardandoEstado.set(false);
        this.fichaSeleccionada.set(fichaActualizada);
        this.cargarHistorial(ficha.id);
        this.cargarFichas();
      },
      error: (err) => {
        console.error('Error al actualizar estado:', err);
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