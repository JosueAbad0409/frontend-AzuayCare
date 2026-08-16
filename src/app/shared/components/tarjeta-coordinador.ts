import { Component, Input, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PerfilCoordinadorService } from '../../core/services/perfil-coordinador.service';
import { PerfilCoordinador } from '../../core/models/perfil-coordinador.model';

@Component({
  selector: 'app-tarjeta-coordinador',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (perfil()) {
      <article class="surface-card">
        <header class="card-header">
          <i class="fas fa-user-tie text-accent"></i>
          <h3 class="card-title">{{ perfil()?.tituloProfesional || perfil()?.['titulo_profesional'] }}</h3>
        </header>
        <div class="card-details">
          <p><strong>📍 Oficina:</strong> {{ perfil()?.ubicacionOficina || perfil()?.['ubicacion_oficina'] }}</p>
          <p><strong>🕒 Horarios:</strong> {{ perfil()?.horarioAtencion || perfil()?.['horario_atencion'] }}</p>
          <p><strong>📞 Contacto:</strong> {{ perfil()?.telefonoContacto || perfil()?.['telefono_contacto'] }}</p>
        </div>
        @if (perfil()?.mensajeAyuda || perfil()?.['mensaje_ayuda_estudiantes']) {
          <div class="card-message">
            "{{ perfil()?.mensajeAyuda || perfil()?.['mensaje_ayuda_estudiantes'] }}"
          </div>
        }
      </article>
    }
  `,
  styles: [`
    .surface-card {
      margin: 1rem 0;
      padding: 1.25rem;
    }
    .card-header {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      margin-bottom: 0.75rem;
    }
    .text-accent {
      color: var(--accent-purple);
      font-size: 1.25rem;
    }
    .card-title {
      margin: 0;
      font-size: 1rem;
      font-weight: 700;
      color: var(--text-strong);
    }
    .card-details {
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
      font-size: 0.875rem;
      color: var(--text-secondary);
    }
    .card-details p {
      margin: 0;
    }
    .card-message {
      margin-top: 0.75rem;
      padding: 0.75rem;
      background: var(--surface-1);
      border: 1px solid var(--border-color);
      border-radius: var(--radius-sm);
      font-size: 0.8rem;
      color: var(--text-muted);
      font-style: italic;
    }
  `]
})
export class TarjetaCoordinador implements OnInit {
  @Input({ required: true }) coordinadorUsuarioId!: string;
  private readonly perfilService = inject(PerfilCoordinadorService);

  perfil = signal<PerfilCoordinador | any | null>(null);

  ngOnInit(): void {
    if (this.coordinadorUsuarioId) {
      this.perfilService.getPerfilByUsuario(this.coordinadorUsuarioId).subscribe({
        next: (data) => this.perfil.set(data),
        error: (err) => console.error(err)
      });
    }
  }
}