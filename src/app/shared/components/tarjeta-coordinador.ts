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
      <div class="bg-slate-800/80 border border-slate-700/80 rounded-xl p-5 shadow-sm my-4 text-slate-200">
        <div class="flex items-center gap-3 mb-2">
          <i class="fas fa-user-tie text-emerald-400 text-xl"></i>
          <h3 class="text-md font-bold text-emerald-300 m-0">{{ perfil()?.tituloProfesional || perfil()?.['titulo_profesional'] }}</h3>
        </div>
        <div class="text-sm text-slate-300 space-y-1 pl-8">
          <p class="m-0"><strong>📍 Oficina:</strong> {{ perfil()?.ubicacionOficina || perfil()?.['ubicacion_oficina'] }}</p>
          <p class="m-0"><strong>🕒 Horarios:</strong> {{ perfil()?.horarioAtencion || perfil()?.['horario_atencion'] }}</p>
          <p class="m-0"><strong>📞 Contacto:</strong> {{ perfil()?.telefonoContacto || perfil()?.['telefono_contacto'] }}</p>
        </div>
        @if (perfil()?.mensajeAyuda || perfil()?.['mensaje_ayuda_estudiantes']) {
          <div class="mt-3 p-3 bg-slate-900/90 rounded-lg border border-slate-700 text-xs text-emerald-200 italic">
            "{{ perfil()?.mensajeAyuda || perfil()?.['mensaje_ayuda_estudiantes'] }}"
          </div>
        }
      </div>
    }
  `
})
export class TarjetaCoordinador implements OnInit {
  @Input({ required: true }) coordinadorUsuarioId!: string;
  private readonly perfilService = inject(PerfilCoordinadorService);

  perfil = signal<PerfilCoordinador | any | null>(null);

  ngOnInit(): void {
    if (this.coordinadorUsuarioId) {
      this.perfilService.getPerfilByUsuario(this.coordinadorUsuarioId).subscribe({
        next: (data) => this.perfil.set(data),
        error: (err) => console.error('Error al cargar información del coordinador:', err)
      });
    }
  }
}