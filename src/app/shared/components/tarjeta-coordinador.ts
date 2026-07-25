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
      <div class="bg-blue-50 border border-blue-200 rounded-xl p-5 shadow-sm my-4">
        <div class="flex items-center gap-3 mb-2">
          <i class="fas fa-user-tie text-blue-600 text-xl"></i>
          <h3 class="text-md font-bold text-blue-900 margin-0">{{ perfil()?.tituloProfesional }}</h3>
        </div>
        <div class="text-sm text-gray-700 space-y-1 pl-8">
          <p class="m-0"><strong>📍 Oficina:</strong> {{ perfil()?.ubicacionOficina }}</p>
          <p class="m-0"><strong>🕒 Horarios:</strong> {{ perfil()?.horarioAtencion }}</p>
          <p class="m-0"><strong>📞 Contacto:</strong> {{ perfil()?.telefonoContacto }}</p>
        </div>
        @if (perfil()?.mensajeAyuda) {
          <div class="mt-3 p-3 bg-white rounded-lg border border-blue-100 text-xs text-blue-800 italic">
            "{{ perfil()?.mensajeAyuda }}"
          </div>
        }
      </div>
    }
  `
})
export class TarjetaCoordinador implements OnInit {
  @Input({ required: true }) coordinadorUsuarioId!: number;
  private readonly perfilService = inject(PerfilCoordinadorService);

  perfil = signal<PerfilCoordinador | null>(null);

  ngOnInit(): void {
    if (this.coordinadorUsuarioId) {
      this.perfilService.getPerfilByUsuario(this.coordinadorUsuarioId.toString()).subscribe({
        next: (data: PerfilCoordinador) => this.perfil.set(data),
        error: (err: unknown) => console.error('Error al cargar información del coordinador:', err)
      });
    }
  }
}