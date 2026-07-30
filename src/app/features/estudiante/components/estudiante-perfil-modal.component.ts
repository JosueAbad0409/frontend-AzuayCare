import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { EstudiantePerfil } from '../../../core/models/estudiante-perfil.model';

@Component({
  selector: 'app-estudiante-perfil-modal',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (visible) {
      <div class="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 animate-pop">
        <!-- Fondo Oscuro con Desenfoque -->
        <div class="absolute inset-0 bg-slate-950/80 backdrop-blur-md" (click)="onCerrarModal()"></div>
        
        <!-- Tarjeta del Modal -->
        <div class="relative w-full max-w-lg bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl overflow-hidden flex flex-col z-10">
          
          <!-- Línea Decorativa -->
          <div class="h-2 w-full bg-gradient-to-r from-emerald-400 to-teal-500"></div>

          <!-- Encabezado del Modal -->
          <div class="px-6 py-5 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
            <h3 class="text-lg font-black text-white flex items-center gap-2">
              <i class="fas fa-id-badge text-emerald-400"></i> Mi Perfil Estudiantil
            </h3>
            <button (click)="onCerrarModal()" class="w-8 h-8 flex items-center justify-center rounded-xl bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors">
              <i class="fas fa-times"></i>
            </button>
          </div>

          <!-- Cuerpo del Modal -->
          <div class="p-6 space-y-6 bg-slate-900">
            <!-- Avatar y Datos Principales -->
            <div class="flex items-center gap-4">
              <div class="w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 text-2xl font-black shadow-inner">
                {{ perfil?.correo?.charAt(0)?.toUpperCase() || 'U' }}
              </div>
              <div>
                <h4 class="text-base font-extrabold text-white break-all">{{ perfil?.correo }}</h4>
                <div class="flex gap-2 mt-1.5">
                  <span class="px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-widest bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    {{ perfil?.rol }}
                  </span>
                  <span class="px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-widest bg-blue-500/10 text-blue-400 border border-blue-500/20">
                    {{ perfil?.estadoMatricula }}
                  </span>
                </div>
              </div>
            </div>

            <!-- Matriz de Detalles -->
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div class="bg-slate-800/50 border border-slate-700/50 rounded-xl p-3.5">
                <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Identificación</span>
                <p class="font-bold text-slate-200 text-sm">{{ perfil?.cedula }}</p>
              </div>

              <div class="bg-slate-800/50 border border-slate-700/50 rounded-xl p-3.5">
                <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Periodo Académico</span>
                <p class="font-bold text-slate-200 text-sm">{{ perfil?.periodoAcademico }}</p>
              </div>

              <div class="bg-slate-800/50 border border-slate-700/50 rounded-xl p-3.5 sm:col-span-2">
                <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Carrera Asignada</span>
                <p class="font-bold text-emerald-300 text-sm">{{ perfil?.carrera }}</p>
              </div>
            </div>
          </div>

          <!-- Pie del Modal -->
          <div class="px-6 py-4 bg-slate-950/60 border-t border-slate-800 flex justify-end">
            <button type="button" (click)="onCerrarModal()" class="px-5 py-2 bg-slate-800 text-slate-200 hover:bg-slate-700 hover:text-white rounded-xl text-xs font-bold transition-all">
              Cerrar
            </button>
          </div>

        </div>
      </div>
    }
  `,
  styles: [`
    .animate-pop { animation: popIn 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
    @keyframes popIn {
      from { opacity: 0; transform: scale(0.95); }
      to { opacity: 1; transform: scale(1); }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EstudiantePerfilModalComponent {
  @Input({ required: true }) perfil!: EstudiantePerfil | null;
  @Input() visible: boolean = false;
  @Output() cerrar = new EventEmitter<void>();

  onCerrarModal(): void {
    this.cerrar.emit();
  }
}