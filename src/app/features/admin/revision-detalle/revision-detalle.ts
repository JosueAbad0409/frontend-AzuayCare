import {
  Component,
  OnInit,
  inject,
  signal,
  ChangeDetectionStrategy
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { RevisionService } from '../../../core/services/revision.service';
import { HistorialEstadoService } from '../../../core/services/historial-estado.service';
import { FichaRevision, EstadoFicha } from '../../../core/models/revision-ficha.model';
import { HistorialEstadoFicha } from '../../../core/models/historial-estado.model';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-revision-detalle',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './revision-detalle.html',
  styleUrls: ['./revision-detalle.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RevisionDetalleComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly revisionService = inject(RevisionService);
  private readonly historialService = inject(HistorialEstadoService);
  private readonly toastService = inject(ToastService);

  ficha = signal<FichaRevision | null>(null);
  respuestas = signal<any[]>([]);
  historial = signal<HistorialEstadoFicha[]>([]);
  isLoading = signal(true);
  tabActiva = signal<'DETALLE' | 'HISTORIAL'>('DETALLE');
  comentario = signal('');
  guardando = signal(false);

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.router.navigate(['/admin/revision-fichas']);
      return;
    }
    this.cargarTodo(id);
  }

  private cargarTodo(id: string): void {
    this.isLoading.set(true);

    this.revisionService.getFichaDetalle(id).subscribe({
      next: (ficha) => {
        this.ficha.set(ficha);
        this.isLoading.set(false);
      },
      error: () => {
        this.toastService.show('No se pudo cargar la ficha.', 'error');
        this.router.navigate(['/admin/revision-fichas']);
      }
    });

    this.revisionService.getRespuestasPorFicha(id).subscribe({
      next: (r) => this.respuestas.set(r),
      error: (err) => console.error('Error respuestas:', err)
    });

    this.historialService.getHistorialByFicha(id).subscribe({
      next: (h) => this.historial.set(h),
      error: (err) => console.error('Error historial:', err)
    });
  }

  setTab(tab: 'DETALLE' | 'HISTORIAL'): void {
    this.tabActiva.set(tab);
  }

  cambiarEstado(nuevoEstado: EstadoFicha): void {
    const f = this.ficha();
    if (!f) return;

    this.guardando.set(true);
    this.revisionService.actualizarEstadoFicha(f.id, nuevoEstado, this.comentario()).subscribe({
      next: (actualizada) => {
        this.ficha.set(actualizada);
        this.guardando.set(false);
        this.comentario.set('');
        this.toastService.show(
          nuevoEstado === 'VALIDADO' ? 'Ficha validada con éxito.' : 'Ficha rechazada.',
          nuevoEstado === 'VALIDADO' ? 'success' : 'info'
        );
        // Recargar historial
        this.historialService.getHistorialByFicha(f.id).subscribe({
          next: (h) => this.historial.set(h)
        });
      },
      error: (err) => {
        console.error(err);
        this.guardando.set(false);
        this.toastService.show('Error al cambiar el estado.', 'error');
      }
    });
  }

  volver(): void {
    this.router.navigate(['/admin/revision-fichas']);
  }
}