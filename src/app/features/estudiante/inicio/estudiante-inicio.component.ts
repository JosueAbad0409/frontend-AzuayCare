import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FichaService } from '../../../core/services/ficha.service';
import { AuthService } from '../../../core/services/auth.service';
import { HistorialEstadoService } from '../../../core/services/historial-estado.service';
import { HistorialEstadoFicha } from '../../../core/models/historial-estado.model';
import { FichaRevision } from '../../../core/models/revision-ficha.model';
import { TarjetaCoordinador } from '../../../shared/components/tarjeta-coordinador';

@Component({
  selector: 'app-estudiante-inicio',
  standalone: true,
  imports: [CommonModule, RouterModule, TarjetaCoordinador],
  templateUrl: './estudiante-inicio.component.html'
})
export class EstudianteInicioComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly fichaService = inject(FichaService);
  private readonly historialService = inject(HistorialEstadoService);

  usuarioNombre = signal<string>('Usuario');
  usuarioRol = signal<string>('ESTUDIANTE');
  coordinadorId = signal<string>('');
  fichaActiva = signal<FichaRevision | null>(null);
  historialRevisiones = signal<HistorialEstadoFicha[]>([]);

  esEstudianteInstitucional = computed(() => this.usuarioRol() === 'ESTUDIANTE');

  ngOnInit(): void {
    const user = this.authService.user();
    if (user) {
      this.usuarioNombre.set(user.nombre || 'Usuario');
      this.usuarioRol.set(user.rol || 'ESTUDIANTE');
      this.coordinadorId.set(user.carrera_id || '');
    }

    this.fichaService.getMisFichas().subscribe({
      next: (fichas) => {
        const activa = fichas.find(f => f.estado_ficha === 'BORRADOR' || f.estado_ficha === 'ENVIADA');
        if (activa) {
          this.fichaActiva.set(activa);
          this.cargarHistorialObservaciones(activa.id);
        }
      }
    });
  }

  cargarHistorialObservaciones(fichaId: string): void {
    this.historialService.getHistorialByFicha(fichaId).subscribe({
      next: (historial) => this.historialRevisiones.set(historial),
      error: (err) => console.error('Error al cargar historial de revisiones:', err)
    });
  }

  fichaEstadoTexto(): string {
    const estado = this.fichaActiva()?.estado_ficha;
    switch (estado) {
      case 'BORRADOR': return 'BORRADOR EN PROCESO';
      case 'ENVIADA': return 'ENVIADA A BIENESTAR';
      case 'VALIDADO': return 'VALIDADO';
      case 'RECHAZADO': return 'DEVUELTA CON OBSERVACIONES';
      default: return 'SIN INICIAR';
    }
  }

  fichaEstadoClass(): string {
    const estado = this.fichaActiva()?.estado_ficha;
    switch (estado) {
      case 'BORRADOR': return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
      case 'ENVIADA': return 'bg-blue-500/15 text-blue-400 border-blue-500/30';
      case 'VALIDADO': return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
      case 'RECHAZADO': return 'bg-red-500/15 text-red-400 border-red-500/30';
      default: return 'bg-slate-700/50 text-slate-400 border-slate-600';
    }
  }

  fichaEstadoDescripcion(): string {
    const estado = this.fichaActiva()?.estado_ficha;
    switch (estado) {
      case 'BORRADOR': return 'Tienes una ficha en borrador. Completa todos los campos obligatorios y presiona enviar.';
      case 'ENVIADA': return 'Tu ficha ha sido receptada exitosamente por el departamento de Bienestar Estudiantil.';
      case 'VALIDADO': return 'Tu ficha socioeconómica ha sido revisada y aprobada para este periodo lectivo.';
      case 'RECHAZADO': return 'Tu ficha fue devuelta por Bienestar Estudiantil. Revisa las observaciones adjuntas y vuelve a enviarla.';
      default: return 'Aún no has completado tu ficha socioeconómica para el periodo lectivo activo.';
    }
  }
}